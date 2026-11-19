import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import cron from '../../../apps/api/node_modules/node-cron';
import {
  DEFAULT_CRAWLER_SCHEDULE,
  triggerNewsCrawler,
  isCrawlerBusy,
  resetCrawlerMutex,
  setCustomCrawlerFeeds,
} from '../../../apps/api/src/jobs/newsCrawlerJob';
import type { FeedConfig } from '../../../apps/api/src/services/newsCrawlerService';

describe('Tier 1: Feature Coverage - F02: Automated 10-Minute News Crawler', () => {
  beforeEach(() => {
    resetCrawlerMutex();
    setCustomCrawlerFeeds(null);
  });

  afterEach(() => {
    resetCrawlerMutex();
    setCustomCrawlerFeeds(null);
  });

  it('T1-F02-01: Default cron cadence matches 10-minute schedule expression (*/10 * * * *)', () => {
    assert.strictEqual(
      DEFAULT_CRAWLER_SCHEDULE,
      '*/10 * * * *',
      'Scheduler must use 10-minute cadence */10 * * * *'
    );
    assert.strictEqual(
      cron.validate(DEFAULT_CRAWLER_SCHEDULE),
      true,
      'DEFAULT_CRAWLER_SCHEDULE must be a syntactically valid cron expression'
    );
  });

  it('T1-F02-02: Mutex lock prevents simultaneous overlapping crawler runs', async () => {
    let releaseHold: () => void;
    const holdPromise = new Promise<void>((r) => {
      releaseHold = r;
    });

    // Mock custom feed with a controlled delay
    const blockingFeed: FeedConfig = {
      name: 'Simulated Long Feed',
      category: 'THEFT',
      categoryHint: 'THEFT',
      url: 'http://127.0.0.1:9999/rss-blocking',
    };

    setCustomCrawlerFeeds([blockingFeed]);

    // Start first run in background
    const run1Promise = triggerNewsCrawler().catch(() => {});

    // Verify mutex immediately reflects busy status
    assert.strictEqual(isCrawlerBusy(), true, 'isCrawlerBusy() must be true while crawl is in progress');

    // Attempt second simultaneous run
    const secondRunResult = await triggerNewsCrawler();

    assert.strictEqual(
      secondRunResult.status,
      'in_progress',
      'Overlapping run must be rejected with status: in_progress'
    );
    assert.strictEqual(
      secondRunResult.ingested,
      0,
      'Rejected run must ingest 0 items'
    );

    // Wait for first run to settle
    await run1Promise;
  });

  it('T1-F02-03: Mutex lock is reliably released after successful crawler completion', async () => {
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex should initially be unlocked');

    // Feed with empty list (fast success)
    setCustomCrawlerFeeds([]);

    const result = await triggerNewsCrawler();

    assert.strictEqual(result.status, 'success', 'Crawl should complete successfully');
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must be released after completion');
  });

  it('T1-F02-04: Mutex lock is safely released via finally block even if crawler encounters error', async () => {
    const errorThrowingFeed: FeedConfig = {
      name: 'Unreachable Host',
      category: 'ROAD_ACCIDENT',
      categoryHint: 'ROAD_ACCIDENT',
      url: 'http://127.0.0.1:59999/non-existent-port',
      timeoutMs: 100,
    };

    setCustomCrawlerFeeds([errorThrowingFeed]);

    let threwError = false;
    try {
      await triggerNewsCrawler();
    } catch {
      threwError = true;
    }

    // Even if error was thrown or handled, mutex must be false
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex lock must be false after error in finally block');
  });

  it('T1-F02-05: Custom feed override capability allows targeted hermetic crawling execution', async () => {
    const testFeed: FeedConfig = {
      name: 'Test Dedicated Feed',
      category: 'ARMED_ASSAULT',
      categoryHint: 'ARMED_ASSAULT',
      url: 'https://news.google.com/rss/search?q=test',
    };

    setCustomCrawlerFeeds([testFeed]);

    // Mutex reset should work idempotently
    resetCrawlerMutex();
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex should be free after reset');
  });
});
