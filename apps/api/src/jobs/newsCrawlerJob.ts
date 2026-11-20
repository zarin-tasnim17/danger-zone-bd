import cron from 'node-cron';
import { crawlAllNewsFeeds, FeedConfig, PUBLIC_NEWS_FEEDS } from '../services/newsCrawlerService';

let isCrawling = false;
let customFeeds: FeedConfig[] | null = null;

export const isCrawlerBusy = (): boolean => isCrawling;
export const resetCrawlerMutex = (): void => {
  isCrawling = false;
};
export const setCustomCrawlerFeeds = (feeds: FeedConfig[] | null): void => {
  customFeeds = feeds;
};

/**
 * Triggers the news crawler process with concurrency mutex protection.
 */
export const triggerNewsCrawler = async (feeds?: FeedConfig[]) => {
  if (isCrawling) {
    console.warn('[News Crawler Job] Crawler already in progress. Skipping duplicate run.');
    return { status: 'in_progress', ingested: 0 };
  }

  isCrawling = true;
  console.log('\n[News Crawler Job] 🌐 Starting automated RSS news crawl for Bangladesh public safety...');

  try {
    const defaultFeeds = process.env.NODE_ENV === 'test' ? [] : PUBLIC_NEWS_FEEDS;
    const targetFeeds = feeds || (customFeeds !== null ? customFeeds : defaultFeeds);
    const result = await crawlAllNewsFeeds(targetFeeds);
    console.log(
      `[News Crawler Job] ✅ Ingestion complete: ${result.totalIngested} new incidents added, ${result.totalVerifiedMatches} citizen reports cross-verified, ${result.totalSkipped} skipped across ${result.feedsChecked} feeds.\n`
    );
    return { status: 'success', ...result };
  } catch (error) {
    console.error('[News Crawler Job] ❌ News crawler failed with error:', error);
    throw error;
  } finally {
    isCrawling = false;
  }
};

/**
 * Executes a cold-start background crawl 10 seconds after server boot.
 * This recovers immediately from Render container sleep / spin-downs so
 * incoming traffic always sees fresh news without waiting for the next cron tick.
 */
export const scheduleStartupCrawl = () => {
  if (process.env.NODE_ENV === 'test') return;
  setTimeout(async () => {
    try {
      console.log('[News Crawler] 🚀 Executing initial startup news crawl check...');
      await triggerNewsCrawler();
    } catch (err: any) {
      console.warn('[News Crawler] Startup crawl warning:', err.message);
    }
  }, 10000);
};

export const DEFAULT_CRAWLER_SCHEDULE = '*/10 * * * *';

/**
 * Initializes the automated news crawler cron job.
 * Default schedule: Every 10 minutes (e.g. 'star/10 * * * *').
 */
export const initNewsCrawlerCron = (scheduleExpression: string = DEFAULT_CRAWLER_SCHEDULE) => {
  const task = cron.schedule(scheduleExpression, async () => {
    try {
      await triggerNewsCrawler();
    } catch (err) {
      console.error('[News Crawler Cron] Unhandled error during scheduled crawl:', err);
    }
  });

  console.log(`[News Crawler Cron] Scheduled automatically with expression: "${scheduleExpression}"`);

  // Run initial crawl on server boot/wake
  scheduleStartupCrawl();

  return {
    task,
    stop: () => {
      console.log('[News Crawler Cron] Stopping cron task...');
      task.stop();
    },
  };
};
