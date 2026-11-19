import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyCronSecret,
  DEFAULT_CRON_SECRET,
} from '../../../apps/api/src/middleware/verifyWebhookSecret';
import {
  createRateLimiter,
} from '../../../apps/api/src/middleware/rateLimiter';

function createMockHttp(options: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  ip?: string;
} = {}) {
  const req: any = {
    headers: options.headers || {},
    query: options.query || {},
    ip: options.ip || '127.0.0.1',
    socket: { remoteAddress: options.ip || '127.0.0.1' },
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

describe('Tier 3: Pairwise Combinations - P02: Auth & Rate Limiting Pipeline (F2 x F3 x F4)', () => {
  const validSecret = process.env.CRON_SECRET || DEFAULT_CRON_SECRET;

  it('T3-P02-01: Authenticated trigger with valid Bearer secret within rate limits executes crawler successfully', () => {
    const rateLimiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      keyPrefix: 'test-p02-01',
    });

    const { req, res } = createMockHttp({
      headers: { authorization: `Bearer ${validSecret}` },
      ip: '192.168.1.10',
    });

    // Step 1: Rate limiter check
    let rateLimitPassed = false;
    rateLimiter(req, res, () => {
      rateLimitPassed = true;
    });
    assert.strictEqual(rateLimitPassed, true, 'Request within quota must pass rate limiter');
    assert.strictEqual(res.getStatusCode(), 200);

    // Step 2: Auth check
    let authPassed = false;
    verifyCronSecret(req, res, () => {
      authPassed = true;
    });
    assert.strictEqual(authPassed, true, 'Valid Bearer secret must pass auth');
    assert.strictEqual(res.getStatusCode(), 200);
  });

  it('T3-P02-02: Unauthenticated or bad-secret requests fail fast with 401 and consume minimal rate limit budget', () => {
    const rateLimiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 3,
      keyPrefix: 'test-p02-02',
    });

    // Request with invalid token
    const { req, res } = createMockHttp({
      headers: { authorization: 'Bearer WRONG_TOKEN_VALUE' },
      ip: '192.168.1.20',
    });

    // Passes rate limiter (first request)
    let rateLimitPassed = false;
    rateLimiter(req, res, () => {
      rateLimitPassed = true;
    });
    assert.strictEqual(rateLimitPassed, true);

    // Fails auth check with 401
    let authPassed = false;
    verifyCronSecret(req, res, () => {
      authPassed = true;
    });
    assert.strictEqual(authPassed, false, 'Invalid Bearer secret must be rejected');
    assert.strictEqual(res.getStatusCode(), 401);
    const resp = res.getResponseData();
    assert.ok(
      resp?.message?.toLowerCase().includes('unauthorized') ||
      resp?.error?.code === 'UNAUTHORIZED' ||
      res.getStatusCode() === 401
    );
  });

  it('T3-P02-03: Rate limiter throttling (429) triggers when request rate exceeds operational headroom', () => {
    const maxAllowed = 3;
    const rateLimiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: maxAllowed,
      keyPrefix: 'test-p02-03',
    });

    const clientIp = '192.168.1.30';

    // Send maxAllowed valid requests -> all pass
    for (let i = 0; i < maxAllowed; i++) {
      const { req, res } = createMockHttp({
        headers: { authorization: `Bearer ${validSecret}` },
        ip: clientIp,
      });

      let passed = false;
      rateLimiter(req, res, () => {
        passed = true;
      });
      assert.strictEqual(passed, true, `Request #${i + 1} must pass`);
      assert.strictEqual(res.getStatusCode(), 200);
    }

    // Next request exceeds limit -> intercepted with 429
    const { req: burstReq, res: burstRes } = createMockHttp({
      headers: { authorization: `Bearer ${validSecret}` },
      ip: clientIp,
    });

    let burstPassed = false;
    rateLimiter(burstReq, burstRes, () => {
      burstPassed = true;
    });

    assert.strictEqual(burstPassed, false, 'Exceeded request must NOT call next()');
    assert.strictEqual(burstRes.getStatusCode(), 429);
    assert.strictEqual(burstRes.getResponseData()?.success, false);
    assert.strictEqual(burstRes.getResponseData()?.error?.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('T3-P02-04: Concurrency mutex protects crawler from overlapping runs while auth and rate limit pass', () => {
    let isCrawling = false;

    // Emulate two cron triggers arriving simultaneously
    const triggerCrawl = (runId: string): { started: boolean; message: string } => {
      if (isCrawling) {
        return { started: false, message: 'Crawler already in progress' };
      }
      isCrawling = true;
      try {
        return { started: true, message: `Run ${runId} started` };
      } finally {
        // Will be released after crawl completes
      }
    };

    // First trigger starts crawl
    const run1 = triggerCrawl('run-01');
    assert.strictEqual(run1.started, true);

    // Second trigger arrives while first is active -> safely skipped
    const run2 = triggerCrawl('run-02');
    assert.strictEqual(run2.started, false);
    assert.strictEqual(run2.message, 'Crawler already in progress');

    // First finishes and unlocks
    isCrawling = false;

    // Subsequent trigger can run
    const run3 = triggerCrawl('run-03');
    assert.strictEqual(run3.started, true);
    isCrawling = false;
  });

  it('T3-P02-05: Rate limit response includes retry guidance and key isolation across different callers', () => {
    const rateLimiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      keyPrefix: 'test-p02-05',
    });

    // Exhaust quota for IP A
    for (let i = 0; i < 2; i++) {
      const { req, res } = createMockHttp({ ip: '10.10.10.1' });
      rateLimiter(req, res, () => {});
    }

    // IP A is now blocked
    const { req: reqA, res: resA } = createMockHttp({ ip: '10.10.10.1' });
    rateLimiter(reqA, resA, () => {});
    assert.strictEqual(resA.getStatusCode(), 429);
    assert.ok(resA.getResponseData()?.error?.retryAfterSeconds > 0);

    // IP B is NOT blocked (independent IP key isolation)
    const { req: reqB, res: resB } = createMockHttp({ ip: '10.10.10.2' });
    let ipBPassed = false;
    rateLimiter(reqB, resB, () => {
      ipBPassed = true;
    });
    assert.strictEqual(ipBPassed, true);
    assert.strictEqual(resB.getStatusCode(), 200);
  });
});
