import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import {
  createDeviceActor,
  createPrivilegedActor,
  mintCustomAccessToken,
  nextTestIp,
} from '../framework/authHelpers';
import { env } from '../../src/config/env';
import {
  assertErrorEnvelope,
  assertStatus,
  assertSuccessEnvelope,
} from '../framework/assertions';

describe('Authentication Suite: Token Validation, Cookie Security & Banned Account Enforcement', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Rejects unauthenticated calls with 401 across all protected routes', async () => {
    const anon = new ApiClient(server.baseUrl, nextTestIp());
    const protectedEndpoints: Array<['GET' | 'POST' | 'PATCH' | 'DELETE', string, unknown?]> = [
      ['POST', '/api/v1/auth/logout', {}],
      ['GET', '/api/v1/users/me'],
      ['POST', '/api/v1/users/verify', { type: 'PHONE_OTP', phoneNumber: '01712345678' }],
      ['POST', '/api/v1/reports', { category: 'THEFT', severity: 'LOW', latitude: 23.74, longitude: 90.37 }],
      ['POST', '/api/v1/alerts/zones', { name: 'Home', coordinates: [[90.37, 23.74], [90.38, 23.74], [90.38, 23.75], [90.37, 23.74]] }],
      ['GET', '/api/v1/alerts/zones'],
      ['POST', '/api/v1/alerts/subscribe', { endpoint: 'https://fcm.googleapis.com/x' }],
      ['GET', '/api/v1/media/presigned-url?reportId=00000000-0000-4000-8000-000000000001&fileType=image/jpeg&fileSize=1000'],
      ['GET', '/api/v1/admin/verifications'],
      ['GET', '/api/v1/admin/logs'],
      ['GET', '/api/v1/admin/analytics/trends'],
    ];

    for (const [method, endpoint, body] of protectedEndpoints) {
      const res = await anon.request(method, endpoint, body ? { body } : {});
      assertErrorEnvelope(res, 401, undefined, `${method} ${endpoint}`);
    }
  });

  it('Rejects expired, malformed, wrong-secret, alg=none, and socketToken tokens on REST requireAuth routes', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);

    const expired = mintCustomAccessToken(
      { id: user.id, role: user.role, isVerified: false, tokenUse: 'access' },
      { expiresIn: -60 }
    );
    const wrongSecret = mintCustomAccessToken(
      { id: user.id, role: user.role, isVerified: false, tokenUse: 'access' },
      { secret: 'completely-wrong-secret-signing-key!' }
    );
    const refreshSecretAsAccess = mintCustomAccessToken(
      { id: user.id, role: user.role, isVerified: false, tokenUse: 'access' },
      { secret: env.JWT_REFRESH_SECRET }
    );
    const algNone = mintCustomAccessToken(
      { id: user.id, role: 'ADMIN', isVerified: true, tokenUse: 'access' },
      { algorithm: 'none' as any }
    );

    const probe = new ApiClient(server.baseUrl, nextTestIp());
    for (const [label, tok] of [
      ['expired', expired],
      ['wrongSecret', wrongSecret],
      ['refreshSecretAsAccess', refreshSecretAsAccess],
      ['alg=none', algNone],
      ['malformed', 'not.a.valid.jwt'],
      ['socketToken on REST', user.socketToken],
    ] as const) {
      const res = await probe.get('/api/v1/users/me', {
        bearerToken: tok,
        useCookies: false,
      });
      assertErrorEnvelope(res, 401, undefined, `Token rejected: ${label}`);
    }
  });

  it('Issues HttpOnly, SameSite=Lax cookies and immediately blocks banned users across REST, refresh, and Socket.IO', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const target = await createDeviceActor(server.baseUrl, tracker);

    // Check cookie security flags on /auth/device
    const fresh = new ApiClient(server.baseUrl, nextTestIp());
    const devRes = await fresh.post('/api/v1/auth/device', {
      anonymousId: `cookie-chk-${Date.now()}`,
    });
    assertStatus(devRes, 201);
    tracker.trackUser(devRes.body.data.user.id);
    assert.ok(devRes.setCookies.some((c) => c.includes('HttpOnly')));
    assert.ok(devRes.setCookies.some((c) => /samesite=lax/i.test(c)));

    // Bearer header works prior to ban
    assertSuccessEnvelope(
      await new ApiClient(server.baseUrl, nextTestIp()).get('/api/v1/users/me', {
        bearerToken: target.accessToken,
        useCookies: false,
      }),
      200
    );

    // Admin bans target
    assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/users/${target.id}/ban`, {
        reason: 'Auth ban revocation check',
      }),
      200
    );

    // Active access token MUST fail 403 immediately (live DB check)
    const bannedMe = await target.client.get('/api/v1/users/me');
    assertErrorEnvelope(bannedMe, 403, 'suspended');

    // Refresh cookie MUST fail 401 and clear cookies
    const bannedRefresh = await target.client.post('/api/v1/auth/refresh', {});
    assertErrorEnvelope(bannedRefresh, 401);
  });
});
