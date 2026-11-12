import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { createDeviceActor, createPrivilegedActor } from '../framework/authHelpers';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';
import { SMALL_DHAKA_POLYGON, TEST_MEDIA, nonExistentUuid } from '../framework/fixtures';

describe('Authorization Suite: RBAC Matrix & Cross-Tenant BOLA/IDOR Checks', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Vertical privilege boundary: USER & VERIFIED_RESPONDER receive 403 on all ADMIN endpoints', async () => {
    const citizen = await createDeviceActor(server.baseUrl, tracker);
    const responder = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    const adminOnlyRequests: Array<['GET' | 'POST' | 'DELETE', string, unknown?]> = [
      ['GET', '/api/v1/admin/verifications'],
      ['POST', `/api/v1/admin/verifications/${nonExistentUuid()}/approve`, {}],
      ['POST', `/api/v1/admin/verifications/${nonExistentUuid()}/reject`, { reason: 'No perm' }],
      ['POST', `/api/v1/admin/users/${nonExistentUuid()}/ban`, { reason: 'No perm' }],
      ['POST', `/api/v1/admin/users/${nonExistentUuid()}/unban`, { reason: 'No perm' }],
      ['POST', `/api/v1/admin/reports/${nonExistentUuid()}/purge`, { reason: 'No perm' }],
      ['GET', '/api/v1/admin/logs'],
      ['GET', '/api/v1/admin/analytics/trends'],
      ['POST', '/api/v1/admin/news/crawl', {}],
      ['POST', `/api/v1/users/verify/${nonExistentUuid()}/approve`, {}],
      ['POST', '/api/v1/safe-zones', { type: 'HOSPITAL', name: 'Blocked Clinic', latitude: 23.75, longitude: 90.38 }],
      ['DELETE', `/api/v1/safe-zones/${nonExistentUuid()}`],
    ];

    for (const actor of [citizen, responder]) {
      for (const [method, url, body] of adminOnlyRequests) {
        const res = await actor.client.request(method, url, body ? { body } : {});
        assertErrorEnvelope(res, 403, undefined, `${actor.role} -> ${method} ${url}`);
      }
    }
  });

  it('Horizontal BOLA/IDOR: User B cannot resolve User A report, delete User A alert zone, or attach media to User A report', async () => {
    const owner = await createDeviceActor(server.baseUrl, tracker);
    const intruder = await createDeviceActor(server.baseUrl, tracker);
    const responder = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    const report = assertSuccessEnvelope(
      await owner.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'MEDIUM',
        latitude: 23.747,
        longitude: 90.377,
        description: 'Ownership isolation report',
      }),
      201
    );
    tracker.trackReport(report.id);

    const zone = assertSuccessEnvelope(
      await owner.client.post('/api/v1/alerts/zones', {
        name: 'Owner Private Zone',
        coordinates: SMALL_DHAKA_POLYGON,
      }),
      201
    );
    tracker.trackAlertZone(zone.id);

    // Intruder cannot list owner's zones
    const intruderZones = assertSuccessEnvelope<any[]>(
      await intruder.client.get('/api/v1/alerts/zones'),
      200
    );
    assert.equal(intruderZones.some((z) => z.id === zone.id), false);

    // Intruder cannot delete owner's zone -> 403
    assertErrorEnvelope(
      await intruder.client.delete(`/api/v1/alerts/zones/${zone.id}`),
      403
    );

    // Intruder cannot request media presigned URL, confirm, or mock-upload for owner's report -> 403
    assertErrorEnvelope(
      await intruder.client.get(
        `/api/v1/media/presigned-url?reportId=${report.id}&fileType=image/png&fileSize=1024`
      ),
      403
    );
    assertErrorEnvelope(
      await intruder.client.post('/api/v1/media/confirm', {
        reportId: report.id,
        fileKey: `reports/${report.id}/00000000-0000-4000-8000-000000000001.png`,
      }),
      403
    );
    assertErrorEnvelope(
      await intruder.client.post('/api/v1/media/mock-upload', {
        reportId: report.id,
        imageDataUrl: TEST_MEDIA.validPngDataUrl,
      }),
      403
    );

    // Intruder USER cannot resolve owner's report -> 403
    assertErrorEnvelope(
      await intruder.client.patch(`/api/v1/reports/${report.id}/resolve`, {}),
      403
    );

    // VERIFIED_RESPONDER CAN resolve another user's report -> 200
    const responderResolve = assertSuccessEnvelope(
      await responder.client.patch(`/api/v1/reports/${report.id}/resolve`, {}),
      200
    );
    assert.equal(responderResolve.status, 'RESOLVED');
  });

  it('Ban authorization guard: non-admin USER receives 403 trying to ban a target while ADMIN succeeds (200)', async () => {
    const admin1 = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const citizen = await createDeviceActor(server.baseUrl, tracker);
    const target = await createDeviceActor(server.baseUrl, tracker);

    assertErrorEnvelope(
      await citizen.client.post(`/api/v1/admin/users/${target.id}/ban`, {
        reason: 'Privilege escalation check',
      }),
      403
    );

    const okBan = assertSuccessEnvelope(
      await admin1.client.post(`/api/v1/admin/users/${target.id}/ban`, {
        reason: 'Authorized admin moderation ban',
      }),
      200
    );
    assert.equal(okBan.user.isBanned, true);
  });
});
