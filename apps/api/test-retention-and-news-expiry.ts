import { calculateNewsReportExpiry, getNewsCategoryLifespanHours } from './src/services/newsCrawlerService';
import { hardDeleteStaleRetentionData } from './src/jobs/timeDecayJob';
import { prisma } from './src/db/prisma';

async function runTestSuite() {
  console.log('🚀 [Test] Starting News Expiry Lifecycles & 30-Day Rolling Retention Test Suite...\n');

  // =========================================================================
  // Part 1: Verify calculateNewsReportExpiry & getNewsCategoryLifespanHours
  // =========================================================================
  console.log('🧪 [Test 1] Testing category-specific lifespans and expiry calculations...');

  // 1a. Verify lifespan hours
  const expectedLifespans: Record<string, number> = {
    ROAD_ACCIDENT: 48,
    SNATCHING: 72,
    ROBBERY: 72,
    THEFT_ROBBERY: 72,
    ARMED_ASSAULT: 72,
    SNATCHING_ARMED_ASSAULT: 72,
    THEFT: 72,
    EXTORTION: 72,
    YOUTH_GANG_ACTIVITY: 168,
    DRUG_RELATED_CRIME: 168,
    UNLIT_ROAD: 336,
  };

  for (const [cat, expectedHours] of Object.entries(expectedLifespans)) {
    const hours = getNewsCategoryLifespanHours(cat as any);
    if (hours !== expectedHours) {
      throw new Error(`Category ${cat} expected ${expectedHours}h lifespan, got ${hours}h`);
    }
  }
  console.log('  ✅ All 11 incident category lifespan hours matched specifications.');

  // 1b. Verify future expiry calculation from published date
  const testNow = new Date('2026-11-08T12:00:00.000Z');
  const testPublishedFresh = new Date('2026-11-08T10:00:00.000Z'); // published 2 hours ago

  const roadAccidentExpiry = calculateNewsReportExpiry('ROAD_ACCIDENT' as any, testPublishedFresh, testNow);
  const expectedAccidentExpiry = new Date(testPublishedFresh.getTime() + 48 * 60 * 60 * 1000);
  if (roadAccidentExpiry.getTime() !== expectedAccidentExpiry.getTime()) {
    throw new Error(`Road accident expiry mismatch: expected ${expectedAccidentExpiry.toISOString()}, got ${roadAccidentExpiry.toISOString()}`);
  }

  const unlitRoadExpiry = calculateNewsReportExpiry('UNLIT_ROAD' as any, testPublishedFresh, testNow);
  const expectedUnlitExpiry = new Date(testPublishedFresh.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (unlitRoadExpiry.getTime() !== expectedUnlitExpiry.getTime()) {
    throw new Error(`Unlit road expiry mismatch: expected ${expectedUnlitExpiry.toISOString()}, got ${unlitRoadExpiry.toISOString()}`);
  }
  console.log('  ✅ Fresh article candidate expiry computed accurately.');

  // 1c. Verify minimum 24h grace window for older published news
  const oldPublished = new Date(testNow.getTime() - 47 * 60 * 60 * 1000); // published 47 hours ago
  const graceExpiry = calculateNewsReportExpiry('ROAD_ACCIDENT' as any, oldPublished, testNow);
  const minExpectedGrace = new Date(testNow.getTime() + 24 * 60 * 60 * 1000);
  if (graceExpiry.getTime() !== minExpectedGrace.getTime()) {
    throw new Error(`Grace window mismatch: expected ${minExpectedGrace.toISOString()}, got ${graceExpiry.toISOString()}`);
  }
  console.log('  ✅ Minimum 24-hour ingestion grace window applied successfully for delayed news.');

  // =========================================================================
  // Part 2: Verify hardDeleteStaleRetentionData (30-day cascading purge)
  // =========================================================================
  console.log('\n🧪 [Test 2] Testing hard-delete cascading retention cleanup in PostgreSQL...');

  // Setup test user
  let testUser = await prisma.user.findFirst({ where: { email: 'retention-test@safety.bd' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'retention-test@safety.bd',
        anonymousId: `retention-test-${Date.now()}`,
        role: 'USER',
      },
    });
  }

  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // Seed 1: Stale PURGED report (> 30 days old)
  const staleReport = await prisma.report.create({
    data: {
      userId: testUser.id,
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.81,
      longitude: 90.41,
      description: 'Stale test report older than 30 days',
      status: 'PURGED',
      expiresAt: fortyDaysAgo,
      createdAt: fortyDaysAgo,
    },
  });

  // Seed child relations for stale report to test cascade
  const vote = await prisma.vote.create({
    data: {
      userId: testUser.id,
      reportId: staleReport.id,
      voteType: 1,
    },
  });

  const update = await prisma.reportUpdate.create({
    data: {
      userId: testUser.id,
      reportId: staleReport.id,
      content: 'Police arrived at the scene',
    },
  });

  const media = await prisma.reportMedia.create({
    data: {
      reportId: staleReport.id,
      originalUrl: 'https://example.com/stale-img.jpg',
    },
  });

  const staleNewsGuid = `test-stale-news-${Date.now()}`;
  const staleNews = await prisma.newsArticle.create({
    data: {
      guid: staleNewsGuid,
      title: 'Stale News Event',
      sourceUrl: 'https://news.example.com/stale',
      sourceName: 'Daily Safety',
      publishedAt: fortyDaysAgo,
      category: 'THEFT',
      severity: 'LOW',
      latitude: 23.81,
      longitude: 90.41,
      reportId: staleReport.id,
    },
  });

  // Seed 2: Recent ACTIVE report (< 30 days old) - must NOT be deleted
  const recentReport = await prisma.report.create({
    data: {
      userId: testUser.id,
      category: 'SNATCHING',
      severity: 'HIGH',
      latitude: 23.75,
      longitude: 90.38,
      description: 'Recent active report (5 days old) - MUST NOT BE PURGED',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      createdAt: fiveDaysAgo,
    },
  });

  console.log(`  Seeded stale report (ID: ${staleReport.id}) with Vote, Update, Media, and News.`);
  console.log(`  Seeded recent report (ID: ${recentReport.id}).`);

  // Execute hard-delete retention cleanup with 30-day threshold
  const result = await hardDeleteStaleRetentionData(30);
  console.log(`  Hard cleanup result:`, result);

  if (result.deletedReports < 1) {
    throw new Error(`Expected at least 1 deleted report, got ${result.deletedReports}`);
  }

  // Verify DB state: Stale report and all child rows must be gone
  const checkStale = await prisma.report.findUnique({ where: { id: staleReport.id } });
  if (checkStale) {
    throw new Error(`Stale report ${staleReport.id} was not deleted from database!`);
  }

  const checkVote = await prisma.vote.findUnique({ where: { id: vote.id } });
  if (checkVote) {
    throw new Error(`Child vote ${vote.id} was not cascade-deleted!`);
  }

  const checkUpdate = await prisma.reportUpdate.findUnique({ where: { id: update.id } });
  if (checkUpdate) {
    throw new Error(`Child update ${update.id} was not cascade-deleted!`);
  }

  const checkMedia = await prisma.reportMedia.findUnique({ where: { id: media.id } });
  if (checkMedia) {
    throw new Error(`Child media ${media.id} was not cascade-deleted!`);
  }

  const checkNews = await prisma.newsArticle.findUnique({ where: { id: staleNews.id } });
  if (checkNews) {
    throw new Error(`Child news article ${staleNews.id} was not cascade-deleted!`);
  }

  // Verify Recent report is completely untouched
  const checkRecent = await prisma.report.findUnique({ where: { id: recentReport.id } });
  if (!checkRecent || checkRecent.status !== 'ACTIVE') {
    throw new Error(`Recent report ${recentReport.id} was affected or deleted!`);
  }

  // Clean up recent test report and user
  await prisma.report.delete({ where: { id: recentReport.id } });
  await prisma.user.delete({ where: { id: testUser.id } });

  console.log('  ✅ Stale report and all associated child entities permanently purged.');
  console.log('  ✅ Recent active reports preserved intact.');
  console.log('\n🎉 ALL NEWS EXPIRY & DATABASE RETENTION TESTS PASSED SUCCESSFULLY!');
}

runTestSuite()
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
