import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { purgeExpiredReports } from './src/jobs/timeDecayJob';
import { prisma } from './src/db/prisma';

const TEST_PORT = 5098;
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
  console.log('🚀 [Test] Starting Phase 9 Time-Decay & Background Jobs Verification Suite...\n');

  // 1. Start test server
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ [1/4] Test server running on ${SERVER_URL}`);

  try {
    // 2. Authenticate user & connect real WebSocket client
    console.log('\n🧪 [Test 1] Authenticating user and establishing WebSocket connection...');
    const authRes = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `time-decay-tester-${Date.now()}` })
    });

    if (authRes.status !== 200 && authRes.status !== 201) {
      throw new Error(`Auth failed: ${JSON.stringify(authRes.data)}`);
    }

    const userId = authRes.data.data.user.id;
    const accessToken = extractCookie(authRes.cookies, 'accessToken');

    const socketClient: ClientSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${accessToken}`
      }
    });

    await new Promise<void>((resolve, reject) => {
      socketClient.on('connect', () => resolve());
      socketClient.on('connect_error', (err) => reject(new Error(`Failed to connect socket: ${err.message}`)));
    });

    console.log(`✅ Passed: Connected socket client ${socketClient.id}`);

    // Set up WebSocket listener for REPORT_EXPIRED
    let receivedExpiredPayload: any = null;
    socketClient.on('REPORT_EXPIRED', (payload) => {
      receivedExpiredPayload = payload;
    });

    // 3. Seed 2 reports: 1 expired and 1 active
    console.log('\n🧪 [Test 2] Seeding 1 expired report and 1 active unexpired report in DB...');
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const futureDate = new Date(Date.now() + 86400000); // 24 hours from now

    const expiredReport = await prisma.report.create({
      data: {
        userId,
        category: 'UNLIT_ROAD',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'Temporary road hazard that should be expired',
        status: 'ACTIVE',
        expiresAt: pastDate
      }
    });

    const activeReport = await prisma.report.create({
      data: {
        userId,
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: 23.76,
        longitude: 90.39,
        description: 'Recent active hazard that must NOT be expired',
        status: 'ACTIVE',
        expiresAt: futureDate
      }
    });

    console.log(`Created Expired Report (ID: ${expiredReport.id}, expiresAt: ${pastDate.toISOString()})`);
    console.log(`Created Active Report (ID: ${activeReport.id}, expiresAt: ${futureDate.toISOString()})`);
    console.log('✅ Passed: Reports seeded in database');

    // 4. Trigger purge worker
    console.log('\n🧪 [Test 3] Triggering purgeExpiredReports() worker...');
    const purgedCount = await purgeExpiredReports();
    console.log(`Worker executed. Purged count: ${purgedCount}`);

    if (purgedCount < 1) {
      throw new Error(`Expected at least 1 purged report, got ${purgedCount}`);
    }

    // 5. Verify database states
    console.log('\n🧪 [Test 4] Verifying database states and WebSocket event propagation...');
    const dbExpiredReport = await prisma.report.findUnique({ where: { id: expiredReport.id } });
    const dbActiveReport = await prisma.report.findUnique({ where: { id: activeReport.id } });

    if (!dbExpiredReport || dbExpiredReport.status !== 'PURGED') {
      throw new Error(`Expected expired report status to be 'PURGED', got: ${dbExpiredReport?.status}`);
    }
    console.log(`✅ Passed: Expired report (ID: ${expiredReport.id}) flipped to status 'PURGED'`);

    if (!dbActiveReport || dbActiveReport.status !== 'ACTIVE') {
      throw new Error(`Active report status unexpectedly changed! Status: ${dbActiveReport?.status}`);
    }
    console.log(`✅ Passed: Active unexpired report (ID: ${activeReport.id}) remains untouched as 'ACTIVE'`);

    // Give 500ms for WebSocket event
    await new Promise((r) => setTimeout(r, 500));

    if (!receivedExpiredPayload) {
      throw new Error('Socket client did not receive REPORT_EXPIRED event!');
    }

    console.log('Received REPORT_EXPIRED event payload:', receivedExpiredPayload);
    if (!receivedExpiredPayload.reportIds.includes(expiredReport.id)) {
      throw new Error(`REPORT_EXPIRED event missing expired report ID ${expiredReport.id}`);
    }
    if (receivedExpiredPayload.reason !== 'TIME_DECAY_EXPIRED') {
      throw new Error(`Unexpected reason: ${receivedExpiredPayload.reason}`);
    }
    console.log('✅ Passed: Real-time REPORT_EXPIRED event received and verified!');

    // Cleanup socket
    socketClient.disconnect();
    console.log('\n🎉 ALL PHASE 9 TIME-DECAY TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
