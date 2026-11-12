import http from 'http';
import crypto from 'crypto';
import { app } from './src/app';
import { prisma } from './src/db/prisma';

const TEST_PORT = 5097;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

// Helper to make fetch requests
const request = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(`${SERVER_URL}${url}`, options);
  const data = await res.json().catch(() => null);
  const cookies = res.headers.get('set-cookie') || '';
  return { status: res.status, data, cookies };
};

// Extract cookie value
const extractCookie = (setCookieHeader: string, name: string): string => {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : '';
};

async function runTests() {
  console.log('🚀 [Test] Starting Phase 10 File & Media Handling Verification Suite...\n');

  // 1. Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ [1/9] Test server running on ${SERVER_URL}`);

  let user1Id = '';
  let user1Token = '';
  let user2Token = '';
  let testReportId = '';
  let createdMediaId = '';
  const originalWebhookSecret = process.env.STORAGE_WEBHOOK_SECRET;
  const originalWebhookBucket = process.env.STORAGE_WEBHOOK_BUCKET;

  try {
    // 2. Authenticate User 1
    console.log('\n🧪 [Test 1] Authenticating test users...');
    const auth1 = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `media-tester-1-${Date.now()}` }),
    });
    if (auth1.status !== 200 && auth1.status !== 201) {
      throw new Error(`User 1 Auth failed: ${JSON.stringify(auth1.data)}`);
    }
    user1Id = auth1.data.data.user.id;
    user1Token = extractCookie(auth1.cookies, 'accessToken');

    // Authenticate User 2
    const auth2 = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `media-tester-2-${Date.now()}` }),
    });
    user2Token = extractCookie(auth2.cookies, 'accessToken');
    console.log('✅ [2/9] Test users authenticated.');

    // 3. Create a test report for User 1
    console.log('\n🧪 [Test 2] Creating test report with PostGIS proximity check...');
    const reportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user1Token}`,
        'x-device-lat': '22.8456',
        'x-device-lng': '89.5403',
      },
      body: JSON.stringify({
        category: 'UNLIT_ROAD',
        severity: 'MEDIUM',
        latitude: 22.8456,
        longitude: 89.5403,
        description: 'Road hazard with deep potholes near Shib Bari intersection.',
      }),
    });

    if (reportRes.status !== 201) {
      throw new Error(`Report creation failed: ${JSON.stringify(reportRes.data)}`);
    }
    testReportId = reportRes.data.data.id;
    console.log(`✅ [3/9] Test report created (ID: ${testReportId})`);

    // 4. Test unauthenticated request rejection (401)
    console.log('\n🧪 [Test 3] Verifying 401 Unauthorized for unauthenticated media request...');
    const unauthRes = await request(`/api/v1/media/presigned-url?reportId=${testReportId}&fileType=image/jpeg&fileSize=1024`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401, got ${unauthRes.status}: ${JSON.stringify(unauthRes.data)}`);
    }
    console.log('✅ [4/9] Unauthenticated access properly rejected with 401.');

    // 5. Test invalid MIME type rejection (400)
    console.log('\n🧪 [Test 4] Verifying 400 Bad Request for unsupported MIME type (e.g., application/pdf)...');
    const badMimeRes = await request(
      `/api/v1/media/presigned-url?reportId=${testReportId}&fileType=application/pdf&fileSize=1024`,
      {
        headers: { cookie: `accessToken=${user1Token}` },
      }
    );
    if (badMimeRes.status !== 400) {
      throw new Error(`Expected 400, got ${badMimeRes.status}: ${JSON.stringify(badMimeRes.data)}`);
    }
    console.log('✅ [5/9] Unsupported MIME types properly rejected with 400.');

    // 6. Test file size > 5MB rejection (400)
    console.log('\n🧪 [Test 5] Verifying 400 Bad Request when file size exceeds 5MB limit...');
    const oversizedRes = await request(
      `/api/v1/media/presigned-url?reportId=${testReportId}&fileType=image/jpeg&fileSize=6000000`,
      {
        headers: { cookie: `accessToken=${user1Token}` },
      }
    );
    if (oversizedRes.status !== 400) {
      throw new Error(`Expected 400, got ${oversizedRes.status}: ${JSON.stringify(oversizedRes.data)}`);
    }
    console.log('✅ [6/9] Oversized files (>5MB) properly rejected with 400.');

    // 7. Test unauthorized user trying to attach media to another user's report (403)
    console.log('\n🧪 [Test 6] Verifying 403 Forbidden when unauthorized user tries to upload for another report...');
    const forbiddenRes = await request(
      `/api/v1/media/presigned-url?reportId=${testReportId}&fileType=image/jpeg&fileSize=102400`,
      {
        headers: { cookie: `accessToken=${user2Token}` },
      }
    );
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403, got ${forbiddenRes.status}: ${JSON.stringify(forbiddenRes.data)}`);
    }
    console.log('✅ [7/9] Non-owner access properly rejected with 403 Forbidden.');

    // 8. Test successful presigned URL generation (200)
    console.log('\n🧪 [Test 7] Requesting valid presigned upload URL as report author...');
    const presignedRes = await request(
      `/api/v1/media/presigned-url?reportId=${testReportId}&fileType=image/jpeg&fileSize=1048576`,
      {
        headers: { cookie: `accessToken=${user1Token}` },
      }
    );
    if (presignedRes.status !== 200) {
      throw new Error(`Expected 200, got ${presignedRes.status}: ${JSON.stringify(presignedRes.data)}`);
    }

    const presignedData = presignedRes.data.data;
    if (!presignedData.uploadUrl || !presignedData.fileKey || !presignedData.publicUrl) {
      throw new Error(`Malformed presigned response: ${JSON.stringify(presignedData)}`);
    }
    if (!presignedData.fileKey.startsWith(`reports/${testReportId}/`)) {
      throw new Error(`File key does not match expected prefix: ${presignedData.fileKey}`);
    }
    console.log(`✅ [8/9] Presigned URL successfully issued:`);
    console.log(`       Upload URL: ${presignedData.uploadUrl.substring(0, 70)}...`);
    console.log(`       File Key:   ${presignedData.fileKey}`);
    console.log(`       Public CDN: ${presignedData.publicUrl}`);

    // 9. Test upload confirmation & privacy auto-blurring pipeline
    console.log('\n🧪 [Test 8] Confirming upload and running Privacy Auto-Blurring Pipeline...');
    const confirmRes = await request('/api/v1/media/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user1Token}`,
      },
      body: JSON.stringify({
        reportId: testReportId,
        fileKey: presignedData.fileKey,
      }),
    });

    if (confirmRes.status !== 201) {
      throw new Error(`Confirm failed: ${JSON.stringify(confirmRes.data)}`);
    }

    const confirmedMedia = confirmRes.data.data;
    createdMediaId = confirmedMedia.id;
    if (!confirmedMedia.originalUrl || !confirmedMedia.blurredUrl) {
      throw new Error(`Expected blurredUrl to be generated: ${JSON.stringify(confirmedMedia)}`);
    }
    if (!confirmedMedia.blurredUrl.includes('blurred-')) {
      throw new Error(`blurredUrl should contain privacy-sanitized prefix 'blurred-': ${confirmedMedia.blurredUrl}`);
    }

    // Verify record in Prisma database
    const dbMedia = await prisma.reportMedia.findUnique({
      where: { id: createdMediaId },
    });
    if (!dbMedia || !dbMedia.blurredUrl) {
      throw new Error('Database record missing or blurredUrl not persisted!');
    }
    console.log('✅ [9/9] Media record stored in DB and sanitized with Privacy Blur Pipeline.');
    console.log(`       Original URL: ${dbMedia.originalUrl}`);
    console.log(`       Blurred URL:  ${dbMedia.blurredUrl}`);

    // 10. Test Server RAM Protection (Multipart form rejection)
    console.log('\n🧪 [Test 9] Verifying server RAM protection rejects direct multipart/form-data uploads...');
    const multipartRes = await request('/api/v1/media/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary',
        cookie: `accessToken=${user1Token}`,
      },
      body: '------WebKitFormBoundary\r\nContent-Disposition: form-data; name="file"\r\n\r\nfakebytes\r\n------WebKitFormBoundary--',
    });
    if (multipartRes.status !== 415) {
      throw new Error(`Expected 415 Unsupported Media Type for multipart, got ${multipartRes.status}`);
    }
    console.log('✅ Server RAM protection verified: Direct multipart uploads rejected with 415.');

    // 11. Test Storage Webhook Authentication & Key Hardening ([SEC-002])
    console.log('\n🧪 [Test 10] Verifying Storage Webhook secret auth & payload hardening...');
    const webhookFileKey = `reports/${testReportId}/${crypto.randomUUID()}.jpg`;
    const sampleWebhookPayload = {
      type: 'INSERT',
      record: {
        bucket_id: 'incident-media',
        name: webhookFileKey,
      },
    };

    // 10a. Fail-closed when STORAGE_WEBHOOK_SECRET is unset
    delete process.env.STORAGE_WEBHOOK_SECRET;
    delete process.env.STORAGE_WEBHOOK_BUCKET;
    const unconfiguredWebhookRes = await request('/api/v1/media/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleWebhookPayload),
    });
    if (unconfiguredWebhookRes.status !== 401) {
      throw new Error(`Expected 401 when webhook secret unset, got ${unconfiguredWebhookRes.status}`);
    }

    // 10b. Missing, wrong-length, and equal-length invalid secrets must return 401
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    process.env.STORAGE_WEBHOOK_SECRET = webhookSecret;
    const wrongSameLengthSecret = `${webhookSecret[0] === 'a' ? 'b' : 'a'}${webhookSecret.slice(1)}`;

    for (const badHeaders of [
      { 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json', 'x-webhook-secret': 'short-wrong-secret' },
      { 'Content-Type': 'application/json', 'x-webhook-secret': wrongSameLengthSecret },
    ] as Record<string, string>[]) {
      const badSecretRes = await request('/api/v1/media/webhook', {
        method: 'POST',
        headers: badHeaders,
        body: JSON.stringify(sampleWebhookPayload),
      });
      if (badSecretRes.status !== 401) {
        throw new Error(`Expected 401 for invalid webhook secret, got ${badSecretRes.status}`);
      }
    }

    const beforeWebhookCount = await prisma.reportMedia.count({ where: { reportId: testReportId } });

    // 10c. Valid x-webhook-secret processes valid INSERT object key
    const validWebhookRes = await request('/api/v1/media/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify(sampleWebhookPayload),
    });
    if (validWebhookRes.status !== 200 || !validWebhookRes.data?.received) {
      throw new Error(`Expected 200 { received: true } for valid webhook, got ${validWebhookRes.status}`);
    }

    const afterInsertCount = await prisma.reportMedia.count({ where: { reportId: testReportId } });
    if (afterInsertCount !== beforeWebhookCount + 1) {
      throw new Error(`Expected exactly 1 new ReportMedia row from webhook, got ${afterInsertCount - beforeWebhookCount}`);
    }

    // 10d. Duplicate delivery is idempotent
    const duplicateWebhookRes = await request('/api/v1/media/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify(sampleWebhookPayload),
    });
    if (duplicateWebhookRes.status !== 200) {
      throw new Error(`Expected 200 on duplicate webhook delivery, got ${duplicateWebhookRes.status}`);
    }

    // 10e. Non-INSERT events, traversal paths, non-UUIDs, blurred loops, and disallowed extensions are ignored
    for (const ignoredPayload of [
      { type: 'DELETE', record: { bucket_id: 'incident-media', name: `reports/${testReportId}/${crypto.randomUUID()}.jpg` } },
      { type: 'INSERT', record: { bucket_id: 'incident-media', name: 'reports/not-a-uuid/fake.jpg' } },
      { type: 'INSERT', record: { bucket_id: 'incident-media', name: `reports/${testReportId}/../../evil.jpg` } },
      { type: 'INSERT', record: { bucket_id: 'incident-media', name: `reports/${testReportId}/malware.exe` } },
      { type: 'INSERT', record: { bucket_id: 'incident-media', name: `reports/${testReportId}/blurred-loop.jpg` } },
    ]) {
      const ignoredRes = await request('/api/v1/media/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret,
        },
        body: JSON.stringify(ignoredPayload),
      });
      if (ignoredRes.status !== 200) {
        throw new Error(`Expected 200 for ignored webhook payload, got ${ignoredRes.status}`);
      }
    }

    const finalWebhookCount = await prisma.reportMedia.count({ where: { reportId: testReportId } });
    if (finalWebhookCount !== afterInsertCount) {
      throw new Error(`Expected no duplicate or malicious ReportMedia rows, got ${finalWebhookCount} vs ${afterInsertCount}`);
    }
    console.log('✅ Storage webhook fail-closed auth, idempotency, and key validation verified.');

    console.log('\n🎉 ========================================================');
    console.log('🎉 ALL PHASE 10 FILE & MEDIA HANDLING TESTS PASSED (100%)!');
    console.log('🎉 ========================================================\n');
  } finally {
    if (originalWebhookSecret === undefined) {
      delete process.env.STORAGE_WEBHOOK_SECRET;
    } else {
      process.env.STORAGE_WEBHOOK_SECRET = originalWebhookSecret;
    }
    if (originalWebhookBucket === undefined) {
      delete process.env.STORAGE_WEBHOOK_BUCKET;
    } else {
      process.env.STORAGE_WEBHOOK_BUCKET = originalWebhookBucket;
    }
    // Cleanup fixtures
    console.log('🧹 Cleaning up test database fixtures...');
    try {
      if (createdMediaId) {
        await prisma.reportMedia.deleteMany({ where: { id: createdMediaId } });
      }
      if (testReportId) {
        await prisma.reportMedia.deleteMany({ where: { reportId: testReportId } });
        await prisma.vote.deleteMany({ where: { reportId: testReportId } });
        await prisma.report.deleteMany({ where: { id: testReportId } });
      }
      if (user1Id) {
        await prisma.refreshToken.deleteMany({ where: { userId: user1Id } });
        await prisma.user.deleteMany({ where: { id: user1Id } });
      }
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.warn('⚠️ Cleanup warning:', cleanErr);
    }

    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
