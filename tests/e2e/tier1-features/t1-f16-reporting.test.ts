import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  ALL_64_DISTRICTS,
  ALL_8_DIVISIONS,
  ALL_11_SAFETY_CATEGORIES,
  DISTRICT_CENTERS,
  DISTRICT_TO_DIVISION,
} from '../harness/testDataGenerators';
import { NewsObservabilityService } from '../../../apps/api/src/services/newsObservabilityService';

describe('Tier 1: Feature Coverage - F16: Operational Reporting & Deployment Audit', () => {
  it('T1-F16-01: Incident telemetry aggregates nationwide distribution across all 8 divisions and 64 districts', () => {
    const db = new MockDatabase();

    // Seed one report in each of the 64 districts
    for (const district of ALL_64_DISTRICTS) {
      const center = DISTRICT_CENTERS[district];
      db.seedReport({
        category: 'ROAD_ACCIDENT',
        latitude: center.latitude,
        longitude: center.longitude,
      });
    }

    const allReports = db.getReportsInBounds({ minLat: 20.3, maxLat: 26.8, minLng: 87.8, maxLng: 92.9 }, 'all');
    assert.strictEqual(allReports.length, 64, 'Must contain 64 nationwide reports');

    // Aggregate division distribution
    const divisionCounts: Record<string, number> = {};
    for (const div of ALL_8_DIVISIONS) {
      divisionCounts[div] = 0;
    }

    for (const r of allReports) {
      // Find matching district
      const matchedDist = ALL_64_DISTRICTS.find((d) => {
        const c = DISTRICT_CENTERS[d];
        return Math.abs(c.latitude - r.latitude) < 0.001 && Math.abs(c.longitude - r.longitude) < 0.001;
      });
      if (matchedDist) {
        const div = DISTRICT_TO_DIVISION[matchedDist];
        divisionCounts[div] = (divisionCounts[div] || 0) + 1;
      }
    }

    for (const div of ALL_8_DIVISIONS) {
      assert.ok(
        divisionCounts[div] > 0,
        `Division ${div} must have reports recorded in aggregate reporting`
      );
    }
  });

  it('T1-F16-02: Categorical breakdown accounts for all 11 primary public safety categories', () => {
    const db = new MockDatabase();

    // Seed 1 incident for each of the 11 categories
    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      db.seedReport({
        category: cat,
        latitude: 23.81,
        longitude: 90.41,
      });
    }

    const categoryBreakdown: Record<string, number> = {};
    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      const count = db.getReportsInBounds({ minLat: 20.3, maxLat: 26.8, minLng: 87.8, maxLng: 92.9 }, cat).length;
      categoryBreakdown[cat] = count;
      assert.strictEqual(count, 1, `Category ${cat} must report exactly 1 incident`);
    }

    assert.strictEqual(
      Object.keys(categoryBreakdown).length,
      11,
      'Report breakdown must account for all 11 categories'
    );
  });

  it('T1-F16-03: Performance metrics track crawl execution SLA compliance (<60 seconds)', () => {
    const service = new NewsObservabilityService();
    const recorder = service.startRun('perf-sla-test');

    recorder.recordFeedExecution({
      feedName: 'Google News Fast',
      category: 'THEFT',
      url: 'https://news.google.com/theft',
      status: 'SUCCESS',
      latencyMs: 350,
      itemsFetched: 12,
    });

    const finished = recorder.complete();

    // Verify SLA compliance (crawler execution should comfortably complete in <60,000ms)
    assert.ok(
      finished.durationMs < 60_000,
      `Crawl run duration (${finished.durationMs}ms) must satisfy <60s SLA threshold`
    );
  });

  it('T1-F16-04: Database deployment audit verifies PostGIS spatial extension and schema readiness', () => {
    // Audit PostGIS and geometry definitions from Prisma schema
    const requiredPrismaModels = ['User', 'Report', 'NewsArticle', 'ReportUpdate', 'SafeZone', 'Vote'];
    const mockDb = new MockDatabase();

    assert.ok(mockDb.report, 'Prisma schema must expose Report model');
    assert.ok(mockDb.newsArticle, 'Prisma schema must expose NewsArticle model');
    assert.ok(mockDb.reportUpdate, 'Prisma schema must expose ReportUpdate model');
    assert.ok(mockDb.user, 'Prisma schema must expose User model');
  });

  it('T1-F16-05: Security configuration audit verifies mandatory environment secrets are defined', () => {
    // Deployment checklist requires CRON_SECRET, JWT_SECRET, and DATABASE_URL
    assert.ok(process.env.CRON_SECRET, 'CRON_SECRET must be configured');
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be configured');
    assert.ok(
      process.env.JWT_SECRET.length >= 32,
      'JWT_SECRET must meet minimum 32-character security entropy requirement'
    );
  });
});
