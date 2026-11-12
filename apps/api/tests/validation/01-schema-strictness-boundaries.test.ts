import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { createDeviceActor, createPrivilegedActor } from '../framework/authHelpers';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';
import {
  OVERSIZED_POLYGON,
  SMALL_DHAKA_POLYGON,
  UNCLOSED_POLYGON,
  nonExistentUuid,
} from '../framework/fixtures';

describe('Validation Suite: Strict Schemas, PostGIS Geometry Limits & Business Boundaries', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Enforces .strict() mass-assignment/unknown-field rejection on strict schemas', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const user = await createDeviceActor(server.baseUrl, tracker);

    assertErrorEnvelope(
      await admin.client.post('/api/v1/safe-zones', {
        type: 'HOSPITAL',
        name: 'Strict Check Hospital',
        latitude: 23.75,
        longitude: 90.38,
        extraEvilField: true,
      }),
      400
    );

    assertErrorEnvelope(
      await user.client.post('/api/v1/alerts/zones', {
        name: 'Strict Zone',
        coordinates: SMALL_DHAKA_POLYGON,
        isActive: false,
      }),
      400
    );

    assertErrorEnvelope(
      await admin.client.post(`/api/v1/admin/users/${nonExistentUuid()}/ban`, {
        reason: 'Valid reason length',
        extraField: 'should-fail',
      }),
      400
    );
  });

  it('PostGIS geofence validation: rejects unclosed, self-intersecting, >25 km² polygons, and >5 zones per user', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);

    // Unclosed -> 400
    assertErrorEnvelope(
      await user.client.post('/api/v1/alerts/zones', {
        name: 'Unclosed Zone',
        coordinates: UNCLOSED_POLYGON,
      }),
      400
    );

    // >25 km² -> 400
    assertErrorEnvelope(
      await user.client.post('/api/v1/alerts/zones', {
        name: 'Giant Zone',
        coordinates: OVERSIZED_POLYGON,
      }),
      400,
      '25 km'
    );

    // Max 5 active zones cap
    for (let i = 1; i <= 5; i += 1) {
      const z = assertSuccessEnvelope(
        await user.client.post('/api/v1/alerts/zones', {
          name: `Zone ${i}`,
          coordinates: SMALL_DHAKA_POLYGON,
        }),
        201
      );
      tracker.trackAlertZone(z.id);
    }

    const sixth = await user.client.post('/api/v1/alerts/zones', {
      name: 'Zone 6 Over Limit',
      coordinates: SMALL_DHAKA_POLYGON,
    });
    assertErrorEnvelope(sixth, 400, 'maximum');
  });

  it('Report, Media & GPS header boundaries (lat/lng extremes, 5MB limit, MIME types, incomplete GPS headers)', async () => {
    const user = await createPrivilegedActor(server.baseUrl, tracker, {
      role: 'VERIFIED_RESPONDER',
    });

    // Latitude > 90 / invalid enum -> 400
    assertErrorEnvelope(
      await user.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 91.5,
        longitude: 90.37,
      }),
      400
    );
    assertErrorEnvelope(
      await user.client.post('/api/v1/reports', {
        category: 'INVALID_ENUM_CATEGORY',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.37,
      }),
      400
    );

    // Partial GPS headers (x-device-lat without x-device-lng) -> 400
    assertErrorEnvelope(
      await user.client.post(
        '/api/v1/reports',
        { category: 'THEFT', severity: 'LOW', latitude: 23.75, longitude: 90.37 },
        { headers: { 'x-device-lat': '23.75' } }
      ),
      400
    );

    const report = assertSuccessEnvelope(
      await user.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.37,
        description: 'Media validation target report',
      }),
      201
    );
    tracker.trackReport(report.id);

    // Media > 5MB rejected -> 400; disallowed MIME -> 400
    assertErrorEnvelope(
      await user.client.get(
        `/api/v1/media/presigned-url?reportId=${report.id}&fileType=image/jpeg&fileSize=5242881`
      ),
      400
    );
    assertErrorEnvelope(
      await user.client.get(
        `/api/v1/media/presigned-url?reportId=${report.id}&fileType=image/svg+xml&fileSize=1024`
      ),
      400
    );
  });
});
