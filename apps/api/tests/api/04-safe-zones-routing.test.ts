import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createPrivilegedActor, nextTestIp } from '../framework/authHelpers';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';
import { nonExistentUuid } from '../framework/fixtures';

describe('API Functional: Safe Zones & Safe-Path Routing (EP-020..EP-023)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('EP-020, EP-021, EP-022 Safe Zones public queries (default, bounds, radial, type) & Admin Create/Delete', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    // Create custom safe zone via ADMIN
    const created = assertSuccessEnvelope(
      await admin.client.post('/api/v1/safe-zones', {
        type: 'POLICE_BOX',
        name: 'Audit Test Police Outpost',
        latitude: 23.7488,
        longitude: 90.3788,
      }),
      201,
      'POST /safe-zones'
    );
    tracker.trackSafeZone(created.id);
    assert.equal(created.type, 'POLICE_BOX');

    // Bounds query with type filter returns created safe zone
    const boundsRes = await publicClient.get(
      '/api/v1/safe-zones?minLng=90.37&minLat=23.74&maxLng=90.39&maxLat=23.76&type=POLICE_BOX'
    );
    const boundsZones = assertSuccessEnvelope<any[]>(boundsRes, 200);
    assert.ok(boundsZones.some((z) => z.id === created.id));

    // Radial query returns distanceMeters
    const radialRes = await publicClient.get(
      '/api/v1/safe-zones?lat=23.7488&lng=90.3788&radius=2000'
    );
    const radialZones = assertSuccessEnvelope<any[]>(radialRes, 200);
    const match = radialZones.find((z) => z.id === created.id);
    assert.ok(match);
    assert.ok('distanceMeters' in match);

    // Delete safe zone
    const delRes = await admin.client.delete(`/api/v1/safe-zones/${created.id}`);
    const delData = assertSuccessEnvelope(delRes, 200);
    assert.equal(delData.deleted, true);

    // Deleting missing UUID yields 404
    const missingDel = await admin.client.delete(`/api/v1/safe-zones/${nonExistentUuid()}`);
    assertErrorEnvelope(missingDel, 404, 'not found');
  });

  it('EP-023 POST /api/v1/routes/safe-path rejects out-of-Bangladesh bounds, nested payloads, and detours around HIGH hazard', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    // Out of Bangladesh bounds -> 400
    const outsideRes = await publicClient.post('/api/v1/routes/safe-path', {
      startLat: 51.5074,
      startLng: -0.1278,
      endLat: 51.515,
      endLng: -0.1,
    });
    assertErrorEnvelope(outsideRes, 400, 'bangladesh');

    // Nested payload rejected by .strict()
    const nestedRes = await publicClient.post('/api/v1/routes/safe-path', {
      start: { lat: 23.738, lng: 90.37 },
      end: { lat: 23.758, lng: 90.39 },
    });
    assertErrorEnvelope(nestedRes, 400);

    // Plant a HIGH severity hazard strictly on midpoint between (23.738, 90.37) and (23.758, 90.39)
    const hazard = assertSuccessEnvelope(
      await admin.client.post('/api/v1/reports', {
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: 23.748,
        longitude: 90.38,
        description: 'Corridor hazard for detour calculation verification',
      }),
      201
    );
    tracker.trackReport(hazard.id);

    const routeRes = await publicClient.post('/api/v1/routes/safe-path', {
      startLat: 23.738,
      startLng: 90.37,
      endLat: 23.758,
      endLng: 90.39,
    });
    const routeData = assertSuccessEnvelope(routeRes, 200, 'POST /routes/safe-path');
    assert.ok(routeData.bypassedHazardsCount >= 1, 'Expected active midpoint hazard to be bypassed');
    assert.equal(routeData.safetyRating, 'HIGH_SAFETY');
    assert.ok(routeData.waypoints.length >= 3, 'Expected orthogonal detour waypoint in polyline');
    assert.ok(routeData.safeDistanceMeters >= routeData.directDistanceMeters);
  });
});
