import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker, prisma } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import {
  createDeviceActor,
  createPrivilegedActor,
  nextTestIp,
} from '../framework/authHelpers';
import {
  assertErrorEnvelope,
  assertNoSensitiveLeakage,
  assertSuccessEnvelope,
} from '../framework/assertions';
import { randomSuffix } from '../framework/fixtures';

describe('API Functional: Authentication & Users Endpoints (EP-006..EP-012)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('EP-006 POST /api/v1/auth/device creates anonymous USER, sets HttpOnly cookies, and rejects mass-assignment keys via .strict()', async () => {
    const client = new ApiClient(server.baseUrl, nextTestIp());
    const anonId = `dev-fn-${randomSuffix()}`;

    // Mass-assignment attempt blocked by .strict()
    const evilRes = await client.post('/api/v1/auth/device', {
      anonymousId: anonId,
      role: 'ADMIN',
      trustScore: 9999,
      isVerified: true,
    });
    assertErrorEnvelope(evilRes, 400, 'unrecognized');

    const res = await client.post('/api/v1/auth/device', {
      anonymousId: anonId,
    });

    const data = assertSuccessEnvelope(res, 201, 'POST /auth/device');
    tracker.trackUser(data.user.id);
    assert.equal(data.user.role, 'USER');
    assert.ok(data.socketToken && typeof data.socketToken === 'string');
    assert.ok(client.getCookie('accessToken'));
    assert.ok(client.getCookie('refreshToken'));

    const dbUser = await prisma.user.findUnique({ where: { id: data.user.id } });
    assert.equal(dbUser?.role, 'USER');
    assert.equal(dbUser?.trustScore, 0);
  });

  it('EP-006 rejects empty anonymousId (400) and blocks device login on password-backed ADMIN (403)', async () => {
    const anonClient = new ApiClient(server.baseUrl, nextTestIp());
    const badRes = await anonClient.post('/api/v1/auth/device', { anonymousId: '' });
    assertErrorEnvelope(badRes, 400, 'validation');

    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const hijackRes = await anonClient.post('/api/v1/auth/device', {
      anonymousId: admin.anonymousId,
    });
    assertErrorEnvelope(hijackRes, 403);
  });

  it('EP-007 & EP-008 & EP-009 Password login -> refresh -> logout lifecycle', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    // Refresh via cookie
    const refreshRes = await admin.client.post('/api/v1/auth/refresh', {});
    const refreshData = assertSuccessEnvelope(refreshRes, 200, 'POST /auth/refresh');
    assert.ok(refreshData.socketToken);

    // Wrong password rejected 401
    const unauthClient = new ApiClient(server.baseUrl, nextTestIp());
    const badLogin = await unauthClient.post('/api/v1/auth/login', {
      email: admin.email,
      password: 'WrongPassword!123',
    });
    assertErrorEnvelope(badLogin, 401, 'invalid');

    // Logout revokes refresh token & clears cookies
    const logoutRes = await admin.client.post('/api/v1/auth/logout', {});
    assertSuccessEnvelope(logoutRes, 200, 'POST /auth/logout');
    assert.equal(admin.client.getCookie('accessToken'), undefined);
    assert.equal(admin.client.getCookie('refreshToken'), undefined);

    // Reusing previous refreshToken cookie after logout fails 401
    admin.client.setCookie('refreshToken', admin.refreshToken);
    const replayRefresh = await admin.client.post('/api/v1/auth/refresh', {});
    assertErrorEnvelope(replayRefresh, 401);
  });

  it('EP-010 GET /api/v1/users/me returns sanitized profile with counts and never leaks passwordHash/anonymousId', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);
    const res = await user.client.get('/api/v1/users/me');
    const data = assertSuccessEnvelope(res, 200, 'GET /users/me');
    assert.equal(data.id, user.id);
    assert.equal(data.role, 'USER');
    assert.ok(data._count && typeof data._count.reports === 'number');
    assertNoSensitiveLeakage(res.body);
  });

  it('EP-011 & EP-012 POST /api/v1/users/verify (PHONE_OTP & NID_DOCUMENT) + legacy /users/verify/:id/approve', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const citizen = await createDeviceActor(server.baseUrl, tracker);

    // Invalid BD phone rejected
    const badPhone = await citizen.client.post('/api/v1/users/verify', {
      type: 'PHONE_OTP',
      phoneNumber: '1234567',
    });
    assertErrorEnvelope(badPhone, 400);

    // Missing phoneNumber on PHONE_OTP rejected
    const missingField = await citizen.client.post('/api/v1/users/verify', {
      type: 'PHONE_OTP',
    });
    assertErrorEnvelope(missingField, 400);

    // Valid PHONE_OTP
    const uniquePhone = `017${String(Math.floor(10000000 + Math.random() * 89999999))}`;
    const verifyRes = await citizen.client.post('/api/v1/users/verify', {
      type: 'PHONE_OTP',
      phoneNumber: uniquePhone,
    });
    const verification = assertSuccessEnvelope(verifyRes, 201, 'POST /users/verify PHONE_OTP');
    tracker.trackVerification(verification.id);
    assert.equal(verification.status, 'PENDING');

    // Duplicate PENDING blocked
    const dupRes = await citizen.client.post('/api/v1/users/verify', {
      type: 'NID_DOCUMENT',
      documentUrl: 'https://cdn.example.com/nid.png',
    });
    assertErrorEnvelope(dupRes, 400, 'pending');

    // Approve via EP-012
    const approveRes = await admin.client.post(
      `/api/v1/users/verify/${verification.id}/approve`,
      {}
    );
    const approveData = assertSuccessEnvelope(approveRes, 200, 'POST /users/verify/:id/approve');
    assert.equal(approveData.userId, citizen.id);
    assert.equal(approveData.role, 'VERIFIED_RESPONDER');

    // Verify NID_DOCUMENT path on second user
    const citizen2 = await createDeviceActor(server.baseUrl, tracker);
    const nidRes = await citizen2.client.post('/api/v1/users/verify', {
      type: 'NID_DOCUMENT',
      documentUrl: 'https://cdn.example.com/kyc/nid-front.jpg',
    });
    const nidData = assertSuccessEnvelope(nidRes, 201, 'POST /users/verify NID_DOCUMENT');
    tracker.trackVerification(nidData.id);
    assert.equal(nidData.type, 'NID_DOCUMENT');
  });
});
