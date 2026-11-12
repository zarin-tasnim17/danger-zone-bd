import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { calculateReportExpiry, createReport, isNightTimeInBangladesh } from './src/services/reportService';
import { getPlatformStats } from './src/services/statsService';
import { setReportLocation } from './src/db/spatialUtils';

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

    // 4. Create Incident with Hardware GPS Proximity & Accuracy Attestation
    console.log('\n🧪 [Test 4] Submitting report with hardware GPS proximity and dynamic expiry...');
    const reportLat = 23.8103;
    const reportLng = 90.4125;
    const createRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieA,
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString(),
        'x-device-accuracy': '15',
        'x-gps-source': 'hardware'
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
    if (report.isGpsVerified !== true) {
      throw new Error(`Expected isGpsVerified=true for hardware GPS <=200m & accuracy 15m, got ${report.isGpsVerified}`);
    }
    console.log(`  ✅ Report created: ID ${report.id}`);
    console.log(`     isGpsVerified: ${report.isGpsVerified}`);
    console.log(`     isNightReport: ${report.isNightReport}`);
    console.log(`     expiresAt: ${report.expiresAt}`);

    // [SEC-006] GPS Verification Matrix (Manual Pin, Coarse Accuracy, Spoofing & Validation)
    console.log('\n🧪 [Test 4b] Testing [SEC-006] GPS anti-spoofing matrix...');
    const helperAuth = async (suffix: string) => {
      const auth = await request('/api/v1/auth/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymousId: `sec006-${suffix}-${Date.now()}` })
      });
      return `accessToken=${extractCookie(auth.cookies, 'accessToken')}`;
    };

    const sec4bBasePayload = {
      category: 'THEFT',
      severity: 'LOW',
      latitude: reportLat,
      longitude: reportLng,
      description: 'SEC-006 verification test report'
    };

    // (i) Partial GPS header must return 400
    const partialHeaderRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('partial'),
        'x-forwarded-for': '10.0.6.1',
        'x-device-lat': reportLat.toString()
      },
      body: JSON.stringify(sec4bBasePayload)
    });
    if (partialHeaderRes.status !== 400) {
      throw new Error(`Expected 400 for partial GPS header, got ${partialHeaderRes.status}`);
    }

    // (ii) Client body cannot spoof isGpsVerified directly (.strict() rejects)
    const bodySpoofRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('bodyspoof'),
        'x-forwarded-for': '10.0.6.2'
      },
      body: JSON.stringify({ ...sec4bBasePayload, isGpsVerified: true })
    });
    if (bodySpoofRes.status !== 400) {
      throw new Error(`Expected 400 when attempting to pass isGpsVerified in body, got ${bodySpoofRes.status}`);
    }

    // (iii) Remote coordinates (> 200m) when device headers provided must return 400
    const distantGpsRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('distant'),
        'x-forwarded-for': '10.0.6.3',
        'x-device-lat': '22.3569',
        'x-device-lng': '91.7832',
        'x-device-accuracy': '15',
        'x-gps-source': 'hardware'
      },
      body: JSON.stringify(sec4bBasePayload)
    });
    if (distantGpsRes.status !== 400 || !distantGpsRes.data?.error?.message?.includes('200m')) {
      throw new Error(`Expected 400 200m error for distant device GPS, got ${JSON.stringify(distantGpsRes)}`);
    }

    // (iv) Manual pin (no device GPS headers) succeeds with isGpsVerified=false
    const manualPinRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('manual'),
        'x-forwarded-for': '10.0.6.4'
      },
      body: JSON.stringify(sec4bBasePayload)
    });
    if (manualPinRes.status !== 201 || manualPinRes.data?.data?.isGpsVerified !== false) {
      throw new Error(`Expected manual pin report 201 with isGpsVerified=false, got ${JSON.stringify(manualPinRes)}`);
    }
    const manualReportId = manualPinRes.data.data.id;

    // (v) Coarse GPS accuracy (> 250m) succeeds with isGpsVerified=false
    const coarseGpsRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('coarse'),
        'x-forwarded-for': '10.0.6.5',
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString(),
        'x-device-accuracy': '350',
        'x-gps-source': 'hardware'
      },
      body: JSON.stringify(sec4bBasePayload)
    });
    if (coarseGpsRes.status !== 201 || coarseGpsRes.data?.data?.isGpsVerified !== false) {
      throw new Error(`Expected coarse GPS report 201 with isGpsVerified=false, got ${JSON.stringify(coarseGpsRes)}`);
    }

    // (vi) Explicit manual source header cannot earn isGpsVerified=true even with low accuracy
    const manualSourceRes = await request('/api/v1/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await helperAuth('manualsrc'),
        'x-forwarded-for': '10.0.6.6',
        'x-device-lat': reportLat.toString(),
        'x-device-lng': reportLng.toString(),
        'x-device-accuracy': '10',
        'x-gps-source': 'manual'
      },
      body: JSON.stringify(sec4bBasePayload)
    });
    if (manualSourceRes.status !== 201 || manualSourceRes.data?.data?.isGpsVerified !== false) {
      throw new Error(`Expected x-gps-source=manual report to have isGpsVerified=false, got ${JSON.stringify(manualSourceRes)}`);
    }
    console.log('  ✅ [SEC-006] Manual pin, coarse GPS, partial headers, body spoof, and >200m gate verified');

    // 5. Single Report Lookup (GET /api/v1/reports/:id) & Viewer-Scoped isOwner ([SEC-005])
    console.log('\n🧪 [Test 5] Fetching single report by ID (GET /api/v1/reports/:id)...');
    const lookupChecks = [
      { label: 'unauthenticated viewer', headers: undefined, expectedIsOwner: false },
      {
        label: 'invalid token viewer',
        headers: { Authorization: 'Bearer invalid.jwt.token' },
        expectedIsOwner: false,
      },
      { label: 'authenticated non-owner', headers: { Cookie: cookieB }, expectedIsOwner: false },
      { label: 'authenticated author', headers: { Cookie: cookieA }, expectedIsOwner: true },
    ] as const;

    for (const check of lookupChecks) {
      const lookupRes = await request(
        `/api/v1/reports/${report.id}`,
        check.headers ? { headers: check.headers } : undefined
      );
      if (lookupRes.status !== 200) {
        throw new Error(`Single report lookup (${check.label}) failed: ${JSON.stringify(lookupRes.data)}`);
      }
      const lookupData = lookupRes.data.data;
      if (
        lookupData.id !== report.id ||
        'userId' in lookupData ||
        'user' in lookupData ||
        lookupData.isOwner !== check.expectedIsOwner ||
        lookupData.isGpsVerified !== true
      ) {
        throw new Error(
          `PII leak, isGpsVerified, or isOwner mismatch for ${check.label}: expected isOwner=${check.expectedIsOwner}, got ${JSON.stringify(lookupData)}`
        );
      }
    }

    const manualLookupRes = await request(`/api/v1/reports/${manualReportId}`);
    if (manualLookupRes.status !== 200 || manualLookupRes.data?.data?.isGpsVerified !== false) {
      throw new Error(`Expected manual report GET /:id isGpsVerified=false, got ${JSON.stringify(manualLookupRes.data)}`);
    }
    console.log(`  ✅ Single report retrieved with userId stripped, isOwner, and isGpsVerified verified: ${report.id}`);

    // 6. Spatial Query Filtering (Category, Severity, Night)
    console.log('\n🧪 [Test 6] Testing viewport query filtering with category and severity...');
    const filterRes = await request(
      `/api/v1/reports?minLng=90.0&minLat=23.0&maxLng=91.0&maxLat=24.0&category=MUGGING&severity=HIGH`
    );
    if (filterRes.status !== 200) {
      throw new Error(`Spatial query filtering failed: ${JSON.stringify(filterRes.data)}`);
    }
    const matched = filterRes.data.data;
    const found = matched.some((r: any) => r.id === report.id && r.isGpsVerified === true);
    if (!found) {
      throw new Error('Created report was not matched in filtered spatial query with isGpsVerified=true');
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
    if ('userId' in (resolveRes.data?.data || {}) || resolveRes.data?.data?.isOwner !== true) {
      throw new Error(`Resolve response leaked userId or omitted isOwner: ${JSON.stringify(resolveRes.data)}`);
    }
    console.log(`  ✅ Author successfully marked report as RESOLVED without exposing userId: status = ${resolveRes.data.data.status}`);

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
    // Create admin user with password credentials
    const adminPassword = `TestAdmin_${crypto.randomBytes(12).toString('hex')}`;
    const passwordHash = await bcrypt.hash(adminPassword, 4);
    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-${Date.now()}`,
        email: `admin-${Date.now()}@safety.gov.bd`,
        passwordHash,
        role: 'ADMIN'
      }
    });

    // Regression: device auth must reject ADMIN accounts and privileged email collisions
    const blockedDeviceAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId })
    });
    if (blockedDeviceAuth.status !== 403) {
      throw new Error(`Expected 403 for passwordless admin device login, got ${blockedDeviceAuth.status}`);
    }

    const blockedEmailCollision = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `escalate-${Date.now()}`, email: adminUser.email })
    });
    if (blockedEmailCollision.status !== 403) {
      throw new Error(`Expected 403 for privileged email collision on device login, got ${blockedEmailCollision.status}`);
    }
    console.log('  ✅ Device login strictly blocked (403) for ADMIN accounts');

    // Login admin via password authentication
    const adminAuth = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: adminPassword })
    });
    if (adminAuth.status !== 200) {
      throw new Error(`Admin password login failed: ${JSON.stringify(adminAuth.data)}`);
    }
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

    // 12. DB-001: Atomic Report + User lastReportAt + PostGIS Location Rollback Verification
    console.log('\n🧪 [Test 12] Verifying DB-001 atomic PostGIS location update & rollback...');
    const locRows = await prisma.$queryRaw<Array<{ has_location: boolean }>>`
      SELECT (location IS NOT NULL) AS has_location
      FROM "Report"
      WHERE id = ${manualReportId}
    `;
    if (!locRows[0]?.has_location) {
      throw new Error(`Expected PostGIS location to be populated on report ${manualReportId}`);
    }

    const rollbackUser = await prisma.user.create({
      data: {
        anonymousId: `db001-rollback-${Date.now()}`,
        email: `db001-rollback-${Date.now()}@test.safety`
      }
    });

    const origTransaction = prisma.$transaction.bind(prisma);
    (prisma as any).$transaction = async (fnOrOps: any, options?: any) => {
      if (typeof fnOrOps === 'function') {
        return origTransaction(async (tx: any) => {
          const txProxy = new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === '$executeRaw') {
                return async () => {
                  throw new Error('SIMULATED_POSTGIS_FAILURE');
                };
              }
              return Reflect.get(target, prop, receiver);
            }
          });
          return fnOrOps(txProxy);
        }, options);
      }
      return origTransaction(fnOrOps, options);
    };

    try {
      let threw = false;
      try {
        await createReport(rollbackUser.id, {
          category: 'THEFT',
          severity: 'MEDIUM',
          latitude: 23.8103,
          longitude: 90.4125,
          description: 'DB-001 simulated PostGIS rollback check'
        });
      } catch (err: any) {
        if (err?.message === 'SIMULATED_POSTGIS_FAILURE') {
          threw = true;
        } else {
          throw err;
        }
      }

      if (!threw) {
        throw new Error('Expected createReport to throw on simulated PostGIS failure');
      }

      const persistedReports = await prisma.report.findMany({
        where: { userId: rollbackUser.id }
      });
      if (persistedReports.length > 0) {
        throw new Error(`DB-001 regression: found ${persistedReports.length} report(s) persisted without PostGIS location!`);
      }

      const refreshedUser = await prisma.user.findUnique({
        where: { id: rollbackUser.id }
      });
      if (refreshedUser?.lastReportAt !== null) {
        throw new Error(`DB-001 regression: lastReportAt was mutated despite PostGIS rollback!`);
      }
      console.log('  ✅ PostGIS failure rolled back Report creation and User.lastReportAt atomically');
    } finally {
      (prisma as any).$transaction = origTransaction;
      await prisma.user.delete({ where: { id: rollbackUser.id } }).catch(() => {});
    }

    // 13. DB-003: Cascade Foreign Key Deletions (Report & User)
    console.log('\n🧪 [Test 13] Verifying DB-003 ON DELETE CASCADE foreign keys...');
    const cascadeOwner = await prisma.user.create({
      data: {
        anonymousId: `db003-owner-${Date.now()}`,
        email: `db003-owner-${Date.now()}@test.safety`
      }
    });
    const cascadePeer = await prisma.user.create({
      data: {
        anonymousId: `db003-peer-${Date.now()}`,
        email: `db003-peer-${Date.now()}@test.safety`
      }
    });

    const createdLogIds: string[] = [];
    try {
      // 13a. Direct Report delete cascades Vote, ReportUpdate, ReportMedia and nulls ModerationLog.targetReportId
      const targetReport = await createReport(cascadeOwner.id, {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.8103,
        longitude: 90.4125,
        description: 'DB-003 report cascade verification'
      });

      await prisma.vote.create({
        data: { userId: cascadePeer.id, reportId: targetReport.id, voteType: 1 }
      });
      await prisma.reportUpdate.create({
        data: { userId: cascadePeer.id, reportId: targetReport.id, content: 'Update before cascade delete' }
      });
      await prisma.reportMedia.create({
        data: { reportId: targetReport.id, originalUrl: 'https://example.test/orig.jpg' }
      });
      const reportLog = await prisma.moderationLog.create({
        data: {
          adminId: adminUser.id,
          targetReportId: targetReport.id,
          action: 'PURGE_REPORT',
          reason: 'DB-003 cascade verification'
        }
      });
      createdLogIds.push(reportLog.id);

      await prisma.report.delete({ where: { id: targetReport.id } });

      const [votesLeft, updatesLeft, mediaLeft, refreshedReportLog] = await Promise.all([
        prisma.vote.count({ where: { reportId: targetReport.id } }),
        prisma.reportUpdate.count({ where: { reportId: targetReport.id } }),
        prisma.reportMedia.count({ where: { reportId: targetReport.id } }),
        prisma.moderationLog.findUnique({ where: { id: reportLog.id } })
      ]);
      if (votesLeft !== 0 || updatesLeft !== 0 || mediaLeft !== 0 || refreshedReportLog?.targetReportId !== null) {
        throw new Error(
          `DB-003 Report cascade check failed: votes=${votesLeft}, updates=${updatesLeft}, media=${mediaLeft}, targetReportId=${refreshedReportLog?.targetReportId}`
        );
      }
      console.log('  ✅ Direct Report deletion cascaded Vote, ReportUpdate, ReportMedia & nulled ModerationLog.targetReportId');

      // 13b. Direct User delete cascades RefreshToken, UserVerification, UserAlertZone, Report (+ nested Vote/ReportUpdate) & nulls ModerationLog.targetUserId
      await prisma.user.update({
        where: { id: cascadeOwner.id },
        data: { lastReportAt: null }
      });
      const userReport = await createReport(cascadeOwner.id, {
        category: 'UNLIT_ROAD',
        severity: 'LOW',
        latitude: 23.815,
        longitude: 90.415,
        description: 'DB-003 user cascade report'
      });
      await prisma.refreshToken.create({
        data: {
          userId: cascadeOwner.id,
          token: `db003-rt-${crypto.randomBytes(8).toString('hex')}`,
          expiresAt: new Date(Date.now() + 60_000)
        }
      });
      await prisma.userVerification.create({
        data: { userId: cascadeOwner.id, type: 'PHONE_OTP' }
      });
      await prisma.$executeRaw`
        INSERT INTO "UserAlertZone" (id, "userId", name, area, "isActive", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${cascadeOwner.id},
          'DB-003 Temp Zone',
          ST_GeogFromText('SRID=4326;POLYGON((90.40 23.80, 90.42 23.80, 90.42 23.82, 90.40 23.82, 90.40 23.80))'),
          true,
          NOW(),
          NOW()
        )
      `;
      await prisma.vote.create({
        data: { userId: cascadePeer.id, reportId: userReport.id, voteType: 1 }
      });
      await prisma.reportUpdate.create({
        data: { userId: cascadeOwner.id, reportId: userReport.id, content: 'Author update' }
      });
      const userLog = await prisma.moderationLog.create({
        data: {
          adminId: adminUser.id,
          targetUserId: cascadeOwner.id,
          action: 'BAN_USER',
          reason: 'DB-003 user cascade verification'
        }
      });
      createdLogIds.push(userLog.id);

      await prisma.user.delete({ where: { id: cascadeOwner.id } });

      const [rtLeft, verLeft, zoneLeft, repLeft, refreshedUserLog] = await Promise.all([
        prisma.refreshToken.count({ where: { userId: cascadeOwner.id } }),
        prisma.userVerification.count({ where: { userId: cascadeOwner.id } }),
        prisma.$queryRaw<Array<{ cnt: number }>>`SELECT COUNT(*)::int AS cnt FROM "UserAlertZone" WHERE "userId" = ${cascadeOwner.id}`,
        prisma.report.count({ where: { userId: cascadeOwner.id } }),
        prisma.moderationLog.findUnique({ where: { id: userLog.id } })
      ]);
      if (rtLeft !== 0 || verLeft !== 0 || (zoneLeft[0]?.cnt ?? 0) !== 0 || repLeft !== 0 || refreshedUserLog?.targetUserId !== null) {
        throw new Error(
          `DB-003 User cascade check failed: rt=${rtLeft}, ver=${verLeft}, zones=${zoneLeft[0]?.cnt}, reports=${repLeft}, targetUserId=${refreshedUserLog?.targetUserId}`
        );
      }
      console.log('  ✅ Direct User deletion cascaded RefreshToken, UserVerification, UserAlertZone, Report & nulled ModerationLog.targetUserId');
    } finally {
      if (createdLogIds.length > 0) {
        await prisma.moderationLog.deleteMany({ where: { id: { in: createdLogIds } } }).catch(() => {});
      }
      await prisma.user.deleteMany({ where: { id: { in: [cascadeOwner.id, cascadePeer.id] } } }).catch(() => {});
    }

    // 14. DB-004: statsService Parity With Non-Null PostGIS Location
    console.log('\n🧪 [Test 14] Verifying DB-004 statsService alignment with PostGIS location...');
    const statsTestUser = await prisma.user.create({
      data: {
        anonymousId: `db004-stats-${Date.now()}`,
        email: `db004-stats-${Date.now()}@test.safety`
      }
    });

    try {
      const [baselineStats, spatialActiveRows] = await Promise.all([
        getPlatformStats(),
        prisma.$queryRaw<Array<{ cnt: number }>>`
          SELECT COUNT(*)::int AS cnt
          FROM "Report"
          WHERE status = 'ACTIVE' AND "expiresAt" > NOW() AND location IS NOT NULL
        `
      ]);
      const spatialActiveCount = spatialActiveRows[0]?.cnt ?? 0;
      if (baselineStats.activeReports !== spatialActiveCount) {
        throw new Error(
          `DB-004 baseline mismatch: stats.activeReports=${baselineStats.activeReports}, spatialActiveCount=${spatialActiveCount}`
        );
      }

      const unindexedReport = await prisma.report.create({
        data: {
          userId: statsTestUser.id,
          category: 'ROBBERY',
          severity: 'HIGH',
          latitude: 23.8103,
          longitude: 90.4125,
          description: 'DB-004 synthetic un-geolocated row',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }
      });

      // Clear PostGIS column explicitly (bypasses BEFORE INSERT trigger trg_update_report_location)
      await prisma.$executeRaw`
        UPDATE "Report" SET location = NULL WHERE id = ${unindexedReport.id}
      `;

      const statsWithNullLoc = await getPlatformStats();
      if (
        statsWithNullLoc.totalReports !== baselineStats.totalReports ||
        statsWithNullLoc.activeReports !== baselineStats.activeReports ||
        statsWithNullLoc.criticalThreats !== baselineStats.criticalThreats
      ) {
        throw new Error(
          `DB-004 regression: stats counted a Report row with location = NULL (${JSON.stringify(statsWithNullLoc)} vs ${JSON.stringify(baselineStats)})`
        );
      }

      await setReportLocation(prisma, unindexedReport.id, 23.8103, 90.4125);
      const statsWithLoc = await getPlatformStats();
      if (
        statsWithLoc.totalReports !== baselineStats.totalReports + 1 ||
        statsWithLoc.activeReports !== baselineStats.activeReports + 1 ||
        statsWithLoc.criticalThreats !== baselineStats.criticalThreats + 1
      ) {
        throw new Error(
          `DB-004 regression: stats did not include newly geolocated report (${JSON.stringify(statsWithLoc)} vs ${JSON.stringify(baselineStats)})`
        );
      }
      console.log('  ✅ getPlatformStats() excludes location = NULL rows and matches PostGIS active count');
    } finally {
      await prisma.user.delete({ where: { id: statsTestUser.id } }).catch(() => {});
    }

    console.log('\n🎉 ALL 14 VERIFICATION TESTS PASSED SUCCESSFULLY!');
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
