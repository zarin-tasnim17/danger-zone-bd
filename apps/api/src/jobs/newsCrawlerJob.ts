import cron from 'node-cron';
import { crawlAllNewsFeeds } from '../services/newsCrawlerService';

let isCrawling = false;

/**
 * Triggers the news crawler process with concurrency mutex protection.
 */
export const triggerNewsCrawler = async () => {
  if (isCrawling) {
    console.warn('[News Crawler Job] Crawler already in progress. Skipping duplicate run.');
    return { status: 'in_progress', ingested: 0 };
  }

  isCrawling = true;
  console.log('\n[News Crawler Job] 🌐 Starting automated RSS news crawl for Bangladesh public safety...');

  try {
    const result = await crawlAllNewsFeeds();
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
 * Initializes the automated news crawler cron job.
 * Default schedule: Every 2 hours (0 *\/2 * * *).
 */
export const initNewsCrawlerCron = (scheduleExpression: string = '0 */2 * * *') => {
  const task = cron.schedule(scheduleExpression, async () => {
    try {
      await triggerNewsCrawler();
    } catch (err) {
      console.error('[News Crawler Cron] Unhandled error during scheduled crawl:', err);
    }
  });

  console.log(`[News Crawler Cron] Scheduled automatically with expression: "${scheduleExpression}"`);
  return task;
};
