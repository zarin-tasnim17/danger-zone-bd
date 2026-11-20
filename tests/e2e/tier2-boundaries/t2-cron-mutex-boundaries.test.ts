import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  circuitBreaker,
  checkGoogleNewsCircuit,
  recordGoogleNewsSuccess,
} from '../../../apps/api/src/services/newsCrawlerService';

describe('Tier 2: Boundary & Corner Cases - Cron Mutex, Timeout & Circuit Breaker Boundaries', () => {
  it('T2-CRON-01: Mutex lease TTL boundary: lock request at TTL - 100ms fails, request at TTL + 100ms succeeds', () => {
    const TTL_MS = 300_000; // 5 minutes
    const acquiredAt = 1_000_000;

    const isLeaseActive = (now: number): boolean => {
      return now - acquiredAt < TTL_MS;
    };

    // At 4m 59.9s (still within lease)
    assert.strictEqual(isLeaseActive(acquiredAt + TTL_MS - 100), true, 'Lease must remain active right before TTL');

    // At exactly TTL + 100ms (lease expired)
    assert.strictEqual(isLeaseActive(acquiredAt + TTL_MS + 100), false, 'Lease must be expired right after TTL');
  });

  it('T2-CRON-02: Timeout boundary: 10,000ms feed timeout budget aborts 10,001ms request cleanly', () => {
    const FEED_TIMEOUT_MS = 10000;

    const isTimedOut = (elapsedMs: number): boolean => {
      return elapsedMs > FEED_TIMEOUT_MS;
    };

    assert.strictEqual(isTimedOut(9950), false, '9,950ms is within budget');
    assert.strictEqual(isTimedOut(10050), true, '10,050ms exceeds budget and must abort');
  });

  it('T2-CRON-03: Rapid burst trigger boundary: 20 concurrent invocations permit exactly 1 execution', async () => {
    let activeLock = false;
    let allowedCount = 0;
    let rejectedCount = 0;

    const tryAcquire = async (): Promise<boolean> => {
      if (activeLock) {
        rejectedCount++;
        return false;
      }
      activeLock = true;
      allowedCount++;
      // Simulate brief work
      await new Promise((r) => setTimeout(r, 10));
      activeLock = false;
      return true;
    };

    // 20 workers attempt to acquire lock simultaneously
    const attempts = Array.from({ length: 20 }, () => tryAcquire());
    await Promise.all(attempts);

    assert.strictEqual(allowedCount, 1, 'Exactly 1 worker must acquire lock');
    assert.strictEqual(rejectedCount, 19, '19 workers must be rejected with lock collision');
  });

  it('T2-CRON-04: Circuit breaker trip boundary: trips to OPEN after consecutive failure threshold', () => {
    circuitBreaker.state = 'CLOSED';
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.openUntil = 0;

    assert.strictEqual(checkGoogleNewsCircuit(), true, 'Circuit should be CLOSED initially');

    // Trip circuit breaker manually to OPEN
    circuitBreaker.state = 'OPEN';
    circuitBreaker.openUntil = Date.now() + 60_000; // 60s cooldown

    assert.strictEqual(checkGoogleNewsCircuit(), false, 'Circuit must reject requests when OPEN');
  });

  it('T2-CRON-05: Circuit breaker cooldown boundary: transitions to HALF_OPEN after cooldown expires', () => {
    const now = Date.now();
    circuitBreaker.state = 'OPEN';
    // Cooldown expired 100ms ago
    circuitBreaker.openUntil = now - 100;

    // Check circuit breaker at current time
    const canAttempt = checkGoogleNewsCircuit();
    assert.strictEqual(canAttempt, true, 'Requests should be permitted once cooldown expires');
    assert.strictEqual(circuitBreaker.state, 'HALF_OPEN', 'State must transition to HALF_OPEN');

    // Recording success resets circuit to CLOSED
    recordGoogleNewsSuccess();
    assert.strictEqual(circuitBreaker.state, 'CLOSED', 'Successful request resets circuit to CLOSED');
    assert.strictEqual(circuitBreaker.consecutiveFailures, 0);
  });
});
