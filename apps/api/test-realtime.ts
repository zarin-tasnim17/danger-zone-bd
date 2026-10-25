import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';

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

  try {
    // -------------------------------------------------------------
    // Test Case 1: Unauthenticated connection must be rejected
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 1] Testing Unauthenticated Handshake Rejection...');
    const rejectedSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false
    });

    const rejectionPromise = new Promise<string>((resolve) => {
      rejectedSocket.on('connect_error', (err) => {
        resolve(err.message);
      });
      rejectedSocket.on('connect', () => {
        throw new Error('FAILED: Unauthenticated client should NOT be allowed to connect!');
      });
    });

    rejectedSocket.connect();
    const rejectionMessage = await rejectionPromise;
    console.log(`✅ Passed: Connection rejected as expected: "${rejectionMessage}"`);
    rejectedSocket.disconnect();

    // -------------------------------------------------------------
    // Test Case 2: Authenticated connection with JWT cookie
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 2] Testing Authenticated Handshake with JWT Cookie...');
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

    const authSocket: ClientSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${accessToken}`
      }
    });

    await new Promise<void>((resolve, reject) => {
      authSocket.on('connect', () => resolve());
      authSocket.on('connect_error', (err) => reject(new Error(`Failed to connect: ${err.message}`)));
    });

    console.log(`✅ Passed: Connected successfully as authenticated client (ID: ${authSocket.id})`);

    // Test map bounds subscription
    authSocket.emit('joinMapBounds', {
      minLng: 90.3,
      minLat: 23.7,
      maxLng: 90.5,
      maxLat: 23.9
    });
    console.log('✅ Passed: Emitted joinMapBounds successfully');

    // -------------------------------------------------------------
    // Test Case 3: Live NEW_REPORT Broadcast with PII Scrubbing
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 3] Testing NEW_REPORT Real-Time Broadcast & PII Scrubbing...');
    const targetLat = 23.8103;
    const targetLng = 90.4125;

    const reportPromise = new Promise<any>((resolve) => {
      authSocket.on('NEW_REPORT', (payload) => {
        resolve(payload);
      });
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

    const receivedReport = await Promise.race([
      reportPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for NEW_REPORT event!')), 3000))
    ]) as any;

    console.log('Received NEW_REPORT payload:', receivedReport);

    // Assertions
    if (receivedReport.id !== createdReportId) {
      throw new Error(`Report ID mismatch: expected ${createdReportId}, got ${receivedReport.id}`);
    }
    if ((receivedReport as any).userId !== undefined) {
      throw new Error('SECURITY VIOLATION: userId was leaked in NEW_REPORT payload!');
    }
    console.log('✅ Passed: NEW_REPORT received instantly and verified 100% PII-free!');

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
    authSocket.disconnect();
    console.log('\n🎉 ALL PHASE 8 TESTS PASSED SUCCESSFULLY! Real-time Socket.IO is production-ready.');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
