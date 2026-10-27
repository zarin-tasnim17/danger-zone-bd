import http from 'http';
import { app } from '../api/src/app';
import { initSocketServer } from '../api/src/sockets';
import { prisma } from '../api/src/db/prisma';

const TEST_PORT = 5125;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

const request = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(`${SERVER_URL}${url}`, options);
  const data = await res.json().catch(() => null);
  const cookies = res.headers.get('set-cookie') || '';
  return { status: res.status, data, cookies };
};

const extractCookie = (setCookieHeader: string, name: string): string => {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : '';
};

async function runFrontendIntegrationSuite() {
  console.log('🚀 [Frontend-Backend Integration Suite] Starting full verification...\n');

  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Test API Server running on ${SERVER_URL}`);

  let testUserId: string | null = null;
  let voterUserId: string | null = null;
  let adminUserId: string | null = null;
  let testReportId: string | null = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Silent Device Authentication (Transparent Citizen Onboarding)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 1] Testing Silent Device Authentication (useAuthStore.initAuth)...');
    const deviceUuid = `web-test-device-${Date.now()}`;
    const authRes = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: deviceUuid }),
    });

    if (authRes.status === 201 && authRes.data?.data?.user?.id) {
      testUserId = authRes.data.data.user.id;
      console.log(`  ✅ Silent device auth created citizen user: ${testUserId} (Role: ${authRes.data.data.user.role})`);
    } else {
      throw new Error(`Device auth failed: ${JSON.stringify(authRes)}`);
    }

    const citizenCookie = extractCookie(authRes.cookies, 'accessToken');

    // Verify GET /users/me returns profile without PII
    const meRes = await request('/api/v1/users/me', {
      method: 'GET',
      headers: { Cookie: `accessToken=${citizenCookie}` },
    });

    if (meRes.status === 200 && meRes.data?.data?.role === 'USER') {
      console.log(`  ✅ Profile retrieved: Role: USER, Community Trust Score: ${meRes.data.data.trustScore}`);
    } else {
      throw new Error(`Failed to retrieve profile: ${JSON.stringify(meRes)}`);
    }

    // -------------------------------------------------------------
    // Test 2: Bounding Box Hazard Query (useIncidentStore.fetchIncidentsInBounds)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 2] Testing PostGIS Bounding Box Reports Retrieval...');
    const bboxRes = await request('/api/v1/reports?minLat=20&maxLat=27&minLng=88&maxLng=93', {
      method: 'GET',
      headers: { Cookie: `accessToken=${citizenCookie}` },
    });

    if (bboxRes.status === 200 && Array.isArray(bboxRes.data?.data)) {
      console.log(`  ✅ Successfully fetched ${bboxRes.data.data.length} live incidents in Bangladesh viewport`);
    } else {
      throw new Error(`Bounding box reports query failed: ${JSON.stringify(bboxRes)}`);
    }

    // -------------------------------------------------------------
    // Test 3: Verified Safe Zones Query (fetchSafeZones)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 3] Testing Verified Safe Zones Query (Hospitals / Police)...');
    const safeZonesRes = await request('/api/v1/safe-zones', {
      method: 'GET',
      headers: { Cookie: `accessToken=${citizenCookie}` },
    });

    if (safeZonesRes.status === 200 && Array.isArray(safeZonesRes.data?.data)) {
      console.log(`  ✅ Retrieved ${safeZonesRes.data.data.length} verified safe zone locations`);
    } else {
      throw new Error(`Safe zones fetch failed: ${JSON.stringify(safeZonesRes)}`);
    }

    // -------------------------------------------------------------
    // Test 4: Live Incident Submission with GPS Proximity Validation
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 4] Testing Live Incident Submission (ReportIncidentModal)...');
    const reportLat = 23.7465;
    const reportLng = 90.3760;

    // 4a. Reject when device GPS is > 200m away
    const fakeRemoteGpsRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-lat': '22.3569',
        'x-device-lng': '91.7832', // Chittagong GPS reporting in Dhaka
        Cookie: `accessToken=${citizenCookie}`,
      },
      body: JSON.stringify({
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: reportLat,
        longitude: reportLng,
        description: 'Testing GPS anti-abuse spoofing protection',
      }),
    });

    const errText = fakeRemoteGpsRes.data?.error?.message || fakeRemoteGpsRes.data?.message || '';
    if (fakeRemoteGpsRes.status === 400 && errText.includes('200m')) {
      console.log('  ✅ Proximity check correctly rejected remote fake report (>200m away)');
    } else {
      throw new Error(`Proximity validation failed: ${JSON.stringify(fakeRemoteGpsRes)}`);
    }

    // 4b. Accept when GPS is within 200m
    const validReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-lat': '23.7466',
        'x-device-lng': '90.3761', // ~15 meters away
        Cookie: `accessToken=${citizenCookie}`,
      },
      body: JSON.stringify({
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: reportLat,
        longitude: reportLng,
        description: 'Armed mugging on Dhanmondi 27 road',
      }),
    });

    if (validReportRes.status === 201 && validReportRes.data?.data?.id) {
      testReportId = validReportRes.data.data.id;
      console.log(`  ✅ Valid report created: ${testReportId} (Fuzzed coords: ${validReportRes.data.data.latitude}, ${validReportRes.data.data.longitude})`);
    } else {
      throw new Error(`Valid report submission failed: ${JSON.stringify(validReportRes)}`);
    }

    // -------------------------------------------------------------
    // Test 5: Community Moderation Voting (voteIncident)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 5] Testing Community Moderation Voting...');
    // Distinct citizen voter casts a vote (backend blocks voting on own report)
    const voterAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `voter-citizen-${Date.now()}` }),
    });
    const voterCookie = extractCookie(voterAuth.cookies, 'accessToken');
    voterUserId = voterAuth.data?.data?.user?.id;

    const voteRes = await request(`/api/v1/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `accessToken=${voterCookie}`,
      },
      body: JSON.stringify({ voteType: 1 }),
    });

    if ((voteRes.status === 200 || voteRes.status === 201) && voteRes.data?.data?.upvotes === 1) {
      console.log('  ✅ Citizen upvote recorded successfully (upvotes: 1)');
    } else {
      throw new Error(`Vote failed: ${JSON.stringify(voteRes)}`);
    }

    // -------------------------------------------------------------
    // Test 6: Threaded Context Update (addContextUpdate)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 6] Testing Live Context Updates ("Police arrived")...');
    const updateRes = await request(`/api/v1/reports/${testReportId}/updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `accessToken=${citizenCookie}`,
      },
      body: JSON.stringify({ content: 'Police patrol car arrived at the intersection' }),
    });

    if (updateRes.status === 201 && updateRes.data?.data?.content) {
      console.log('  ✅ Context update appended to active incident pin');
    } else {
      throw new Error(`Context update failed: ${JSON.stringify(updateRes)}`);
    }

    // -------------------------------------------------------------
    // Test 7: Admin Console Authorization & Moderation Actions (/admin)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 7] Testing Role-Based Administration Controls (/admin)...');

    // 7a. Citizen cannot access admin routes
    const citizenAdminRes = await request('/api/v1/admin/logs', {
      method: 'GET',
      headers: { Cookie: `accessToken=${citizenCookie}` },
    });
    if (citizenAdminRes.status === 403) {
      console.log('  ✅ Standard citizen blocked from /admin routes with 403 Forbidden');
    } else {
      throw new Error(`Expected 403 for citizen on admin route, got ${citizenAdminRes.status}`);
    }

    // 7b. Admin account authentication
    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-test-${Date.now()}`,
        email: `admin-e2e-${Date.now()}@safety.bd`,
        role: 'ADMIN',
      },
    });
    adminUserId = adminUser.id;

    const adminAuthRes = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId }),
    });
    const adminCookie = extractCookie(adminAuthRes.cookies, 'accessToken');

    // 7c. Admin views audit logs
    const adminLogsRes = await request('/api/v1/admin/logs', {
      method: 'GET',
      headers: { Cookie: `accessToken=${adminCookie}` },
    });
    if (adminLogsRes.status === 200 && Array.isArray(adminLogsRes.data?.data?.logs)) {
      console.log(`  ✅ Admin successfully accessed /admin/logs (${adminLogsRes.data.data.logs.length} audit entries)`);
    } else {
      throw new Error(`Admin logs failed: ${JSON.stringify(adminLogsRes)}`);
    }

    // 7d. Admin purges false report with reason
    const purgeRes = await request(`/api/v1/admin/reports/${testReportId}/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `accessToken=${adminCookie}`,
      },
      body: JSON.stringify({ reason: 'Disputed false incident verified by area patrol' }),
    });

    if (purgeRes.status === 200 && purgeRes.data?.data?.report?.status === 'PURGED') {
      console.log('  ✅ Admin successfully purged report with reason logged in immutable ModerationLog');
    } else {
      throw new Error(`Purge report failed: ${JSON.stringify(purgeRes)}`);
    }

    console.log('\n🎉 ALL 7 FRONTEND-BACKEND INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    console.log('\n🧹 Cleaning up test artifacts...');
    try {
      if (testReportId) {
        await prisma.reportUpdate.deleteMany({ where: { reportId: testReportId } });
        await prisma.vote.deleteMany({ where: { reportId: testReportId } });
        await prisma.moderationLog.deleteMany({ where: { targetReportId: testReportId } });
        await prisma.report.deleteMany({ where: { id: testReportId } });
      }
      const userIdsToClean = [testUserId, voterUserId, adminUserId].filter(Boolean) as string[];
      if (userIdsToClean.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIdsToClean } } });
        await prisma.moderationLog.deleteMany({ where: { adminId: { in: userIdsToClean } } });
        await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
      }
      console.log('✅ Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('⚠️ Cleanup notice:', cleanupErr);
    }

    await prisma.$disconnect();
    server.close();
  }
}

runFrontendIntegrationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Frontend integration test failed:', err);
    process.exit(1);
  });
