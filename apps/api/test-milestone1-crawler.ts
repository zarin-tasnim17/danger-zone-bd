import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { app } from './src/app';
import { initSocketServer } from './src/sockets';
import { prisma } from './src/db/prisma';
import { ReportCategory } from '@prisma/client';
import {
  DEDICATED_CATEGORY_FEEDS,
  PUBLIC_NEWS_FEEDS,
  crawlAllNewsFeeds,
  FeedConfig,
} from './src/services/newsCrawlerService';
import {
  newsObservabilityService,
} from './src/services/newsObservabilityService';
import {
  DEFAULT_CRAWLER_SCHEDULE,
  triggerNewsCrawler,
  isCrawlerBusy,
  resetCrawlerMutex,
  setCustomCrawlerFeeds,
} from './src/jobs/newsCrawlerJob';

const TEST_PORT = 5123;
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

async function runMilestone1Suite() {
  console.log('🚀 [Milestone 1 Suite] Starting Comprehensive Ingestion, Security & Observability Tests...\n');

  // Start API test server
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Test server running on ${SERVER_URL}`);

  const testArticleGuids = ['mock-snatching-guid-001', 'mock-theft-guid-001'];
  const testUserIds: string[] = [];
  const testReportIds: string[] = [];

  // Pre-clean any prior mock test records
  await prisma.report.deleteMany({
    where: { sourceName: { contains: 'Mock Feed' } },
  }).catch(() => null);
  await prisma.newsArticle.deleteMany({
    where: {
      OR: [
        { guid: { in: testArticleGuids } },
        { sourceName: { contains: 'Mock Feed' } },
      ],
    },
  }).catch(() => null);

  // Start Mock RSS server for isolated network testing
  const MOCK_RSS_PORT = 5124;
  const mockRssServer = http.createServer((req, res) => {
    if (req.url === '/rss/valid-snatching') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock News Snatching</title>
    <link>http://127.0.0.1:${MOCK_RSS_PORT}</link>
    <description>Public safety reports</description>
    <item>
      <title>মিরপুরে অস্ত্র ঠেকিয়ে পথচারীর মোবাইল ও টাকা ছিনতাই</title>
      <link>http://127.0.0.1:${MOCK_RSS_PORT}/article-snatching-1</link>
      <guid>mock-snatching-guid-001</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>মিরপুর ১০ নম্বরে ছিনতাইয়ের ঘটনা ঘটে</description>
    </item>
  </channel>
</rss>`);
    } else if (req.url === '/rss/failing-feed') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error from upstream publisher');
    } else if (req.url === '/rss/valid-theft') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock News Theft</title>
    <link>http://127.0.0.1:${MOCK_RSS_PORT}</link>
    <description>Public safety reports</description>
    <item>
      <title>ধানমন্ডিতে গভীর রাতে দোকানে ঢুকে মালামাল ও নগদ টাকা চুরি</title>
      <link>http://127.0.0.1:${MOCK_RSS_PORT}/article-theft-1</link>
      <guid>mock-theft-guid-001</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>ধানমন্ডি ২৭ নম্বরে নগদ টাকা চুরি হয়েছে</description>
    </item>
  </channel>
</rss>`);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => mockRssServer.listen(MOCK_RSS_PORT, '127.0.0.1', () => resolve()));
  console.log(`✅ Mock RSS server running on http://127.0.0.1:${MOCK_RSS_PORT}`);

  const previousCronSecret = process.env.CRON_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    // -----------------------------------------------------------------
    // TEST 1: 11 Dedicated Category-Specific RSS Feeds Registry
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 1] Verifying 11 Dedicated Category Feeds Registry Structure & Mapping...');

    const expected11Categories: ReportCategory[] = [
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

    if (DEDICATED_CATEGORY_FEEDS.length !== 11) {
      throw new Error(`Expected exactly 11 dedicated category feeds, got ${DEDICATED_CATEGORY_FEEDS.length}`);
    }

    const registeredCategories = DEDICATED_CATEGORY_FEEDS.map((f) => f.category);
    for (const cat of expected11Categories) {
      if (!registeredCategories.includes(cat)) {
        throw new Error(`Missing expected category in feed registry: ${cat}`);
      }
    }

    for (const feed of DEDICATED_CATEGORY_FEEDS) {
      if (!feed.name || feed.name.trim().length === 0) {
        throw new Error(`Feed has invalid or empty name: ${JSON.stringify(feed)}`);
      }
      if (!feed.url || !feed.url.startsWith('https://news.google.com/rss/search?q=')) {
        throw new Error(`Feed ${feed.name} has invalid Google News RSS URL: ${feed.url}`);
      }
      // Check proper URL encoding: no raw spaces
      if (feed.url.includes(' ')) {
        throw new Error(`Feed ${feed.name} URL contains unencoded raw space character: ${feed.url}`);
      }
      // Check query parameter is encoded
      const urlObj = new URL(feed.url);
      const qParam = urlObj.searchParams.get('q');
      if (!qParam || qParam.trim().length === 0) {
        throw new Error(`Feed ${feed.name} has empty query parameter: ${feed.url}`);
      }
      // Check categoryHint matches category
      if (feed.categoryHint !== feed.category) {
        throw new Error(`Feed ${feed.name} categoryHint (${feed.categoryHint}) does not match category (${feed.category})`);
      }
      // Check timeout is specified
      if (!feed.timeoutMs || feed.timeoutMs < 1000) {
        throw new Error(`Feed ${feed.name} must have reasonable timeoutMs (>= 1000ms), got ${feed.timeoutMs}`);
      }
    }

    // Verify PUBLIC_NEWS_FEEDS includes all 11 dedicated feeds
    if (PUBLIC_NEWS_FEEDS.length < 11) {
      throw new Error(`PUBLIC_NEWS_FEEDS should contain at least 11 feeds, got ${PUBLIC_NEWS_FEEDS.length}`);
    }

    console.log('  ✅ Centralized feed registry contains all 11 dedicated categories');
    console.log('  ✅ All feed URLs are properly URL-encoded with valid Google News search parameters');
    console.log('  ✅ All feeds have categoryHint and explicit per-feed timeouts');

    // -----------------------------------------------------------------
    // TEST 2: Per-Feed Independent Failure Isolation
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 2] Testing Independent Feed Error Handling (One feed failure must not abort loop)...');

    const testFeeds: FeedConfig[] = [
      {
        name: 'Mock Feed 1 (Valid Snatching)',
        category: 'SNATCHING',
        categoryHint: 'SNATCHING',
        url: `http://127.0.0.1:${MOCK_RSS_PORT}/rss/valid-snatching`,
        timeoutMs: 3000,
      },
      {
        name: 'Mock Feed 2 (Failing 500 Error)',
        category: 'ARMED_ASSAULT',
        categoryHint: 'ARMED_ASSAULT',
        url: `http://127.0.0.1:${MOCK_RSS_PORT}/rss/failing-feed`,
        timeoutMs: 3000,
      },
      {
        name: 'Mock Feed 3 (Valid Theft)',
        category: 'THEFT',
        categoryHint: 'THEFT',
        url: `http://127.0.0.1:${MOCK_RSS_PORT}/rss/valid-theft`,
        timeoutMs: 3000,
      },
    ];

    newsObservabilityService.resetMetricsForTesting();
    setCustomCrawlerFeeds(testFeeds);

    const crawlResult = await crawlAllNewsFeeds(testFeeds);

    if (crawlResult.feedsChecked !== 3) {
      throw new Error(`Expected all 3 feeds to be checked despite Feed 2 failing, got ${crawlResult.feedsChecked}`);
    }

    const telemetry = newsObservabilityService.getTelemetrySummary();
    const lastRun = telemetry.lastRun;
    if (!lastRun) {
      throw new Error('Expected telemetry lastRun to be populated');
    }

    if (lastRun.feedsSuccess !== 2 || lastRun.feedsFailed !== 1) {
      throw new Error(`Expected 2 successes and 1 failure in run metrics, got ${lastRun.feedsSuccess} / ${lastRun.feedsFailed}`);
    }

    if (lastRun.status !== 'PARTIAL') {
      throw new Error(`Expected run status to be PARTIAL when one feed fails, got ${lastRun.status}`);
    }

    console.log('  ✅ Failing feed was isolated cleanly without aborting remaining feeds');
    console.log('  ✅ Both Feed 1 and Feed 3 were successfully processed and ingested');
    console.log('  ✅ Telemetry accurately recorded 2 successes, 1 failure, and status: PARTIAL');

    // -----------------------------------------------------------------
    // TEST 3: Strict Bearer Authentication for Cron
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 3] Verifying Strict Bearer Authentication (Fail-closed, query param rejection, prod unset)...');

    const testCronSecret = `cron-auth-test-${crypto.randomBytes(8).toString('hex')}`;
    process.env.CRON_SECRET = testCronSecret;
    process.env.NODE_ENV = 'development';

    // 3a. Missing Authorization header
    const missingAuthRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });
    if (missingAuthRes.status !== 401) {
      throw new Error(`Expected 401 for missing Authorization header, got ${missingAuthRes.status}`);
    }

    // 3b. Bare Authorization header (without Bearer prefix)
    const bareAuthRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.21',
        Authorization: testCronSecret,
      },
    });
    if (bareAuthRes.status !== 401) {
      throw new Error(`Expected 401 for bare Authorization header without Bearer, got ${bareAuthRes.status}`);
    }

    // 3c. Invalid Bearer token
    const wrongBearerRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.22',
        Authorization: 'Bearer invalid-token-12345',
      },
    });
    if (wrongBearerRes.status !== 401) {
      throw new Error(`Expected 401 for invalid Bearer token, got ${wrongBearerRes.status}`);
    }

    // 3d. Query parameter token rejection (?key=..., ?secret=..., ?cron_secret=...)
    const queryParamKeyRes = await request(`/api/v1/cron/news-crawl?key=${testCronSecret}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.23' },
    });
    if (queryParamKeyRes.status !== 401) {
      throw new Error(`Expected 401 for ?key= query parameter token, got ${queryParamKeyRes.status}`);
    }

    const queryParamSecretRes = await request(`/api/v1/cron/news-crawl?secret=${testCronSecret}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.24' },
    });
    if (queryParamSecretRes.status !== 401) {
      throw new Error(`Expected 401 for ?secret= query parameter token, got ${queryParamSecretRes.status}`);
    }

    const queryParamCronSecretRes = await request(`/api/v1/cron/news-crawl?cron_secret=${testCronSecret}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.25' },
    });
    if (queryParamCronSecretRes.status !== 401) {
      throw new Error(`Expected 401 for ?cron_secret= query parameter token, got ${queryParamCronSecretRes.status}`);
    }

    // 3e. Production fail-closed when CRON_SECRET is unset or empty (do not fallback to default)
    process.env.NODE_ENV = 'production';
    delete process.env.CRON_SECRET;

    const prodUnsetRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.26',
        Authorization: 'Bearer danger-zone-bd-cron-crawler-secret-2026',
      },
    });
    if (prodUnsetRes.status !== 401) {
      throw new Error(`Expected 401 in production when CRON_SECRET is unset, got ${prodUnsetRes.status}`);
    }

    process.env.CRON_SECRET = '   ';
    const prodEmptyRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.27',
        Authorization: 'Bearer danger-zone-bd-cron-crawler-secret-2026',
      },
    });
    if (prodEmptyRes.status !== 401) {
      throw new Error(`Expected 401 in production when CRON_SECRET is empty string, got ${prodEmptyRes.status}`);
    }

    // 3f. Valid Bearer token authentication
    process.env.NODE_ENV = 'development';
    process.env.CRON_SECRET = testCronSecret;

    const validBearerRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.28',
        Authorization: `Bearer ${testCronSecret}`,
      },
    });
    if (validBearerRes.status !== 200) {
      throw new Error(`Expected 200 for valid Bearer token, got ${validBearerRes.status}`);
    }

    console.log('  ✅ Rejects missing, bare, and invalid Bearer tokens with 401 Unauthorized');
    console.log('  ✅ Rejects query parameter tokens (?key, ?secret, ?cron_secret) with 401 Unauthorized');
    console.log('  ✅ Fails closed in production (401) when CRON_SECRET is unset or empty without falling back');
    console.log('  ✅ Successfully authenticates valid Authorization: Bearer <CRON_SECRET> header (200)');

    // -----------------------------------------------------------------
    // TEST 4: Concurrency Protection (isCrawling Mutex Lock)
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 4] Testing Crawler Concurrency Protection (isCrawling Mutex Lock)...');

    resetCrawlerMutex();
    if (isCrawlerBusy()) {
      throw new Error('Expected crawler mutex to be false initially');
    }

    // Simulate mutex lock in progress
    // Manually trigger simultaneous calls
    const p1 = triggerNewsCrawler();
    const p2 = triggerNewsCrawler();

    const [r1, r2] = await Promise.all([p1, p2]);

    const statuses = [r1.status, r2.status];
    if (!statuses.includes('in_progress')) {
      throw new Error(`Expected one overlapping crawl to return status 'in_progress', got ${JSON.stringify(statuses)}`);
    }

    console.log(`  ✅ Overlapping crawler execution prevented: one ran (${r1.status}), the duplicate was rejected (${r2.status})`);

    // -----------------------------------------------------------------
    // TEST 5: 10-Minute Crawler Schedule & Rate Limiting Headroom
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 5] Testing Default Schedule Expression & Rate Limiting Headroom...');

    if (DEFAULT_CRAWLER_SCHEDULE !== '*/10 * * * *') {
      throw new Error(`Expected DEFAULT_CRAWLER_SCHEDULE to be '*/10 * * * *', got '${DEFAULT_CRAWLER_SCHEDULE}'`);
    }
    console.log(`  ✅ Verified default cron schedule is every 10 minutes: "${DEFAULT_CRAWLER_SCHEDULE}"`);

    // Rate limiting: Send 6 requests from same IP -> all 6 must succeed (200)
    // 7th request must be throttled with 429
    const rateLimitIp = '198.51.100.50';

    for (let i = 1; i <= 6; i++) {
      const res = await request('/api/v1/cron/news-crawl', {
        method: 'POST',
        headers: {
          'x-forwarded-for': rateLimitIp,
          Authorization: `Bearer ${testCronSecret}`,
        },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200 for request ${i} within 6-req operational headroom, got ${res.status}`);
      }
    }

    const throttledRes = await request('/api/v1/cron/news-crawl', {
      method: 'POST',
      headers: {
        'x-forwarded-for': rateLimitIp,
        Authorization: `Bearer ${testCronSecret}`,
      },
    });
    if (throttledRes.status !== 429 || throttledRes.data?.error?.code !== 'RATE_LIMIT_EXCEEDED') {
      throw new Error(`Expected 429 RATE_LIMIT_EXCEEDED on 7th request, got status=${throttledRes.status}`);
    }

    console.log('  ✅ Rate limiter provides headroom: allows 6 requests / 10 min without throttling');
    console.log('  ✅ Rate limiter correctly throttles 7th request with 429 RATE_LIMIT_EXCEEDED');

    // -----------------------------------------------------------------
    // TEST 6: Observability Telemetry Store & Endpoints
    // -----------------------------------------------------------------
    console.log('\n🧪 [Test 6] Testing Observability Metrics Store & Admin/Cron Telemetry Endpoints...');

    // 6a. Service API
    const finalTelemetry = newsObservabilityService.getTelemetrySummary();
    if (finalTelemetry.totalRuns < 1) {
      throw new Error(`Expected totalRuns >= 1, got ${finalTelemetry.totalRuns}`);
    }
    if (typeof finalTelemetry.overallGeocodingSuccessRate !== 'number') {
      throw new Error('Expected overallGeocodingSuccessRate to be a number');
    }
    if (!finalTelemetry.feedHealth || typeof finalTelemetry.feedHealth !== 'object') {
      throw new Error('Expected feedHealth summary object in telemetry');
    }
    console.log(`  ✅ Telemetry store contains: ${finalTelemetry.totalRuns} runs, ${finalTelemetry.totalArticlesDiscovered} discovered articles, geocoding success rate: ${finalTelemetry.overallGeocodingSuccessRate}%`);

    // 6b. GET /api/v1/cron/crawler-metrics endpoint (protected by cron secret)
    const unauthMetricsRes = await request('/api/v1/cron/crawler-metrics', {
      method: 'GET',
    });
    if (unauthMetricsRes.status !== 401) {
      throw new Error(`Expected 401 for unauthorized cron crawler-metrics, got ${unauthMetricsRes.status}`);
    }

    const cronMetricsRes = await request('/api/v1/cron/crawler-metrics', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${testCronSecret}`,
      },
    });
    if (cronMetricsRes.status !== 200 || !cronMetricsRes.data?.data?.feedHealth) {
      throw new Error(`Expected 200 with telemetry data for cron crawler-metrics, got ${cronMetricsRes.status}`);
    }
    console.log('  ✅ GET /api/v1/cron/crawler-metrics enforces Bearer auth and returns crawler telemetry');

    // 6c. GET /api/v1/admin/crawler-metrics endpoint (protected by Admin RBAC)
    // Create admin user for testing
    const adminPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-milestone1-${Date.now()}@safety.bd`,
        anonymousId: `admin-anon-${Date.now()}`,
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
      },
    });
    testUserIds.push(adminUser.id);

    const loginRes = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: adminPassword }),
    });
    const adminCookie = extractCookie(loginRes.cookies, 'accessToken');

    // Non-admin request rejected
    const unauthAdminRes = await request('/api/v1/admin/crawler-metrics', {
      method: 'GET',
    });
    if (unauthAdminRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated admin crawler-metrics, got ${unauthAdminRes.status}`);
    }

    const adminMetricsRes = await request('/api/v1/admin/crawler-metrics', {
      method: 'GET',
      headers: {
        Cookie: `accessToken=${adminCookie}`,
      },
    });
    if (adminMetricsRes.status !== 200 || !adminMetricsRes.data?.data?.recentRuns) {
      throw new Error(`Expected 200 with recentRuns for admin crawler-metrics, got ${adminMetricsRes.status}`);
    }
    console.log('  ✅ GET /api/v1/admin/crawler-metrics enforces Admin RBAC and returns recent crawl runs and telemetry');

    console.log('\n🎉 ALL MILESTONE 1 AUTOMATED TESTS PASSED CLEANLY (Zero Failures)!');
  } finally {
    // Teardown
    console.log('\n🧹 Cleaning up test fixtures...');
    setCustomCrawlerFeeds(null);
    resetCrawlerMutex();
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    try {
      await prisma.report.deleteMany({
        where: {
          OR: [
            { sourceName: { contains: 'Mock Feed' } },
            { id: { in: testReportIds } },
          ],
        },
      });
      if (testArticleGuids.length > 0) {
        await prisma.newsArticle.deleteMany({
          where: {
            OR: [
              { guid: { in: testArticleGuids } },
              { sourceName: { contains: 'Mock Feed' } },
            ],
          },
        });
      }
      if (testUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }
    } catch (e: any) {
      console.warn('Cleanup warning:', e.message);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => mockRssServer.close(() => resolve()));
    console.log('✅ Servers stopped cleanly.');
  }
}

runMilestone1Suite().catch((err) => {
  console.error('\n❌ Milestone 1 Test Suite Failed:', err);
  process.exit(1);
});
