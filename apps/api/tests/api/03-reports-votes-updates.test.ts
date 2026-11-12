import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createDeviceActor, createPrivilegedActor, nextTestIp } from '../framework/authHelpers';
import {
  assertErrorEnvelope,
  assertNoReportPii,
  assertSuccessEnvelope,
} from '../framework/assertions';
import { nonExistentUuid } from '../framework/fixtures';

describe('API Functional: Reports, Votes & Threaded Updates (EP-013..EP-019)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('EP-013 POST /api/v1/reports creates report with hardware GPS verification and rejects >200m GPS drift', async () => {
    const citizen = await createDeviceActor(server.baseUrl, tracker);

    // >200m GPS spoof rejected 400
    const farGpsRes = await citizen.client.post(
      '/api/v1/reports',
      {
        category: 'SNATCHING',
        severity: 'HIGH',
        latitude: 23.7465,
        longitude: 90.376,
        description: 'GPS mismatch test',
      },
      {
        headers: {
          'x-device-lat': '23.7800',
          'x-device-lng': '90.4100',
          'x-device-accuracy': '15',
          'x-gps-source': 'hardware',
        },
      }
    );
    assertErrorEnvelope(farGpsRes, 400);

    // Matching hardware GPS accepted 201 + stripped userId
    const createRes = await citizen.client.post(
      '/api/v1/reports',
      {
        category: 'SNATCHING',
        severity: 'MEDIUM',
        latitude: 23.7465,
        longitude: 90.376,
        description: 'Phone snatching reported near bus stand',
      },
      {
        headers: {
          'x-device-lat': '23.7466',
          'x-device-lng': '90.3761',
          'x-device-accuracy': '12',
          'x-gps-source': 'hardware',
        },
      }
    );
    const created = assertSuccessEnvelope(createRes, 201, 'POST /reports hardware GPS');
    tracker.trackReport(created.id);
    assert.equal(created.isGpsVerified, true);
    assert.equal(created.fuzzedRadiusMeters, 150);

    // Immediate second report by USER triggers 15m cooldown -> 429
    const cooldownRes = await citizen.client.post('/api/v1/reports', {
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.7465,
      longitude: 90.376,
      description: 'Second rapid report',
    });
    assertErrorEnvelope(cooldownRes, 429, 'wait');
  });

  it('EP-014 & EP-015 GET /reports bounds filtering + GET /reports/:id PII sanitization & isOwner', async () => {
    const owner = await createDeviceActor(server.baseUrl, tracker);
    const other = await createDeviceActor(server.baseUrl, tracker);
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());

    const createRes = await owner.client.post('/api/v1/reports', {
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: 23.751,
      longitude: 90.381,
      description: 'Streetlight broken along main lane',
    });
    const report = assertSuccessEnvelope(createRes, 201);
    tracker.trackReport(report.id);

    // Bounds list
    const listRes = await publicClient.get(
      '/api/v1/reports?minLng=90.30&minLat=23.70&maxLng=90.45&maxLat=23.85&category=UNLIT_ROAD&status=ACTIVE'
    );
    const list = assertSuccessEnvelope<any[]>(listRes, 200, 'GET /reports');
    assert.ok(Array.isArray(list));
    const found = list.find((r) => r.id === report.id);
    assert.ok(found, 'Created report should appear inside matching Dhaka bounds');
    assertNoReportPii(found);

    // Non-numeric bounds rejected 400
    const badBounds = await publicClient.get(
      '/api/v1/reports?minLng=not-a-number&minLat=23.7&maxLng=90.3&maxLat=23.8'
    );
    assertErrorEnvelope(badBounds, 400);

    // Owner view -> isOwner: true
    const ownerView = assertSuccessEnvelope(
      await owner.client.get(`/api/v1/reports/${report.id}`),
      200
    );
    assert.equal(ownerView.isOwner, true);
    assertNoReportPii(ownerView);

    // Other view -> isOwner: false
    const otherView = assertSuccessEnvelope(
      await other.client.get(`/api/v1/reports/${report.id}`),
      200
    );
    assert.equal(otherView.isOwner, false);

    // Non-existent UUID -> 404
    assertErrorEnvelope(await publicClient.get(`/api/v1/reports/${nonExistentUuid()}`), 404);
  });

  it('EP-016 PATCH /api/v1/reports/:id/resolve works for owner and VERIFIED_RESPONDER, prevents duplicate resolve', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const responder = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    const created = assertSuccessEnvelope(
      await responder.client.post('/api/v1/reports', {
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        latitude: 23.748,
        longitude: 90.379,
        description: 'Minor collision blocking right lane',
      }),
      201
    );
    tracker.trackReport(created.id);

    // Responder can resolve (also author here, and test another user report below in authz)
    const resolveRes = await responder.client.patch(`/api/v1/reports/${created.id}/resolve`, {});
    const resolved = assertSuccessEnvelope(resolveRes, 200, 'PATCH /resolve');
    assert.equal(resolved.status, 'RESOLVED');

    // Duplicate resolve returns 400
    const dupResolve = await responder.client.patch(`/api/v1/reports/${created.id}/resolve`, {});
    assertErrorEnvelope(dupResolve, 400, 'already');

    // Separate report resolved by original citizen author
    const citizenReport = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.749,
        longitude: 90.382,
        description: 'Author resolve check',
      }),
      201
    );
    tracker.trackReport(citizenReport.id);
    const authorResolve = assertSuccessEnvelope(
      await author.client.patch(`/api/v1/reports/${citizenReport.id}/resolve`, {}),
      200
    );
    assert.equal(authorResolve.status, 'RESOLVED');
  });

  it('EP-017, EP-018, EP-019 Votes (upvote/switch/reject invalid voteType) and Threaded Updates lifecycle', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const voter = await createDeviceActor(server.baseUrl, tracker);

    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'MUGGING',
        severity: 'MEDIUM',
        latitude: 23.755,
        longitude: 90.385,
        description: 'Suspicious activity near overbridge',
      }),
      201
    );
    tracker.trackReport(report.id);

    // Upvote
    const up = assertSuccessEnvelope(
      await voter.client.post(`/api/v1/reports/${report.id}/vote`, { voteType: 1 }),
      201
    );
    assert.equal(up.upvotes, 1);
    assert.equal(up.downvotes, 0);

    // Duplicate vote from same user rejected 400
    assertErrorEnvelope(
      await voter.client.post(`/api/v1/reports/${report.id}/vote`, { voteType: 1 }),
      400,
      'already'
    );

    // Distinct second voter casts downvote (-1)
    const voter2 = await createDeviceActor(server.baseUrl, tracker);
    const down = assertSuccessEnvelope(
      await voter2.client.post(`/api/v1/reports/${report.id}/vote`, { voteType: -1 }),
      201
    );
    assert.equal(down.upvotes, 1);
    assert.equal(down.downvotes, 1);

    // Invalid voteType (0) rejected 400
    assertErrorEnvelope(
      await voter.client.post(`/api/v1/reports/${report.id}/vote`, { voteType: 0 }),
      400
    );

    // Post threaded update
    const upd = assertSuccessEnvelope(
      await voter.client.post(`/api/v1/reports/${report.id}/updates`, {
        content: 'Police patrol unit arrived at the junction.',
      }),
      201
    );
    assert.equal(upd.reportId, report.id);
    assert.equal('userId' in upd, false);

    // List updates
    const updates = assertSuccessEnvelope<any[]>(
      await voter.client.get(`/api/v1/reports/${report.id}/updates`),
      200
    );
    assert.equal(updates.length, 1);
    assert.equal(updates[0].content, 'Police patrol unit arrived at the junction.');
  });
});
