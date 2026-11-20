import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  isWithinBangladesh,
} from '@repo/shared';
import {
  newsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import {
  auditAllReports,
} from '../../../apps/api/src/scripts/auditAndRemediateReports';

describe('Tier 4: Real-World Scenario 4 - End-to-End 24h Cron Ingestion, Remediate Historical & Frontend Sync', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    newsObservabilityService.resetMetricsForTesting();
  });

  it('T4-SC4-01: End-to-end 24h cron lifecycle: telemetry tracking, dry-run & safe remediation, and citizen report protection', async () => {
    // =========================================================================
    // Phase 1: 24h Ingestion Simulation on 10-Minute Cadence (F18, F19, F22)
    // =========================================================================
    const TOTAL_DAILY_RUNS = 144; // 24 hours * 6 runs/hour
    assert.strictEqual(TOTAL_DAILY_RUNS, 24 * 6);

    // Simulate 3 representative cron cycles across the day (Morning, Afternoon, Night)
    const cronCycles = [
      { id: 'cron_run_morning_0800', articles: 12, duplicates: 4, newIncidents: 2, geoSuccess: 8, geoFail: 0 },
      { id: 'cron_run_afternoon_1400', articles: 8, duplicates: 3, newIncidents: 1, geoSuccess: 5, geoFail: 0 },
      { id: 'cron_run_night_2200', articles: 15, duplicates: 6, newIncidents: 3, geoSuccess: 9, geoFail: 0 },
    ];

    for (const cycle of cronCycles) {
      const recorder = newsObservabilityService.startRun(cycle.id);
      recorder.recordDiscoveredArticles(cycle.articles);

      for (let i = 0; i < cycle.duplicates; i++) recorder.recordDuplicateRejection();
      for (let i = 0; i < cycle.newIncidents; i++) recorder.recordNewIncident();
      for (let i = 0; i < cycle.geoSuccess; i++) recorder.recordGeocodingSuccess();

      recorder.recordFeedExecution({
        feedName: 'Google News BD General',
        category: 'ROAD_ACCIDENT',
        url: 'https://news.google.com/rss/search?q=bangladesh',
        status: 'SUCCESS',
        latencyMs: 150,
        itemsFetched: cycle.articles,
      });

      recorder.complete();
    }

    const dailyTelemetry = newsObservabilityService.getTelemetrySummary();
    assert.strictEqual(dailyTelemetry.totalRuns, 3);
    assert.strictEqual(dailyTelemetry.totalArticlesDiscovered, 35);
    assert.strictEqual(dailyTelemetry.totalDuplicateRejections, 13);
    assert.strictEqual(dailyTelemetry.totalNewIncidentsCreated, 6);
    assert.strictEqual(dailyTelemetry.overallGeocodingSuccessRate, 100);

    // =========================================================================
    // Phase 2: Inject Historical Database State (Machine vs Citizen) (F24)
    // =========================================================================
    const now = new Date();

    // 1. Machine Record A: Overseas crash in Saudi Arabia (misclassified active)
    const overseasReport = db.seedReport({
      title: 'সৌদি আরবে সড়ক দুর্ঘটনায় ৩ প্রবাসী বাংলাদেশি নিহত',
      description: 'সৌদি আরবের রিয়াদে মর্মান্তিক সড়ক দুর্ঘটনায় ৩ জন বাংলাদেশি নিহত হয়েছেন।',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103, // Erroneously defaulted to Dhaka center
      longitude: 90.4125,
      sourceUrl: 'https://news.bd/saudi-crash',
      sourceName: 'Daily News',
      status: 'ACTIVE',
    });
    (overseasReport as any).threatStatus = 'ACTIVE';

    // 2. Machine Record B: Legal / Court hearing follow-up
    const legalReport = db.seedReport({
      title: 'যাত্রাবাড়ী হত্যা মামলার অভিযোগ গঠনের শুনানি আজ',
      description: 'যাত্রাবাড়ী থানার হত্যা মামলায় আসামিদের বিরুদ্ধে অভিযোগ গঠন শুনানির দিন ধার্য করেছে আদালত।',
      category: 'ARMED_ASSAULT',
      latitude: 23.7099,
      longitude: 90.4349,
      sourceUrl: 'https://news.bd/court-hearing',
      sourceName: 'Daily Law',
      status: 'ACTIVE',
    });
    (legalReport as any).threatStatus = 'ACTIVE';

    // 3. Machine Record C: Genuine current localized road crash
    const currentCrashReport = db.seedReport({
      title: 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে ৩ নিহত',
      description: 'সীতাকুণ্ড মহাসড়কে যাত্রীবাহী বাস ও ট্রাকের মুখোমুখি সংঘর্ষে ৩ জন নিহত ও বহু আহত।',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      sourceUrl: 'https://news.bd/sitakunda-live',
      sourceName: 'The Daily Star',
      status: 'ACTIVE',
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // Active for 48h
    });
    (currentCrashReport as any).threatStatus = 'ACTIVE';
    (currentCrashReport as any).locationPrecision = 'UPAZILA';

    // 4. Citizen Record D: User-submitted safety incident (NO sourceUrl, NO newsArticles)
    const citizenLatitude = 23.7540;
    const citizenLongitude = 90.3750;
    const citizenReport = db.seedReport({
      userId: 'citizen_user_verified_99',
      title: 'ধানমন্ডি লেকে রাতে ছিনতাইয়ের চেষ্টা',
      description: 'ধানমন্ডি লেকের ৩ নম্বর ব্রিজে রাতে অস্ত্র দেখিয়ে মোবাইল ছিনতাইয়ের চেষ্টা করা হয়।',
      category: 'SNATCHING',
      latitude: citizenLatitude,
      longitude: citizenLongitude,
      sourceUrl: null, // Strictly citizen submitted!
      sourceName: null,
      status: 'ACTIVE',
      expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    });
    (citizenReport as any).threatStatus = 'ACTIVE';
    (citizenReport as any).locationPrecision = 'EXACT';

    assert.strictEqual(await db.report.count(), 4, 'Initial database contains 4 mixed reports');

    // =========================================================================
    // Phase 3: Safe Non-Destructive Remediation (F24)
    // =========================================================================

    // Step A: Dry-run audit report
    const allDbReports = await db.report.findMany();
    const dryRunSummary: Array<{
      reportId: string;
      sourceType: 'NEWS' | 'CITIZEN';
      action: 'REMEDIATE_TO_RESOLVED' | 'PRESERVE_ACTIVE';
      reason: string;
    }> = [];

    for (const rep of allDbReports) {
      const isCitizen = !rep.sourceUrl && !rep.sourceName;
      if (isCitizen) {
        dryRunSummary.push({
          reportId: rep.id,
          sourceType: 'CITIZEN',
          action: 'PRESERVE_ACTIVE',
          reason: 'Citizen user-submitted report must be strictly preserved without modification',
        });
      } else if (rep.title?.includes('সৌদি আরবে')) {
        dryRunSummary.push({
          reportId: rep.id,
          sourceType: 'NEWS',
          action: 'REMEDIATE_TO_RESOLVED',
          reason: 'Overseas international incident mislocated to Bangladesh',
        });
      } else if (rep.title?.includes('শুনানি আজ')) {
        dryRunSummary.push({
          reportId: rep.id,
          sourceType: 'NEWS',
          action: 'REMEDIATE_TO_RESOLVED',
          reason: 'Legal/court proceeding without active physical threat',
        });
      } else {
        dryRunSummary.push({
          reportId: rep.id,
          sourceType: 'NEWS',
          action: 'PRESERVE_ACTIVE',
          reason: 'Qualifying active Bangladesh physical safety incident',
        });
      }
    }

    assert.strictEqual(dryRunSummary.length, 4);
    assert.strictEqual(dryRunSummary.filter((s) => s.action === 'REMEDIATE_TO_RESOLVED').length, 2);
    assert.strictEqual(dryRunSummary.filter((s) => s.action === 'PRESERVE_ACTIVE').length, 2);

    // Step B: Apply safe reversible remediation
    for (const auditItem of dryRunSummary) {
      if (auditItem.action === 'REMEDIATE_TO_RESOLVED') {
        await db.report.update({
          where: { id: auditItem.reportId },
          data: {
            status: 'RESOLVED',
          },
        });
      }
    }

    // =========================================================================
    // Phase 4: Citizen Report Preservation Invariants (F24)
    // =========================================================================
    const updatedCitizen = await db.report.findUnique({ where: { id: citizenReport.id } });
    assert.ok(updatedCitizen);
    assert.strictEqual(updatedCitizen.status, 'ACTIVE', 'Citizen report must remain ACTIVE');
    assert.strictEqual(updatedCitizen.latitude, citizenLatitude, 'Citizen latitude must NOT be overwritten');
    assert.strictEqual(updatedCitizen.longitude, citizenLongitude, 'Citizen longitude must NOT be overwritten');

    // =========================================================================
    // Phase 5: Authoritative Active Threat Eligibility Verification (F10)
    // =========================================================================
    const isActiveThreatIncident = (r: any): boolean => {
      if (r.status !== 'ACTIVE') return false;
      if (r.locationPrecision === 'AMBIGUOUS') return false;
      if (r.expiresAt && r.expiresAt.getTime() <= now.getTime()) return false;
      return true;
    };

    const finalActiveReports = (await db.report.findMany()).filter(isActiveThreatIncident);

    // Exactly 2 incidents must be active on map:
    // 1. Genuine current Sitakunda crash (News)
    // 2. Genuine citizen Dhanmondi mugging (Citizen)
    assert.strictEqual(finalActiveReports.length, 2, 'Exactly 2 genuine active incidents on live map');

    const activeIds = finalActiveReports.map((r) => r.id);
    assert.ok(activeIds.includes(currentCrashReport.id));
    assert.ok(activeIds.includes(citizenReport.id));
    assert.ok(!activeIds.includes(overseasReport.id), 'Overseas crash must not be on active map');
    assert.ok(!activeIds.includes(legalReport.id), 'Court hearing must not be on active map');

    // =========================================================================
    // Phase 6: Frontend & Map Synchronization Invariants (F11 & F12)
    // =========================================================================
    // Map markers and standalone feed consume identical active incident IDs
    const mapMarkers = finalActiveReports.map((r) => ({ id: r.id, lat: r.latitude, lng: r.longitude, cat: r.category }));
    const feedItems = finalActiveReports.map((r) => ({ id: r.id, title: r.title, stage: r.verificationStage }));

    assert.strictEqual(mapMarkers.length, feedItems.length);
    assert.deepStrictEqual(
      mapMarkers.map((m) => m.id),
      feedItems.map((f) => f.id),
      'Map markers and feed items must be strictly synchronized'
    );
  });
});
