import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { createDeviceActor, createPrivilegedActor, nextTestIp } from '../framework/authHelpers';
import { ApiClient } from '../framework/apiClient';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';

describe('Workflows Suite: Multi-Step End-to-End Business Journeys', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('E2E Onboarding -> KYC Approval -> Role Promotion -> Cooldown Exemption -> Third-Party Resolve', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const citizen = await createDeviceActor(server.baseUrl, tracker);
    const victimAuthor = await createDeviceActor(server.baseUrl, tracker);

    // 1. Citizen creates first report -> 15m cooldown starts
    const rep1 = assertSuccessEnvelope(
      await citizen.client.post('/api/v1/reports', {
        category: 'UNLIT_ROAD',
        severity: 'LOW',
        latitude: 23.745,
        longitude: 90.375,
        description: 'Citizen initial hazard submission',
      }),
      201
    );
    tracker.trackReport(rep1.id);

    // Cooldown prevents 2nd immediate report
    assertErrorEnvelope(
      await citizen.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.746,
        longitude: 90.376,
        description: 'Should hit 429 cooldown',
      }),
      429
    );

    // 2. Citizen submits KYC -> Admin approves
    const ver = assertSuccessEnvelope(
      await citizen.client.post('/api/v1/users/verify', {
        type: 'NID_DOCUMENT',
        documentUrl: 'https://cdn.example.com/kyc/e2e-nid.jpg',
      }),
      201
    );
    tracker.trackVerification(ver.id);

    const approved = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/verifications/${ver.id}/approve`, {
        notes: 'Verified responder onboarding E2E',
      }),
      200
    );
    assert.equal(approved.role, 'VERIFIED_RESPONDER');

    // 3. Citizen calls /auth/refresh to obtain updated JWT carrying VERIFIED_RESPONDER role
    assertSuccessEnvelope(await citizen.client.post('/api/v1/auth/refresh', {}), 200);

    // 4. Cooldown is now exempted -> immediate report succeeds!
    const rep2 = assertSuccessEnvelope(
      await citizen.client.post('/api/v1/reports', {
        category: 'ROAD_ACCIDENT',
        severity: 'MEDIUM',
        latitude: 23.747,
        longitude: 90.377,
        description: 'Responder post-promotion immediate report',
      }),
      201
    );
    tracker.trackReport(rep2.id);

    // 5. Victim author posts a report; promoted responder can resolve it
    const victimRep = assertSuccessEnvelope(
      await victimAuthor.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'HIGH',
        latitude: 23.749,
        longitude: 90.379,
        description: 'Third-party hazard awaiting responder resolution',
      }),
      201
    );
    tracker.trackReport(victimRep.id);

    const resolved = assertSuccessEnvelope(
      await citizen.client.patch(`/api/v1/reports/${victimRep.id}/resolve`, {}),
      200
    );
    assert.equal(resolved.status, 'RESOLVED');

    // 6. Confirm /stats reflects changes cleanly
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const stats = assertSuccessEnvelope(await publicClient.get('/api/v1/stats'), 200);
    assert.ok(stats.resolvedReports >= 1);
  });

  it('E2E Hazard Routing Lifecycle: Active HIGH hazard triggers detour -> RESOLVED removes hazard from safe-path', async () => {
    const responder = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());

    const corridorReport = assertSuccessEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'ROBBERY',
        severity: 'HIGH',
        latitude: 23.748,
        longitude: 90.38,
        description: 'E2E active corridor blockade',
      }),
      201
    );
    tracker.trackReport(corridorReport.id);

    const activeRoute = assertSuccessEnvelope(
      await publicClient.post('/api/v1/routes/safe-path', {
        startLat: 23.738,
        startLng: 90.37,
        endLat: 23.758,
        endLng: 90.39,
      }),
      200
    );
    assert.ok(
      activeRoute.bypassedHazards.some((h: any) => h.id === corridorReport.id),
      'Active hazard must appear in bypassedHazards'
    );

    // Resolve the hazard
    assertSuccessEnvelope(
      await responder.client.patch(`/api/v1/reports/${corridorReport.id}/resolve`, {}),
      200
    );

    const resolvedRoute = assertSuccessEnvelope(
      await publicClient.post('/api/v1/routes/safe-path', {
        startLat: 23.738,
        startLng: 90.37,
        endLat: 23.758,
        endLng: 90.39,
      }),
      200
    );
    assert.equal(
      resolvedRoute.bypassedHazards.some((h: any) => h.id === corridorReport.id),
      false,
      'Resolved hazard must no longer trigger safe-path detour'
    );
  });
});
