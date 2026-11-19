import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NewsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import {
  assertValidCrawlerMetrics,
} from '../harness/contractValidator';
import {
  DEDICATED_CATEGORY_FEEDS,
} from '../../../apps/api/src/services/newsCrawlerService';

describe('Tier 3: Pairwise Combinations - P08: Crawler & Observability Telemetry (F2 x F5 x F8 x F16)', () => {
  let observability: NewsObservabilityService;

  beforeEach(() => {
    observability = new NewsObservabilityService();
  });

  it('T3-P08-01: Crawl run tracks discovered articles, rejected duplicates, and consolidated incidents in telemetry', () => {
    const recorder = observability.startRun('crawl-run-p08-01');

    // Simulate crawling 11 feeds:
    // 30 articles discovered: 18 new incidents, 8 duplicate rejections, 4 consolidated into existing
    recorder.recordDiscoveredArticles(30);
    recorder.recordDuplicateRejection(8);
    recorder.recordNewIncident(18);
    recorder.recordVerifiedMatches(4);

    // Record geocoding outcomes
    recorder.recordGeocodingSuccess(20);
    recorder.recordGeocodingFailure(2);

    for (const feed of DEDICATED_CATEGORY_FEEDS) {
      recorder.recordFeedExecution({
        feedName: feed.name,
        category: feed.category,
        url: feed.url,
        status: 'SUCCESS',
        latencyMs: 140,
        itemsFetched: Math.floor(30 / 11),
      });
    }

    const completed = recorder.complete();
    assert.strictEqual(completed.runId, 'crawl-run-p08-01');
    assert.strictEqual(completed.status, 'SUCCESS');
    assert.strictEqual(completed.articlesDiscovered, 30);
    assert.strictEqual(completed.duplicateRejections, 8);
    assert.strictEqual(completed.newIncidentsCreated, 18);
    assert.strictEqual(completed.verifiedMatchesCount, 4);
    assert.strictEqual(completed.geocodingSuccessCount, 20);
    assert.strictEqual(completed.geocodingFailureCount, 2);
    assert.strictEqual(completed.feedsChecked, 11);
    assert.strictEqual(completed.feedsSuccess, 11);
    assert.strictEqual(completed.feedsFailed, 0);
  });

  it('T3-P08-02: Observability recorder captures per-feed latency, item count, and health status across crawler execution', () => {
    const recorder = observability.startRun('crawl-run-p08-02');

    // 10 feeds succeed, 1 feed fails with timeout
    for (let i = 0; i < 10; i++) {
      const feed = DEDICATED_CATEGORY_FEEDS[i];
      recorder.recordFeedExecution({
        feedName: feed.name,
        category: feed.category,
        url: feed.url,
        status: 'SUCCESS',
        latencyMs: 120 + i * 10,
        itemsFetched: 3,
      });
    }

    // 11th feed fails
    const failedFeed = DEDICATED_CATEGORY_FEEDS[10];
    recorder.recordFeedExecution({
      feedName: failedFeed.name,
      category: failedFeed.category,
      url: failedFeed.url,
      status: 'TIMEOUT',
      latencyMs: 10000,
      itemsFetched: 0,
      errorMessage: 'Feed connection timed out after 10000ms',
    });

    const completed = recorder.complete();
    assert.strictEqual(completed.status, 'PARTIAL');
    assert.strictEqual(completed.feedsChecked, 11);
    assert.strictEqual(completed.feedsSuccess, 10);
    assert.strictEqual(completed.feedsFailed, 1);
    assert.strictEqual(completed.feedDetails.length, 11);

    const timeoutFeed = completed.feedDetails.find((f) => f.status === 'TIMEOUT');
    assert.ok(timeoutFeed);
    assert.strictEqual(timeoutFeed!.feedName, failedFeed.name);
    assert.ok(timeoutFeed!.errorMessage?.includes('timed out'));
  });

  it('T3-P08-03: Multi-run telemetry aggregates cumulative statistics over consecutive 10-minute crawl runs', () => {
    // Run 1: at 00:00
    const rec1 = observability.startRun('run-1');
    rec1.recordDiscoveredArticles(10);
    rec1.recordDuplicateRejection(2);
    rec1.recordNewIncident(8);
    rec1.recordGeocodingSuccess(8);
    rec1.recordFeedExecution({
      feedName: 'Test Feed 1',
      category: 'THEFT',
      url: 'https://test/theft',
      status: 'SUCCESS',
      latencyMs: 100,
      itemsFetched: 10,
    });
    rec1.complete();

    // Run 2: at 00:10
    const rec2 = observability.startRun('run-2');
    rec2.recordDiscoveredArticles(15);
    rec2.recordDuplicateRejection(5);
    rec2.recordNewIncident(10);
    rec2.recordGeocodingSuccess(9);
    rec2.recordGeocodingFailure(1);
    rec2.recordFeedExecution({
      feedName: 'Test Feed 2',
      category: 'ROAD_ACCIDENT',
      url: 'https://test/accident',
      status: 'SUCCESS',
      latencyMs: 150,
      itemsFetched: 15,
    });
    rec2.complete();

    const summary = observability.getTelemetrySummary();
    assert.strictEqual(summary.totalRuns, 2);
    assert.strictEqual(summary.totalArticlesDiscovered, 25);
    assert.strictEqual(summary.totalDuplicateRejections, 7);
    assert.strictEqual(summary.totalNewIncidentsCreated, 18);
    assert.strictEqual(summary.totalGeocodingSuccess, 17);
    assert.strictEqual(summary.totalGeocodingFailure, 1);
    assert.strictEqual(summary.recentRuns.length, 2);
  });

  it('T3-P08-04: Geocoding telemetry accurately calculates success rate percentage', () => {
    const rec = observability.startRun('run-geo');
    rec.recordGeocodingSuccess(80);
    rec.recordGeocodingFailure(20);
    rec.recordFeedExecution({
      feedName: 'Geo Feed',
      category: 'ROBBERY',
      url: 'https://test/robbery',
      status: 'SUCCESS',
      latencyMs: 50,
      itemsFetched: 100,
    });
    rec.complete();

    const summary = observability.getTelemetrySummary();
    // 80 / (80 + 20) = 80.0%
    assert.strictEqual(summary.overallGeocodingSuccessRate, 80);
  });

  it('T3-P08-05: Operational audit report strictly conforms to contractValidator CrawlerMetrics schema', () => {
    const rec = observability.startRun('audit-run');
    rec.recordDiscoveredArticles(5);
    rec.recordNewIncident(5);
    rec.recordGeocodingSuccess(5);
    rec.recordFeedExecution({
      feedName: 'Audit Feed',
      category: 'UNLIT_ROAD',
      url: 'https://test/unlit',
      status: 'SUCCESS',
      latencyMs: 95,
      itemsFetched: 5,
    });
    rec.complete();

    const summary = observability.getTelemetrySummary();
    const validated = assertValidCrawlerMetrics(summary);
    assert.ok(validated.totalRuns >= 1);
    assert.ok(validated.lastRun !== undefined);
    assert.strictEqual(validated.lastRun?.status, 'SUCCESS');
  });
});
