import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { notificationEvents } from './src/jobs/notificationWorker';

const TEST_PORT = 5096;
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
  console.log('🚀 [Test] Starting Phase 11 Notifications & Alert Zones Verification Suite...\n');

  // 1. Start test server with Socket.IO
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ [1/9] Test server running on ${SERVER_URL}`);

  let user1Id = '';
  let user1Token = '';
  let user2Id = '';
  let user2Token = '';
  let socketClient2: ClientSocket | null = null;
  let createdZoneId = '';
  let insideReportId = '';
  let outsideReportId = '';

  try {
    // 2. Authenticate User 1 (Reporter) and User 2 (Resident)
    console.log('\n🧪 [Test 1] Authenticating test users...');
    const auth1 = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `alerts-reporter-${Date.now()}` }),
    });
    user1Id = auth1.data.data.user.id;
    user1Token = extractCookie(auth1.cookies, 'accessToken');

    const auth2 = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `alerts-resident-${Date.now()}` }),
    });
    user2Id = auth2.data.data.user.id;
    user2Token = extractCookie(auth2.cookies, 'accessToken');
    console.log(`✅ [2/9] Users authenticated (User 1 Reporter: ${user1Id}, User 2 Resident: ${user2Id})`);

    // Connect User 2's WebSocket client
    socketClient2 = ioClient(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: {
        cookie: `accessToken=${user2Token}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      socketClient2!.on('connect', () => resolve());
      socketClient2!.on('connect_error', (err) => reject(err));
    });
    console.log('✅ Connected User 2 WebSocket client to personal notification channel.');

    // 3. Test unauthenticated request guard (401)
    console.log('\n🧪 [Test 2] Verifying 401 Unauthorized for unauthenticated zone creation...');
    const unauthRes = await request('/api/v1/alerts/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauth Zone',
        coordinates: [
          [89.535, 22.84],
          [89.545, 22.84],
          [89.545, 22.85],
          [89.535, 22.85],
          [89.535, 22.84],
        ],
      }),
    });
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401, got ${unauthRes.status}: ${JSON.stringify(unauthRes.data)}`);
    }
    console.log('✅ [3/9] Unauthenticated zone creation properly blocked with 401.');

    // 4. Test polygon validation - unclosed ring (400)
    console.log('\n🧪 [Test 3] Verifying 400 Bad Request for unclosed polygon ring...');
    const unclosedRes = await request('/api/v1/alerts/zones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user2Token}`,
      },
      body: JSON.stringify({
        name: 'Unclosed Zone',
        coordinates: [
          [89.535, 22.84],
          [89.545, 22.84],
          [89.545, 22.85],
          [89.535, 22.85], // Missing closing vertex equal to first
        ],
      }),
    });
    if (unclosedRes.status !== 400) {
      throw new Error(`Expected 400, got ${unclosedRes.status}: ${JSON.stringify(unclosedRes.data)}`);
    }
    console.log('✅ [4/9] Unclosed polygon ring properly rejected with 400.');

    // 5. Test anti-abuse area capping (reject > 25 km²)
    console.log('\n🧪 [Test 4] Verifying anti-abuse 400 rejection for oversized polygon (>25 km²)...');
    // Massive box across southwest Bangladesh (>5,000 km²)
    const oversizedRes = await request('/api/v1/alerts/zones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user2Token}`,
      },
      body: JSON.stringify({
        name: 'Whole Division Zone',
        coordinates: [
          [89.0, 22.0],
          [90.0, 22.0],
          [90.0, 23.0],
          [89.0, 23.0],
          [89.0, 22.0],
        ],
      }),
    });
    if (oversizedRes.status !== 400) {
      throw new Error(`Expected 400, got ${oversizedRes.status}: ${JSON.stringify(oversizedRes.data)}`);
    }
    console.log(`✅ [5/9] Anti-abuse area limit enforced: ${oversizedRes.data.error.message}`);

    // 6. Test valid zone creation (~1.2 km² around Shib Bari, Khulna)
    console.log('\n🧪 [Test 5] Creating valid alert zone for User 2 (Home - Shib Bari)...');
    const validZoneRes = await request('/api/v1/alerts/zones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user2Token}`,
      },
      body: JSON.stringify({
        name: 'Home - Shib Bari',
        coordinates: [
          [89.535, 22.84],
          [89.545, 22.84],
          [89.545, 22.85],
          [89.535, 22.85],
          [89.535, 22.84],
        ],
      }),
    });

    if (validZoneRes.status !== 201) {
      throw new Error(`Valid zone creation failed: ${JSON.stringify(validZoneRes.data)}`);
    }

    const createdZone = validZoneRes.data.data;
    createdZoneId = createdZone.id;
    if (createdZone.name !== 'Home - Shib Bari' || createdZone.area.type !== 'Polygon') {
      throw new Error(`Malformed zone returned: ${JSON.stringify(createdZone)}`);
    }
    console.log(`✅ [6/9] Alert zone created successfully (ID: ${createdZoneId}, Type: ${createdZone.area.type})`);

    // 7. Test listing active alert zones
    console.log('\n🧪 [Test 6] Fetching active alert zones for User 2...');
    const listRes = await request('/api/v1/alerts/zones', {
      headers: { cookie: `accessToken=${user2Token}` },
    });
    if (listRes.status !== 200 || !Array.isArray(listRes.data.data) || listRes.data.data.length === 0) {
      throw new Error(`Failed to list alert zones: ${JSON.stringify(listRes.data)}`);
    }
    console.log(`✅ [7/9] Retrieved ${listRes.data.data.length} active alert zone(s) with GeoJSON geometries.`);

    // 8. Test PostGIS ST_Intersects & Asynchronous Notification Worker
    console.log('\n🧪 [Test 7] Testing PostGIS ST_Intersects & Asynchronous Geofence Alerting...');
    
    // Set up a promise to catch the real-time GEOFENCE_ALERT on User 2's socket
    const socketAlertPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for GEOFENCE_ALERT socket event')), 5000);
      socketClient2!.once('GEOFENCE_ALERT', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // User 1 reports a HIGH severity MUGGING inside User 2's zone (22.8450, 89.5400)
    console.log('       Submitting HIGH severity incident inside User 2\'s zone (22.8450, 89.5400)...');
    const insideReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user1Token}`,
        'x-device-lat': '22.8450',
        'x-device-lng': '89.5400',
      },
      body: JSON.stringify({
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: 22.8450,
        longitude: 89.5400,
        description: 'Armed robbery incident near Shib Bari circle.',
      }),
    });

    if (insideReportRes.status !== 201) {
      throw new Error(`Incident creation failed: ${JSON.stringify(insideReportRes.data)}`);
    }
    insideReportId = insideReportRes.data.data.id;
    console.log(`       Report created instantly with status 201 (ID: ${insideReportId}). Awaiting worker alert...`);

    const receivedAlert = await socketAlertPromise;
    if (
      receivedAlert.data.reportId !== insideReportId ||
      !receivedAlert.data.zones.includes('Home - Shib Bari')
    ) {
      throw new Error(`Unexpected alert payload: ${JSON.stringify(receivedAlert)}`);
    }
    console.log(`✅ [8/9] Asynchronous ST_Intersects worker correctly alerted User 2!`);
    console.log(`       Alert Title: ${receivedAlert.title}`);
    console.log(`       Alert Body:  ${receivedAlert.body}`);
    console.log(`       Matched Zones: ${receivedAlert.data.zones.join(', ')}`);

    // 9. Test Spatial Isolation: Incident outside zone should NOT trigger an alert
    console.log('\n🧪 [Test 8] Testing spatial isolation (incident outside alert zone)...');
    let spuriousAlertReceived = false;
    socketClient2!.once('GEOFENCE_ALERT', () => {
      spuriousAlertReceived = true;
    });

    // User 1 reports incident 10km away at Daulatpur (22.8900, 89.5100)
    const outsideReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `accessToken=${user1Token}`,
        'x-device-lat': '22.8900',
        'x-device-lng': '89.5100',
      },
      body: JSON.stringify({
        category: 'THEFT',
        severity: 'HIGH',
        latitude: 22.8900,
        longitude: 89.5100,
        description: 'Theft incident far away in Daulatpur.',
      }),
    });
    outsideReportId = outsideReportRes.data.data.id;

    // Wait 500ms to ensure no spurious alert is emitted
    await new Promise((r) => setTimeout(r, 500));
    if (spuriousAlertReceived) {
      throw new Error('Spatial isolation failure: Received alert for an incident outside the alert zone!');
    }
    console.log('✅ Spatial isolation verified: No notification emitted for out-of-zone incident.');

    // 10. Test Ownership & Deletion Guard
    console.log('\n🧪 [Test 9] Testing ownership guard & zone deletion...');
    // User 1 tries to delete User 2's zone -> expect 403
    const unauthorizedDelete = await request(`/api/v1/alerts/zones/${createdZoneId}`, {
      method: 'DELETE',
      headers: { cookie: `accessToken=${user1Token}` },
    });
    if (unauthorizedDelete.status !== 403) {
      throw new Error(`Expected 403, got ${unauthorizedDelete.status}: ${JSON.stringify(unauthorizedDelete.data)}`);
    }
    console.log('✅ Non-owner deletion properly blocked with 403 Forbidden.');

    // User 2 deletes their own zone -> expect 200
    const ownerDelete = await request(`/api/v1/alerts/zones/${createdZoneId}`, {
      method: 'DELETE',
      headers: { cookie: `accessToken=${user2Token}` },
    });
    if (ownerDelete.status !== 200) {
      throw new Error(`Owner delete failed: ${JSON.stringify(ownerDelete.data)}`);
    }
    console.log('✅ Owner zone deletion succeeded with 200 OK.');

    console.log('\n🎉 ========================================================');
    console.log('🎉 ALL PHASE 11 NOTIFICATIONS & ALERT ZONES TESTS PASSED (100%)!');
    console.log('🎉 ========================================================\n');
  } finally {
    // Cleanup fixtures
    console.log('🧹 Cleaning up test database fixtures...');
    try {
      if (socketClient2) {
        socketClient2.disconnect();
      }
      if (createdZoneId) {
        await prisma.$executeRaw`DELETE FROM "UserAlertZone" WHERE id = ${createdZoneId}`;
      }
      if (insideReportId) {
        await prisma.report.deleteMany({ where: { id: insideReportId } });
      }
      if (outsideReportId) {
        await prisma.report.deleteMany({ where: { id: outsideReportId } });
      }
      if (user1Id) {
        await prisma.refreshToken.deleteMany({ where: { userId: user1Id } });
        await prisma.user.deleteMany({ where: { id: user1Id } });
      }
      if (user2Id) {
        await prisma.refreshToken.deleteMany({ where: { userId: user2Id } });
        await prisma.user.deleteMany({ where: { id: user2Id } });
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
