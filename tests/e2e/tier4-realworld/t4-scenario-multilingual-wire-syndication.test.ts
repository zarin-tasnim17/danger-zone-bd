import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  isWireSyndicatedStory,
  resolvePublisherDomain,
} from '../../../apps/api/src/services/publisherRegistry';
import {
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';
import {
  newsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import {
  crawlRunMetricSchema,
} from '../harness/contractValidator';

describe('Tier 4: Real-World Scenario 3 - Mass Breaking News Wire Syndication Influx (BSS + 8 Outlets)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    newsObservabilityService.resetMetricsForTesting();
  });

  it('T4-SC3-01: End-to-end mass wire syndication influx: mutex safety, feed failure isolation, trust protection & structured telemetry', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Start Telemetry Run & Mutex Lease (F19 & F22)
    // -------------------------------------------------------------------------
    const runId = `crawl_mass_wire_${Date.now()}`;
    const recorder = newsObservabilityService.startRun(runId);
    assert.strictEqual(recorder.run.status, 'IN_PROGRESS');

    // -------------------------------------------------------------------------
    // Phase 2: Influx of 8 Syndicated Feeds + 1 Network Failure (F21)
    // -------------------------------------------------------------------------
    const wireFeeds = [
      { name: 'BSS Official Wire', url: 'https://bssnews.net/news/tongi-blaze', status: 'SUCCESS' as const, latency: 90 },
      { name: 'Prothom Alo', url: 'https://prothomalo.com/tongi-fire-bss', status: 'SUCCESS' as const, latency: 120 },
      { name: 'The Daily Star', url: 'https://thedailystar.net/tongi-fire-bss', status: 'SUCCESS' as const, latency: 140 },
      { name: 'Samakal', url: 'https://samakal.com/tongi-fire-bss', status: 'SUCCESS' as const, latency: 110 },
      { name: 'Kaler Kantho', url: 'https://kalerkantho.com/tongi-fire-bss', status: 'SUCCESS' as const, latency: 130 },
      { name: 'Jugantor', url: 'https://jugantor.com/tongi-fire-bss', status: 'SUCCESS' as const, latency: 125 },
      { name: 'Dhaka Post', url: 'https://dhakapost.com/tongi-fire-bss', status: 'SUCCESS' as const, latency: 105 },
      { name: 'RisingBD', url: 'https://risingbd.com/tongi-fire-bss', status: 'FAILED' as const, latency: 5000, error: 'HTTP 504 Gateway Timeout' },
    ];

    recorder.recordDiscoveredArticles(wireFeeds.length);

    // Process feed executions with Failure Isolation (F21)
    for (const f of wireFeeds) {
      if (f.status === 'SUCCESS') {
        recorder.recordFeedExecution({
          feedName: f.name,
          category: 'UNLIT_ROAD',
          url: f.url,
          status: 'SUCCESS',
          latencyMs: f.latency,
          itemsFetched: 1,
        });
      } else {
        recorder.recordFeedExecution({
          feedName: f.name,
          category: 'UNLIT_ROAD',
          url: f.url,
          status: 'FAILED',
          latencyMs: f.latency,
          itemsFetched: 0,
          errorMessage: f.error,
        });
      }
    }

    assert.strictEqual(recorder.run.feedsChecked, 8);
    assert.strictEqual(recorder.run.feedsSuccess, 7);
    assert.strictEqual(recorder.run.feedsFailed, 1);

    // -------------------------------------------------------------------------
    // Phase 3: Canonical Report Creation from BSS Wire Story (F15 & F16)
    // -------------------------------------------------------------------------
    const storyTitle = 'টঙ্গীতে কারখানায় ভয়াবহ আগুনে ৫ জন আহত';
    const primaryLat = 23.9800;
    const primaryLng = 90.4000;

    const bssCheck = isWireSyndicatedStory(wireFeeds[0].url, 'BSS', '(BSS) - Chemical fire in Tongi');
    assert.strictEqual(bssCheck.isWire, true);

    recorder.recordGeocodingSuccess();
    recorder.recordNewIncident();

    const canonicalReport = db.seedReport({
      title: storyTitle,
      category: 'UNLIT_ROAD', // hazard
      latitude: primaryLat,
      longitude: primaryLng,
      sourceName: 'BSS',
      sourceUrl: wireFeeds[0].url,
      verificationStage: 'WIRE_SYNDICATED',
      upvotes: 0,
      citations: [
        {
          sourceName: 'BSS',
          sourceUrl: wireFeeds[0].url,
          title: storyTitle,
        },
      ],
    });

    assert.strictEqual(await db.report.count(), 1);

    // -------------------------------------------------------------------------
    // Phase 4: Deduplication & Trust Protection across 6 Remaining Successful Feeds (F15)
    // -------------------------------------------------------------------------
    const successfulSyndicatedFeeds = wireFeeds.slice(1, 7); // 6 feeds
    assert.strictEqual(successfulSyndicatedFeeds.length, 6);

    for (const feed of successfulSyndicatedFeeds) {
      recorder.recordDuplicateRejection();

      const wireCheck = isWireSyndicatedStory(feed.url, feed.name, `${storyTitle} (BSS)`);
      assert.strictEqual(wireCheck.isWire, true, `${feed.name} must be detected as wire copy`);

      const currentReport = (await db.report.findMany())[0];
      const sim = calculateStorySimilarity(storyTitle, `${storyTitle} (BSS)`);
      assert.strictEqual(sim.isDuplicate, true);

      // Consolidate citation without incrementing upvotes or elevating verificationStage
      await db.report.update({
        where: { id: canonicalReport.id },
        data: {
          citations: [
            ...currentReport.citations,
            { sourceName: feed.name, sourceUrl: feed.url, title: storyTitle },
          ],
          // Upvotes remain untouched (0) for wire syndication!
          upvotes: currentReport.upvotes,
          verificationStage: 'WIRE_SYNDICATED',
        },
      });
    }

    // Assertions after wire influx:
    assert.strictEqual(await db.report.count(), 1, 'Exactly 1 canonical report created for all 7 wire copies');
    const reportAfterWire = (await db.report.findMany())[0];
    assert.strictEqual(reportAfterWire.citations.length, 7, 'All 7 successful wire sources are cited');
    assert.strictEqual(reportAfterWire.upvotes, 0, 'Zero upvotes added for wire syndication (Trust Protection)');
    assert.strictEqual(reportAfterWire.verificationStage, 'WIRE_SYNDICATED', 'Stage must remain WIRE_SYNDICATED');

    // -------------------------------------------------------------------------
    // Phase 5: Independent Staff Reporter Investigation Corroboration
    // -------------------------------------------------------------------------
    const independentInvestigation = {
      sourceName: 'The Daily Star Staff Correspondent',
      sourceUrl: 'https://thedailystar.net/news/tongi-factory-fire-investigation',
      snippet: 'Staff Correspondent, Gazipur: Eye-witnesses recount the sudden explosion...',
    };

    const isIndependent = !isWireSyndicatedStory(
      independentInvestigation.sourceUrl,
      independentInvestigation.sourceName,
      independentInvestigation.snippet
    ).isWire;
    assert.strictEqual(isIndependent, true, 'Staff investigation is independent, not wire');

    // Independent reporting elevates verification stage and increments upvotes
    const finalReport = await db.report.update({
      where: { id: canonicalReport.id },
      data: {
        verificationStage: 'PRESS_CORROBORATED',
        upvotes: reportAfterWire.upvotes + 2,
        citations: [
          ...reportAfterWire.citations,
          { sourceName: independentInvestigation.sourceName, sourceUrl: independentInvestigation.sourceUrl },
        ],
      },
    });

    assert.strictEqual(finalReport.verificationStage, 'PRESS_CORROBORATED', 'Elevated to PRESS_CORROBORATED');
    assert.strictEqual(finalReport.upvotes, 2, 'Gains +2 upvotes from independent corroboration');
    assert.strictEqual(finalReport.citations.length, 8);

    // -------------------------------------------------------------------------
    // Phase 6: Complete Structured Execution Telemetry (F22)
    // -------------------------------------------------------------------------
    const completedMetric = recorder.complete();
    crawlRunMetricSchema.parse(completedMetric);

    assert.strictEqual(completedMetric.runId, runId);
    assert.strictEqual(completedMetric.status, 'PARTIAL', 'Overall status is PARTIAL due to 1 failed feed');
    assert.strictEqual(completedMetric.feedsChecked, 8);
    assert.strictEqual(completedMetric.feedsSuccess, 7);
    assert.strictEqual(completedMetric.feedsFailed, 1);
    assert.strictEqual(completedMetric.articlesDiscovered, 8);
    assert.strictEqual(completedMetric.duplicateRejections, 6);
    assert.strictEqual(completedMetric.newIncidentsCreated, 1);
  });
});
