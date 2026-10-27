import Parser from 'rss-parser';
import { prisma } from '../db/prisma';
import { resolveLocationFromText } from './geocodingService';
import { classifyNewsText } from './newsClassifierService';
import { crossVerifyCitizenReports } from './newsVerificationService';
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
    url: 'https://news.google.com/rss/search?q=crime+OR+mugging+OR+robbery+bangladesh&hl=en-BD&gl=BD&ceid=BD:en',
  },
  {
    name: 'Google News BD Safety (Bangla)',
    url: 'https://news.google.com/rss/search?q=%E0%A6%9B%E0%A6%BF%E0%A6%A8%E0%A6%A4%E0%A6%BE%E0%A6%87+OR+%E0%A6%A1%E0%A6%BE%E0%A6%95%E0%A6%BE%E0%A6%A4%E0%A6%BF+OR+%E0%A6%B8%E0%A6%82%E0%A6%98%E0%A6%B0%E0%A7%8D%E0%A6%B7+OR+%E0%A6%A6%E0%A7%81%E0%A6%B0%E0%A7%8D%E0%A6%98%E0%A6%9F%E0%A6%A8%E0%A6%BE&hl=bn&gl=BD&ceid=BD:bn',
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

    // 3. Bilingual classification
    const classification = classifyNewsText(item.title, item.contentSnippet || '');
    if (!classification.isSafetyRelated) {
      skipped++;
      continue;
    }

    // 4. Geocoding resolution
    const geocode = await resolveLocationFromText(`${item.title} ${item.contentSnippet || ''}`);
    if (!geocode) {
      // Cannot plot on map without verified Bangladesh coordinates
      skipped++;
      continue;
    }

    // 5. Expiration: 7 days rolling lifecycle
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 6. Insert Report and NewsArticle in database
    const report = await prisma.report.create({
      data: {
        userId: botUserId,
        category: classification.category,
        severity: classification.severity,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        description: `[${item.sourceName}] ${item.title}`,
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
