import http from 'http';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';

const TEST_PORT = 5120;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

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

async function runRecheckVerification() {
  console.log('🚀 [Recheck Suite] Starting Recheck Enhancements Verification...\n');

  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Test server running on ${SERVER_URL}`);

  try {
    // 1. Health Route Dual Mount Check
    console.log('\n🧪 [Test 1] Testing /health and /api/v1/health routes...');
    const health1 = await request('/health');
    const health2 = await request('/api/v1/health');
    if (health1.status === 200 && health2.status === 200) {
      console.log('  ✅ Both /health and /api/v1/health return 200 OK');
    } else {
      throw new Error(`Health check failed: /health=${health1.status}, /api/v1/health=${health2.status}`);
    }

    // 2. Bearer Token Auth Support Check
    console.log('\n🧪 [Test 2] Testing Bearer token in Authorization header...');
    const authRes = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `bearer-user-${Date.now()}` })
    });
    const token = extractCookie(authRes.cookies, 'accessToken');
    const meRes = await request('/api/v1/users/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (meRes.status === 200 && meRes.data.data.email) {
      console.log('  ✅ Authorization: Bearer <token> accepted successfully on protected route /users/me');
    } else {
      throw new Error(`Bearer auth failed: status=${meRes.status}`);
    }

    // 3. Banned User Defense on Vote & Context Update
    console.log('\n🧪 [Test 3] Testing Banned User Defense on Votes & Updates...');
    const bannedUser = await prisma.user.create({
      data: {
        anonymousId: `banned-test-${Date.now()}`,
        email: `banned-${Date.now()}@test.local`,
        isBanned: true
      }
    });
    const bannedAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: bannedUser.anonymousId })
    });
    const bannedCookie = `accessToken=${extractCookie(bannedAuth.cookies, 'accessToken')}`;

    // Create a dummy report
    const activeReport = await prisma.report.create({
      data: {
        userId: bannedUser.id,
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.8103,
        longitude: 90.4125,
        expiresAt: new Date(Date.now() + 3600000)
      }
    });

    const voteRes = await request(`/api/v1/reports/${activeReport.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bannedCookie },
      body: JSON.stringify({ voteType: 1 })
    });
    if (voteRes.status === 403) {
      console.log('  ✅ Banned user prevented from voting with 403 Forbidden');
    } else {
      throw new Error(`Expected 403 for banned user vote, got ${voteRes.status}`);
    }

    const updateRes = await request(`/api/v1/reports/${activeReport.id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bannedCookie },
      body: JSON.stringify({ content: 'Malicious update attempt' })
    });
    if (updateRes.status === 403) {
      console.log('  ✅ Banned user prevented from posting context updates with 403 Forbidden');
    } else {
      throw new Error(`Expected 403 for banned user update, got ${updateRes.status}`);
    }

    // 4. Admin KYC Verification Listing and Rejection
    console.log('\n🧪 [Test 4] Testing Admin KYC Verification Listing & Rejection...');
    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-kyc-${Date.now()}`,
        email: `admin-kyc-${Date.now()}@safety.gov.bd`,
        role: 'ADMIN'
      }
    });
    const adminAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId })
    });
    const adminCookie = `accessToken=${extractCookie(adminAuth.cookies, 'accessToken')}`;

    // Create a pending verification
    const testApplicant = await prisma.user.create({
      data: {
        anonymousId: `applicant-${Date.now()}`,
        email: `applicant-${Date.now()}@test.local`,
      }
    });
    const verification = await prisma.userVerification.create({
      data: {
        userId: testApplicant.id,
        type: 'NID_DOCUMENT',
        documentUrl: 'https://storage.safety.bd/documents/fake-nid.pdf',
        status: 'PENDING'
      }
    });

    const listVerif = await request('/api/v1/admin/verifications', {
      method: 'GET',
      headers: { Cookie: adminCookie }
    });
    if (listVerif.status === 200 && Array.isArray(listVerif.data.data)) {
      console.log(`  ✅ Admin successfully listed pending verifications (found: ${listVerif.data.data.length})`);
    } else {
      throw new Error(`Failed to list verifications: ${listVerif.status}`);
    }

    const rejectVerif = await request(`/api/v1/admin/verifications/${verification.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ reason: 'Blurred NID photo' })
    });
    if (rejectVerif.status === 200 && rejectVerif.data.data.status === 'REJECTED') {
      console.log('  ✅ Admin successfully rejected invalid verification document');
    } else {
      throw new Error(`Failed to reject verification: ${rejectVerif.status}`);
    }

    // 5. Admin Safe Zone Deletion
    console.log('\n🧪 [Test 5] Testing Admin Safe Zone Deletion (DELETE /api/v1/safe-zones/:id)...');
    const createdZone = await prisma.safeZone.create({
      data: {
        name: 'Temporary Field Hospital',
        type: 'HOSPITAL',
        latitude: 23.75,
        longitude: 90.38
      }
    });

    const deleteRes = await request(`/api/v1/safe-zones/${createdZone.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    if (deleteRes.status === 200 && deleteRes.data.data.deleted) {
      console.log(`  ✅ Admin successfully deleted safe zone "${createdZone.name}"`);
    } else {
      throw new Error(`Failed to delete safe zone: ${deleteRes.status}`);
    }

    console.log('\n🎉 ALL RECHECK VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runRecheckVerification().catch((err) => {
  console.error('\n❌ Recheck Verification failed:', err);
  process.exit(1);
});
