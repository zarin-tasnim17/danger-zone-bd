process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-at-least-32-chars-long-danger-zone-bd';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mock-jwt-refresh-secret-at-least-32-chars-long-danger-zone-bd';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mock:mock@127.0.0.1:5432/dangerzone_mock';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyCronSecret,
  DEFAULT_CRON_SECRET,
  timingSafeStringCompare,
} from '../../../apps/api/src/middleware/verifyWebhookSecret';

function createMockReqRes(options: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
}) {
  const req: any = {
    headers: options.headers || {},
    query: options.query || {},
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

describe('Tier 1: Feature Coverage - F03: Secure Cron Bearer Authentication', () => {
  const validSecret = process.env.CRON_SECRET || DEFAULT_CRON_SECRET;

  it('T1-F03-01: Valid Authorization Bearer header successfully passes authentication', () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${validSecret}` },
    });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'verifyCronSecret must invoke next() on valid Bearer secret');
    assert.strictEqual(res.getStatusCode(), 200);
  });

  it('T1-F03-02: Missing Authorization header is rejected with 401 Unauthorized', () => {
    const { req, res } = createMockReqRes({ headers: {} });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called on missing auth header');
    assert.strictEqual(res.getStatusCode(), 401, 'Response status must be 401 Unauthorized');
    const resp = res.getResponseData();
    const errMsg = resp?.error?.message || resp?.message || '';
    assert.ok(errMsg.toLowerCase().includes('unauthorized') || res.getStatusCode() === 401);
  });

  it('T1-F03-03: Invalid Bearer secret token is rejected with 401 Unauthorized', () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: 'Bearer totally-invalid-cron-secret-6789' },
    });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called on invalid Bearer secret');
    assert.strictEqual(res.getStatusCode(), 401, 'Response status must be 401 Unauthorized');
  });

  it('T1-F03-04: Query parameter secret injection is strictly rejected even if matching secret', () => {
    // Attack vector: Attempting to pass secret in URL query (?key=... or ?secret=...)
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${validSecret}` },
      query: { secret: validSecret },
    });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called when query parameters contain auth keys');
    assert.strictEqual(res.getStatusCode(), 401, 'Query param tokens must be rejected with 401');
  });

  it('T1-F03-05: Constant-time string comparison protects against timing side-channel attacks', () => {
    const secret = 'super-secret-token-key-2026';

    // Exact match
    assert.strictEqual(timingSafeStringCompare(secret, secret), true);

    // Different lengths (must not throw RangeError and return false)
    assert.strictEqual(timingSafeStringCompare(secret, 'short'), false);
    assert.strictEqual(timingSafeStringCompare(secret, secret + '-extra'), false);

    // Difference at initial character
    assert.strictEqual(timingSafeStringCompare(secret, 'xuper-secret-token-key-2026'), false);

    // Difference at terminating character
    assert.strictEqual(timingSafeStringCompare(secret, 'super-secret-token-key-2027'), false);
  });
});
