import http from 'http';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { calculateReportExpiry, isNightTimeInBangladesh } from './src/services/reportService';

const TEST_PORT = 5110;
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

async function runVerification() {
  console.log('🚀 [Test Suite] Starting Backend Gap Fixes Verification...\n');

  // 1. Pure Unit Checks for Helper Functions
  console.log('🧪 [Test 1] Verifying dynamic expiry calculations...');
  const baseTime = new Date('2026-10-27T12:00:00Z');
  
  const muggingExpiry = calculateReportExpiry('MUGGING', baseTime);
  const muggingHours = (muggingExpiry.getTime() - baseTime.getTime()) / (1000 * 60 * 60);
  if (Math.abs(muggingHours - 3) > 0.01) {
    throw new Error(`Expected MUGGING expiry to be 3h, got ${muggingHours}h`);
  }
  console.log(`  ✅ MUGGING expiry: +${muggingHours}h (Expected 3h)`);

  const drugExpiry = calculateReportExpiry('DRUG_ACTIVITY', baseTime);
  const drugHours = (drugExpiry.getTime() - baseTime.getTime()) / (1000 * 60 * 60);
  if (Math.abs(drugHours - 24) > 0.01) {
    throw new Error(`Expected DRUG_ACTIVITY expiry to be 24h, got ${drugHours}h`);
  }
  console.log(`  ✅ DRUG_ACTIVITY expiry: +${drugHours}h (Expected 24h)`);

  const unlitExpiry = calculateReportExpiry('UNLIT_ROAD', baseTime);
  const unlitDays = (unlitExpiry.getTime() - baseTime.getTime()) / (1000 * 60 * 60 * 24);
  if (Math.abs(unlitDays - 14) > 0.01) {
    throw new Error(`Expected UNLIT_ROAD expiry to be 14d, got ${unlitDays}d`);
  }
  console.log(`  ✅ UNLIT_ROAD expiry: +${unlitDays}d (Expected 14d)`);

  console.log('\n🧪 [Test 2] Verifying Bangladesh night-time detection...');
  // 15:00 UTC = 21:00 (9 PM) in Dhaka (UTC+6) -> Night
  const nightDate = new Date('2026-10-27T15:00:00Z');
  if (!isNightTimeInBangladesh(nightDate)) {
    throw new Error('Expected 15:00 UTC to be detected as night in Dhaka');
  }
  console.log('  ✅ 15:00 UTC (21:00 Dhaka) is night: true');

  // 04:00 UTC = 10:00 (10 AM) in Dhaka -> Day
  const dayDate = new Date('2026-10-27T04:00:00Z');
  if (isNightTimeInBangladesh(dayDate)) {
    throw new Error('Expected 04:00 UTC to be detected as day in Dhaka');
  }
  console.log('  ✅ 04:00 UTC (10:00 Dhaka) is night: false');

  // 2. Start HTTP & Socket Test Server
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`\n✅ Test server running on ${SERVER_URL}`);

  try {
    // 3. User Setup
    console.log('\n🧪 [Test 3] Authenticating test users...');
    const authA = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `author-${Date.now()}` })
    });
    const userAId = authA.data.data.user.id;
    const cookieA = `accessToken=${extractCookie(authA.cookies, 'accessToken')}`;

    const authB = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `voter-${Date.now()}` })
    });
    const userBId = authB.data.data.user.id;
    const cookieB = `accessToken=${extractCookie(authB.cookies, 'accessToken')}`;
    console.log(`  ✅ User A (Author: ${userAId}) and User B (Voter: ${userBId}) authenticated`);

    // 4. Create Incident with GPS Proximity
    console.log('\n🧪 [Test 4] Submitting report with GPS proximity and dynamic expiry...');
    const reportLat = 23.8103;
    const reportLng = 90.4125;
    const createRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieA,
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString()
      },
      body: JSON.stringify({
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: reportLat,
        longitude: reportLng,
        description: 'Active mugging incident near Farmgate'
      })
    });

    if (createRes.status !== 201) {
      throw new Error(`Failed to create report: ${JSON.stringify(createRes.data)}`);
    }
    const report = createRes.data.data;
    console.log(`  ✅ Report created: ID ${report.id}`);
    console.log(`     isNightReport: ${report.isNightReport}`);
    console.log(`     expiresAt: ${report.expiresAt}`);

    // 5. Single Report Lookup (GET /api/v1/reports/:id)
    console.log('\n🧪 [Test 5] Fetching single report by ID (GET /api/v1/reports/:id)...');
    const lookupRes = await request(`/api/v1/reports/${report.id}`);
    if (lookupRes.status !== 200) {
      throw new Error(`Single report lookup failed: ${JSON.stringify(lookupRes.data)}`);
    }
    const lookupData = lookupRes.data.data;
    if (lookupData.id !== report.id || lookupData.userId) {
      throw new Error('Report lookup returned incorrect ID or leaked userId!');
    }
    console.log(`  ✅ Single report retrieved successfully with PII stripped: ${lookupData.id}`);

    // 6. Spatial Query Filtering (Category, Severity, Night)
    console.log('\n🧪 [Test 6] Testing viewport query filtering with category and severity...');
    const filterRes = await request(
      `/api/v1/reports?minLng=90.0&minLat=23.0&maxLng=91.0&maxLat=24.0&category=MUGGING&severity=HIGH`
    );
    if (filterRes.status !== 200) {
      throw new Error(`Spatial query filtering failed: ${JSON.stringify(filterRes.data)}`);
    }
    const matched = filterRes.data.data;
    const found = matched.some((r: any) => r.id === report.id);
    if (!found) {
      throw new Error('Created report was not matched in filtered spatial query');
    }
    console.log(`  ✅ Spatial filter successfully returned matching report(s): ${matched.length}`);

    // Non-matching category
    const nonMatchRes = await request(
      `/api/v1/reports?minLng=90.0&minLat=23.0&maxLng=91.0&maxLat=24.0&category=UNLIT_ROAD`
    );
    const nonMatched = nonMatchRes.data.data;
    if (nonMatched.some((r: any) => r.id === report.id)) {
      throw new Error('Report appeared in wrong category filter!');
    }
    console.log('  ✅ Category filter correctly excluded non-matching reports');

    // 7. Trust Engine Accrual (Upvote)
    console.log('\n🧪 [Test 7] Testing Trust Engine accrual on upvotes...');
    const userAProfileBefore = await prisma.user.findUnique({ where: { id: userAId } });
    const initialTrust = userAProfileBefore?.trustScore ?? 0;

    const voteRes = await request(`/api/v1/reports/${report.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieB
      },
      body: JSON.stringify({ voteType: 1 })
    });

    if (voteRes.status !== 201) {
      throw new Error(`Vote failed: ${JSON.stringify(voteRes.data)}`);
    }

    const userAProfileAfter = await prisma.user.findUnique({ where: { id: userAId } });
    const newTrust = userAProfileAfter?.trustScore ?? 0;
    if (newTrust !== initialTrust + 1) {
      throw new Error(`Expected trustScore to increment from ${initialTrust} to ${initialTrust + 1}, got ${newTrust}`);
    }
    console.log(`  ✅ Author trustScore incremented: ${initialTrust} -> ${newTrust}`);

    // 8. Report Resolution (PATCH /api/v1/reports/:id/resolve)
    console.log('\n🧪 [Test 8] Testing Report Resolution authorization and lifecycle...');
    // Non-author attempting resolution -> 403
    const unauthorizedRes = await request(`/api/v1/reports/${report.id}/resolve`, {
      method: 'PATCH',
      headers: { 'Cookie': cookieB }
    });
    if (unauthorizedRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized resolve, got ${unauthorizedRes.status}`);
    }
    console.log('  ✅ Unauthorized resolution blocked with 403 Forbidden');

    // Author resolving report -> 200
    const resolveRes = await request(`/api/v1/reports/${report.id}/resolve`, {
      method: 'PATCH',
      headers: { 'Cookie': cookieA }
    });
    if (resolveRes.status !== 200) {
      throw new Error(`Resolution failed: ${JSON.stringify(resolveRes.data)}`);
    }
    console.log(`  ✅ Author successfully marked report as RESOLVED: status = ${resolveRes.data.data.status}`);

    // 9. Low Trust Score Restriction
    console.log('\n🧪 [Test 9] Testing low trust score submission restriction...');
    // Temporarily set User A's trustScore to -6
    await prisma.user.update({ where: { id: userAId }, data: { trustScore: -6 } });

    const lowTrustRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieA,
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

    if (lowTrustRes.status !== 400 || !lowTrustRes.data.error.message.includes('restricted')) {
      throw new Error(`Expected restriction for low trust score, got: ${JSON.stringify(lowTrustRes.data)}`);
    }
    console.log('  ✅ Report submission blocked for low-trust user (-6)');

    // Restore trust score
    await prisma.user.update({ where: { id: userAId }, data: { trustScore: 1 } });

    // 10. Admin Trends Analytics & Session Invalidation
    console.log('\n🧪 [Test 10] Testing Admin 30-Day Trends Analytics & Session Invalidation...');
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-${Date.now()}`,
        email: `admin-${Date.now()}@safety.gov.bd`,
        role: 'ADMIN'
      }
    });

    // Login admin
    const adminAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId })
    });
    const adminCookie = `accessToken=${extractCookie(adminAuth.cookies, 'accessToken')}`;

    // Query 30-day hazard trends
    const trendsRes = await request('/api/v1/admin/analytics/trends', {
      headers: { 'Cookie': adminCookie }
    });

    if (trendsRes.status !== 200) {
      throw new Error(`Trends analytics failed: ${JSON.stringify(trendsRes.data)}`);
    }
    const trends = trendsRes.data.data;
    console.log(`  ✅ 30-Day Trends retrieved successfully:`);
    console.log(`     Total Reports: ${trends.totalReports}`);
    console.log(`     Breakdown by Category:`, trends.breakdown.byCategory);
    console.log(`     Breakdown by Status:`, trends.breakdown.byStatus);
    console.log(`     Night Reports: ${trends.nightReportsCount} (${trends.nightReportPercentage}%)`);

    // Test ban with session invalidation
    console.log('\n🧪 [Test 11] Testing Admin Ban with Session Revocation...');
    const banRes = await request(`/api/v1/admin/users/${userAId}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({ reason: 'Repeated malicious reporting violation' })
    });

    if (banRes.status !== 200) {
      throw new Error(`Ban failed: ${JSON.stringify(banRes.data)}`);
    }

    // Verify active refresh tokens for User A are marked isRevoked
    const activeTokens = await prisma.refreshToken.findMany({
      where: { userId: userAId, isRevoked: false }
    });
    if (activeTokens.length > 0) {
      throw new Error(`Found ${activeTokens.length} unrevoked refresh tokens after user ban!`);
    }
    console.log('  ✅ All refresh tokens for banned user revoked successfully');

    console.log('\n🎉 ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  });
