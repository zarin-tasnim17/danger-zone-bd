import http from 'http';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { classifyNewsText } from './src/services/newsClassifierService';
import { resolveLocationFromText, isWithinBangladeshBounds } from './src/services/geocodingService';
import { processAndIngestNewsItems } from './src/services/newsCrawlerService';

const TEST_PORT = 5122;
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

async function runNewsCrawlerVerificationSuite() {
  console.log('🚀 [News Crawler Suite] Starting 100% Free RSS & Verification Engine Verification...\n');

  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Test server running on ${SERVER_URL}`);

  const testUserIds: string[] = [];
  const testReportIds: string[] = [];
  const testArticleGuids: string[] = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Bilingual Keyword Classification (Bangla + English)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 1] Testing Bilingual Keyword Classifier (Bangla + English)...');

    const muggingBn = classifyNewsText('মিরপুরে অস্ত্র ঠেকিয়ে পথচারীর মোবাইল ও টাকা ছিনতাই', '');
    if (muggingBn.isSafetyRelated && muggingBn.category === 'MUGGING' && muggingBn.severity === 'HIGH') {
      console.log('  ✅ Bangla mugging text classified as MUGGING (HIGH severity)');
    } else {
      throw new Error(`Bangla mugging classification failed: ${JSON.stringify(muggingBn)}`);
    }

    const extortionBn = classifyNewsText('ব্যবসায়ীর কাছে চাঁদা না পেয়ে অস্ত্রের মুখে হুমকি, এলাকায় চাঁদাবাজি আতঙ্ক', '');
    if (extortionBn.isSafetyRelated && extortionBn.category === 'EXTORTION' && extortionBn.severity === 'HIGH') {
      console.log('  ✅ Bangla armed extortion text classified as EXTORTION (HIGH severity)');
    } else {
      throw new Error(`Bangla extortion classification failed: ${JSON.stringify(extortionBn)}`);
    }

    const theftBn = classifyNewsText('মধ্যরাতে দোকানে ঢুকে মালামাল চুরি করে পালাল চোর', '');
    if (theftBn.isSafetyRelated && theftBn.category === 'THEFT' && theftBn.severity === 'MEDIUM') {
      console.log('  ✅ Bangla theft text classified as THEFT (MEDIUM severity)');
    } else {
      throw new Error(`Bangla theft classification failed: ${JSON.stringify(theftBn)}`);
    }

    const unlitBn = classifyNewsText('গলিতে বাতি নেই, অন্ধকার রাস্তায় চরম ভোগান্তি', '');
    if (unlitBn.isSafetyRelated && unlitBn.category === 'UNLIT_ROAD' && unlitBn.severity === 'LOW') {
      console.log('  ✅ Bangla unlit road classified as UNLIT_ROAD (LOW severity)');
    } else {
      throw new Error(`Bangla unlit road classification failed: ${JSON.stringify(unlitBn)}`);
    }

    const drugEn = classifyNewsText('Police arrest drug syndicate with 50,000 yaba pills and narcotics in Chittagong', '');
    if (drugEn.isSafetyRelated && drugEn.category === 'DRUG_ACTIVITY' && drugEn.severity === 'MEDIUM') {
      console.log('  ✅ English narcotics text classified as DRUG_ACTIVITY (MEDIUM severity)');
    } else {
      throw new Error(`English drug classification failed: ${JSON.stringify(drugEn)}`);
    }

    const irrelevant = classifyNewsText('Bangladesh cricket team wins thrilling test match in Mirpur', 'Historic victory');
    if (!irrelevant.isSafetyRelated) {
      console.log('  ✅ Non-crime / sports news correctly filtered out (isSafetyRelated: false)');
    } else {
      throw new Error(`Irrelevant news was falsely classified: ${JSON.stringify(irrelevant)}`);
    }

    // -------------------------------------------------------------
    // Test 2: Geocoding & Bangladesh Landmark Resolution
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 2] Testing Geocoding & Bangladesh Landmark Resolution...');

    const dhanmondiLoc = await resolveLocationFromText('রাজধানীর ধানমন্ডি ২৭ নম্বরে ছিনতাইয়ের শিকার ব্যবসায়ী');
    if (dhanmondiLoc && Math.abs(dhanmondiLoc.latitude - 23.7465) < 0.05 && Math.abs(dhanmondiLoc.longitude - 90.376) < 0.05) {
      console.log(`  ✅ Successfully resolved Dhanmondi landmark coordinates (${dhanmondiLoc.latitude}, ${dhanmondiLoc.longitude})`);
    } else {
      throw new Error(`Failed to resolve Dhanmondi landmark: ${JSON.stringify(dhanmondiLoc)}`);
    }

    const ctgLoc = await resolveLocationFromText('Chittagong port police detained suspect in robbery');
    if (ctgLoc && Math.abs(ctgLoc.latitude - 22.3569) < 0.05) {
      console.log(`  ✅ Successfully resolved Chittagong district coordinates (${ctgLoc.latitude}, ${ctgLoc.longitude})`);
    } else {
      throw new Error(`Failed to resolve Chittagong: ${JSON.stringify(ctgLoc)}`);
    }

    // Bounds checking
    if (isWithinBangladeshBounds(23.8103, 90.4125) && !isWithinBangladeshBounds(40.7128, -74.006)) {
      console.log('  ✅ Bounding box validation strictly restricts coordinates to Bangladesh territory');
    } else {
      throw new Error('Bounding box check failed');
    }

    // -------------------------------------------------------------
    // Test 3: Deduplication Pipeline Against NewsArticle.guid
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 3] Testing News Ingestion & Deduplication Pipeline...');

    const testGuid = `test-article-guid-${Date.now()}`;
    testArticleGuids.push(testGuid);

    const mockNewsItem = {
      guid: testGuid,
      title: 'মিরপুর ১০ নম্বরে অস্ত্রের মুখে যুবকের মোবাইল ছিনতাই',
      link: `https://test-news.bd/articles/${testGuid}`,
      pubDate: new Date(),
      contentSnippet: 'মিরপুরে গতকাল রাতে ঘটনাটি ঘটে',
      sourceName: 'Daily Safety BD',
    };

    // First ingestion run: should ingest 1 item
    const firstRun = await processAndIngestNewsItems([mockNewsItem]);
    if (firstRun.ingested === 1 && firstRun.skipped === 0) {
      console.log('  ✅ First ingestion run successfully ingested 1 incident report and 1 news article');
    } else {
      throw new Error(`First ingestion failed: ${JSON.stringify(firstRun)}`);
    }

    // Second ingestion run with same GUID: should skip duplicate
    const secondRun = await processAndIngestNewsItems([mockNewsItem]);
    if (secondRun.ingested === 0 && secondRun.skipped === 1) {
      console.log('  ✅ Duplicate ingestion run with identical GUID skipped cleanly without duplicate reports');
    } else {
      throw new Error(`Deduplication check failed: ${JSON.stringify(secondRun)}`);
    }

    // Verify NewsArticle and Report in DB
    const savedArticle = await prisma.newsArticle.findUnique({
      where: { guid: testGuid },
      include: { report: true },
    });
    if (savedArticle && savedArticle.report && savedArticle.report.sourceName === 'Daily Safety BD') {
      console.log(`  ✅ Database record verified: NewsArticle ${savedArticle.id} linked to Report ${savedArticle.reportId}`);
      testReportIds.push(savedArticle.reportId!);
    } else {
      throw new Error(`Saved article verification failed: ${JSON.stringify(savedArticle)}`);
    }

    // -------------------------------------------------------------
    // Test 4: Spatial Cross-Verification ("Trust Booster" +5 score)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 4] Testing Spatial Cross-Verification & Trust Booster (+5 reputation points)...');

    // Create a citizen user with baseline trust score = 10
    const citizenUser = await prisma.user.create({
      data: {
        anonymousId: `citizen-reporter-${Date.now()}`,
        email: `citizen-${Date.now()}@test.safety`,
        trustScore: 10,
        role: 'USER',
      },
    });
    testUserIds.push(citizenUser.id);

    // Citizen creates an unverified report at Dhanmondi (23.7465, 90.3760)
    const citizenReport = await prisma.report.create({
      data: {
        userId: citizenUser.id,
        category: 'MUGGING',
        severity: 'HIGH',
        latitude: 23.7465,
        longitude: 90.376,
        description: 'Just witnessed a mugging near Dhanmondi lake',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    testReportIds.push(citizenReport.id);

    // Populate PostGIS location column
    await prisma.$executeRaw`
      UPDATE "Report"
      SET location = ST_SetSRID(ST_MakePoint(90.3760, 23.7465), 4326)::geography
      WHERE id = ${citizenReport.id}
    `;

    // Now ingest a press report within 500m (at Dhanmondi 23.7465, 90.3760)
    const pressGuid = `press-corroboration-${Date.now()}`;
    testArticleGuids.push(pressGuid);

    const pressItem = {
      guid: pressGuid,
      title: 'ধানমন্ডি লেকে প্রকাশ্যে অস্ত্রের মুখে ছিনতাই, মোবাইল ও টাকা লুট',
      link: `https://test-news.bd/articles/${pressGuid}`,
      pubDate: new Date(),
      contentSnippet: 'ধানমন্ডি এলাকায় ছিনতাই',
      sourceName: 'Prothom Alo Online',
    };

    const pressIngest = await processAndIngestNewsItems([pressItem]);
    if (pressIngest.ingested === 1 && pressIngest.verifiedMatches >= 1) {
      console.log(`  ✅ Press news ingestion matched and cross-verified ${pressIngest.verifiedMatches} citizen report(s)`);
    } else {
      throw new Error(`Cross verification failed: ${JSON.stringify(pressIngest)}`);
    }

    // Check citizen report description for press confirmation tag
    const updatedCitizenReport = await prisma.report.findUnique({
      where: { id: citizenReport.id },
    });
    if (updatedCitizenReport?.description?.includes('[Verified by Press: Prothom Alo Online]')) {
      console.log('  ✅ Citizen report description updated with "[Verified by Press: Prothom Alo Online]"');
    } else {
      throw new Error(`Citizen report description was not updated: ${updatedCitizenReport?.description}`);
    }

    // Check citizen user's trust score: should be incremented from 10 to 15 (+5 points)
    const updatedUser = await prisma.user.findUnique({
      where: { id: citizenUser.id },
    });
    if (updatedUser?.trustScore === 15) {
      console.log('  ✅ Citizen user trustScore incremented by +5 (from 10 to 15) as community reputation reward');
    } else {
      throw new Error(`User trustScore not incremented correctly: expected 15, got ${updatedUser?.trustScore}`);
    }

    // Ensure news report created also tracked in cleanup
    const pressArticle = await prisma.newsArticle.findUnique({
      where: { guid: pressGuid },
    });
    if (pressArticle?.reportId) {
      testReportIds.push(pressArticle.reportId);
    }

    // -------------------------------------------------------------
    // Test 5: Admin Manual Crawler Trigger Endpoint (/api/v1/admin/news/crawl)
    // -------------------------------------------------------------
    console.log('\n🧪 [Test 5] Testing Admin Manual Crawler Trigger Endpoint...');

    // 5a. Non-admin forbidden check
    const nonAdminAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: `standard-user-${Date.now()}` }),
    });
    const userCookie = extractCookie(nonAdminAuth.cookies, 'accessToken');

    const forbiddenRes = await request('/api/v1/admin/news/crawl', {
      method: 'POST',
      headers: { Cookie: `accessToken=${userCookie}` },
    });
    if (forbiddenRes.status === 403) {
      console.log('  ✅ Standard user request rejected with 403 Forbidden (RBAC enforced)');
    } else {
      throw new Error(`Expected 403 Forbidden for non-admin, got ${forbiddenRes.status}`);
    }

    // 5b. Admin authenticated crawl trigger
    const adminUser = await prisma.user.create({
      data: {
        anonymousId: `admin-crawler-${Date.now()}`,
        email: `admin-crawler-${Date.now()}@test.safety`,
        role: 'ADMIN',
      },
    });
    testUserIds.push(adminUser.id);

    const adminAuth = await request('/api/v1/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId: adminUser.anonymousId }),
    });
    const adminCookie = extractCookie(adminAuth.cookies, 'accessToken');

    const crawlRes = await request('/api/v1/admin/news/crawl', {
      method: 'POST',
      headers: { Cookie: `accessToken=${adminCookie}` },
    });

    if (crawlRes.status === 200 && crawlRes.data?.data?.status === 'success') {
      console.log(
        `  ✅ Admin successfully triggered manual crawl: ${crawlRes.data.data.feedsChecked} feeds checked, ${crawlRes.data.data.totalIngested} ingested, ${crawlRes.data.data.totalSkipped} skipped`
      );
    } else {
      throw new Error(`Admin crawl trigger failed: status=${crawlRes.status}, data=${JSON.stringify(crawlRes.data)}`);
    }

    console.log('\n🎉 ALL 5 TEST SUITES PASSED! 100% Free RSS News Crawler & Cross-Verification Engine is completely operational.');
  } finally {
    // Teardown test artifacts
    console.log('\n🧹 Cleaning up test records...');
    try {
      if (testArticleGuids.length > 0) {
        await prisma.newsArticle.deleteMany({
          where: { guid: { in: testArticleGuids } },
        });
      }
      if (testReportIds.length > 0) {
        await prisma.report.deleteMany({
          where: { id: { in: testReportIds } },
        });
      }
      if (testUserIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: testUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }
      console.log('✅ Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('⚠️ Teardown notice:', cleanupErr);
    }

    await prisma.$disconnect();
    server.close();
  }
}

runNewsCrawlerVerificationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ News crawler test failed:', err);
    process.exit(1);
  });
