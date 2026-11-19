import Parser from 'rss-parser';
import { prisma } from '../db/prisma';
import { ReportCategory } from '@prisma/client';
import { resolveLocationFromText } from './geocodingService';
import { classifyNewsText } from './newsClassifierService';
import { isForeignIncident } from './internationalIncidentFilter';
import { crossVerifyCitizenReports } from './newsVerificationService';
import { findDuplicateActiveReport, normalizeCanonicalUrl, cleanIncidentTitle } from './incidentDeduplicationService';
import { emitNewReport } from '../sockets';
import { broadcastPlatformStats } from './statsService';
import { setReportLocation } from '../db/spatialUtils';
import { newsObservabilityService, CrawlRunRecorder } from './newsObservabilityService';

const parser = new Parser({
  headers: {
    'User-Agent': 'DangerZoneBD-PublicSafetyNewsCrawler/1.0 (contact@dangerzonebd.org)',
  },
  timeout: 10000,
});

export interface FeedConfig {
  name: string;
  category: ReportCategory;
  categoryHint: ReportCategory;
  url: string;
  timeoutMs?: number;
}

export const buildGoogleNewsRssUrl = (query: string, lang: 'bn' | 'en' = 'en'): string => {
  const encodedQuery = encodeURIComponent(query);
  if (lang === 'bn') {
    return `https://news.google.com/rss/search?q=${encodedQuery}&hl=bn&gl=BD&ceid=BD:bn`;
  }
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-BD&gl=BD&ceid=BD:en`;
};

export const DEDICATED_CATEGORY_FEEDS: FeedConfig[] = [
  {
    name: 'Google News BD Theft',
    category: 'THEFT',
    categoryHint: 'THEFT',
    url: buildGoogleNewsRssUrl('(theft OR burglary OR stolen OR "চুরি" OR "চোর" OR "সিঁধেল চুরি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Robbery',
    category: 'ROBBERY',
    categoryHint: 'ROBBERY',
    url: buildGoogleNewsRssUrl('(robbery OR dacoity OR "ডাকাত" OR "ডাকাতি" OR "সশস্ত্র ডাকাত" OR "লুণ্ঠন") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Theft & Robbery',
    category: 'THEFT_ROBBERY',
    categoryHint: 'THEFT_ROBBERY',
    url: buildGoogleNewsRssUrl('("theft and robbery" OR "burglary and robbery" OR "চুরি ও ডাকাতি" OR "চুরি ডাকাতি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching',
    category: 'SNATCHING',
    categoryHint: 'SNATCHING',
    url: buildGoogleNewsRssUrl('(snatching OR mugging OR "ছিনতাই" OR "ছিনতাইকারী" OR "ব্যাগ টান") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Armed Assault',
    category: 'ARMED_ASSAULT',
    categoryHint: 'ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('(assault OR "armed assault" OR "knife attack" OR gunfire OR "কুপিয়ে জখম" OR "ছুরিকাঘাত" OR "গুলিবিদ্ধ" OR "সংঘর্ষ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching & Armed Assault',
    category: 'SNATCHING_ARMED_ASSAULT',
    categoryHint: 'SNATCHING_ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('("armed mugging" OR "violent snatching" OR "ছিনতাই ও হামলা" OR "ছিনতাইকালে কুপিয়ে" OR "ছিনতাইকালে গুলি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Extortion',
    category: 'EXTORTION',
    categoryHint: 'EXTORTION',
    url: buildGoogleNewsRssUrl('(extortion OR "illegal toll" OR "protection money" OR "চাঁদাবাজি" OR "চাঁদা দাবি" OR "চাঁদাবাজ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Youth Gang Activity',
    category: 'YOUTH_GANG_ACTIVITY',
    categoryHint: 'YOUTH_GANG_ACTIVITY',
    url: buildGoogleNewsRssUrl('("youth gang" OR "teen gang" OR "teenage gang" OR "juvenile delinquency" OR "কিশোর গ্যাং" OR "কিশোর অপরাধী") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Drug-Related Crime',
    category: 'DRUG_RELATED_CRIME',
    categoryHint: 'DRUG_RELATED_CRIME',
    url: buildGoogleNewsRssUrl('(narcotics OR "yaba" OR phensedyl OR "মাদক" OR "ইয়াবা" OR "গাঁজা" OR "ফেনসিডিল" OR "মাদক কারবারি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Unlit & Hazardous Road',
    category: 'UNLIT_ROAD',
    categoryHint: 'UNLIT_ROAD',
    url: buildGoogleNewsRssUrl('("unlit road" OR "dark street" OR "street light off" OR "broken road" OR "pothole hazard" OR "অন্ধকার রাস্তা" OR "সড়ক বাতি নেই" OR "ভাঙা রাস্তা") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Road Accident',
    category: 'ROAD_ACCIDENT',
    categoryHint: 'ROAD_ACCIDENT',
    url: buildGoogleNewsRssUrl('("road accident" OR "bus accident" OR "সড়ক দুর্ঘটনা" OR "বাস উল্টে" OR "মুখোমুখি সংঘর্ষ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
];

export const PUBLIC_NEWS_FEEDS: FeedConfig[] = [...DEDICATED_CATEGORY_FEEDS];

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
  categoryHint?: ReportCategory;
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
  items: RawNewsItem[],
  runRecorder?: CrawlRunRecorder
): Promise<{ ingested: number; skipped: number; verifiedMatches: number }> => {
  const botUserId = await getOrCreateNewsBotUser();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let ingested = 0;
  let skipped = 0;
  let verifiedMatches = 0;

  if (runRecorder) {
    runRecorder.recordDiscoveredArticles(items.length);
  }

  // Batch deduplication check in a single query
  const allGuids = items.map((i) => i.guid || normalizeCanonicalUrl(i.link)).filter(Boolean);
  const allUrls = items.map((i) => normalizeCanonicalUrl(i.link)).filter(Boolean);
  const existingArticles = await prisma.newsArticle.findMany({
    where: {
      OR: [
        { guid: { in: allGuids } },
        { sourceUrl: { in: allUrls } },
      ],
    },
    select: { guid: true, sourceUrl: true },
  });
  const existingGuidSet = new Set(existingArticles.map((a) => a.guid));
  const existingUrlSet = new Set(existingArticles.map((a) => a.sourceUrl).filter(Boolean));

  for (const item of items) {
    const canonicalUrl = normalizeCanonicalUrl(item.link);
    const guid = item.guid || canonicalUrl;
    if (!guid || !item.title) {
      skipped++;
      if (runRecorder) runRecorder.recordDuplicateRejection();
      continue;
    }

    // 1. Deduplication check (check both GUID and normalized canonical URL)
    if (existingGuidSet.has(guid) || existingUrlSet.has(canonicalUrl)) {
      skipped++;
      if (runRecorder) runRecorder.recordDuplicateRejection();
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
    const isSafetyRelated = classification.isSafetyRelated || !!item.categoryHint;
    const finalCategory = classification.isSafetyRelated
      ? classification.category
      : (item.categoryHint || classification.category);

    if (!isSafetyRelated) {
      skipped++;
      continue;
    }

    // 5. Domestic Geocoding resolution (Headline priority + victim residence exclusion)
    const geocode = await resolveLocationFromText(item.title, item.contentSnippet || '');
    if (!geocode) {
      // Cannot plot on map without verified Bangladesh coordinates
      if (runRecorder) runRecorder.recordGeocodingFailure();
      skipped++;
      continue;
    }

    if (runRecorder) runRecorder.recordGeocodingSuccess();

    // 5. Expiration: Category-specific active lifecycle
    const expiresAt = calculateNewsReportExpiry(finalCategory, publishedAt);

    // 6. Clean headline and content
    const cleanTitle = cleanIncidentTitle(item.title);
    const cleanDesc = cleanIncidentTitle(item.contentSnippet || item.title);

    // 7. Cross-Outlet Semantic Deduplication:
    // If another news agency already reported on this exact same accident/crime in this area,
    // consolidate under the existing report instead of scattering duplicate pins across the map.
    const duplicateMatch = await findDuplicateActiveReport({
      title: cleanTitle,
      category: finalCategory,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    });

    if (duplicateMatch) {
      const { existingReport, sharedTokens } = duplicateMatch;
      console.log(
        `[News Crawler] 🔄 Consolidated duplicate story from "${item.sourceName}": "${cleanTitle.substring(0, 60)}..." -> Merged with Report ${existingReport.id} (Shared: ${sharedTokens.join(', ')})`
      );

      // Create NewsArticle record linked to existingReport.id (multi-source consolidation)
      await prisma.newsArticle.create({
        data: {
          guid,
          title: item.title,
          sourceUrl: canonicalUrl,
          sourceName: item.sourceName,
          publishedAt,
          category: finalCategory,
          severity: classification.severity,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          reportId: existingReport.id,
        },
      });

      // Format source names to credit multiple outlets
      const currentSources = existingReport.sourceName || '';
      const cleanOutlet = item.sourceName.replace(/^Google News BD[^:]*:\s*/i, '').trim();
      let updatedSources = currentSources;
      if (cleanOutlet && !currentSources.includes(cleanOutlet)) {
        updatedSources = `${currentSources}, ${cleanOutlet}`.replace(/^,\s*/, '');
      }

      // Preserve structured citations array
      const existingCitations: any[] = Array.isArray(existingReport.citations)
        ? (existingReport.citations as any[])
        : existingReport.sourceUrl
          ? [
              {
                sourceName: (existingReport.sourceName || 'Press').replace(/^Google News BD[^:]*:\s*/i, '').trim(),
                sourceUrl: existingReport.sourceUrl,
                title: cleanIncidentTitle(existingReport.description?.split('\n')[0] || ''),
              },
            ]
          : [];

      const newCitation = {
        sourceName: cleanOutlet || item.sourceName,
        sourceUrl: canonicalUrl,
        title: cleanTitle,
        publishedAt: publishedAt.toISOString(),
      };

      if (!existingCitations.some((c) => c.sourceUrl === canonicalUrl)) {
        existingCitations.push(newCitation);
      }

      // Advance verificationStage to CORROBORATED (preserving ADMIN_VERIFIED if already verified)
      const nextStage = existingReport.verificationStage === 'ADMIN_VERIFIED'
        ? 'ADMIN_VERIFIED'
        : 'CORROBORATED';

      // If existing report was previously misclassified (e.g. ARMED_ASSAULT instead of ROAD_ACCIDENT), fix it:
      const updatedCategory =
        existingReport.category === 'ARMED_ASSAULT' && finalCategory === 'ROAD_ACCIDENT'
          ? 'ROAD_ACCIDENT'
          : existingReport.category;

      await prisma.report.update({
        where: { id: existingReport.id },
        data: {
          category: updatedCategory,
          sourceName: updatedSources,
          upvotes: { increment: 2 }, // Multi-press verification confidence boost
          verificationStage: nextStage,
          citations: existingCitations,
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
      existingUrlSet.add(canonicalUrl);
      skipped++;
      if (runRecorder) runRecorder.recordDuplicateRejection();
      continue;
    }

    const initialCitations = [
      {
        sourceName: item.sourceName.replace(/^Google News BD[^:]*:\s*/i, '').trim() || item.sourceName,
        sourceUrl: canonicalUrl,
        title: cleanTitle,
        publishedAt: publishedAt.toISOString(),
      },
    ];

    // Atomically create report, populate PostGIS location, and persist news article metadata
    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.report.create({
        data: {
          userId: botUserId,
          category: finalCategory,
          severity: classification.severity,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          description: cleanDesc,
          sourceUrl: canonicalUrl,
          sourceName: item.sourceName,
          verificationStage: 'CLASSIFIED',
          citations: initialCitations,
          expiresAt,
        },
      });

      await setReportLocation(tx, createdReport.id, geocode.latitude, geocode.longitude);

      await tx.newsArticle.create({
        data: {
          guid,
          title: item.title,
          sourceUrl: canonicalUrl,
          sourceName: item.sourceName,
          publishedAt,
          category: finalCategory,
          severity: classification.severity,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          reportId: createdReport.id,
        },
      });

      return createdReport;
    });

    existingGuidSet.add(guid);
    existingUrlSet.add(canonicalUrl);
    ingested++;
    if (runRecorder) runRecorder.recordNewIncident();

    // 7. Cross-Verification with active citizen reports
    const verifyResult = await crossVerifyCitizenReports({
      id: report.id,
      category: report.category,
      latitude: report.latitude,
      longitude: report.longitude,
      sourceName: item.sourceName,
      sourceUrl: canonicalUrl,
      title: item.title,
    });
    verifiedMatches += verifyResult.matchedCount;
    if (runRecorder && verifyResult.matchedCount > 0) {
      runRecorder.recordVerifiedMatches(verifyResult.matchedCount);
      // Automatically advance verificationStage to CORROBORATED when citizen report matches
      await prisma.report.update({
        where: { id: report.id },
        data: { verificationStage: 'CORROBORATED' },
      });
      if (verifyResult.verifiedReportIds.length > 0) {
        await prisma.report.updateMany({
          where: { id: { in: verifyResult.verifiedReportIds } },
          data: { verificationStage: 'CORROBORATED' },
        });
      }
    }

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

  if (ingested > 0) {
    void broadcastPlatformStats();
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

export const crawlAllNewsFeeds = async (
  feeds: FeedConfig[] = PUBLIC_NEWS_FEEDS
): Promise<{
  feedsChecked: number;
  totalIngested: number;
  totalSkipped: number;
  totalVerifiedMatches: number;
  runId: string;
  durationMs: number;
}> => {
  const runRecorder = newsObservabilityService.startRun();
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalVerifiedMatches = 0;
  let feedsChecked = 0;

  for (const feedConfig of feeds) {
    feedsChecked++;
    const feedStartTime = Date.now();
    const timeoutMs = feedConfig.timeoutMs || 10000;

    try {
      const parsePromise = parser.parseURL(feedConfig.url);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Feed fetch timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const feed = await Promise.race([parsePromise, timeoutPromise]);
      const latencyMs = Date.now() - feedStartTime;

      const items: RawNewsItem[] = (feed.items || []).map((item) => {
        const rawLink = safeString(item.link);
        const canonicalLink = normalizeCanonicalUrl(rawLink);
        return {
          guid: safeString(item.guid || canonicalLink || item.title),
          title: safeString(item.title),
          link: canonicalLink,
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentSnippet: safeString(item.contentSnippet || item.content),
          sourceName: feedConfig.name,
          categoryHint: feedConfig.categoryHint || feedConfig.category,
        };
      });

      const result = await processAndIngestNewsItems(items, runRecorder);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;
      totalVerifiedMatches += result.verifiedMatches;

      runRecorder.recordFeedExecution({
        feedName: feedConfig.name,
        category: feedConfig.category,
        url: feedConfig.url,
        status: 'SUCCESS',
        latencyMs,
        itemsFetched: items.length,
      });
    } catch (feedErr: any) {
      const latencyMs = Date.now() - feedStartTime;
      const isTimeout = feedErr?.message?.includes('timed out');
      console.warn(`[News Crawler] Failed to fetch feed "${feedConfig.name}":`, feedErr?.message || feedErr);

      runRecorder.recordFeedExecution({
        feedName: feedConfig.name,
        category: feedConfig.category,
        url: feedConfig.url,
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        latencyMs,
        itemsFetched: 0,
        errorMessage: feedErr?.message || String(feedErr),
      });
      // Isolated failure handling: continuing crawl loop without aborting
    }
  }

  const completedRun = runRecorder.complete();

  return {
    feedsChecked,
    totalIngested,
    totalSkipped,
    totalVerifiedMatches,
    runId: completedRun.runId,
    durationMs: completedRun.durationMs,
  };
};
