import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
import { nonExistentUuid } from '../framework/fixtures';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';

const execFileAsync = promisify(execFile);

/**
 * Post-Fix Verification & Boundary Expansion Regression Suite.
 *
 * Covers sub-clauses, edge cases, and boundary conditions of BACKEND-001..BACKEND-014
 * that were not explicitly exercised by 01-confirmed-defects-regression.test.ts.
 */
describe('Post-Fix Edge Cases & Coverage Expansion Suite (BACKEND-001..BACKEND-014)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('[BACKEND-001] POST /cron/news-crawl ordering, unref cleanup timer, and all newly added route rate limiters enforce 429', async () => {
    // 1. POST /api/v1/cron/news-crawl must verify secret BEFORE consuming IP rate-limit quota
    const prevSecret = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'post-fix-cron-secret-32chars-val!';
      const cronIp = nextTestIp();
      const unauthCron = new ApiClient(server.baseUrl, cronIp);
      for (let i = 0; i < 3; i += 1) {
        const res = await unauthCron.post('/api/v1/cron/news-crawl', {});
        assert.equal(res.status, 401);
      }
      const authedCron = await new ApiClient(server.baseUrl, cronIp).post(
        '/api/v1/cron/news-crawl',
        {},
        { headers: { 'x-cron-secret': 'post-fix-cron-secret-32chars-val!' } }
      );
      assert.equal(authedCron.status, 200);
    } finally {
      if (prevSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevSecret;
    }

    // 2. Cleanup interval calls .unref() so importing rateLimiter does not hang Node process exit
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', '-e', "import './src/middleware/rateLimiter.ts'"],
      { cwd: TEST_CONFIG.apiRoot, timeout: 8000 }
    );

    // 3. Verify all 6 newly protected endpoints enforce 429 RATE_LIMIT_EXCEEDED
    const deviceClient = new ApiClient(server.baseUrl, nextTestIp());
    for (let i = 0; i < 20; i += 1) {
      const r = await deviceClient.post('/api/v1/auth/device', {});
      assert.equal(r.status, 400);
    }
    const device429 = await deviceClient.post('/api/v1/auth/device', {});
    assertErrorEnvelope(device429, 429);
    assert.equal(device429.body?.error?.code, 'RATE_LIMIT_EXCEEDED');

    const refreshClient = new ApiClient(server.baseUrl, nextTestIp());
    for (let i = 0; i < 30; i += 1) {
      const r = await refreshClient.post('/api/v1/auth/refresh', {});
      assert.equal(r.status, 401);
    }
    const refresh429 = await refreshClient.post('/api/v1/auth/refresh', {});
    assertErrorEnvelope(refresh429, 429);
    assert.equal(refresh429.body?.error?.code, 'RATE_LIMIT_EXCEEDED');

    const safeRouteClient = new ApiClient(server.baseUrl, nextTestIp());
    for (let batch = 0; batch < 12; batch += 1) {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => safeRouteClient.post('/api/v1/routes/safe-path', {}))
      );
      for (const r of responses) assert.equal(r.status, 400);
    }
    const route429 = await safeRouteClient.post('/api/v1/routes/safe-path', {});
    assertErrorEnvelope(route429, 429);
    assert.equal(route429.body?.error?.code, 'RATE_LIMIT_EXCEEDED');

    // Authenticated rate-limited endpoints: use actor bearer with dedicated IP per endpoint
    const actor = await createDeviceActor(server.baseUrl, tracker);
    const dummyReportId = nonExistentUuid();

    const verifyIp = nextTestIp();
    const verifyClient = new ApiClient(server.baseUrl, verifyIp);
    verifyClient.setBearerToken(actor.accessToken);
    const verifyWarmup = await Promise.all(
      Array.from({ length: 10 }, () => verifyClient.post('/api/v1/users/verify', {}))
    );
    for (const r of verifyWarmup) assert.equal(r.status, 400);
    const verify429 = await verifyClient.post('/api/v1/users/verify', {});
    assertErrorEnvelope(verify429, 429);

    const updateClient = new ApiClient(server.baseUrl, nextTestIp());
    updateClient.setBearerToken(actor.accessToken);
    for (let b = 0; b < 2; b += 1) {
      const batch = await Promise.all(
        Array.from({ length: 10 }, () =>
          updateClient.post(`/api/v1/reports/${dummyReportId}/updates`, {})
        )
      );
      for (const r of batch) assert.equal(r.status, 400);
    }
    const update429 = await updateClient.post(`/api/v1/reports/${dummyReportId}/updates`, {});
    assertErrorEnvelope(update429, 429);

    const voteClient = new ApiClient(server.baseUrl, nextTestIp());
    voteClient.setBearerToken(actor.accessToken);
    for (let b = 0; b < 6; b += 1) {
      const batch = await Promise.all(
        Array.from({ length: 10 }, () =>
          voteClient.post(`/api/v1/reports/${dummyReportId}/vote`, {})
        )
      );
      for (const r of batch) assert.equal(r.status, 400);
    }
    const vote429 = await voteClient.post(`/api/v1/reports/${dummyReportId}/vote`, {});
    assertErrorEnvelope(vote429, 429);
  });

  it('[BACKEND-002] Login omits accessToken & refreshToken JSON, /refresh rotates DB row & cookie, expired-access /logout revokes DB row & clears cookies', async () => {
    const password = 'EdgeSessionPass!2026';
    const admin = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'ADMIN',
      password,
    });

    const loginClient = new ApiClient(server.baseUrl, nextTestIp());
    const loginRes = await loginClient.post('/api/v1/auth/login', {
      email: admin.email,
      password,
    });
    const loginData = assertSuccessEnvelope(loginRes, 200);
    assert.equal('refreshToken' in loginData, false, 'refreshToken must not be in login JSON');
    assert.equal('accessToken' in loginData, false, 'accessToken must not be in login JSON');
    assert.ok(typeof loginData.socketToken === 'string' && loginData.socketToken.length > 0);

    const initialRefresh = loginClient.getCookie('refreshToken')!;
    assert.ok(initialRefresh);

    // Refresh issues a distinct rotated cookie and marks previous DB token revoked
    const refreshRes = await loginClient.post('/api/v1/auth/refresh', {});
    assertSuccessEnvelope(refreshRes, 200);
    const rotatedRefresh = loginClient.getCookie('refreshToken')!;
    assert.ok(rotatedRefresh && rotatedRefresh !== initialRefresh, 'refreshToken cookie must rotate');

    const oldRow = await prisma.refreshToken.findUnique({ where: { token: initialRefresh } });
    const newRow = await prisma.refreshToken.findUnique({ where: { token: rotatedRefresh } });
    assert.equal(oldRow?.isRevoked, true, 'Consumed RefreshToken DB row must be revoked');
    assert.equal(newRow?.isRevoked, false, 'Rotated RefreshToken DB row must be active');

    // Expired access token + valid refresh cookie -> logout returns 200, revokes DB row, clears both cookies
    const expiredAccess = mintCustomAccessToken(
      { id: admin.id, role: admin.role, isVerified: true, tokenUse: 'access' },
      { expiresIn: -120 }
    );
    const logoutClient = new ApiClient(server.baseUrl, nextTestIp());
    logoutClient.setCookie('accessToken', expiredAccess);
    logoutClient.setCookie('refreshToken', rotatedRefresh);
    const logoutRes = await logoutClient.post('/api/v1/auth/logout', {});
    assertSuccessEnvelope(logoutRes, 200);

    assert.equal(logoutClient.getCookie('accessToken'), undefined);
    assert.equal(logoutClient.getCookie('refreshToken'), undefined);
    assert.ok(
      logoutRes.setCookies.some((c) => c.startsWith('accessToken=')),
      'Set-Cookie must clear accessToken'
    );
    assert.ok(
      logoutRes.setCookies.some((c) => c.startsWith('refreshToken=')),
      'Set-Cookie must clear refreshToken'
    );

    const revokedAfterLogout = await prisma.refreshToken.findUnique({
      where: { token: rotatedRefresh },
    });
    assert.equal(revokedAfterLogout?.isRevoked, true);
  });

  it('[BACKEND-003] Booting env.ts fails closed when JWT_SECRET or JWT_REFRESH_SECRET is empty or < 32 chars', async () => {
    for (const overrideEnv of [
      { JWT_SECRET: '', JWT_REFRESH_SECRET: 'b'.repeat(32) },
      { JWT_SECRET: 'short-access-secret-31chars-val', JWT_REFRESH_SECRET: 'b'.repeat(32) },
      { JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'short-refresh-secret-31char' },
    ]) {
      let failed = false;
      try {
        await execFileAsync(
          process.execPath,
          ['--import', 'tsx', '-e', "import './src/config/env.ts'"],
          {
            cwd: TEST_CONFIG.apiRoot,
            env: { ...process.env, ...overrideEnv },
            timeout: 8000,
          }
        );
      } catch (err: any) {
        failed = true;
        assert.notEqual(err.code, 0, 'env.ts must exit non-zero on invalid JWT secrets');
      }
      assert.equal(failed, true, `Expected fail-closed startup failure for ${JSON.stringify(overrideEnv)}`);
    }
  });

  it('[BACKEND-004 & BACKEND-005] Report description & update content enforce exact whitespace/1000-char boundaries', async () => {
    const responder = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    // Whitespace-only -> 400
    assertErrorEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: '     ',
      }),
      400
    );

    // 1001 chars -> 400
    assertErrorEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'X'.repeat(1001),
      }),
      400
    );

    // Exact 1000 chars -> 201
    const maxReport = assertSuccessEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'Y'.repeat(1000),
      }),
      201
    );
    tracker.trackReport(maxReport.id);

    // Omitted description -> 201
    const omittedReport = assertSuccessEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.751,
        longitude: 90.381,
      }),
      201
    );
    tracker.trackReport(omittedReport.id);

    // Report updates: " a " trims to 1 char (< min 2) -> 400; "  ok  " trims to "ok" -> 201
    assertErrorEnvelope(
      await responder.client.post(`/api/v1/reports/${omittedReport.id}/updates`, {
        content: ' a ',
      }),
      400
    );
    const okUpdate = assertSuccessEnvelope(
      await responder.client.post(`/api/v1/reports/${omittedReport.id}/updates`, {
        content: '  ok  ',
      }),
      201
    );
    assert.equal(okUpdate.content, 'ok');
  });

  it('[BACKEND-006 & BACKEND-012] Strict spatial coordinate bounds, trailing garbage, and inverted bounding box checks', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());

    const badSafeZoneQueries = [
      '/api/v1/safe-zones?lat=95&lng=90.3',
      '/api/v1/safe-zones?lat=23.7&lng=90.3&radius=-10',
      '/api/v1/safe-zones?lat=23.7',
      '/api/v1/safe-zones?minLng=90.3abc&minLat=23.7&maxLng=90.4&maxLat=23.8',
      '/api/v1/safe-zones?minLng=90.5&minLat=23.7&maxLng=90.3&maxLat=23.8',
    ];
    for (const q of badSafeZoneQueries) {
      assertErrorEnvelope(await publicClient.get(q), 400, undefined, q);
    }

    const badReportBoundsQueries = [
      '/api/v1/reports?minLng=90.3&minLat=23.9&maxLng=90.4&maxLat=23.7',
      '/api/v1/reports?minLng=90.3abc&minLat=23.7&maxLng=90.4&maxLat=23.8',
      '/api/v1/reports?minLng=90.3&minLat=-95&maxLng=90.4&maxLat=23.8',
    ];
    for (const q of badReportBoundsQueries) {
      assertErrorEnvelope(await publicClient.get(q), 400, undefined, q);
    }
  });

  it('[BACKEND-009 & BACKEND-010] Envelopes (/health*, /), strict /admin/logs & /analytics/trends params, legacy approve UUID validation & action filter', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());

    for (const ep of ['/', '/health', '/health/db', '/api/v1/health', '/api/v1/health/db']) {
      const data = assertSuccessEnvelope(await publicClient.get(ep), 200, ep);
      assert.ok(data && typeof data === 'object');
    }

    for (const badAdminQuery of [
      '/api/v1/admin/logs?limit=abc',
      '/api/v1/admin/logs?page=0',
      '/api/v1/admin/logs?extra=1',
      '/api/v1/admin/analytics/trends?days=7',
    ]) {
      assertErrorEnvelope(await admin.client.get(badAdminQuery), 400, undefined, badAdminQuery);
    }

    // Legacy approve route validates UUID param syntax -> 400
    assertErrorEnvelope(
      await admin.client.post('/api/v1/users/verify/not-a-valid-uuid/approve', {}),
      400
    );

    // Filter logs by REJECT_VERIFICATION enum returns only rejection actions
    const citizen = await createDeviceActor(server.baseUrl, tracker);
    const ver = assertSuccessEnvelope(
      await citizen.client.post('/api/v1/users/verify', {
        type: 'NID_DOCUMENT',
        documentUrl: 'https://cdn.example.com/kyc/filter-check.jpg',
      }),
      201
    );
    tracker.trackVerification(ver.id);
    assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/verifications/${ver.id}/reject`, {
        reason: 'Filter verification test',
      }),
      200
    );

    const rejLogs = assertSuccessEnvelope<{ logs: any[] }>(
      await admin.client.get('/api/v1/admin/logs?action=REJECT_VERIFICATION&limit=20'),
      200
    );
    assert.ok(rejLogs.logs.some((l) => l.targetUserId === citizen.id && l.action === 'REJECT_VERIFICATION'));
    assert.ok(rejLogs.logs.every((l) => l.action === 'REJECT_VERIFICATION'));
  });
});
