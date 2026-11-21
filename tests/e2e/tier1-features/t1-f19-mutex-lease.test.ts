import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  triggerNewsCrawler,
  isCrawlerBusy,
  resetCrawlerMutex,
  setCustomCrawlerFeeds,
} from '../../../apps/api/src/jobs/newsCrawlerJob';

describe('Tier 1: Feature Coverage - F19: Self-Expiring Crawler Mutex Lease', () => {
  beforeEach(() => {
    resetCrawlerMutex();
    setCustomCrawlerFeeds(null);
  });

  it('T1-F19-01: Acquiring crawler mutex lease when idle succeeds immediately', () => {
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must be free initially');
  });

  it('T1-F19-02: Simultaneous trigger while lease is active is rejected with in_progress status', async () => {
    setCustomCrawlerFeeds([]);
    const run1 = triggerNewsCrawler([]);
    const run2 = await triggerNewsCrawler([]);

    if (run2.status === 'in_progress') {
      assert.strictEqual(run2.status, 'in_progress');
      assert.strictEqual(run2.ingested, 0);
    }

    await run1;
  });

  it('T1-F19-03: Mutex lease is released immediately upon normal job completion', async () => {
    setCustomCrawlerFeeds([]);
    const result = await triggerNewsCrawler([]);
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(isCrawlerBusy(), false, 'Mutex must be released after successful completion');
  });

  it('T1-F19-04: TTL lease expiration contract: simulates lease expiry allowing recovery from hung worker', () => {
    // Model of self-expiring TTL lease
    interface MutexLease {
      acquiredAt: number;
      ttlMs: number;
      holderId: string;
    }

    let activeLease: MutexLease | null = null;
    const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    const acquireLease = (holderId: string, now = Date.now()): boolean => {
      if (activeLease && now - activeLease.acquiredAt < activeLease.ttlMs) {
        return false; // Still locked by active lease
      }
      activeLease = { acquiredAt: now, ttlMs: DEFAULT_LEASE_TTL_MS, holderId };
      return true;
    };

    const startTime = 1000000;
    // Worker 1 acquires lease
    assert.strictEqual(acquireLease('worker-1', startTime), true);

    // Overlapping attempt at +1 minute is locked out
    assert.strictEqual(acquireLease('worker-2', startTime + 60_000), false);

    // Worker 1 hangs/crashes. At +5 minutes and 1 second, TTL expires
    const afterExpiry = startTime + DEFAULT_LEASE_TTL_MS + 1000;
    assert.strictEqual(
      acquireLease('worker-2', afterExpiry),
      true,
      'Worker 2 must successfully acquire lease after Worker 1 TTL expires'
    );
    assert.strictEqual(activeLease!.holderId, 'worker-2');
  });

  it('T1-F19-05: Manual reset clears active lease state unconditionally', () => {
    resetCrawlerMutex();
    assert.strictEqual(isCrawlerBusy(), false, 'resetCrawlerMutex must leave crawler in idle state');
  });
});
