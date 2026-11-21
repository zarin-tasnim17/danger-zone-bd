import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  newsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import {
  crawlRunMetricSchema,
  assertValidCrawlerMetrics,
} from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - F22: Structured Execution Telemetry & Funnel Counts', () => {
  beforeEach(() => {
    newsObservabilityService.resetMetricsForTesting();
  });

  it('T1-F22-01: startRun creates structured run with unique runId, ISO timestamps, and IN_PROGRESS status', () => {
    const customId = `crawl_test_${Date.now()}`;
    const recorder = newsObservabilityService.startRun(customId);

    assert.strictEqual(recorder.run.runId, customId);
    assert.strictEqual(recorder.run.status, 'IN_PROGRESS');
    assert.ok(recorder.run.startTime.length > 0);
    assert.strictEqual(recorder.run.articlesDiscovered, 0);
  });

  it('T1-F22-02: Funnel counters accurately track discovery, duplicate rejections, and geocoding', () => {
    const recorder = newsObservabilityService.startRun('test_funnel_counts');

    recorder.recordDiscoveredArticles(15);
    recorder.recordDuplicateRejection();
    recorder.recordDuplicateRejection();
    recorder.recordDuplicateRejection();
    recorder.recordGeocodingSuccess();
    recorder.recordGeocodingSuccess();
    recorder.recordGeocodingFailure();
    recorder.recordNewIncident();

    recorder.complete();

    const current = recorder.run;
    assert.strictEqual(current.articlesDiscovered, 15, '15 articles discovered');
    assert.strictEqual(current.duplicateRejections, 3, '3 duplicate rejections');
    assert.strictEqual(current.geocodingSuccessCount, 2, '2 geocoding successes');
    assert.strictEqual(current.geocodingFailureCount, 1, '1 geocoding failure');
    assert.strictEqual(current.newIncidentsCreated, 1, '1 new incident created');
  });

  it('T1-F22-03: Per-feed execution details record latency, status, and items fetched', () => {
    const recorder = newsObservabilityService.startRun('test_feed_metrics');

    recorder.recordFeedExecution({
      feedName: 'Google News BD Theft',
      category: 'THEFT',
      url: 'https://news.google.com/rss/search?q=theft',
      status: 'SUCCESS',
      latencyMs: 145,
      itemsFetched: 8,
    });

    recorder.recordFeedExecution({
      feedName: 'Google News BD Robbery',
      category: 'ROBBERY',
      url: 'https://news.google.com/rss/search?q=robbery',
      status: 'FAILED',
      latencyMs: 310,
      itemsFetched: 0,
      errorMessage: 'HTTP 500 Internal Server Error',
    });

    recorder.complete();

    const current = recorder.run;
    assert.strictEqual(current.feedsChecked, 2);
    assert.strictEqual(current.feedsSuccess, 1);
    assert.strictEqual(current.feedsFailed, 1);
    assert.strictEqual(current.feedDetails.length, 2);
    assert.strictEqual(current.feedDetails[0].status, 'SUCCESS');
    assert.strictEqual(current.feedDetails[1].status, 'FAILED');
    assert.strictEqual(current.feedDetails[1].errorMessage, 'HTTP 500 Internal Server Error');
  });

  it('T1-F22-04: Completed run strictly validates against contractValidator crawlRunMetricSchema', () => {
    const recorder = newsObservabilityService.startRun('test_contract_schema');

    recorder.recordDiscoveredArticles(10);
    recorder.recordFeedExecution({
      feedName: 'Google News BD Road Accident',
      category: 'ROAD_ACCIDENT',
      url: 'https://news.google.com/rss/search?q=accident',
      status: 'SUCCESS',
      latencyMs: 120,
      itemsFetched: 5,
    });
    recorder.recordGeocodingSuccess();
    recorder.recordNewIncident();

    const completed = recorder.complete();
    const validated = crawlRunMetricSchema.parse(completed);

    assert.strictEqual(validated.runId, 'test_contract_schema');
    assert.strictEqual(validated.status, 'SUCCESS');
    assert.ok(validated.durationMs >= 0);
  });

  it('T1-F22-05: Cumulative telemetry summary calculates overall geocoding success rate across runs', () => {
    // Run 1: 8 successes, 2 failures (80% rate)
    const rec1 = newsObservabilityService.startRun('run_1');
    for (let i = 0; i < 8; i++) rec1.recordGeocodingSuccess();
    for (let i = 0; i < 2; i++) rec1.recordGeocodingFailure();
    rec1.complete();

    // Run 2: 12 successes, 3 failures (12+8=20 successes, 3+2=5 failures -> 20/25 = 80%)
    const rec2 = newsObservabilityService.startRun('run_2');
    for (let i = 0; i < 12; i++) rec2.recordGeocodingSuccess();
    for (let i = 0; i < 3; i++) rec2.recordGeocodingFailure();
    rec2.complete();

    const summary = newsObservabilityService.getTelemetrySummary();
    assertValidCrawlerMetrics(summary);

    assert.strictEqual(summary.totalRuns, 2);
    assert.strictEqual(summary.totalGeocodingSuccess, 20);
    assert.strictEqual(summary.totalGeocodingFailure, 5);
    assert.strictEqual(summary.overallGeocodingSuccessRate, 80);
  });
});
