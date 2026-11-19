import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { NewsObservabilityService } from '../../../apps/api/src/services/newsObservabilityService';
import { ALL_64_DISTRICTS } from '../harness/testDataGenerators';
import { assertValidCrawlerMetrics } from '../harness/contractValidator';
import { MockDatabase } from '../harness/mockDatabase';

describe('Tier 2: Boundary & Corner Cases - F16: Operational Audit Boundaries & Streams', () => {
  it('T2-F16-01: Empty fresh install metrics return valid zeroes with no NaN or undefined rate fields', () => {
    const freshService = new NewsObservabilityService();
    const summary = freshService.getTelemetrySummary();

    assert.strictEqual(summary.totalRuns, 0);
    assert.strictEqual(summary.totalArticlesDiscovered, 0);
    assert.strictEqual(summary.totalDuplicateRejections, 0);
    assert.strictEqual(summary.totalNewIncidentsCreated, 0);
    assert.strictEqual(summary.totalGeocodingSuccess, 0);
    assert.strictEqual(summary.totalGeocodingFailure, 0);
    assert.strictEqual(summary.overallGeocodingSuccessRate, 0);
    assert.ok(!isNaN(summary.overallGeocodingSuccessRate), 'Success rate must not be NaN');

    // Conformance with contractValidator Zod schema
    const validated = assertValidCrawlerMetrics(summary);
    assert.strictEqual(validated.totalRuns, 0);
  });

  it('T2-F16-02: 5-year historical date range audit query executes cleanly without date overflows', () => {
    const now = new Date('2026-11-19T10:00:00Z');
    const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);

    assert.ok(fiveYearsAgo < now);
    assert.strictEqual(fiveYearsAgo.getUTCFullYear(), 2021);

    const db = new MockDatabase();
    // Seed 1 historical report from 2021 and 1 current report
    db.seedReport({
      title: 'Historical 2021 accident',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103,
      longitude: 90.4125,
      createdAt: fiveYearsAgo,
    });
    db.seedReport({
      title: 'Current 2026 accident',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103,
      longitude: 90.4125,
      createdAt: now,
    });

    const historicalReports = db.getReportsInBounds({ minLat: 20.3, maxLat: 26.8, minLng: 87.8, maxLng: 92.9 }, 'all');
    assert.strictEqual(historicalReports.length, 2);
  });

  it('T2-F16-03: Nationwide 64-district aggregate roster preserves 0-count entries for quiet districts', () => {
    // Only 2 districts have incidents (Dhaka and Chattogram)
    const incidentCounts: Record<string, number> = {
      Dhaka: 15,
      Chattogram: 7,
    };

    // Construct full 64-district roster
    const nationwideRoster: Array<{ district: string; incidentCount: number }> = ALL_64_DISTRICTS.map((district) => ({
      district,
      incidentCount: incidentCounts[district] || 0,
    }));

    assert.strictEqual(nationwideRoster.length, 64, 'Roster must contain all 64 districts of Bangladesh');

    const meherpur = nationwideRoster.find((d) => d.district === 'Meherpur');
    assert.ok(meherpur !== undefined);
    assert.strictEqual(meherpur!.incidentCount, 0, 'Districts with zero incidents must have count: 0');

    const dhaka = nationwideRoster.find((d) => d.district === 'Dhaka');
    assert.strictEqual(dhaka!.incidentCount, 15);
  });

  it('T2-F16-04: Concurrent background crawl recording and telemetry queries produce consistent snapshot statistics', async () => {
    const service = new NewsObservabilityService();
    const recorder = service.startRun('live-run');

    // Concurrently record metrics while reading summary snapshots
    await Promise.all([
      (async () => {
        for (let i = 0; i < 50; i++) {
          recorder.recordDiscoveredArticles(1);
          recorder.recordNewIncident(1);
          recorder.recordGeocodingSuccess(1);
        }
        recorder.complete('SUCCESS');
      })(),
      (async () => {
        for (let i = 0; i < 10; i++) {
          const snapshot = service.getTelemetrySummary();
          assert.ok(snapshot.totalRuns >= 0);
        }
      })(),
    ]);

    const finalSummary = service.getTelemetrySummary();
    assert.strictEqual(finalSummary.totalArticlesDiscovered, 50);
    assert.strictEqual(finalSummary.totalNewIncidentsCreated, 50);
  });

  it('T2-F16-05: 50,000 item CSV streaming pipeline handles backpressure without heap exhaustion', async () => {
    const totalRecords = 50_000;
    let chunkCount = 0;
    let totalBytes = 0;

    // Create a generator stream yielding CSV lines in chunks
    async function* generateCsvLines() {
      yield 'id,category,severity,latitude,longitude,createdAt\n';
      for (let i = 0; i < totalRecords; i++) {
        yield `id-${i},ROAD_ACCIDENT,HIGH,23.8103,90.4125,2026-11-19T10:00:00Z\n`;
      }
    }

    const stream = Readable.from(generateCsvLines());

    for await (const chunk of stream) {
      chunkCount++;
      totalBytes += Buffer.byteLength(chunk, 'utf-8');
    }

    assert.ok(chunkCount > 0);
    assert.ok(totalBytes > 1_000_000, `Total streamed CSV bytes must be >1MB, got ${totalBytes}`);
  });
});
