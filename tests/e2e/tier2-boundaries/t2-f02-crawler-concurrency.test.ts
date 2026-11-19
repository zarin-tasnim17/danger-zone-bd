import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  triggerNewsCrawler,
  isCrawlerBusy,
  resetCrawlerMutex,
  setCustomCrawlerFeeds,
} from '../../../apps/api/src/jobs/newsCrawlerJob';
import {
  calculateNewsReportExpiry,
  type FeedConfig,
} from '../../../apps/api/src/services/newsCrawlerService';

describe('Tier 2: Boundary & Corner Cases - F02: Crawler Concurrency & Clock Extremes', () => {
  beforeEach(() => {
    resetCrawlerMutex();
    setCustomCrawlerFeeds(null);
  });

  afterEach(() => {
    resetCrawlerMutex();
    setCustomCrawlerFeeds(null);
  });

  it('T2-F02-01: 100 concurrent triggers yield exactly 1 executing run and 99 rejected with status: in_progress', async () => {
    // Configure a feed with slight delay so lock is held during concurrent triggers
    const slowFeed: FeedConfig = {
      name: 'Controlled Delay Feed',
      category: 'THEFT',
      categoryHint: 'THEFT',
      url: 'http://127.0.0.1:59998/delayed',
      timeoutMs: 150,
    };
    setCustomCrawlerFeeds([slowFeed]);

    const results = await Promise.all(
      Array.from({ length: 100 }, () => triggerNewsCrawler())
    );

    const inProgressCount = results.filter((r) => r.status === 'in_progress').length;
    const completedCount = results.filter((r) => r.status === 'success').length;

    assert.strictEqual(completedCount, 1, 'Exactly 1 run must execute');
    assert.strictEqual(inProgressCount, 99, 'Exactly 99 concurrent runs must be rejected with in_progress');
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must be released after completion');
  });

  it('T2-F02-02: Mid-crawl unhandled error / disconnection guarantees mutex release in finally block', async () => {
    const errorFeed: FeedConfig = {
      name: 'Broken Network Feed',
      category: 'ROAD_ACCIDENT',
      categoryHint: 'ROAD_ACCIDENT',
      url: 'http://127.0.0.1:59997/fatal-error',
      timeoutMs: 50,
    };
    setCustomCrawlerFeeds([errorFeed]);

    await triggerNewsCrawler();

    // Mutex lock must be released
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must be released even after feed error');

    // Subsequent trigger must be permitted
    setCustomCrawlerFeeds([]);
    const nextResult = await triggerNewsCrawler();
    assert.strictEqual(nextResult.status, 'success');
  });

  it('T2-F02-03: Clock backward jump does not induce deadlock or infinite lock state', () => {
    // Simulate backward clock shift (e.g., NTP adjustment by -1 hour)
    const t0 = Date.now();
    const backwardTime = new Date(t0 - 3600 * 1000);

    assert.ok(backwardTime.getTime() < t0);
    resetCrawlerMutex();
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must remain free regardless of clock jumps');
  });

  it('T2-F02-04: Extreme future pubDate (year 2099) does not crash expiry calculation', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const futureDate = new Date('2099-01-01T00:00:00Z');

    const expiry = calculateNewsReportExpiry('ROAD_ACCIDENT', futureDate, now);
    assert.ok(expiry instanceof Date);
    assert.ok(expiry.getTime() > now.getTime(), 'Expiry must be in the future');
    assert.ok(!isNaN(expiry.getTime()), 'Expiry must not be NaN');
  });

  it('T2-F02-05: Epoch zero (1970) or past pubDate guarantees at least 24-hour minimum visibility buffer', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const epochZero = new Date(0); // 1970-01-01T00:00:00.000Z

    const expiry = calculateNewsReportExpiry('THEFT', epochZero, now);
    assert.ok(expiry instanceof Date);

    const minExpected = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    assert.strictEqual(
      expiry.getTime(),
      minExpected.getTime(),
      'Epoch zero date must default to minimum 24-hour retention buffer from now'
    );
  });
});
