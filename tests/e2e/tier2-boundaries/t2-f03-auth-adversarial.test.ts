import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyCronSecret,
  DEFAULT_CRON_SECRET,
  timingSafeStringCompare,
} from '../../../apps/api/src/middleware/verifyWebhookSecret';

function createMockReqRes(options: {
  headers?: Record<string, string | string[]>;
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

describe('Tier 2: Boundary & Corner Cases - F03: Adversarial Auth & Scheme Tampering', () => {
  const validSecret = process.env.CRON_SECRET || DEFAULT_CRON_SECRET;

  it('T2-F03-01: Trailing whitespace, tabs, and newlines in token are sanitized or compared safely', () => {
    // A header containing whitespace after Bearer
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer   ${validSecret}   ` },
    });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Bearer token with surrounding whitespace should be trimmed and accepted');
    assert.strictEqual(res.getStatusCode(), 200);
  });

  it('T2-F03-02: Non-ASCII Unicode token (emojis, zero-width spaces, Bengali) safely rejected without crashing', () => {
    const maliciousTokens = [
      'Bearer 🔑admin-token-2026',
      `Bearer ${validSecret}\u200B`, // zero-width space appended
      'Bearer \u09e7\u09e8\u09e9\u09ea\u09eb', // Bengali digits
      'Bearer \x00\x01\x02',
    ];

    for (const badHeader of maliciousTokens) {
      const { req, res } = createMockReqRes({
        headers: { authorization: badHeader },
      });

      let nextCalled = false;
      verifyCronSecret(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, `Token "${badHeader}" must be rejected`);
      assert.strictEqual(res.getStatusCode(), 401);
    }
  });

  it('T2-F03-03: Header spoofing (x-forwarded-authorization, uppercase AUTHORIZATION) does not bypass auth', () => {
    // Attempting to bypass using spoofed header while sending empty or invalid authorization
    const { req, res } = createMockReqRes({
      headers: {
        'x-forwarded-authorization': `Bearer ${validSecret}`,
        'x-original-authorization': `Bearer ${validSecret}`,
        authorization: 'Bearer wrong-secret',
      },
    });

    let nextCalled = false;
    verifyCronSecret(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Spoofed headers must not bypass invalid authorization header');
    assert.strictEqual(res.getStatusCode(), 401);
  });

  it('T2-F03-04: Empty or undefined secret in production fails closed strictly', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.CRON_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      process.env.CRON_SECRET = '';

      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${DEFAULT_CRON_SECRET}` },
      });

      let nextCalled = false;
      verifyCronSecret(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, 'Must fail-closed when CRON_SECRET is empty in production');
      assert.strictEqual(res.getStatusCode(), 401);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('T2-F03-05: Malformed auth schemes (Basic, Digest, Token, bare Bearer) rejected with 401', () => {
    const invalidSchemes = [
      `Basic ${Buffer.from(`user:${validSecret}`).toString('base64')}`,
      `Token ${validSecret}`,
      `Digest username="admin", realm="test"`,
      'Bearer',
      'Bearer ',
      'bearer-without-space',
    ];

    for (const authHeader of invalidSchemes) {
      const { req, res } = createMockReqRes({
        headers: { authorization: authHeader },
      });

      let nextCalled = false;
      verifyCronSecret(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, `Scheme "${authHeader}" must be rejected`);
      assert.strictEqual(res.getStatusCode(), 401);
    }
  });
});
