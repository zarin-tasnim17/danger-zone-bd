import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NewsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import { assertValidCrawlerMetrics } from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - F05: Structured Logging & Ingestion Observability', () => {
  let service: NewsObservabilityService;

  beforeEach(() => {
    service = new NewsObservabilityService();
  });

  it('T1-F05-01: Crawl run recorder accurately tracks lifecycle, status, and duration', () => {
    const recorder = service.startRun('test-run-001');

    assert.strictEqual(recorder.run.runId, 'test-run-001');
    assert.strictEqual(recorder.run.status, 'IN_PROGRESS');

    recorder.recordFeedExecution({
      feedName: 'Test Theft Feed',
      category: 'THEFT',
      url: 'https://news.bd.test/rss/theft',
      status: 'SUCCESS',
      latencyMs: 120,
      itemsFetched: 5,
    });

    const finished = recorder.complete();

    assert.strictEqual(finished.status, 'SUCCESS');
    assert.strictEqual(finished.feedsChecked, 1);
    assert.strictEqual(finished.feedsSuccess, 1);
    assert.strictEqual(finished.feedsFailed, 0);
    assert.ok(finished.durationMs >= 0, 'Duration must be non-negative');
    assert.ok(finished.endTime, 'Crawl run must record an endTime timestamp');
  });

  it('T1-F05-02: Discovered articles, duplicates, and new incidents are tracked accurately', () => {
    const recorder = service.startRun();

    recorder.recordDiscoveredArticles(15);
    recorder.recordDuplicateRejection(6);
    recorder.recordNewIncident(9);

    recorder.recordFeedExecution({
      feedName: 'Test Accident Feed',
      category: 'ROAD_ACCIDENT',
      url: 'https://news.bd.test/rss/accident',
      status: 'SUCCESS',
      latencyMs: 80,
      itemsFetched: 15,
    });

    recorder.complete();

    const summary = service.getTelemetrySummary();
    assert.strictEqual(summary.totalArticlesDiscovered, 15);
    assert.strictEqual(summary.totalDuplicateRejections, 6);
    assert.strictEqual(summary.totalNewIncidentsCreated, 9);
  });

  it('T1-F05-03: Geocoding telemetry tracks successes and failures and computes success rate', () => {
    const recorder = service.startRun();

    recorder.recordGeocodingSuccess(8);
    recorder.recordGeocodingFailure(2);

    recorder.recordFeedExecution({
      feedName: 'Test Snatching Feed',
      category: 'SNATCHING',
      url: 'https://news.bd.test/rss/snatching',
      status: 'SUCCESS',
      latencyMs: 95,
      itemsFetched: 10,
    });

    recorder.complete();

    const summary = service.getTelemetrySummary();
    assert.strictEqual(summary.totalGeocodingSuccess, 8);
    assert.strictEqual(summary.totalGeocodingFailure, 2);
    // (8 / (8 + 2)) * 100 = 80.0%
    assert.strictEqual(summary.overallGeocodingSuccessRate, 80);
  });

  it('T1-F05-04: Per-feed health tracking calculates success rate and average latency', () => {
    const feedName = 'Google News BD Theft';

    // Run 1: success (100ms)
    const rec1 = service.startRun();
    rec1.recordFeedExecution({
      feedName,
      category: 'THEFT',
      url: 'https://news.google.com/rss/theft',
      status: 'SUCCESS',
      latencyMs: 100,
      itemsFetched: 3,
    });
    rec1.complete();

    // Run 2: failure (300ms)
    const rec2 = service.startRun();
    rec2.recordFeedExecution({
      feedName,
      category: 'THEFT',
      url: 'https://news.google.com/rss/theft',
      status: 'FAILED',
      latencyMs: 300,
      itemsFetched: 0,
      errorMessage: 'Network timeout',
    });
    rec2.complete();

    const summary = service.getTelemetrySummary();
    const stats = summary.feedHealth[feedName];

    assert.ok(stats, `feedHealth must contain metrics for ${feedName}`);
    assert.strictEqual(stats.totalChecks, 2);
    assert.strictEqual(stats.successes, 1);
    assert.strictEqual(stats.failures, 1);
    assert.strictEqual(stats.successRate, 50); // 50%
    assert.strictEqual(stats.avgLatencyMs, 200); // (100 + 300) / 2 = 200ms
  });

  it('T1-F05-05: Telemetry summary strictly conforms to contractValidator schema', () => {
    const recorder = service.startRun('schema-test-run');
    recorder.recordDiscoveredArticles(10);
    recorder.recordDuplicateRejection(2);
    recorder.recordNewIncident(8);
    recorder.recordGeocodingSuccess(7);
    recorder.recordGeocodingFailure(1);
    recorder.recordFeedExecution({
      feedName: 'Robbery Feed',
      category: 'ROBBERY',
      url: 'https://news.google.com/rss/robbery',
      status: 'SUCCESS',
      latencyMs: 150,
      itemsFetched: 10,
    });
    recorder.complete();

    const summary = service.getTelemetrySummary();
    const validated = assertValidCrawlerMetrics(summary);

    assert.strictEqual(validated.totalRuns, 1);
    assert.strictEqual(validated.totalArticlesDiscovered, 10);
    assert.strictEqual(validated.totalDuplicateRejections, 2);
    assert.strictEqual(validated.totalNewIncidentsCreated, 8);
    assert.ok(validated.overallGeocodingSuccessRate > 0);
  });
});
