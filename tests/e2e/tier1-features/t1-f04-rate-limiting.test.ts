import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
  cronNewsCrawlRateLimiter,
} from '../../../apps/api/src/middleware/rateLimiter';

function createMockHttp(clientIp = '127.0.0.1') {
  const req: any = {
    ip: clientIp,
    socket: { remoteAddress: clientIp },
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };

  return { req, res };
}

describe('Tier 1: Feature Coverage - F04: Operational Rate Limiting', () => {
  it('T1-F04-01: Permitted requests within operational window succeed with 200/next()', () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 3,
      keyPrefix: 'test-f04-p1',
    });

    const { req, res } = createMockHttp('10.0.0.1');
    let nextCalled = false;

    limiter(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Permitted request must proceed to next()');
    assert.strictEqual(res.getStatusCode(), 200);
  });

  it('T1-F04-02: Operational headroom accommodates 10-minute crawl interval plus manual admin retries', () => {
    // The cron rate limiter is configured with maxRequests: 6 per 10-minute window
    // This allows 1 scheduled crawl per 10-min tick plus 5 manual trigger headrooms
    const testIp = '10.0.0.2';
    let permittedCount = 0;

    for (let i = 0; i < 6; i++) {
      const { req, res } = createMockHttp(testIp);
      cronNewsCrawlRateLimiter(req, res, () => {
        permittedCount++;
      });
    }

    assert.strictEqual(
      permittedCount,
      6,
      `Expected all 6 operational headroom requests to be permitted, got ${permittedCount}`
    );
  });

  it('T1-F04-03: Rapid burst exceeding maxRequests is intercepted and returns 429 Too Many Requests', () => {
    const testIp = '10.0.0.3';
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      keyPrefix: 'test-f04-burst',
    });

    // Request 1: OK
    const r1 = createMockHttp(testIp);
    let next1 = false;
    limiter(r1.req, r1.res, () => { next1 = true; });
    assert.strictEqual(next1, true);

    // Request 2: OK
    const r2 = createMockHttp(testIp);
    let next2 = false;
    limiter(r2.req, r2.res, () => { next2 = true; });
    assert.strictEqual(next2, true);

    // Request 3: Exceeds limit -> 429
    const r3 = createMockHttp(testIp);
    let next3 = false;
    limiter(r3.req, r3.res, () => { next3 = true; });

    assert.strictEqual(next3, false, 'Third request must NOT proceed to next()');
    assert.strictEqual(r3.res.getStatusCode(), 429, 'Excess request must return HTTP 429');
    const data = r3.res.getResponseData();
    assert.strictEqual(data.error?.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('T1-F04-04: Rate limiter payload includes retryAfterSeconds and actionable guidance', () => {
    const limiter = createRateLimiter({
      windowMs: 30000,
      maxRequests: 1,
      keyPrefix: 'test-f04-retry',
      message: 'Rate limit hit',
    });

    const r1 = createMockHttp('10.0.0.4');
    limiter(r1.req, r1.res, () => {});

    const r2 = createMockHttp('10.0.0.4');
    limiter(r2.req, r2.res, () => {});

    assert.strictEqual(r2.res.getStatusCode(), 429);
    const data = r2.res.getResponseData();
    assert.ok(data.error?.retryAfterSeconds !== undefined, 'Response must specify retryAfterSeconds');
    assert.ok(data.error.retryAfterSeconds > 0, 'retryAfterSeconds must be positive');
  });

  it('T1-F04-05: Rate limiter isolates different IP addresses independently', () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyPrefix: 'test-f04-isolation',
    });

    // IP A reaches limit
    const ipA1 = createMockHttp('192.168.1.100');
    limiter(ipA1.req, ipA1.res, () => {});

    const ipA2 = createMockHttp('192.168.1.100');
    limiter(ipA2.req, ipA2.res, () => {});
    assert.strictEqual(ipA2.res.getStatusCode(), 429, 'IP A must be rate limited on 2nd request');

    // IP B makes request (should succeed)
    const ipB1 = createMockHttp('192.168.1.101');
    let ipBNext = false;
    limiter(ipB1.req, ipB1.res, () => {
      ipBNext = true;
    });

    assert.strictEqual(ipBNext, true, 'IP B request must succeed independently of IP A status');
    assert.strictEqual(ipB1.res.getStatusCode(), 200);
  });
});
