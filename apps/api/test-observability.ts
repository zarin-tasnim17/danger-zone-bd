import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { generateAccessToken } from './src/utils/jwt';
import { sanitizeErrorOutput } from './src/middleware/errorHandler';

const TEST_PORT = 5095;
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
  console.log('🚀 [Test] Starting Phase 12 Observability & Production Readiness Verification Suite...\n');

  // 1. Start test server with Socket.IO
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ [1/9] Test server running on ${SERVER_URL}`);

  let regularUserId = '';
  let regularUserToken = '';
  let adminUserId = '';
  let adminUserToken = '';
  let testReportId = '';
  let socketClient: ClientSocket | null = null;

  try {
    // 2. Authenticate regular user
    console.log('\n🧪 [Test 1] Authenticating regular citizen user...');
    const authUser = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `regular-user-${Date.now()}` }),
    });
    regularUserId = authUser.data.data.user.id;
    regularUserToken = extractCookie(authUser.cookies, 'accessToken');
    console.log(`✅ Regular user authenticated (ID: ${regularUserId})`);

    // Create an Admin user in database and sign admin token
    console.log('\n🧪 [Test 2] Provisioning system administrator account...');
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@safety.gov.bd`,
        anonymousId: `admin-${Date.now()}`,
        role: 'ADMIN',
      },
    });
    adminUserId = adminUser.id;
    adminUserToken = generateAccessToken({ id: adminUserId, role: 'ADMIN' });
    console.log(`✅ Admin account provisioned (ID: ${adminUserId}, Role: ADMIN)`);

    // Connect socket client for real-time purge event listening
    socketClient = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${regularUserToken}`,
      },
    });
    await new Promise<void>((resolve, reject) => {
      socketClient!.on('connect', () => resolve());
      socketClient!.on('connect_error', (err) => reject(err));
    });

    // 3. Test RBAC guard: Regular citizen cannot access admin routes (403)
    console.log('\n🧪 [Test 3] Verifying RBAC guard blocks regular citizens from admin routes (403)...');
    const rbacRes = await request(`/api/v1/admin/users/${regularUserId}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${regularUserToken}`,
      },
      body: JSON.stringify({ reason: 'Malicious attempt' }),
    });
    if (rbacRes.status !== 403) {
      throw new Error(`Expected 403, got ${rbacRes.status}: ${JSON.stringify(rbacRes.data)}`);
    }
    console.log('✅ [3/9] Non-admin access properly blocked with 403 Forbidden.');

    // 4. Test Admin Ban User & Immutable ModerationLog
    console.log('\n🧪 [Test 4] Admin bans regular user and verifies immutable ModerationLog...');
    const banRes = await request(`/api/v1/admin/users/${regularUserId}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${adminUserToken}`,
      },
      body: JSON.stringify({ reason: 'Repeated spam submissions in Khulna' }),
    });

    if (banRes.status !== 200) {
      throw new Error(`Ban failed: ${JSON.stringify(banRes.data)}`);
    }

    // Verify user is marked banned in DB
    const dbUserBanned = await prisma.user.findUnique({ where: { id: regularUserId } });
    if (!dbUserBanned?.isBanned) {
      throw new Error('User isBanned flag was not set to true in database!');
    }

    // Verify ModerationLog entry
    const banLog = await prisma.moderationLog.findFirst({
      where: { targetUserId: regularUserId, action: 'BAN_USER' },
    });
    if (!banLog || banLog.adminId !== adminUserId) {
      throw new Error('ModerationLog record missing or mismatched for BAN_USER action!');
    }
    console.log(`✅ [4/9] User banned and ModerationLog created (Log ID: ${banLog.id}, Action: ${banLog.action})`);

    // 5. Test Banned User is Blocked from Reporting
    console.log('\n🧪 [Test 5] Verifying banned user is blocked from submitting reports...');
    const reportAttemptRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${regularUserToken}`,
        'x-device-lat': '22.8456',
        'x-device-lng': '89.5403',
      },
      body: JSON.stringify({
        category: 'THEFT',
        severity: 'LOW',
        latitude: 22.8456,
        longitude: 89.5403,
        description: 'Attempted report by banned user.',
      }),
    });

    if (reportAttemptRes.status === 201) {
      throw new Error('Security flaw: Banned user was allowed to submit a report!');
    }
    console.log(`✅ [5/9] Banned user correctly blocked: ${reportAttemptRes.data.error.message}`);

    // 6. Test Admin Unban User & Immutable ModerationLog
    console.log('\n🧪 [Test 6] Admin unbans regular user and verifies second ModerationLog...');
    const unbanRes = await request(`/api/v1/admin/users/${regularUserId}/unban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${adminUserToken}`,
      },
      body: JSON.stringify({ reason: 'User completed safety agreement appeal' }),
    });

    if (unbanRes.status !== 200) {
      throw new Error(`Unban failed: ${JSON.stringify(unbanRes.data)}`);
    }

    const dbUserUnbanned = await prisma.user.findUnique({ where: { id: regularUserId } });
    if (dbUserUnbanned?.isBanned) {
      throw new Error('User isBanned flag was not restored to false!');
    }

    const unbanLog = await prisma.moderationLog.findFirst({
      where: { targetUserId: regularUserId, action: 'UNBAN_USER' },
    });
    if (!unbanLog) {
      throw new Error('ModerationLog record missing for UNBAN_USER action!');
    }
    console.log(`✅ [6/9] User unbanned and ModerationLog created (Log ID: ${unbanLog.id}, Action: ${unbanLog.action})`);

    // 7. Test Admin Purge Report, Audit Logging & Socket.IO Broadcasting
    console.log('\n🧪 [Test 7] Admin purges report, creates ModerationLog and emits real-time event...');
    
    // Create an unbanned report
    const createReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${regularUserToken}`,
        'x-device-lat': '22.8456',
        'x-device-lng': '89.5403',
      },
      body: JSON.stringify({
        category: 'DRUG_ACTIVITY',
        severity: 'MEDIUM',
        latitude: 22.8456,
        longitude: 89.5403,
        description: 'Report to be purged by admin.',
      }),
    });
    testReportId = createReportRes.data.data.id;

    // Listen for Socket.IO purge broadcast
    const purgeSocketPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for REPORT_PURGED socket event')), 5000);
      socketClient!.once('REPORT_PURGED', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const purgeRes = await request(`/api/v1/admin/reports/${testReportId}/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${adminUserToken}`,
      },
      body: JSON.stringify({ reason: 'False information confirmed by field review' }),
    });

    if (purgeRes.status !== 200) {
      throw new Error(`Report purge failed: ${JSON.stringify(purgeRes.data)}`);
    }

    const receivedPurgeSocket = await purgeSocketPromise;
    if (receivedPurgeSocket.reportId !== testReportId) {
      throw new Error(`Mismatched socket purge event: ${JSON.stringify(receivedPurgeSocket)}`);
    }

    // Verify DB state
    const dbPurgedReport = await prisma.report.findUnique({ where: { id: testReportId } });
    if (dbPurgedReport?.status !== 'PURGED') {
      throw new Error('Report status was not updated to PURGED in database!');
    }

    const purgeLog = await prisma.moderationLog.findFirst({
      where: { targetReportId: testReportId, action: 'PURGE_REPORT' },
    });
    if (!purgeLog) {
      throw new Error('ModerationLog record missing for PURGE_REPORT action!');
    }
    console.log(`✅ [7/9] Report purged in DB, broadcasted via Socket.IO, and logged in ModerationLog.`);

    // 8. Test Audit Log Retrieval Endpoint
    console.log('\n🧪 [Test 8] Retrieving paginated audit logs via GET /api/v1/admin/logs...');
    const logsRes = await request('/api/v1/admin/logs?page=1&limit=10', {
      headers: { cookie: `accessToken=${adminUserToken}` },
    });
    if (logsRes.status !== 200 || !logsRes.data.data?.logs) {
      throw new Error(`Failed to retrieve logs: ${JSON.stringify(logsRes.data)}`);
    }
    const retrievedLogs = logsRes.data.data.logs;
    if (retrievedLogs.length < 3) {
      throw new Error(`Expected at least 3 moderation logs, found ${retrievedLogs.length}`);
    }
    console.log(`✅ [8/9] Audit logs retrieved successfully (${retrievedLogs.length} entries recorded).`);

    // 9. Test Production Secret Sanitizer & Health Probes
    console.log('\n🧪 [Test 9] Testing Secret Sanitization & Health Check Endpoints...');
    const sensitiveString = 'Error connecting to postgresql://postgres.ref:SuperSecretPassword123@aws.pooler.supabase.com:6543/db with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const sanitizedOutput = sanitizeErrorOutput(sensitiveString);
    if (sanitizedOutput.includes('SuperSecretPassword123') || sanitizedOutput.includes('eyJhbGciOiJIUzI1Ni')) {
      throw new Error(`Secret sanitizer failed to mask secrets! Output: ${sanitizedOutput}`);
    }
    console.log('✅ Secret Sanitizer successfully scrubbed database credentials and JWT tokens.');

    const healthRes = await request('/health');
    const dbHealthRes = await request('/health/db');
    if (healthRes.status !== 200 || dbHealthRes.status !== 200) {
      throw new Error(`Health checks failed: health=${healthRes.status}, dbHealth=${dbHealthRes.status}`);
    }
    console.log('✅ Container readiness health probes (/health and /health/db) verified 200 OK.');

    console.log('\n🎉 ========================================================');
    console.log('🎉 ALL PHASE 12 OBSERVABILITY & PROD READINESS TESTS PASSED (100%)!');
    console.log('🎉 ========================================================\n');
  } finally {
    // Cleanup fixtures
    console.log('🧹 Cleaning up test database fixtures...');
    try {
      if (socketClient) {
        socketClient.disconnect();
      }
      if (testReportId) {
        await prisma.moderationLog.deleteMany({ where: { targetReportId: testReportId } });
        await prisma.vote.deleteMany({ where: { reportId: testReportId } });
        await prisma.report.deleteMany({ where: { id: testReportId } });
      }
      if (regularUserId) {
        await prisma.moderationLog.deleteMany({ where: { targetUserId: regularUserId } });
        await prisma.refreshToken.deleteMany({ where: { userId: regularUserId } });
        await prisma.user.deleteMany({ where: { id: regularUserId } });
      }
      if (adminUserId) {
        await prisma.moderationLog.deleteMany({ where: { adminId: adminUserId } });
        await prisma.refreshToken.deleteMany({ where: { userId: adminUserId } });
        await prisma.user.deleteMany({ where: { id: adminUserId } });
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
