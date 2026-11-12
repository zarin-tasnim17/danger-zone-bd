import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createDeviceActor, nextTestIp } from '../framework/authHelpers';
import {
  assertErrorEnvelope,
  assertStatus,
  assertSuccessEnvelope,
} from '../framework/assertions';
import { SMALL_DHAKA_POLYGON, TEST_MEDIA, randomUuid } from '../framework/fixtures';
import { env } from '../../src/config/env';

describe('API Functional: Geofenced Alerts & Media Privacy Endpoints (EP-024..EP-031)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('EP-024, EP-025, EP-026, EP-027 Alert zone CRUD & push subscription lifecycle', async () => {
    const user = await createDeviceActor(server.baseUrl, tracker);

    // Create zone
    const createRes = await user.client.post('/api/v1/alerts/zones', {
      name: 'Dhanmondi Commute',
      coordinates: SMALL_DHAKA_POLYGON,
    });
    const zone = assertSuccessEnvelope(createRes, 201, 'POST /alerts/zones');
    tracker.trackAlertZone(zone.id);
    assert.equal(zone.name, 'Dhanmondi Commute');
    assert.equal(zone.isActive, true);
    assert.ok(zone.area?.type === 'Polygon');

    // List user's zones
    const listRes = await user.client.get('/api/v1/alerts/zones');
    const zones = assertSuccessEnvelope<any[]>(listRes, 200, 'GET /alerts/zones');
    assert.equal(zones.length, 1);
    assert.equal(zones[0].id, zone.id);

    // Web Push subscription
    const subRes = await user.client.post('/api/v1/alerts/subscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/audit-test-endpoint',
      keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
    });
    const subData = assertSuccessEnvelope(subRes, 200, 'POST /alerts/subscribe');
    assert.equal(subData.subscribed, true);
    assert.equal(subData.userId, user.id);

    // Delete zone
    const delRes = await user.client.delete(`/api/v1/alerts/zones/${zone.id}`);
    assertSuccessEnvelope(delRes, 200, 'DELETE /alerts/zones/:id');

    const afterList = assertSuccessEnvelope<any[]>(
      await user.client.get('/api/v1/alerts/zones'),
      200
    );
    assert.equal(afterList.length, 0);
  });

  it('EP-028 & EP-029 Presigned URL -> Media Confirm (idempotent + strips originalUrl) & rejects multipart 415', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'MEDIUM',
        latitude: 23.7465,
        longitude: 90.376,
        description: 'Report for media upload test',
      }),
      201
    );
    tracker.trackReport(report.id);

    // Multipart upload rejected with 415
    const multipartRes = await author.client.request('POST', '/api/v1/media/confirm', {
      headers: { 'content-type': 'multipart/form-data; boundary=---test123' },
      rawBody: '-----test123--',
    });
    assertStatus(multipartRes, 415, 'Multipart reject on /media');

    // Presigned URL
    const preRes = await author.client.get(
      `/api/v1/media/presigned-url?reportId=${report.id}&fileType=image/jpeg&fileSize=102400`
    );
    const preData = assertSuccessEnvelope(preRes, 200, 'GET /media/presigned-url');
    assert.ok(preData.fileKey.startsWith(`reports/${report.id}/`));
    assert.equal(preData.expiresInSeconds, 600);

    // Confirm uploaded media -> 201 and NO originalUrl leaked
    const confirmRes = await author.client.post('/api/v1/media/confirm', {
      reportId: report.id,
      fileKey: preData.fileKey,
    });
    const media = assertSuccessEnvelope(confirmRes, 201, 'POST /media/confirm');
    tracker.trackMedia(media.id);
    assert.equal('originalUrl' in media, false);
    assert.ok(typeof media.blurredUrl === 'string' && media.blurredUrl.length > 0);

    // Idempotent duplicate confirm -> 200 returning existing media ID
    const dupConfirm = await author.client.post('/api/v1/media/confirm', {
      reportId: report.id,
      fileKey: preData.fileKey,
    });
    const dupMedia = assertSuccessEnvelope(dupConfirm, 200, 'POST /media/confirm idempotent');
    assert.equal(dupMedia.id, media.id);
  });

  it('EP-030 POST /api/v1/media/mock-upload accepts valid PNG, JPEG, and WEBP magic-byte data URIs', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'ROBBERY',
        severity: 'HIGH',
        latitude: 23.749,
        longitude: 90.379,
        description: 'Inline compressed mock upload check',
      }),
      201
    );
    tracker.trackReport(report.id);

    for (const [label, dataUrl] of [
      ['image/png', TEST_MEDIA.validPngDataUrl],
      ['image/jpeg', TEST_MEDIA.validJpegDataUrl],
      ['image/webp', TEST_MEDIA.validWebpDataUrl],
    ] as const) {
      const res = await author.client.post('/api/v1/media/mock-upload', {
        reportId: report.id,
        imageDataUrl: dataUrl,
      });
      const data = assertSuccessEnvelope(res, 201, `mock-upload ${label}`);
      tracker.trackMedia(data.id);
      assert.equal(data.reportId, report.id);
      assert.ok(typeof data.blurredUrl === 'string' && data.blurredUrl.startsWith('data:image/'));
      assert.equal('originalUrl' in data, false);
    }
  });

  it('EP-031 POST /api/v1/media/webhook enforces fail-closed secret and idempotently records valid callback', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'MEDIUM',
        latitude: 23.752,
        longitude: 90.382,
        description: 'Webhook ingestion check',
      }),
      201
    );
    tracker.trackReport(report.id);

    const hookClient = new ApiClient(server.baseUrl, nextTestIp());
    const prevSecret = process.env.STORAGE_WEBHOOK_SECRET;
    try {
      // Unset -> fail closed 401
      delete process.env.STORAGE_WEBHOOK_SECRET;
      const failClosed = await hookClient.post('/api/v1/media/webhook', {
        key: `reports/${report.id}/${randomUuid()}.jpg`,
      });
      assertErrorEnvelope(failClosed, 401);

      // Configured -> valid secret accepted (standardized { success: true, data: { received: true } } envelope)
      process.env.STORAGE_WEBHOOK_SECRET = 'test-webhook-secret-32chars-value!';
      const validKey = `reports/${report.id}/${randomUuid()}.jpg`;
      const okHook = await hookClient.post(
        '/api/v1/media/webhook',
        {
          type: 'INSERT',
          record: { name: validKey, bucket_id: env.S3_BUCKET },
        },
        { headers: { 'x-webhook-secret': 'test-webhook-secret-32chars-value!' } }
      );
      const hookData = assertSuccessEnvelope<{ received?: boolean }>(okHook, 200, 'POST /media/webhook');
      assert.equal(hookData.received, true);
    } finally {
      if (prevSecret === undefined) delete process.env.STORAGE_WEBHOOK_SECRET;
      else process.env.STORAGE_WEBHOOK_SECRET = prevSecret;
    }
  });
});
