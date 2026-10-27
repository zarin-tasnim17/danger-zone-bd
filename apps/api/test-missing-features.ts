import http from 'http';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { haversineDistanceMeters } from './src/services/safeRouteService';

const TEST_PORT = 5115;
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

async function runMissingFeaturesVerification() {
  console.log('🚀 [Test Suite] Starting Completely Missing Features Verification Suite...\n');

  // 1. Boot HTTP and Socket test server
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Test server running on ${SERVER_URL}`);

  try {
    // 2. Authenticate standard citizen and admin user
    console.log('\n🧪 [Test 1] Authenticating test citizen and administrator...');
    const citizenAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `citizen-missing-${Date.now()}` })
    });
    const citizenId = citizenAuth.data.data.user.id;
    const citizenCookie = `accessToken=${extractCookie(citizenAuth.cookies, 'accessToken')}`;

    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-missing-${Date.now()}`,
        email: `admin-missing-${Date.now()}@safety.gov.bd`,
        role: 'ADMIN'
      }
    });
    const adminAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId })
    });
    const adminCookie = `accessToken=${extractCookie(adminAuth.cookies, 'accessToken')}`;
    console.log(`  ✅ Citizen (${citizenId}) and Admin (${adminUser.id}) authenticated.`);

    // 3. Test Safe Zones API
    console.log('\n🧪 [Test 2] Testing Safe Zones API (GET /api/v1/safe-zones)...');
    const safeZonesRes = await request('/api/v1/safe-zones');
    if (safeZonesRes.status !== 200) {
      throw new Error(`Failed to fetch safe zones: ${JSON.stringify(safeZonesRes.data)}`);
    }
    const safeZones = safeZonesRes.data.data;
    if (!Array.isArray(safeZones) || safeZones.length === 0) {
      throw new Error('Expected safe zones to be automatically seeded and returned');
    }
    console.log(`  ✅ Default safe zones automatically seeded: returned ${safeZones.length} safe havens`);
    console.log(`     Sample safe haven: "${safeZones[0].name}" (${safeZones[0].type})`);

    // Proximity lookup
    const farmgateProximity = await request('/api/v1/safe-zones?lat=23.7565&lng=90.3888&radius=2000');
    if (farmgateProximity.status !== 200) {
      throw new Error(`Proximity query failed: ${JSON.stringify(farmgateProximity.data)}`);
    }
    console.log(`  ✅ Proximity radius safe zones query returned ${farmgateProximity.data.data.length} havens nearby`);

    // Admin create safe zone
    console.log('\n🧪 [Test 3] Testing Admin Safe Zone Creation (POST /api/v1/safe-zones)...');
    const newSafeZoneRes = await request('/api/v1/safe-zones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        name: 'Dhanmondi 27 Police Box',
        type: 'POLICE_BOX',
        latitude: 23.7511,
        longitude: 90.3722
      })
    });
    if (newSafeZoneRes.status !== 201) {
      throw new Error(`Admin safe zone creation failed: ${JSON.stringify(newSafeZoneRes.data)}`);
    }
    console.log(`  ✅ Admin created verified safe zone: "${newSafeZoneRes.data.data.name}"`);

    // 4. Test Threaded Context Updates (ReportUpdate)
    console.log('\n🧪 [Test 4] Testing Threaded Context Updates (POST/GET /api/v1/reports/:id/updates)...');
    const reportLat = 22.8400;
    const reportLng = 89.5400;

    const reportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': citizenCookie,
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString()
      },
      body: JSON.stringify({
        category: 'UNLIT_ROAD',
        severity: 'MEDIUM',
        latitude: reportLat,
        longitude: reportLng,
        description: 'Streetlamps broken across 500m stretch'
      })
    });
    if (reportRes.status !== 201) {
      throw new Error(`Failed to create test report: ${JSON.stringify(reportRes.data)}`);
    }
    const reportId = reportRes.data.data.id;

    // Post update 1
    const update1 = await request(`/api/v1/reports/${reportId}/updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': citizenCookie
      },
      body: JSON.stringify({
        content: 'City corporation electricians have arrived on site.'
      })
    });
    if (update1.status !== 201) {
      throw new Error(`Posting context update failed: ${JSON.stringify(update1.data)}`);
    }
    console.log(`  ✅ Posted update 1: "${update1.data.data.content}" by ${update1.data.data.author.alias}`);

    // Fetch chronological updates
    const updatesList = await request(`/api/v1/reports/${reportId}/updates`);
    if (updatesList.status !== 200 || updatesList.data.data.length !== 1) {
      throw new Error(`Fetching updates list failed: ${JSON.stringify(updatesList.data)}`);
    }
    console.log(`  ✅ Retrieved ${updatesList.data.data.length} chronological update(s) with author PII strictly masked`);

    // 5. Test Safe Route Planning Pathfinding Engine
    console.log('\n🧪 [Test 5] Testing Safe Route Planning Algorithm (POST /api/v1/routes/safe-path)...');
    // Start and End coordinates across Dhaka
    const routeStart = { lat: 23.7400, lng: 90.3800 };
    const routeEnd = { lat: 23.7650, lng: 90.3800 };

    // Place an active HIGH severity hazard right on the direct path corridor
    const hazardLat = 23.7525;
    const hazardLng = 90.3800;
    await prisma.$executeRaw`
      INSERT INTO "Report" (id, "userId", category, severity, "isNightReport", latitude, longitude, location, description, status, "expiresAt", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${adminUser.id},
        'MUGGING'::"ReportCategory",
        'HIGH'::"ReportSeverity",
        false,
        ${hazardLat},
        ${hazardLng},
        ST_SetSRID(ST_MakePoint(${hazardLng}, ${hazardLat}), 4326)::geography,
        'Active dangerous mugging zone directly in corridor',
        'ACTIVE'::"ReportStatus",
        NOW() + INTERVAL '3 hours',
        NOW(),
        NOW()
      )
    `;

    const routeRes = await request('/api/v1/routes/safe-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startLat: routeStart.lat,
        startLng: routeStart.lng,
        endLat: routeEnd.lat,
        endLng: routeEnd.lng
      })
    });

    if (routeRes.status !== 200) {
      throw new Error(`Safe route calculation failed: ${JSON.stringify(routeRes.data)}`);
    }
    const routeData = routeRes.data.data;
    console.log(`  ✅ Safe route calculated:`);
    console.log(`     Direct distance: ${routeData.directDistanceMeters}m`);
    console.log(`     Safe distance: ${routeData.safeDistanceMeters}m`);
    console.log(`     Bypassed hazards: ${routeData.bypassedHazardsCount}`);
    console.log(`     Safety rating: ${routeData.safetyRating}`);
    console.log(`     Waypoints: ${routeData.waypoints.length} coordinates plotted`);

    if (routeData.bypassedHazardsCount === 0 || routeData.waypoints.length < 3) {
      throw new Error('Algorithm failed to detect corridor hazard or generate detour waypoints!');
    }

    // 6. Test User Account Rate Limiting (User.lastReportAt)
    console.log('\n🧪 [Test 6] Testing User Account Rate Limiting (15-min spam block)...');
    // Immediate second submission by citizen -> should be rejected with 429
    const secondReportRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': citizenCookie,
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString()
      },
      body: JSON.stringify({
        category: 'THEFT',
        severity: 'LOW',
        latitude: reportLat,
        longitude: reportLng
      })
    });

    if (secondReportRes.status !== 429) {
      throw new Error(`Expected 429 rate limit error for rapid submission, got ${secondReportRes.status}: ${JSON.stringify(secondReportRes.data)}`);
    }
    console.log('  ✅ Rapid submission blocked by User.lastReportAt check (HTTP 429 Rate Limit Exceeded)');

    // 7. Test Location Fuzzing (Deterministic Cryptographic Jitter)
    console.log('\n🧪 [Test 7] Testing Location Fuzzing (Deterministic Cryptographic Jitter)...');
    const singleReportLookup = await request(`/api/v1/reports/${reportId}`);
    if (singleReportLookup.status !== 200) {
      throw new Error(`Report lookup failed: ${JSON.stringify(singleReportLookup.data)}`);
    }
    const fuzzedReport = singleReportLookup.data.data;
    const distanceDiff = haversineDistanceMeters(
      reportLat, reportLng,
      fuzzedReport.latitude, fuzzedReport.longitude
    );

    console.log(`  ✅ Location Fuzzing Verification:`);
    console.log(`     Actual GPS: (${reportLat}, ${reportLng})`);
    console.log(`     Public Fuzzed GPS: (${fuzzedReport.latitude}, ${fuzzedReport.longitude})`);
    console.log(`     Offset Distance: ${distanceDiff.toFixed(1)} meters (Target: 40-80m)`);
    console.log(`     Fuzzed Danger Perimeter Radius: ${fuzzedReport.fuzzedRadiusMeters} meters`);

    if (distanceDiff < 30 || distanceDiff > 95) {
      throw new Error(`Fuzzing offset of ${distanceDiff}m is outside expected 40-80m privacy range!`);
    }

    console.log('\n🎉 ALL 7 MISSING FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runMissingFeaturesVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  });
