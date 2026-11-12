import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker, prisma } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import {
  createDeviceActor,
  createPrivilegedActor,
  mintCustomAccessToken,
  nextTestIp,
} from '../framework/authHelpers';
import { TEST_CONFIG } from '../framework/config';
import {
  BOWTIE_SELF_INTERSECTING_POLYGON,
  randomSuffix,
  randomUuid,
  nonExistentUuid,
} from '../framework/fixtures';
import { assertSuccessEnvelope } from '../framework/assertions';

/**
 * Confirmed Backend Defects Regression Suite (`BACKEND-001` .. `BACKEND-010`).
 *
 * Each test asserts the EXPECTED fixed behavior so a coding agent can verify
 * fixes deterministically. Under the unfixed baseline codebase audited in this
 * report, each case is expected to FAIL loudly and reproduce the exact defect.
 */
describe('Confirmed Defects Regression Suite (BACKEND-001..BACKEND-010)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('[BACKEND-001] Unauthenticated calls to /api/v1/cron/news-crawl must NOT exhaust authenticated cron rate-limit quota on same IP', async () => {
    const prevSecret = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'regression-cron-secret-32chars-val';
      const sameIp = '198.51.100.201';
      const unauth = new ApiClient(server.baseUrl, sameIp);
      // 3 unauthenticated probes should return 401 before touching quota
      await unauth.get('/api/v1/cron/news-crawl');
      await unauth.get('/api/v1/cron/news-crawl');
      await unauth.get('/api/v1/cron/news-crawl');

      const authed = new ApiClient(server.baseUrl, sameIp);
      const res = await authed.get('/api/v1/cron/news-crawl', {
        headers: { 'x-cron-secret': 'regression-cron-secret-32chars-val' },
      });
      assert.equal(
        res.status,
        200,
        `Expected valid cron secret to succeed (200) rather than pre-auth 429 DoS; got ${res.status}`
      );
    } finally {
      if (prevSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevSecret;
    }
  });

  it('[BACKEND-002] /auth/login should not leak refreshToken in JSON, /auth/refresh must rotate refreshToken, and /auth/logout must work with expired accessToken', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    // 1. Login JSON should omit refreshToken when HttpOnly cookie is used
    const freshClient = new ApiClient(server.baseUrl, nextTestIp());
    const userPass = 'RegressPass!999';
    const specialAdmin = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'ADMIN',
      password: userPass,
    });
    const loginRes = await freshClient.post('/api/v1/auth/login', {
      email: specialAdmin.email,
      password: userPass,
    });
    assert.equal(
      'refreshToken' in (loginRes.body?.data || {}),
      false,
      'POST /auth/login must not expose refreshToken in JSON body alongside HttpOnly cookie'
    );

    // 2. Old refreshToken must be rotated/invalidated after one /auth/refresh
    const oldRefresh = admin.refreshToken;
    await admin.client.post('/api/v1/auth/refresh', {});
    const replay = new ApiClient(server.baseUrl, nextTestIp());
    replay.setCookie('refreshToken', oldRefresh);
    const replayRes = await replay.post('/api/v1/auth/refresh', {});
    assert.equal(replayRes.status, 401, 'Reused refreshToken must fail after rotation');

    // 3. Logout with expired accessToken + valid refreshToken should still revoke session (200)
    const expiredAccess = mintCustomAccessToken(
      { id: specialAdmin.id, role: specialAdmin.role, isVerified: true, tokenUse: 'access' },
      { expiresIn: -60 }
    );
    const logoutClient = new ApiClient(server.baseUrl, nextTestIp());
    logoutClient.setCookie('accessToken', expiredAccess);
    logoutClient.setCookie('refreshToken', specialAdmin.refreshToken);
    const expiredLogout = await logoutClient.post('/api/v1/auth/logout', {});
    assert.equal(expiredLogout.status, 200);
  });

  it('[BACKEND-003] JWT_SECRET and JWT_REFRESH_SECRET in .env must be >= 32 characters without hardcoded fallbacks', async () => {
    const envRaw = dotenv.parse(
      fs.readFileSync(path.join(TEST_CONFIG.apiRoot, '.env'), 'utf8')
    );
    assert.ok(
      (envRaw.JWT_SECRET || '').length >= 32,
      `JWT_SECRET length is ${(envRaw.JWT_SECRET || '').length}; minimum 32 chars required`
    );
    assert.ok(
      (envRaw.JWT_REFRESH_SECRET || '').length >= 32,
      `JWT_REFRESH_SECRET length is ${(envRaw.JWT_REFRESH_SECRET || '').length}; minimum 32 chars required`
    );
  });

  it('[BACKEND-004] POST /api/v1/reports must reject empty string "" and >1000-char description with 400', async () => {
    const user = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    const emptyRes = await user.client.post('/api/v1/reports', {
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.75,
      longitude: 90.38,
      description: '',
    });
    if (emptyRes.status === 201 && emptyRes.body?.data?.id) tracker.trackReport(emptyRes.body.data.id);
    assert.equal(emptyRes.status, 400, `Expected 400 for empty description "", got ${emptyRes.status}`);

    const longRes = await user.client.post('/api/v1/reports', {
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.75,
      longitude: 90.38,
      description: 'A'.repeat(1500),
    });
    if (longRes.status === 201 && longRes.body?.data?.id) tracker.trackReport(longRes.body.data.id);
    assert.equal(longRes.status, 400, `Expected 400 for 1500-char description, got ${longRes.status}`);
  });

  it('[BACKEND-005] POST /api/v1/reports/:id/updates must reject whitespace-only content with 400', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);
    const report = assertSuccessEnvelope(
      await user.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'Target report for whitespace update regression',
      }),
      201
    );
    tracker.trackReport(report.id);

    const wsRes = await user.client.post(`/api/v1/reports/${report.id}/updates`, {
      content: '   ',
    });
    assert.equal(wsRes.status, 400, `Expected 400 for whitespace-only update, got ${wsRes.status}`);
  });

  it('[BACKEND-006] GET /api/v1/safe-zones must return 400 for non-numeric spatial parameters (?lat=abc&lng=def)', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const res = await publicClient.get('/api/v1/safe-zones?lat=abc&lng=def');
    assert.equal(res.status, 400, `Expected 400 for non-numeric lat/lng, got ${res.status}`);
  });

  it('[BACKEND-007] Missing resource IDs on /reports/:id/vote, /alerts/zones/:id, and /users/verify/:id/approve must return 404 (not 400)', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const missingId = nonExistentUuid();

    const voteMissing = await admin.client.post(`/api/v1/reports/${missingId}/vote`, { voteType: 1 });
    assert.equal(voteMissing.status, 404, `vote missing report returned ${voteMissing.status} instead of 404`);

    const zoneMissing = await admin.client.delete(`/api/v1/alerts/zones/${missingId}`);
    assert.equal(zoneMissing.status, 404, `delete missing alert zone returned ${zoneMissing.status} instead of 404`);

    const verifyMissing = await admin.client.post(`/api/v1/users/verify/${missingId}/approve`, {});
    assert.equal(verifyMissing.status, 404, `approve missing verification returned ${verifyMissing.status} instead of 404`);
  });

  it('[BACKEND-008] Repeat sign-in on POST /api/v1/auth/device for existing anonymousId should return 200 OK instead of 201 Created', async () => {
    const anonId = `regress-dev-${randomSuffix()}`;
    const c1 = new ApiClient(server.baseUrl, nextTestIp());
    const first = await c1.post('/api/v1/auth/device', { anonymousId: anonId });
    assert.equal(first.status, 201);
    tracker.trackUser(first.body.data.user.id);

    const c2 = new ApiClient(server.baseUrl, nextTestIp());
    const second = await c2.post('/api/v1/auth/device', { anonymousId: anonId });
    assert.equal(second.status, 200, `Expected 200 on existing device login, got ${second.status}`);
  });

  it('[BACKEND-009] API contract consistency: /media/webhook uses {success,data}, /admin/logs rejects limit>100, and /safe-zones distanceMeters is a number', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());

    const radial = assertSuccessEnvelope<any[]>(
      await publicClient.get('/api/v1/safe-zones?lat=23.75&lng=90.38&radius=5000'),
      200
    );
    if (radial.length > 0) {
      assert.equal(
        typeof radial[0].distanceMeters,
        'number',
        `Expected numeric distanceMeters, got ${typeof radial[0].distanceMeters}`
      );
    }

    const badLimit = await admin.client.get('/api/v1/admin/logs?limit=101');
    assert.equal(badLimit.status, 400, `Expected 400 on limit=101, got ${badLimit.status}`);

    const prevSec = process.env.STORAGE_WEBHOOK_SECRET;
    try {
      process.env.STORAGE_WEBHOOK_SECRET = 'regress-webhook-sec-32chars-value!';
      const hook = await publicClient.post(
        '/api/v1/media/webhook',
        { key: `reports/${randomUuid()}/${randomUuid()}.jpg` },
        { headers: { 'x-webhook-secret': 'regress-webhook-sec-32chars-value!' } }
      );
      assert.equal(hook.body?.success, true, 'Webhook response must follow { success: true, data }');
    } finally {
      if (prevSec === undefined) delete process.env.STORAGE_WEBHOOK_SECRET;
      else process.env.STORAGE_WEBHOOK_SECRET = prevSec;
    }
  });

  it('[BACKEND-010] Admin verification rejection must record a distinct rejection ModerationLog.action instead of VERIFY_USER', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const citizen = await createDeviceActor(server.baseUrl, tracker);
    const ver = assertSuccessEnvelope(
      await citizen.client.post('/api/v1/users/verify', {
        type: 'NID_DOCUMENT',
        documentUrl: 'https://cdn.example.com/kyc/reject-audit.jpg',
      }),
      201
    );
    tracker.trackVerification(ver.id);

    assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/verifications/${ver.id}/reject`, {
        reason: 'Audit distinct ModerationLog action check',
      }),
      200
    );

    const log = await prisma.moderationLog.findFirst({
      where: { targetUserId: citizen.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.notEqual(
      log?.action,
      'VERIFY_USER',
      'Rejected KYC verification should not write identical VERIFY_USER enum action as approval'
    );
  });

  it('[BACKEND-011] POST /api/v1/reports and POST /api/v1/reports/:id/vote must NOT expose reporter userId PII in response JSON', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const voter = await createDeviceActor(server.baseUrl, tracker);

    const createdRes = await author.client.post('/api/v1/reports', {
      category: 'THEFT',
      severity: 'MEDIUM',
      latitude: 23.748,
      longitude: 90.378,
      description: 'Regression check for reporter userId PII leak',
    });
    const created = assertSuccessEnvelope(createdRes, 201);
    tracker.trackReport(created.id);

    assert.equal(
      'userId' in created,
      false,
      'POST /api/v1/reports response must strip reporter userId PII'
    );

    const voteRes = await voter.client.post(`/api/v1/reports/${created.id}/vote`, {
      voteType: 1,
    });
    const voted = assertSuccessEnvelope(voteRes, 201);
    assert.equal(
      'userId' in voted,
      false,
      'POST /api/v1/reports/:id/vote must NEVER expose another reporter userId UUID to voters'
    );
  });

  it('[BACKEND-012] GET /api/v1/reports must reject inverted bounds (minLng >= maxLng or minLat >= maxLat) with 400', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const res = await publicClient.get(
      '/api/v1/reports?minLng=90.5&minLat=23.7&maxLng=90.3&maxLat=23.8'
    );
    assert.equal(
      res.status,
      400,
      `Expected 400 Bad Request for inverted minLng > maxLng bounds, got ${res.status}`
    );
  });

  it('[BACKEND-013] POST /api/v1/admin/users/:id/ban must forbid self-banning and peer-ADMIN suspension (403)', async () => {
    const admin1 = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const admin2 = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    const peerBan = await admin1.client.post(`/api/v1/admin/users/${admin2.id}/ban`, {
      reason: 'Regression check: peer admin ban safeguard',
    });
    assert.equal(
      peerBan.status,
      403,
      `Expected 403 Forbidden when banning peer ADMIN, got ${peerBan.status}`
    );

    const selfBan = await admin1.client.post(`/api/v1/admin/users/${admin1.id}/ban`, {
      reason: 'Regression check: self-ban lockout safeguard',
    });
    assert.equal(
      selfBan.status,
      403,
      `Expected 403 Forbidden on admin self-ban, got ${selfBan.status}`
    );
  });

  it('[BACKEND-014] POST /api/v1/alerts/zones must reject topologically invalid self-intersecting polygons (ST_IsValid) with 400', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);
    const res = await user.client.post('/api/v1/alerts/zones', {
      name: 'Regression Bowtie Polygon',
      coordinates: BOWTIE_SELF_INTERSECTING_POLYGON,
    });
    if (res.status === 201 && res.body?.data?.id) {
      tracker.trackAlertZone(res.body.data.id);
    }
    assert.equal(
      res.status,
      400,
      `Expected 400 for self-intersecting bowtie polygon, got ${res.status}`
    );
  });
});
