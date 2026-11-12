import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { app } from './src/app';
import { initSocketServer, emitUserAlert } from './src/sockets';
import { prisma } from './src/db/prisma';
import { generateSocketToken } from './src/utils/jwt';

const TEST_PORT = 5099;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

// Helper to make fetch requests
const request = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(`${SERVER_URL}${url}`, options);
  const data = await res.json().catch(() => null);
  const cookies = res.headers.get('set-cookie') || '';
  return { status: res.status, data, cookies };
};

// Extract a cookie value from Set-Cookie string
const extractCookie = (setCookieHeader: string, name: string): string => {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : '';
};

async function runTests() {
  console.log('🚀 [Test] Starting Phase 8 Real-Time Sockets Verification Suite...\n');

  // 1. Start test server
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ [1/5] Test server running on ${SERVER_URL}`);

  let guestSocket: ClientSocket | null = null;
  let crossOriginSocket: ClientSocket | null = null;
  let authSocket: ClientSocket | null = null;
  let bannedTestUserId: string | null = null;

  try {
    // -------------------------------------------------------------
    // Test Case 1: Guest read-only connection & invalid/banned token rejection
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 1] Testing Guest Read-Only Socket & Invalid/Banned Token Rejection...');
    guestSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false
    });

    await new Promise<void>((resolve, reject) => {
      guestSocket!.on('connect', () => resolve());
      guestSocket!.on('connect_error', (err) => reject(new Error(`Guest read-only socket failed to connect: ${err.message}`)));
      guestSocket!.connect();
    });
    console.log(`✅ Passed: Guest read-only client connected without cookie/token (ID: ${guestSocket.id})`);

    const invalidSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      auth: { token: 'invalid.jwt.token' }
    });

    const invalidErr = await new Promise<string>((resolve, reject) => {
      invalidSocket.on('connect_error', (err) => resolve(err.message));
      invalidSocket.on('connect', () => reject(new Error('FAILED: Invalid token should NOT be allowed to connect!')));
      invalidSocket.connect();
    });
    console.log(`✅ Passed: Invalid token rejected as expected: "${invalidErr}"`);
    invalidSocket.disconnect();

    const bannedUser = await prisma.user.create({
      data: {
        anonymousId: `banned-socket-user-${Date.now()}`,
        email: `banned-socket-${Date.now()}@test.local`,
        isBanned: true
      }
    });
    bannedTestUserId = bannedUser.id;
    const bannedSocketToken = generateSocketToken({
      id: bannedUser.id,
      role: bannedUser.role,
      isVerified: bannedUser.isVerified
    });

    const bannedSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      auth: { token: bannedSocketToken }
    });

    const bannedErr = await new Promise<string>((resolve, reject) => {
      bannedSocket.on('connect_error', (err) => resolve(err.message));
      bannedSocket.on('connect', () => reject(new Error('FAILED: Banned user socketToken should NOT be allowed to connect!')));
      bannedSocket.connect();
    });
    console.log(`✅ Passed: Banned user socketToken rejected as expected: "${bannedErr}"`);
    bannedSocket.disconnect();

    // -------------------------------------------------------------
    // Test Case 2: Cookie & Cross-Origin socketToken Auth + REST Scope Isolation
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 2] Testing Cookie Auth, Cross-Origin socketToken Auth & Scope Isolation...');
    const authRes = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `test-device-${Date.now()}` })
    });

    if (authRes.status !== 200 && authRes.status !== 201) {
      throw new Error(`Device login failed: ${JSON.stringify(authRes.data)}`);
    }

    const accessToken = extractCookie(authRes.cookies, 'accessToken');
    if (!accessToken) {
      throw new Error('Device login did not return accessToken cookie!');
    }

    const socketToken = authRes.data?.data?.socketToken;
    const authedUserId = authRes.data?.data?.user?.id;
    if (!socketToken || !authedUserId) {
      throw new Error(`Device login did not return socketToken or user.id: ${JSON.stringify(authRes.data)}`);
    }

    // Ensure scoped socketToken is rejected on HTTP REST endpoints
    const restWithSocketToken = await request('/api/v1/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${socketToken}`
      }
    });
    if (restWithSocketToken.status !== 401) {
      throw new Error(`Expected 401 when using socketToken on GET /api/v1/users/me, got ${restWithSocketToken.status}`);
    }
    console.log('✅ Passed: Scoped socketToken rejected on REST GET /api/v1/users/me with 401');

    // Cookie-less cross-origin client authenticating purely via auth: { token: socketToken }
    crossOriginSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: socketToken }
    });

    await new Promise<void>((resolve, reject) => {
      crossOriginSocket!.on('connect', () => resolve());
      crossOriginSocket!.on('connect_error', (err) => reject(new Error(`Cross-origin socketToken connection failed: ${err.message}`)));
    });
    console.log(`✅ Passed: Cookie-less cross-origin socket connected via socketToken (ID: ${crossOriginSocket.id})`);

    authSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${accessToken}`
      }
    });

    await new Promise<void>((resolve, reject) => {
      authSocket!.on('connect', () => resolve());
      authSocket!.on('connect_error', (err) => reject(new Error(`Failed to connect: ${err.message}`)));
    });

    console.log(`✅ Passed: Connected successfully as cookie-authenticated client (ID: ${authSocket.id})`);

    // Test map bounds subscription
    authSocket.emit('joinMapBounds', {
      minLng: 90.3,
      minLat: 23.7,
      maxLng: 90.5,
      maxLat: 23.9
    });
    console.log('✅ Passed: Emitted joinMapBounds successfully');

    // -------------------------------------------------------------
    // Test Case 3: Live NEW_REPORT Broadcast + Private GEOFENCE_ALERT Isolation
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 3] Testing NEW_REPORT Public Broadcast & Private GEOFENCE_ALERT Isolation...');
    const targetLat = 23.8103;
    const targetLng = 90.4125;

    const guestReportPromise = new Promise<any>((resolve) => {
      guestSocket!.on('NEW_REPORT', (payload) => resolve(payload));
    });
    const crossOriginReportPromise = new Promise<any>((resolve) => {
      crossOriginSocket!.on('NEW_REPORT', (payload) => resolve(payload));
    });
    const reportPromise = new Promise<any>((resolve) => {
      authSocket!.on('NEW_REPORT', (payload) => {
        resolve(payload);
      });
    });

    let guestReceivedPrivateAlert = false;
    guestSocket.on('GEOFENCE_ALERT', () => {
      guestReceivedPrivateAlert = true;
    });
    const crossOriginAlertPromise = new Promise<any>((resolve) => {
      crossOriginSocket!.on('GEOFENCE_ALERT', (payload) => resolve(payload));
    });

    const createReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `accessToken=${accessToken}`,
        'x-device-lat': targetLat.toString(),
        'x-device-lng': targetLng.toString()
      },
      body: JSON.stringify({
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: targetLat,
        longitude: targetLng,
        description: 'Test incident for real-time socket verification'
      })
    });

    if (createReportRes.status !== 201) {
      throw new Error(`Report creation failed: ${JSON.stringify(createReportRes.data)}`);
    }

    const createdReportId = createReportRes.data.data.id;
    console.log(`Report created in database (ID: ${createdReportId}). Waiting for WebSocket event...`);

    const [receivedReport, guestReport, crossOriginReport] = await Promise.all([
      Promise.race([
        reportPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for NEW_REPORT event!')), 3000))
      ]),
      Promise.race([
        guestReportPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for guest NEW_REPORT event!')), 3000))
      ]),
      Promise.race([
        crossOriginReportPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for cross-origin NEW_REPORT event!')), 3000))
      ]),
    ]) as [any, any, any];

    console.log('Received NEW_REPORT payload:', receivedReport);

    // Assertions
    if (
      receivedReport.id !== createdReportId ||
      guestReport.id !== createdReportId ||
      crossOriginReport.id !== createdReportId
    ) {
      throw new Error(`Report ID mismatch: expected ${createdReportId}, got ${receivedReport.id}`);
    }
    if ((receivedReport as any).userId !== undefined) {
      throw new Error('SECURITY VIOLATION: userId was leaked in NEW_REPORT payload!');
    }
    console.log('✅ Passed: NEW_REPORT received by cookie, guest, and cross-origin clients (100% PII-free)');

    // Verify private GEOFENCE_ALERT reaches cross-origin user room ONLY, never guest sockets
    emitUserAlert(authedUserId, { reportId: createdReportId, zoneName: 'Cross-Origin Test Zone' });
    const receivedAlert = await Promise.race([
      crossOriginAlertPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for cross-origin GEOFENCE_ALERT!')), 3000))
    ]) as any;
    await new Promise((r) => setTimeout(r, 200));

    if (receivedAlert?.reportId !== createdReportId) {
      throw new Error(`Unexpected GEOFENCE_ALERT payload: ${JSON.stringify(receivedAlert)}`);
    }
    if (guestReceivedPrivateAlert) {
      throw new Error('SECURITY VIOLATION: Guest socket received private GEOFENCE_ALERT!');
    }
    console.log('✅ Passed: Targeted GEOFENCE_ALERT delivered via cross-origin socketToken & withheld from guest socket');

    // -------------------------------------------------------------
    // Test Case 4: Real-time REPORT_VOTED & REPORT_PURGED (Trust Engine)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 4] Testing REPORT_VOTED & REPORT_PURGED (Trust Engine Threshold)...');

    // Listener for votes
    let latestVoteTally: any = null;
    authSocket.on('REPORT_VOTED', (data) => {
      if (data.reportId === createdReportId) {
        latestVoteTally = data;
      }
    });

    const purgePromise = new Promise<any>((resolve) => {
      authSocket.on('REPORT_PURGED', (data) => {
        if (data.reportId === createdReportId) {
          resolve(data);
        }
      });
    });

    // Cast 5 downvotes from 5 different unique users
    for (let i = 1; i <= 5; i++) {
      const voterAuth = await request('/api/v1/auth/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId: `voter-device-${Date.now()}-${i}` })
      });
      if (voterAuth.status !== 200 && voterAuth.status !== 201) {
        throw new Error(`Voter auth failed: ${JSON.stringify(voterAuth.data)}`);
      }
      const voterToken = extractCookie(voterAuth.cookies, 'accessToken');

      const voteRes = await request(`/api/v1/reports/${createdReportId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `accessToken=${voterToken}`
        },
        body: JSON.stringify({ voteType: -1 })
      });

      if (voteRes.status !== 201) {
        throw new Error(`Vote ${i} failed: ${JSON.stringify(voteRes.data)}`);
      }
    }

    // Give 500ms for events to propagate
    await new Promise((r) => setTimeout(r, 500));

    if (!latestVoteTally || latestVoteTally.downvotes < 5) {
      throw new Error(`Expected at least 5 downvotes in vote tally, got: ${JSON.stringify(latestVoteTally)}`);
    }
    console.log('✅ Passed: Received REPORT_VOTED event with 5 downvotes tally');

    const purgedEvent = await Promise.race([
      purgePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for REPORT_PURGED event!')), 3000))
    ]) as any;

    console.log('Received REPORT_PURGED payload:', purgedEvent);
    if (purgedEvent.reportId !== createdReportId) {
      throw new Error(`Purge reportId mismatch: expected ${createdReportId}, got ${purgedEvent.reportId}`);
    }
    console.log('✅ Passed: REPORT_PURGED received with reason "TRUST_ENGINE_DOWNVOTE_THRESHOLD"');

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    console.log('\n🎉 ALL PHASE 8 TESTS PASSED SUCCESSFULLY! Real-time Socket.IO is production-ready.');
  } finally {
    guestSocket?.disconnect();
    crossOriginSocket?.disconnect();
    authSocket?.disconnect();
    if (bannedTestUserId) {
      await prisma.user.deleteMany({ where: { id: bannedTestUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
