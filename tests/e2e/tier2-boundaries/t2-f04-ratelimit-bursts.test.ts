import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
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

describe('Tier 2: Boundary & Corner Cases - F04: Rate Limiting Bursts & Address Invariants', () => {
  it('T2-F04-01: Exact quota boundary: exactly N requests succeed, N+1th is blocked with 429', () => {
    const quota = 4;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: quota,
      keyPrefix: 'test-exact-quota',
    });
    const ip = '192.168.1.10';

    // First N requests succeed
    for (let i = 1; i <= quota; i++) {
      const { req, res } = createMockHttp(ip);
      let nextCalled = false;
      limiter(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, `Request #${i} within quota must succeed`);
      assert.strictEqual(res.getStatusCode(), 200);
    }

    // N+1th request blocked
    const { req, res } = createMockHttp(ip);
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false, 'Request N+1 exceeding quota must be blocked');
    assert.strictEqual(res.getStatusCode(), 429);
    assert.strictEqual(res.getResponseData()?.error?.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('T2-F04-02: Window expiration resets counter after configured duration', async () => {
    const windowMs = 50; // short window for testability
    const limiter = createRateLimiter({
      windowMs,
      maxRequests: 2,
      keyPrefix: 'test-window-reset',
    });
    const ip = '192.168.1.20';

    // Consume quota
    for (let i = 0; i < 2; i++) {
      const { req, res } = createMockHttp(ip);
      limiter(req, res, () => {});
    }

    // Immediately blocked
    const { req: bReq, res: bRes } = createMockHttp(ip);
    limiter(bReq, bRes, () => {});
    assert.strictEqual(bRes.getStatusCode(), 429);

    // Wait for window to elapse
    await new Promise((r) => setTimeout(r, windowMs + 10));

    // Now request should succeed again
    const { req: aReq, res: aRes } = createMockHttp(ip);
    let resetAllowed = false;
    limiter(aReq, aRes, () => {
      resetAllowed = true;
    });
    assert.strictEqual(resetAllowed, true, 'Request after window expiration must succeed');
    assert.strictEqual(aRes.getStatusCode(), 200);
  });

  it('T2-F04-03: 50 parallel asynchronous requests burst strictly enforces maxRequests limit', async () => {
    const maxRequests = 10;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests,
      keyPrefix: 'test-parallel-burst',
    });
    const ip = '192.168.1.30';

    const requests = Array.from({ length: 50 }, () => createMockHttp(ip));
    const results: number[] = [];

    await Promise.all(
      requests.map(
        ({ req, res }) =>
          new Promise<void>((resolve) => {
            limiter(req, res, () => {
              results.push(200);
              resolve();
            });
            if (res.getStatusCode() === 429) {
              results.push(429);
              resolve();
            }
          })
      )
    );

    const allowed = results.filter((code) => code === 200).length;
    const rejected = results.filter((code) => code === 429).length;

    assert.strictEqual(allowed, maxRequests, `Exactly ${maxRequests} requests must be allowed`);
    assert.strictEqual(rejected, 50 - maxRequests, `Exactly ${50 - maxRequests} requests must be blocked`);
  });

  it('T2-F04-04: Canonical IPv6 representations and IPv4-mapped IPv6 are tracked and isolated', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      keyPrefix: 'test-ipv6',
    });

    const fullIpv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    const ipv4Mapped = '::ffff:192.168.1.50';

    // Exhaust quota for fullIpv6
    for (let i = 0; i < 2; i++) {
      const { req, res } = createMockHttp(fullIpv6);
      limiter(req, res, () => {});
    }
    const { req: blkReq, res: blkRes } = createMockHttp(fullIpv6);
    limiter(blkReq, blkRes, () => {});
    assert.strictEqual(blkRes.getStatusCode(), 429, 'IPv6 address must be rate limited');

    // Different IPv4-mapped address must still have its own quota
    const { req: mapReq, res: mapRes } = createMockHttp(ipv4Mapped);
    let mapAllowed = false;
    limiter(mapReq, mapRes, () => {
      mapAllowed = true;
    });
    assert.strictEqual(mapAllowed, true, 'Distinct IPv6 address must have independent quota');
    assert.strictEqual(mapRes.getStatusCode(), 200);
  });

  it('T2-F04-05: Missing IP or corrupted socket properties fall back gracefully without throwing', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 5,
      keyPrefix: 'test-fallback-ip',
    });

    // Request with undefined ip and remoteAddress
    const req: any = {
      ip: undefined,
      socket: { remoteAddress: undefined },
    };
    let statusCode = 200;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json() {
        return res;
      },
      getStatusCode: () => statusCode,
    };

    let nextCalled = false;
    assert.doesNotThrow(() => {
      limiter(req, res, () => {
        nextCalled = true;
      });
    }, 'Limiter must not crash on missing IP fields');

    assert.strictEqual(nextCalled, true, 'Request with missing IP falls back to unknown and proceeds');
  });
});
