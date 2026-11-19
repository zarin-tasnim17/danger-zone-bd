import http from 'http';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { ReportCategory, ReportSeverity } from '@prisma/client';
import {
  normalizeCanonicalUrl,
  cleanIncidentTitle,
  extractSignificantTokens,
  calculateStorySimilarity,
} from './src/services/incidentDeduplicationService';
import {
  classifyNewsText,
  getKeywordWeight,
} from './src/services/newsClassifierService';
import {
  verifyReport,
  reclassifyReport,
} from './src/services/adminService';

const TEST_PORT = 5124;
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

async function runMilestone2Suite() {
  console.log('===============================================================');
  console.log('  Danger Zone BD - Milestone 2 Comprehensive Test Suite');
  console.log('  Deduplication, Multi-Source Consolidation & Classification');
  console.log('===============================================================\n');

  // Start API test server
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ API Test Server running on ${SERVER_URL}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✔ [PASS] ${name}`);
        passedTests++;
      } catch (err: any) {
        console.error(`  ✖ [FAIL] ${name}`);
        console.error(`    ${err.message || err}`);
        throw err;
      }
    })();
  }

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: URL Canonicalization & Tracking Stripping (Feature 6)
    // ------------------------------------------------------------------------
    console.log('--- Section 1: URL Canonicalization & Tracking Stripping ---');

    await test('T1.1: Strips all tracking parameters (utm_*, ref, fbclid, gclid, ocid, ved, source)', () => {
      const raw = 'https://thedailystar.net/news/accident?utm_source=fb&utm_medium=cpc&utm_campaign=breaking&utm_term=safety&utm_content=v1&ref=rss&fbclid=123&gclid=456&ocid=789&ved=001&source=feed';
      const canonical = normalizeCanonicalUrl(raw);
      assert.strictEqual(canonical, 'https://thedailystar.net/news/accident');
    });

    await test('T1.2: Standardizes protocol to HTTPS and domain to lowercase', () => {
      const raw = 'http://NEWS.ProthomAlo.COM/crime/theft';
      const canonical = normalizeCanonicalUrl(raw);
      assert.strictEqual(canonical, 'https://news.prothomalo.com/crime/theft');
    });

    await test('T1.3: Removes www. subdomain while preserving path', () => {
      const raw = 'https://www.dhakapost.com/national/accident-reported';
      const canonical = normalizeCanonicalUrl(raw);
      assert.strictEqual(canonical, 'https://dhakapost.com/national/accident-reported');
    });

    await test('T1.4: Strips trailing slashes while preserving root slash /', () => {
      assert.strictEqual(
        normalizeCanonicalUrl('https://kalerkantho.com/national/road-crash/'),
        'https://kalerkantho.com/national/road-crash'
      );
      assert.strictEqual(normalizeCanonicalUrl('https://samakal.com/'), 'https://samakal.com/');
    });

    await test('T1.5: Preserves non-tracking query parameters, double percent encoding, and IDN Punycode', () => {
      const raw1 = 'https://ittefaq.com.bd/view.php?article_id=98721&page=1&utm_source=twitter';
      assert.strictEqual(normalizeCanonicalUrl(raw1), 'https://ittefaq.com.bd/view.php?article_id=98721&page=1');

      const raw2 = 'https://prothomalo.com/bangladesh/%2520special%252Farticle?slug=%25E0%25A6%25AC';
      assert.ok(normalizeCanonicalUrl(raw2).includes('%2520special%252Farticle'));

      const raw3 = 'https://xn--54b8cd9a.com/bangladesh/news?utm_source=feed';
      assert.strictEqual(normalizeCanonicalUrl(raw3), 'https://xn--54b8cd9a.com/bangladesh/news');
    });

    // ------------------------------------------------------------------------
    // SECTION 2: Headline Normalization & Title Matching (Feature 7)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Headline Normalization & Title Matching ---');

    await test('T2.1: Strips Bengali Double Dari (॥), Dari (।), En-dash (–), and Em-dash (—)', () => {
      const raw = 'মিরপুরে সড়ক দুর্ঘটনা ॥ বাস চাপায় পথচারী নিহত – বিস্তারিত আসছে';
      const cleaned = cleanIncidentTitle(raw);
      assert.ok(!cleaned.includes('॥'));
      assert.ok(!cleaned.includes('–'));
      assert.ok(cleaned.includes('মিরপুরে সড়ক দুর্ঘটনা'));
      assert.ok(cleaned.includes('বাস চাপায় পথচারী নিহত'));
    });

    await test('T2.2: Strips feed aggregator prefixes and trailing media outlet credits', () => {
      const t1 = 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে নিহত ৩ - The Daily Star';
      const t2 = 'উত্তরায় মধ্যরাতে সশস্ত্র ডাকাতি | প্রথম আলো';
      const t3 = '[Google News BD Theft] মিরপুরে স্বর্ণালঙ্কার চুরি';

      assert.strictEqual(cleanIncidentTitle(t1), 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে নিহত ৩');
      assert.strictEqual(cleanIncidentTitle(t2), 'উত্তরায় মধ্যরাতে সশস্ত্র ডাকাতি');
      assert.strictEqual(cleanIncidentTitle(t3), 'মিরপুরে স্বর্ণালঙ্কার চুরি');
    });

    await test('T2.3: Converts Bengali numerals (০-৯) to Western numerals (0-9)', () => {
      const tokens = extractSignificantTokens('গাজীপুরে সংঘর্ষে ৫ জন নিহত ও ১২ জন আহত');
      assert.ok(tokens.has('5'));
      assert.ok(tokens.has('12'));
    });

    await test('T2.4: Cross-lingual headline normalization matches English and Bangla story variants', () => {
      const titleBn = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে ৩ জন নিহত';
      const titleEn = '3 killed in bus-truck collision in Sitakunda - Daily Star';

      const sim = calculateStorySimilarity(titleBn, titleEn);
      assert.strictEqual(sim.isDuplicate, true, 'Bilingual headlines must be recognized as duplicate');
      assert.ok(sim.sharedTokens.length >= 2, 'Must share anchor entities');
    });

    await test('T2.5: Punctuation-only titles clean safely to empty string and do not trigger ReDoS', () => {
      assert.strictEqual(cleanIncidentTitle('॥ ॥ ॥ ॥ ॥'), '');
      assert.strictEqual(cleanIncidentTitle('– – — — | | - -'), '');
      assert.strictEqual(cleanIncidentTitle('   '), '');

      const longRepeated = 'মিরপুরে '.repeat(600) + 'সড়ক দুর্ঘটনা - The Daily Star';
      const start = Date.now();
      const cleaned = cleanIncidentTitle(longRepeated);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 50, `cleanIncidentTitle must finish in <50ms (took ${elapsed}ms)`);
      assert.ok(!cleaned.includes('The Daily Star'));
    });

    // ------------------------------------------------------------------------
    // SECTION 3: 11-Category Classification Engine (Feature 9)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: 11-Category Classification Engine ---');

    await test('T3.1: Word-boundary matching prevents false positives for short English keywords', () => {
      // "business" should NOT trigger bus / collision
      const r1 = classifyNewsText('Big business seminar held in Dhaka today', 'Economic growth report');
      assert.strictEqual(r1.isSafetyRelated, false, 'Business seminar must not trigger safety classification');

      // "career" should NOT trigger car / collision
      const r2 = classifyNewsText('University career counseling fair draws students', 'Students seek jobs');
      assert.strictEqual(r2.isSafetyRelated, false, 'Career fair must not trigger safety classification');

      // "bulletin" should NOT trigger bullet / gunfire
      const r3 = classifyNewsText('Official meteorological bulletin released', 'Weather forecast update');
      assert.strictEqual(r3.isSafetyRelated, false, 'Weather bulletin must not trigger ARMED_ASSAULT');

      // Genuine short keywords DO match
      const r4 = classifyNewsText('Bus crashed into wall in Mirpur', 'Passengers injured');
      assert.strictEqual(r4.isSafetyRelated, true);
      assert.strictEqual(r4.category, 'ROAD_ACCIDENT');
    });

    await test('T3.2: Weighted compound scoring assigns 5 to exact compound phrases, 3 to medium terms, 1 to generic terms', () => {
      // Weight 5: exact compound safety phrases
      assert.strictEqual(getKeywordWeight('সড়ক দুর্ঘটনা'), 5);
      assert.strictEqual(getKeywordWeight('কিশোর গ্যাং'), 5);
      assert.strictEqual(getKeywordWeight('সশস্ত্র ডাকাত'), 5);
      assert.strictEqual(getKeywordWeight('armed robbery'), 5);

      // Weight 3: medium specificity terms
      assert.strictEqual(getKeywordWeight('ছিনতাইকারী'), 3);
      assert.strictEqual(getKeywordWeight('গুলিবিদ্ধ'), 3);
      assert.strictEqual(getKeywordWeight('ইয়াবা'), 3);
      assert.strictEqual(getKeywordWeight('extortion'), 3);

      // Weight 1: generic single terms
      assert.strictEqual(getKeywordWeight('চোর'), 1);
      assert.strictEqual(getKeywordWeight('হামলা'), 1);
      assert.strictEqual(getKeywordWeight('মারধর'), 1);
      assert.strictEqual(getKeywordWeight('theft'), 1);
    });

    await test('T3.3: Returns probabilistic confidence score in range [0.0, 1.0]', () => {
      const r1 = classifyNewsText('সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩', 'মহাসড়কে দুর্ঘটনা');
      assert.ok(r1.confidence >= 0.60 && r1.confidence <= 1.0, `Confidence ${r1.confidence} must be between 0.60 and 1.0`);

      const r2 = classifyNewsText('আজকের আবহাওয়া পূর্বাভাস ও বৃষ্টিপাত', 'রোদ ও মেঘের খেলা');
      assert.strictEqual(r2.confidence, 0.0, 'Non-safety news must return confidence 0.0');
    });

    await test('T3.4: Classifies all 11 primary safety categories accurately', () => {
      const categorySamples: Record<ReportCategory, string> = {
        THEFT: 'মিরপুরে ফ্ল্যাটের তালা ভেঙে স্বর্ণালঙ্কার ও নগদ টাকা চুরি',
        ROBBERY: 'উত্তরায় মধ্যরাতে সিন্দুক ভেঙে সশস্ত্র ডাকাত দল লুটপাট চালায়',
        THEFT_ROBBERY: 'ধানমন্ডিতে বাড়িতে চুরি ও ডাকাতির ঘটনায় মামলা',
        SNATCHING: 'ফার্মগেটে পথচারীর ব্যাগ টান দিয়ে ছিনতাইকারী চক্র উধাও',
        ARMED_ASSAULT: 'মোহাম্মদপুরে দুর্বৃত্তদের ছুরিকাঘাতে যুবক গুরুতর জখম ও রক্তাক্ত',
        SNATCHING_ARMED_ASSAULT: 'যাত্রাবাড়ীতে ছিনতাইকালে বাধা দেওয়ায় ছুরিকাঘাতে পথচারীকে কুপিয়ে জখম',
        EXTORTION: 'টঙ্গীতে ব্যবসায়ীর কাছে চাঁদা দাবি ও চাঁদাবাজির হুমকি',
        YOUTH_GANG_ACTIVITY: 'মিরপুর ১০ নম্বরে কিশোর গ্যাংয়ের দুই গ্রুপের মধ্যে মহড়া ও ধাওয়া',
        DRUG_RELATED_CRIME: 'টেকনাফে বিপুল পরিমাণ ইয়াবা ও মাদক কারবারি আটক',
        UNLIT_ROAD: 'কেরানীগঞ্জে ভাঙা রাস্তায় সড়ক বাতি নেই রাতে চলাচলে চরম ঝুঁকি',
        ROAD_ACCIDENT: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
        MUGGING: 'ছিনতাই',
        DACOITY: 'ডাকাতি',
        THEFT_DACOITY: 'চুরি ডাকাতি',
        TEEN_GANG: 'কিশোর গ্যাং',
        TEEN_GANG_ARMED_ASSAULT: 'কিশোর গ্যাং অস্ত্র',
        DRUG_ACTIVITY: 'মাদক কারবারি',
      };

      const primary11: ReportCategory[] = [
        'THEFT',
        'ROBBERY',
        'THEFT_ROBBERY',
        'SNATCHING',
        'ARMED_ASSAULT',
        'SNATCHING_ARMED_ASSAULT',
        'EXTORTION',
        'YOUTH_GANG_ACTIVITY',
        'DRUG_RELATED_CRIME',
        'UNLIT_ROAD',
        'ROAD_ACCIDENT',
      ];

      for (const cat of primary11) {
        const text = categorySamples[cat];
        const res = classifyNewsText(text);
        assert.strictEqual(res.isSafetyRelated, true);
        assert.strictEqual(res.category, cat, `Expected ${cat}, got ${res.category}`);
      }
    });

    // ------------------------------------------------------------------------
    // SECTION 4: Multi-Source Incident Consolidation & Citations (Feature 8)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Multi-Source Incident Consolidation & Citations ---');

    const testAdminEmail = `admin-m2-test-${Date.now()}@safety.bd`;
    const passwordHash = await bcrypt.hash('TestAdminPass123!', 10);
    const adminUser = await prisma.user.create({
      data: {
        email: testAdminEmail,
        passwordHash,
        anonymousId: `admin-anon-${Date.now()}`,
        role: 'ADMIN',
        isVerified: true,
        trustScore: 100,
      },
    });

    const citizenUser = await prisma.user.create({
      data: {
        email: `citizen-m2-test-${Date.now()}@safety.bd`,
        passwordHash,
        anonymousId: `citizen-anon-${Date.now()}`,
        role: 'USER',
        isVerified: true,
      },
    });

    await test('T4.1: Database schema permits multiple NewsArticle records linked to one Report without unique violation', async () => {
      const report = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'ROAD_ACCIDENT',
          severity: 'HIGH',
          latitude: 22.6200,
          longitude: 91.6600,
          description: 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষ',
          status: 'ACTIVE',
          verificationStage: 'CLASSIFIED',
          citations: [
            {
              sourceName: 'The Daily Star',
              sourceUrl: 'https://thedailystar.net/sitakunda-accident-1',
              title: 'Collision in Sitakunda',
            },
          ],
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      // Article 1
      const a1 = await prisma.newsArticle.create({
        data: {
          guid: `guid-test-1-${Date.now()}`,
          title: '3 killed in Sitakunda bus crash - The Daily Star',
          sourceUrl: 'https://thedailystar.net/sitakunda-accident-1',
          sourceName: 'The Daily Star',
          publishedAt: new Date(),
          category: 'ROAD_ACCIDENT',
          severity: 'HIGH',
          latitude: 22.6200,
          longitude: 91.6600,
          reportId: report.id,
        },
      });

      // Article 2 linked to SAME report (validates schema 1-to-many relationship)
      const a2 = await prisma.newsArticle.create({
        data: {
          guid: `guid-test-2-${Date.now()}`,
          title: 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে নিহত ৩ - প্রথম আলো',
          sourceUrl: 'https://prothomalo.com/sitakunda-accident-2',
          sourceName: 'Prothom Alo',
          publishedAt: new Date(),
          category: 'ROAD_ACCIDENT',
          severity: 'HIGH',
          latitude: 22.6210,
          longitude: 91.6605,
          reportId: report.id,
        },
      });

      assert.strictEqual(a1.reportId, report.id);
      assert.strictEqual(a2.reportId, report.id);

      const fetchedReport = await prisma.report.findUnique({
        where: { id: report.id },
        include: { newsArticles: true },
      });

      assert.strictEqual(fetchedReport?.newsArticles.length, 2, 'Report must have 2 linked NewsArticle records');
    });

    await test('T4.2: Structured citations array preserves multiple outlets with titles and sourceUrls', async () => {
      const citations = [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/sitakunda-1',
          title: 'Bus crash in Sitakunda',
        },
        {
          sourceName: 'Prothom Alo',
          sourceUrl: 'https://prothomalo.com/sitakunda-2',
          title: 'সীতাকুণ্ডে বাস দুর্ঘটনা',
        },
        {
          sourceName: 'Dhaka Post',
          sourceUrl: 'https://dhakapost.com/sitakunda-3',
          title: 'সীতাকুণ্ডে মহাসড়কে দুর্ঘটনা',
        },
      ];

      const report = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'ROAD_ACCIDENT',
          severity: 'HIGH',
          latitude: 22.6200,
          longitude: 91.6600,
          status: 'ACTIVE',
          verificationStage: 'CORROBORATED',
          citations,
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      const retrieved = await prisma.report.findUnique({ where: { id: report.id } });
      const parsedCitations = retrieved?.citations as any[];
      assert.strictEqual(parsedCitations.length, 3);
      assert.strictEqual(parsedCitations[0].sourceName, 'The Daily Star');
      assert.strictEqual(parsedCitations[1].sourceName, 'Prothom Alo');
      assert.strictEqual(parsedCitations[2].sourceName, 'Dhaka Post');
    });

    // ------------------------------------------------------------------------
    // SECTION 5: Dual-Status Moderation Lifecycle & Admin API Endpoints (Feature 10)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Dual-Status Moderation Lifecycle & Admin Endpoints ---');

    await test('T5.1: verifyReport promotes stage to ADMIN_VERIFIED and logs VERIFY_INCIDENT', async () => {
      const report = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'SNATCHING',
          severity: 'MEDIUM',
          latitude: 23.7500,
          longitude: 90.3800,
          status: 'ACTIVE',
          verificationStage: 'CLASSIFIED',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      const result = await verifyReport(adminUser.id, report.id, 'Verified via CCTV confirmation');
      assert.strictEqual(result.report.verificationStage, 'ADMIN_VERIFIED');
      assert.strictEqual(result.report.status, 'ACTIVE', 'Report status must remain ACTIVE');
      assert.strictEqual(result.log.action, 'VERIFY_INCIDENT');
      assert.strictEqual(result.log.targetReportId, report.id);
      assert.strictEqual(result.log.adminId, adminUser.id);
    });

    await test('T5.2: reclassifyReport updates category and severity with RECLASSIFY_REPORT log', async () => {
      const report = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'ARMED_ASSAULT',
          severity: 'LOW',
          latitude: 23.7500,
          longitude: 90.3800,
          status: 'ACTIVE',
          verificationStage: 'CLASSIFIED',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      const result = await reclassifyReport(adminUser.id, report.id, {
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        reason: 'Misclassified political clash was actually vehicular accident',
      });

      assert.strictEqual(result.report.category, 'ROAD_ACCIDENT');
      assert.strictEqual(result.report.severity, 'HIGH');
      assert.strictEqual(result.log.action, 'RECLASSIFY_REPORT');
      assert.strictEqual(result.log.targetReportId, report.id);
    });

    await test('T5.3: Verification and reclassification are strictly rejected on PURGED reports', async () => {
      const purged = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'THEFT',
          severity: 'LOW',
          latitude: 23.8100,
          longitude: 90.4100,
          status: 'PURGED',
          verificationStage: 'CLASSIFIED',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      await assert.rejects(
        async () => {
          await verifyReport(adminUser.id, purged.id);
        },
        /Cannot verify a purged report/,
        'Must reject verifying a purged report'
      );

      await assert.rejects(
        async () => {
          await reclassifyReport(adminUser.id, purged.id, { category: 'ROBBERY' });
        },
        /Cannot reclassify a purged report/,
        'Must reject reclassifying a purged report'
      );
    });

    await test('T5.4: HTTP PATCH /api/v1/admin/reports/:id/verify verifies report over REST API', async () => {
      // 1. Login as admin to get auth cookie
      const loginRes = await request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testAdminEmail, password: 'TestAdminPass123!' }),
      });
      assert.strictEqual(loginRes.status, 200);
      const cookie = loginRes.cookies;

      // 2. Create target report
      const rep = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'ROBBERY',
          severity: 'HIGH',
          latitude: 23.8700,
          longitude: 90.3900,
          status: 'ACTIVE',
          verificationStage: 'CORROBORATED',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      // 3. Call PATCH endpoint
      const patchRes = await request(`/api/v1/admin/reports/${rep.id}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({ reason: 'Admin physically verified location and incident' }),
      });

      assert.strictEqual(patchRes.status, 200);
      assert.strictEqual(patchRes.data?.success, true);
      assert.strictEqual(patchRes.data?.data?.report?.verificationStage, 'ADMIN_VERIFIED');
      assert.strictEqual(patchRes.data?.data?.log?.action, 'VERIFY_INCIDENT');
    });

    await test('T5.5: HTTP PATCH /api/v1/admin/reports/:id/reclassify updates category over REST API', async () => {
      const loginRes = await request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testAdminEmail, password: 'TestAdminPass123!' }),
      });
      const cookie = loginRes.cookies;

      const rep = await prisma.report.create({
        data: {
          userId: adminUser.id,
          category: 'THEFT',
          severity: 'LOW',
          latitude: 23.8700,
          longitude: 90.3900,
          status: 'ACTIVE',
          verificationStage: 'CLASSIFIED',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      const patchRes = await request(`/api/v1/admin/reports/${rep.id}/reclassify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          category: 'THEFT_ROBBERY',
          severity: 'MEDIUM',
          reason: 'Both theft and armed entry occurred',
        }),
      });

      assert.strictEqual(patchRes.status, 200);
      assert.strictEqual(patchRes.data?.success, true);
      assert.strictEqual(patchRes.data?.data?.report?.category, 'THEFT_ROBBERY');
      assert.strictEqual(patchRes.data?.data?.report?.severity, 'MEDIUM');
      assert.strictEqual(patchRes.data?.data?.log?.action, 'RECLASSIFY_REPORT');
    });

    // Cleanup test records
    await prisma.moderationLog.deleteMany({
      where: { adminId: adminUser.id },
    }).catch(() => null);
    await prisma.report.deleteMany({
      where: { userId: adminUser.id },
    }).catch(() => null);
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, citizenUser.id] } },
    }).catch(() => null);

    console.log('\n===============================================================');
    console.log(`  Milestone 2 Suite Passed: ${passedTests}/${totalTests} tests cleanly!`);
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runMilestone2Suite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
