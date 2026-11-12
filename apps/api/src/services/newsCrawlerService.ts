import Parser from 'rss-parser';
import { prisma } from '../db/prisma';
import { ReportCategory } from '@prisma/client';
import { resolveLocationFromText } from './geocodingService';
import { classifyNewsText } from './newsClassifierService';
import { isForeignIncident } from './internationalIncidentFilter';
import { crossVerifyCitizenReports } from './newsVerificationService';
import { findDuplicateActiveReport } from './incidentDeduplicationService';
import { emitNewReport } from '../sockets';

const parser = new Parser({
  headers: {
    'User-Agent': 'DangerZoneBD-PublicSafetyNewsCrawler/1.0 (contact@dangerzonebd.org)',
  },
  timeout: 10000,
});

export const PUBLIC_NEWS_FEEDS = [
  {
    name: 'Google News BD Crime',
    url: 'https://news.google.com/rss/search?q=(crime+OR+mugging+OR+robbery+OR+%22road+accident%22)+bangladesh+-saudi+-india+-overseas+when:1d&hl=en-BD&gl=BD&ceid=BD:en',
  },
  {
    name: 'Google News BD Safety (Bangla)',
    // Explicitly scope to Bangladesh and exclude expatriate/overseas indicators
    url: 'https://news.google.com/rss/search?q=(%E0%A6%9B%E0%A6%BF%E0%A6%A8%E0%A6%A4%E0%A6%BE%E0%A6%87+OR+%E0%A6%A1%E0%A6%BE%E0%A6%95%E0%A6%BE%E0%A6%A4%E0%A6%BF+OR+%E0%A6%B8%E0%A6%82%E0%A6%98%E0%A6%B0%E0%A7%8D%E0%A6%B7+OR+%22%E0%A6%B8%E0%A7%9C%E0%A6%95+%E0%A6%A6%E0%A7%81%E0%A6%B0%E0%A7%8D%E0%A6%98%E0%A6%9F%E0%A6%A8%E0%A6%BE%22)+%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6+-%E0%A6%B8%E0%A7%8C%E0%A6%A6%E0%A6%BF+-%E0%A6%AD%E0%A6%BE%E0%A6%B0%E0%A6%A4+-%E0%A6%AA%E0%A7%8D%E0%A6%B0%E0%A6%AC%E0%A6%BE%E0%A6%B8%E0%A7%80+when:1d&hl=bn&gl=BD&ceid=BD:bn',
  },
  {
    name: 'The Daily Star Law & Crime',
    url: 'https://www.thedailystar.net/law-our-rights/rss.xml',
  },
];

const NEWS_BOT_EMAIL = 'news-crawler-bot@safety.bd';
let cachedBotUserId: string | null = null;

/**
 * Ensures system news-crawler bot user exists with VERIFIED_RESPONDER privileges
 */
export const getOrCreateNewsBotUser = async (): Promise<string> => {
  if (cachedBotUserId) {
    return cachedBotUserId;
  }

  let bot = await prisma.user.findUnique({
    where: { email: NEWS_BOT_EMAIL },
  });

  if (!bot) {
    bot = await prisma.user.create({
      data: {
        email: NEWS_BOT_EMAIL,
        anonymousId: 'news-crawler-bot-system-v1',
        role: 'VERIFIED_RESPONDER',
        isVerified: true,
        trustScore: 100,
      },
    });
  }

  cachedBotUserId = bot.id;
  return bot.id;
};

export interface RawNewsItem {
  guid: string;
  title: string;
  link: string;
  pubDate?: string | Date;
  contentSnippet?: string;
  sourceName: string;
}

/**
 * Returns the active map lifespan (in hours) based on incident category.
 * - Acute traffic incidents: 48 hours
 * - Acute violent / property crimes: 72 hours (3 days)
 * - Recurring social / syndicate hazards: 7 days (168 hours)
 * - Infrastructure hazards: 14 days (336 hours)
 */
export const getNewsCategoryLifespanHours = (category: ReportCategory): number => {
  switch (category) {
    case 'ROAD_ACCIDENT':
      return 48; // 48 hours (2 days)
    case 'SNATCHING':
    case 'ROBBERY':
    case 'THEFT_ROBBERY':
    case 'ARMED_ASSAULT':
    case 'SNATCHING_ARMED_ASSAULT':
    case 'THEFT':
    case 'EXTORTION':
    case 'MUGGING':
    case 'DACOITY':
    case 'THEFT_DACOITY':
      return 72; // 72 hours (3 days)
    case 'YOUTH_GANG_ACTIVITY':
    case 'DRUG_RELATED_CRIME':
    case 'TEEN_GANG':
    case 'TEEN_GANG_ARMED_ASSAULT':
    case 'DRUG_ACTIVITY':
      return 168; // 7 days (168 hours)
    case 'UNLIT_ROAD':
      return 336; // 14 days (336 hours)
    default:
      return 72;
  }
};

/**
 * Computes the expiration date for a news-originated incident report.
 * Guarantees at least 24 hours of visibility from time of ingestion even if
 * the article publication date was several days in the past.
 */
export const calculateNewsReportExpiry = (
  category: ReportCategory,
  publishedAt: Date = new Date(),
  now: Date = new Date()
): Date => {
  const lifespanHours = getNewsCategoryLifespanHours(category);
  const lifespanMs = lifespanHours * 60 * 60 * 1000;
  const candidateExpiry = new Date(publishedAt.getTime() + lifespanMs);

  // Grant at least 24 hours of live map presence from current ingestion time
  const minFutureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (candidateExpiry.getTime() < minFutureExpiry.getTime()) {
    return minFutureExpiry;
  }

  return candidateExpiry;
};

/**
 * Ingests and processes an array of news items:
 * 1. Batch deduplicates against NewsArticle.guid to eliminate DB round-trip overhead.
 * 2. Filters out articles older than 7 days.
 * 3. Classifies category and severity via bilingual classifier.
 * 4. Resolves Bangladesh coordinates via landmark dictionary / Nominatim.
 * 5. Saves Report and NewsArticle in database.
 * 6. Executes cross-verification against active citizen reports.
 * 7. Broadcasts real-time NEW_REPORT event.
 */
export const processAndIngestNewsItems = async (
  items: RawNewsItem[]
): Promise<{ ingested: number; skipped: number; verifiedMatches: number }> => {
  const botUserId = await getOrCreateNewsBotUser();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let ingested = 0;
  let skipped = 0;
  let verifiedMatches = 0;

  // Batch deduplication check in a single query
  const allGuids = items.map((i) => i.guid || i.link).filter(Boolean);
  const existingArticles = await prisma.newsArticle.findMany({
    where: { guid: { in: allGuids } },
    select: { guid: true },
  });
  const existingGuidSet = new Set(existingArticles.map((a) => a.guid));

  for (const item of items) {
    const guid = item.guid || item.link;
    if (!guid || !item.title) {
      skipped++;
      continue;
    }

    // 1. Deduplication check
    if (existingGuidSet.has(guid)) {
      skipped++;
      continue;
    }

    // 2. Date check: max 7 days old
    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
    if (publishedAt < sevenDaysAgo) {
      skipped++;
      continue;
    }

    // 3. Domestic Incident Boundary Check (Strictly exclude overseas/expatriate news)
    const foreignCheck = isForeignIncident(item.title, item.contentSnippet || '');
    if (foreignCheck.isForeign) {
      console.log(
        `[News Crawler] 🌍 Skipping overseas incident: "${item.title.substring(0, 65)}..." (Matched: ${foreignCheck.matchedTerm})`
      );
      skipped++;
      continue;
    }

    // 4. Bilingual classification
    const classification = classifyNewsText(item.title, item.contentSnippet || '');
    if (!classification.isSafetyRelated) {
      skipped++;
      continue;
    }

    // 5. Domestic Geocoding resolution (Headline priority + victim residence exclusion)
    const geocode = await resolveLocationFromText(item.title, item.contentSnippet || '');
    if (!geocode) {
      // Cannot plot on map without verified Bangladesh coordinates
      skipped++;
      continue;
    }

    // 5. Expiration: Category-specific active lifecycle
    const expiresAt = calculateNewsReportExpiry(classification.category, publishedAt);

    // 6. Clean headline and content
    const cleanTitle = item.title.replace(/^\[(?:Google News[^\]]*|The Daily Star[^\]]*)\]\s*/i, '').trim();
    const cleanDesc = (item.contentSnippet || item.title).replace(/^\[(?:Google News[^\]]*|The Daily Star[^\]]*)\]\s*/i, '').trim();

    // 7. Cross-Outlet Semantic Deduplication:
    // If another news agency already reported on this exact same accident/crime in this area,
    // consolidate under the existing report instead of scattering duplicate pins across the map.
    const duplicateMatch = await findDuplicateActiveReport({
      title: cleanTitle,
      category: classification.category,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    });

    if (duplicateMatch) {
      const { existingReport, sharedTokens } = duplicateMatch;
      console.log(
        `[News Crawler] 🔄 Consolidated duplicate story from "${item.sourceName}": "${cleanTitle.substring(0, 60)}..." -> Merged with Report ${existingReport.id} (Shared: ${sharedTokens.join(', ')})`
      );

      // Create NewsArticle record (unlinked via null reportId to prevent unique constraint conflict)
      await prisma.newsArticle.create({
        data: {
          guid,
          title: item.title,
          sourceUrl: item.link,
          sourceName: item.sourceName,
          publishedAt,
          category: classification.category,
          severity: classification.severity,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          reportId: null,
        },
      });

      // Format source names to credit multiple outlets
      const currentSources = existingReport.sourceName || '';
      const cleanOutlet = item.sourceName.replace(/^Google News BD[^:]*:\s*/i, '').trim();
      let updatedSources = currentSources;
      if (cleanOutlet && !currentSources.includes(cleanOutlet)) {
        updatedSources = `${currentSources}, ${cleanOutlet}`.replace(/^,\s*/, '');
      }

      // If existing report was previously misclassified (e.g. ARMED_ASSAULT instead of ROAD_ACCIDENT), fix it:
      const updatedCategory =
        existingReport.category === 'ARMED_ASSAULT' && classification.category === 'ROAD_ACCIDENT'
          ? 'ROAD_ACCIDENT'
          : existingReport.category;

      await prisma.report.update({
        where: { id: existingReport.id },
        data: {
          category: updatedCategory,
          sourceName: updatedSources,
          upvotes: { increment: 2 }, // Multi-press verification confidence boost
        },
      });

      // Add a context update linking the confirming news outlet
      await prisma.reportUpdate.create({
        data: {
          reportId: existingReport.id,
          userId: botUserId,
          content: `অতিরিক্ত প্রেস নিশ্চিতকরণ (${cleanOutlet || item.sourceName}): "${cleanTitle}"`,
        },
      });

      existingGuidSet.add(guid);
      skipped++;
      continue;
    }

    const report = await prisma.report.create({
      data: {
        userId: botUserId,
        category: classification.category,
        severity: classification.severity,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        description: cleanDesc,
        sourceUrl: item.link,
        sourceName: item.sourceName,
        expiresAt,
      },
    });

    // Populate PostGIS geography point for spatial GIST indexing
    await prisma.$executeRaw`
      UPDATE "Report"
      SET location = ST_SetSRID(ST_MakePoint(${geocode.longitude}, ${geocode.latitude}), 4326)::geography
      WHERE id = ${report.id}
    `;

    await prisma.newsArticle.create({
      data: {
        guid,
        title: item.title,
        sourceUrl: item.link,
        sourceName: item.sourceName,
        publishedAt,
        category: classification.category,
        severity: classification.severity,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        reportId: report.id,
      },
    });

    existingGuidSet.add(guid);
    ingested++;

    // 7. Cross-Verification with active citizen reports
    const verifyResult = await crossVerifyCitizenReports({
      id: report.id,
      category: report.category,
      latitude: report.latitude,
      longitude: report.longitude,
      sourceName: item.sourceName,
      sourceUrl: item.link,
      title: item.title,
    });
    verifiedMatches += verifyResult.matchedCount;

    // 8. Real-time broadcast
    emitNewReport({
      id: report.id,
      category: report.category,
      severity: report.severity,
      latitude: report.latitude,
      longitude: report.longitude,
      description: report.description,
      upvotes: report.upvotes,
      downvotes: report.downvotes,
      status: report.status,
      expiresAt: report.expiresAt,
      createdAt: report.createdAt,
      sourceUrl: report.sourceUrl,
      sourceName: report.sourceName,
      isGpsVerified: report.isGpsVerified,
    });
  }

  return { ingested, skipped, verifiedMatches };
};

/**
 * Crawls all configured public RSS feeds across Bangladesh and ingests verified incident stories
 */
const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if (typeof val._ === 'string') return val._.trim();
    if (typeof val.value === 'string') return val.value.trim();
    if (typeof val.$t === 'string') return val.$t.trim();
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  }
  return String(val).trim();
};

export const crawlAllNewsFeeds = async (): Promise<{
  feedsChecked: number;
  totalIngested: number;
  totalSkipped: number;
  totalVerifiedMatches: number;
}> => {
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalVerifiedMatches = 0;
  let feedsChecked = 0;

  for (const feedConfig of PUBLIC_NEWS_FEEDS) {
    try {
      feedsChecked++;
      const feed = await parser.parseURL(feedConfig.url);

      const items: RawNewsItem[] = (feed.items || []).map((item) => ({
        guid: safeString(item.guid || item.link || item.title),
        title: safeString(item.title),
        link: safeString(item.link),
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        contentSnippet: safeString(item.contentSnippet || item.content),
        sourceName: feedConfig.name,
      }));

      const result = await processAndIngestNewsItems(items);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;
      totalVerifiedMatches += result.verifiedMatches;
    } catch (feedErr) {
      console.warn(`[News Crawler] Failed to fetch feed "${feedConfig.name}":`, feedErr);
    }
  }

  return {
    feedsChecked,
    totalIngested,
    totalSkipped,
    totalVerifiedMatches,
  };
};
