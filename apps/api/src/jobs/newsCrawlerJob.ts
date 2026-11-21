import cron from 'node-cron';
import { crawlAllNewsFeeds, FeedConfig, PUBLIC_NEWS_FEEDS } from '../services/newsCrawlerService';

export const DEFAULT_CRAWLER_SCHEDULE = '*/10 * * * *';
export const DEFAULT_MUTEX_TTL_MS = 8 * 60 * 1000; // 8 minutes (within 10-minute cadence)

export interface CrawlerMutexLease {
  isLocked: boolean;
  acquiredAt: number | null;
  expiresAt: number | null;
  leaseHolder: string | null;
  ttlMs: number;
}

let currentLease: CrawlerMutexLease = {
  isLocked: false,
  acquiredAt: null,
  expiresAt: null,
  leaseHolder: null,
  ttlMs: DEFAULT_MUTEX_TTL_MS,
};

let customFeeds: FeedConfig[] | null = null;

/**
 * Checks if the crawler is currently busy under an active, unexpired lease.
 * If the lease has exceeded its TTL, it is considered expired and not busy.
 */
export const isCrawlerBusy = (now: number = Date.now()): boolean => {
  if (!currentLease.isLocked) return false;
  if (currentLease.expiresAt !== null && now >= currentLease.expiresAt) {
    return false; // Lease has self-expired
  }
  return true;
};

/**
 * Attempts to acquire the crawler mutex lease.
 * Returns true if the lease was successfully acquired, false if an active unexpired lease exists.
 */
export const tryAcquireCrawlerMutex = (
  holder: string = 'crawler-job',
  ttlMs: number = DEFAULT_MUTEX_TTL_MS,
  now: number = Date.now()
): boolean => {
  if (isCrawlerBusy(now)) {
    return false;
  }

  // Check if breaking a stale/expired lease
  if (currentLease.isLocked && currentLease.expiresAt !== null && now >= currentLease.expiresAt) {
    const expiredBySec = Math.round((now - currentLease.expiresAt) / 1000);
    console.warn(
      `[News Crawler Mutex] ⚠️ Breaking stale crawler lease held by "${currentLease.leaseHolder}". Lease expired ${expiredBySec}s ago (acquired at ${new Date(currentLease.acquiredAt!).toISOString()}). Self-expiring lease broke stale lock.`
    );
  }

  currentLease = {
    isLocked: true,
    acquiredAt: now,
    expiresAt: now + ttlMs,
    leaseHolder: holder,
    ttlMs,
  };
  return true;
};

/**
 * Releases the crawler mutex lease if held by the given holder or unconditionally.
 */
export const releaseCrawlerMutex = (holder?: string): void => {
  if (holder && currentLease.leaseHolder && currentLease.leaseHolder !== holder) {
    // If holder doesn't match and current lease hasn't expired, reject release
    if (currentLease.expiresAt !== null && Date.now() < currentLease.expiresAt) {
      console.warn(
        `[News Crawler Mutex] Ignored release request from "${holder}" - lease held by "${currentLease.leaseHolder}"`
      );
      return;
    }
  }

  currentLease = {
    isLocked: false,
    acquiredAt: null,
    expiresAt: null,
    leaseHolder: null,
    ttlMs: DEFAULT_MUTEX_TTL_MS,
  };
};

/**
 * Unconditionally resets the crawler mutex (useful for testing and emergency admin recovery).
 */
export const resetCrawlerMutex = (): void => {
  releaseCrawlerMutex();
};

/**
 * Returns diagnostic metadata for the current crawler lease.
 */
export const getCrawlerLeaseStatus = (now: number = Date.now()) => {
  const busy = isCrawlerBusy(now);
  const remainingTtlMs = currentLease.expiresAt ? Math.max(0, currentLease.expiresAt - now) : 0;
  return {
    isBusy: busy,
    isLocked: currentLease.isLocked,
    acquiredAt: currentLease.acquiredAt,
    acquiredAtIso: currentLease.acquiredAt ? new Date(currentLease.acquiredAt).toISOString() : null,
    expiresAt: currentLease.expiresAt,
    expiresAtIso: currentLease.expiresAt ? new Date(currentLease.expiresAt).toISOString() : null,
    remainingTtlMs,
    leaseHolder: currentLease.leaseHolder,
    ttlMs: currentLease.ttlMs,
  };
};

export const setCustomCrawlerFeeds = (feeds: FeedConfig[] | null): void => {
  customFeeds = feeds;
};

/**
 * Triggers the news crawler process with concurrency mutex lease protection.
 */
export const triggerNewsCrawler = async (
  feeds?: FeedConfig[],
  options?: { holder?: string; ttlMs?: number }
) => {
  const holder = options?.holder || `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ttlMs = options?.ttlMs || Number(process.env.CRAWLER_MUTEX_TTL_MS) || DEFAULT_MUTEX_TTL_MS;

  if (!tryAcquireCrawlerMutex(holder, ttlMs)) {
    console.warn('[News Crawler Job] Crawler already in progress under active lease. Skipping duplicate run.');
    return { status: 'in_progress', ingested: 0 };
  }

  console.log(`\n[News Crawler Job] 🌐 Starting automated RSS news crawl for Bangladesh public safety (lease: ${holder}, TTL: ${ttlMs}ms)...`);

  let timeoutTimer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new Error(`News crawler execution exceeded safety lease timeout limit of ${ttlMs}ms`));
    }, ttlMs);
    timeoutTimer.unref?.();
  });

  try {
    const defaultFeeds = process.env.NODE_ENV === 'test' ? [] : PUBLIC_NEWS_FEEDS;
    const targetFeeds = feeds || (customFeeds !== null ? customFeeds : defaultFeeds);

    const crawlPromise = crawlAllNewsFeeds(targetFeeds);
    const result = await Promise.race([crawlPromise, timeoutPromise]);

    console.log(
      `[News Crawler Job] ✅ Ingestion complete: ${result.totalIngested} new incidents added, ${result.totalVerifiedMatches} citizen reports cross-verified, ${result.totalSkipped} skipped across ${result.feedsChecked} feeds.\n`
    );
    return { status: 'success', ...result };
  } catch (error) {
    console.error('[News Crawler Job] ❌ News crawler failed with error:', error);
    throw error;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    releaseCrawlerMutex(holder);
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
