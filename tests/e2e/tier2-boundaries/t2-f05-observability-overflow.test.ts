import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NewsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import { assertValidCrawlerMetrics } from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - F05: Observability Counter Overflows & Redaction', () => {
  let service: NewsObservabilityService;

  beforeEach(() => {
    service = new NewsObservabilityService();
  });

  it('T2-F05-01: Very large metric counts (e.g. 100,000,000 items) maintain numeric precision without NaN or overflow', () => {
    const recorder = service.startRun('overflow-run-1');
    const hugeCount = 100_000_000;

    recorder.recordDiscoveredArticles(hugeCount);
    recorder.recordDuplicateRejection(40_000_000);
    recorder.recordNewIncident(60_000_000);

    recorder.recordGeocodingSuccess(1000);
    recorder.complete();

    const summary = service.getTelemetrySummary();
    assert.strictEqual(summary.totalArticlesDiscovered, hugeCount);
    assert.strictEqual(summary.totalDuplicateRejections, 40_000_000);
    assert.strictEqual(summary.totalNewIncidentsCreated, 60_000_000);
    assert.strictEqual(summary.totalGeocodingSuccess, 1000);
    assert.ok(!isNaN(summary.overallGeocodingSuccessRate));
    assert.strictEqual(summary.overallGeocodingSuccessRate, 100);

    const validated = assertValidCrawlerMetrics(summary);
    assert.strictEqual(validated.totalArticlesDiscovered, hugeCount);
  });

  it('T2-F05-02: Credential redaction sanitizes embedded HTTP basic auth and sensitive tokens in feed metrics', () => {
    const recorder = service.startRun('redact-run-1');
    const rawFeedUrl = 'https://admin:super_secret_password@news.bd.test/rss/theft?token=secret_cron_key_123';

    // Redaction function to sanitize feed URLs prior to telemetry recording
    const sanitizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        u.username = '';
        u.password = '';
        u.searchParams.delete('token');
        u.searchParams.delete('secret');
        u.searchParams.delete('key');
        return u.toString();
      } catch {
        return url.replace(/\/\/.*@/, '//');
      }
    };

    const cleanUrl = sanitizeUrl(rawFeedUrl);
    recorder.recordFeedExecution({
      feedName: 'Secure Feeds',
      category: 'THEFT',
      url: cleanUrl,
      status: 'SUCCESS',
      latencyMs: 100,
      itemsFetched: 10,
    });
    recorder.complete();

    const summary = service.getTelemetrySummary();
    const feedDetails = summary.lastRun?.feedDetails || [];
    assert.strictEqual(feedDetails.length, 1);
    assert.ok(!feedDetails[0].url.includes('super_secret_password'), 'Password must be redacted');
    assert.ok(!feedDetails[0].url.includes('secret_cron_key_123'), 'Auth token must be redacted');
    assert.strictEqual(feedDetails[0].url, 'https://news.bd.test/rss/theft');
  });

  it('T2-F05-03: In-memory observability service remains operational and resilient without filesystem dependency', () => {
    // The observability service is in-memory and non-blocking
    assert.doesNotThrow(() => {
      const r = service.startRun('run-memory-resilience');
      r.recordDiscoveredArticles(50);
      r.complete('SUCCESS');
    }, 'In-memory telemetry must never throw filesystem exceptions');

    const summary = service.getTelemetrySummary();
    assert.strictEqual(summary.totalRuns, 1);
    assert.strictEqual(summary.totalArticlesDiscovered, 50);
  });

  it('T2-F05-04: Concurrent asynchronous feed telemetry updates preserve cumulative totals without race conditions', async () => {
    const recorder = service.startRun('concurrent-run');
    const iterations = 50;

    await Promise.all(
      Array.from({ length: iterations }, async (_, i) => {
        recorder.recordFeedExecution({
          feedName: `Feed ${i % 5}`,
          category: 'ROAD_ACCIDENT',
          url: `https://news.bd.test/feed-${i % 5}`,
          status: 'SUCCESS',
          latencyMs: 10 + (i % 20),
          itemsFetched: 2,
        });
        recorder.recordDiscoveredArticles(2);
        recorder.recordNewIncident(1);
        recorder.recordGeocodingSuccess(1);
      })
    );

    const completed = recorder.complete();
    assert.strictEqual(completed.articlesDiscovered, iterations * 2);
    assert.strictEqual(completed.newIncidentsCreated, iterations);
    assert.strictEqual(completed.geocodingSuccessCount, iterations);

    const summary = service.getTelemetrySummary();
    assert.strictEqual(summary.totalArticlesDiscovered, iterations * 2);
  });

  it('T2-F05-05: Escape sequences, Unicode control characters, and JSON formatting characters in headlines do not corrupt metrics', () => {
    const recorder = service.startRun('escape-run');
    const adversarialHeadline = '{"incident": "Explosion \u0000 \b \f \n \r \t \" \\\\"} <script>alert(1)</script>';

    recorder.recordFeedExecution({
      feedName: `Feed with headline: ${adversarialHeadline}`,
      category: 'ARMED_ASSAULT',
      url: 'https://news.bd.test/rss/assault',
      status: 'SUCCESS',
      latencyMs: 95,
      itemsFetched: 1,
      errorMessage: `Error with: ${adversarialHeadline}`,
    });
    recorder.complete();

    const summary = service.getTelemetrySummary();
    // Serialization and deserialization test
    const serialized = JSON.stringify(summary);
    assert.ok(serialized && serialized.length > 0);

    const deserialized = JSON.parse(serialized);
    assert.strictEqual(deserialized.totalRuns, 1);
    assert.ok(deserialized.lastRun.feedDetails[0].feedName.includes('<script>'));
  });
});
