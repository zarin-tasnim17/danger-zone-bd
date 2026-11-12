import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createDeviceActor, createPrivilegedActor, nextTestIp } from '../framework/authHelpers';
import {
  assertErrorEnvelope,
  assertNoSensitiveLeakage,
  assertStatus,
  assertSuccessEnvelope,
} from '../framework/assertions';
import { TEST_MEDIA } from '../framework/fixtures';

describe('Security Audit Suite: OWASP API Top 10 Probes, SSRF, Polyglots & Injection Safety', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Prevents SSRF & path traversal on POST /api/v1/media/confirm', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const otherReport = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'SSRF test report',
      }),
      201
    );
    tracker.trackReport(otherReport.id);

    const ssrfPayloads = [
      { reportId: otherReport.id, originalUrl: 'http://169.254.169.254/latest/meta-data/' },
      { reportId: otherReport.id, originalUrl: 'http://127.0.0.1:5432/secret.jpg' },
      { reportId: otherReport.id, originalUrl: 'https://evil-attacker.example.com/reports/a.jpg' },
      { reportId: otherReport.id, fileKey: '../../etc/passwd.jpg' },
      { reportId: otherReport.id, fileKey: `reports/${otherReport.id}/blurred-fake.jpg` },
    ];

    for (const payload of ssrfPayloads) {
      const res = await author.client.post('/api/v1/media/confirm', payload);
      assertErrorEnvelope(res, 400, undefined, `SSRF/traversal blocked: ${JSON.stringify(payload)}`);
    }
  });

  it('Rejects spoofed HTML payloads & mismatched magic-byte headers on POST /api/v1/media/mock-upload', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'MEDIUM',
        latitude: 23.746,
        longitude: 90.376,
        description: 'Polyglot security upload test',
      }),
      201
    );
    tracker.trackReport(report.id);

    assertErrorEnvelope(
      await author.client.post('/api/v1/media/mock-upload', {
        reportId: report.id,
        imageDataUrl: TEST_MEDIA.spoofedHtmlAsPngDataUrl,
      }),
      400,
      'signature'
    );

    assertErrorEnvelope(
      await author.client.post('/api/v1/media/mock-upload', {
        reportId: report.id,
        imageDataUrl: TEST_MEDIA.mismatchedPngAsJpegDataUrl,
      }),
      400,
      'signature'
    );
  });

  it('Enforces rate limit on POST /api/v1/auth/login (429 after 10 attempts per IP)', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const sharedIp = '198.51.100.77';
    const bruteClient = new ApiClient(server.baseUrl, sharedIp);

    let hit429 = false;
    for (let i = 1; i <= 12; i += 1) {
      const res = await bruteClient.post('/api/v1/auth/login', {
        email: admin.email,
        password: `WrongPass_${i}`,
      });
      if (res.status === 429) {
        hit429 = true;
        assert.equal(res.body?.error?.code, 'RATE_LIMIT_EXCEEDED');
        break;
      }
      assertStatus(res, 401);
    }
    assert.equal(hit429, true, 'Expected 429 RATE_LIMIT_EXCEEDED by attempt 11 from same IP');
  });

  it('Parameterizes SQL/PostGIS inputs and avoids secret leakage on SQLi/XSS probes', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const user = await createDeviceActor(server.baseUrl, tracker);

    // SQLi attempt in UUID param & bounds filter -> clean 400 validation without DB error leak
    const sqliParam = await publicClient.get("/api/v1/reports/' OR '1'='1");
    assertErrorEnvelope(sqliParam, 400);
    assertNoSensitiveLeakage(sqliParam.rawText);

    const sqliFilter = await publicClient.get(
      "/api/v1/safe-zones?minLng=90.3&minLat=23.7&maxLng=90.4&maxLat=23.8&type=HOSPITAL';DROP TABLE \"User\";--"
    );
    assertErrorEnvelope(sqliFilter, 400);
    assertNoSensitiveLeakage(sqliFilter.rawText);

    // Stored XSS string safely treated as JSON text (application/json + nosniff)
    const xssRes = await user.client.post('/api/v1/reports', {
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.748,
      longitude: 90.378,
      description: '<script>alert("xss")</script>',
    });
    const xssCreated = assertSuccessEnvelope(xssRes, 201);
    tracker.trackReport(xssCreated.id);
    assert.ok(xssRes.headers.get('content-type')?.includes('application/json'));
    assert.equal(xssRes.headers.get('x-content-type-options'), 'nosniff');
  });
});
