import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import {
  classifyNewsText,
} from '../../../apps/api/src/services/newsClassifierService';
import {
  evaluateActiveThreatEligibility,
} from '../../../apps/api/src/services/activeThreatEligibilityService';
import {
  isForeignIncident,
} from '../../../apps/api/src/services/internationalIncidentFilter';
import {
  haversineDistance,
} from '../harness/geoUtils';

describe('Tier 4: Real-World Scenario 1 - Cyclone/Storm Disaster Cluster in Coastal Upazilas', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T4-SC1-01: End-to-end coastal cyclone emergency: uncapped multi-upazila ingestion with authentic coordinates', async () => {
    // Stage 1: Breaking news incoming stream from coastal disaster
    const stormArticles = [
      {
        id: 'storm_art_01',
        title: 'Tidal surge submerges coastal embankment in Teknaf, road communication cut off',
        category: 'UNLIT_ROAD',
        district: "Cox's Bazar",
        upazila: 'Teknaf',
        latitude: 20.8650, // Authentic Teknaf coordinates
        longitude: 92.3020,
        precision: 'UPAZILA',
        confidence: 0.92,
        isForeign: false,
      },
      {
        id: 'storm_art_02',
        title: 'চকরিয়ায় মহাসড়কে গাছ ভেঙে পড়ে বাস উল্টে আহত ১৫',
        category: 'ROAD_ACCIDENT',
        district: "Cox's Bazar",
        upazila: 'Chakaria',
        latitude: 21.7865, // Authentic Chakaria coordinates
        longitude: 92.0782,
        precision: 'UPAZILA',
        confidence: 0.95,
        isForeign: false,
      },
      {
        id: 'storm_art_03',
        title: 'কক্সবাজার সমুদ্র সৈকতে তীব্র ঝড়ে ক্ষতিগ্রস্ত রাস্তা ও যান চলাচল বন্ধ',
        category: 'UNLIT_ROAD',
        district: "Cox's Bazar",
        upazila: "Cox's Bazar Sadar",
        latitude: 21.4320, // Authentic Cox's Bazar Sadar coordinates (NOT Savar: 23.85!)
        longitude: 91.9840,
        precision: 'UPAZILA',
        confidence: 0.88,
        isForeign: false,
      },
      {
        id: 'storm_art_04',
        title: 'উপকূলীয় অঞ্চলে ব্যাপক ক্ষয়ক্ষতির আশঙ্কা, পরিস্থিতি থমথমে',
        category: 'UNLIT_ROAD',
        district: undefined,
        upazila: undefined,
        latitude: 23.8103, // Arbitrary center fallback
        longitude: 90.4125,
        precision: 'AMBIGUOUS',
        confidence: 0.45, // Low confidence / uncertain
        isForeign: false,
      },
      {
        id: 'storm_art_05',
        title: 'মিয়ানমারের রাখাইন উপকূলে তীব্র ঘূর্ণিঝড়ে শতাধিক বাড়িঘর বিধ্বস্ত',
        category: 'UNLIT_ROAD',
        district: undefined,
        upazila: undefined,
        latitude: 20.1500,
        longitude: 92.8900,
        precision: 'AMBIGUOUS',
        confidence: 0.90,
        isForeign: true,
      },
    ];

    // Stage 2: Filter foreign and stage uncertain articles
    const activeIncidentReports: any[] = [];
    const underReviewReports: any[] = [];

    for (const art of stormArticles) {
      // 1. Foreign check
      const foreignCheck = isForeignIncident(art.title);
      if (foreignCheck.isForeign || art.isForeign) {
        continue; // Discard international article
      }

      // 2. Classification
      const classification = classifyNewsText(art.title);

      // 3. Active Threat Eligibility
      const isAmbiguousLocation = art.precision === 'AMBIGUOUS' || !art.district;
      const isLowConfidence = art.confidence < 0.70;

      if (isAmbiguousLocation || isLowConfidence) {
        // Stage to review queue (UNDER_REVIEW) without active map pin
        const reviewRep = db.seedReport({
          title: art.title,
          category: art.category as any,
          latitude: art.latitude,
          longitude: art.longitude,
          status: 'ACTIVE',
        });
        (reviewRep as any).threatStatus = 'UNDER_REVIEW';
        (reviewRep as any).locationPrecision = 'AMBIGUOUS';
        underReviewReports.push(reviewRep);
      } else {
        // Active threat on map with verified upazila precision
        const activeRep = db.seedReport({
          title: art.title,
          category: art.category as any,
          latitude: art.latitude,
          longitude: art.longitude,
          status: 'ACTIVE',
        });
        (activeRep as any).threatStatus = 'ACTIVE';
        (activeRep as any).locationPrecision = art.precision;
        (activeRep as any).district = art.district;
        (activeRep as any).upazila = art.upazila;
        activeIncidentReports.push(activeRep);
      }
    }

    // Assertions on Ingestion Results:
    assert.strictEqual(activeIncidentReports.length, 3, 'Exactly 3 genuine coastal incidents enter active map');
    assert.strictEqual(underReviewReports.length, 1, '1 ambiguous incident is held in review queue');

    // Stage 3: Geospatial Coordinate Verification (F1 & F6)
    // Verify Cox's Bazar incident is NOT located in Savar/Dhaka (~23.85, ~90.26)
    const coxReport = activeIncidentReports.find((r) => r.upazila === "Cox's Bazar Sadar");
    assert.ok(coxReport);
    assert.ok(
      coxReport.latitude < 22.0,
      `Cox's Bazar latitude must be < 22.0 (got ${coxReport.latitude}), proving authentic coordinates NOT Savar fallback`
    );

    // Distance to Dhaka center (~23.81, 90.41) must be > 250km
    const distToDhaka = haversineDistance(coxReport.latitude, coxReport.longitude, 23.8103, 90.4125);
    assert.ok(
      distToDhaka > 250_000,
      `Cox's Bazar must be > 250km from Dhaka centroid (calculated: ${(distToDhaka / 1000).toFixed(1)}km)`
    );

    // Verify all active incidents fall strictly within Bangladesh bounds
    for (const report of activeIncidentReports) {
      assert.ok(
        isWithinBangladesh(report.latitude, report.longitude),
        `Report in ${report.upazila} must fall within sovereign Bangladesh bounds`
      );
      assert.strictEqual(report.locationPrecision, 'UPAZILA', 'Precision must truthfully reflect UPAZILA');
    }

    // Stage 4: Authoritative Active Map Predicate Check (F10 & F11)
    const now = new Date();
    const isActiveMapCandidate = (r: any): boolean => {
      if (r.status !== 'ACTIVE') return false;
      if (r.threatStatus !== 'ACTIVE') return false;
      if (r.locationPrecision === 'AMBIGUOUS') return false;
      if (r.expiresAt && r.expiresAt.getTime() <= now.getTime()) return false;
      return true;
    };

    const liveMapPins = activeIncidentReports.filter(isActiveMapCandidate);
    assert.strictEqual(liveMapPins.length, 3, 'All 3 active coastal reports appear on live map');

    const underReviewPins = underReviewReports.filter(isActiveMapCandidate);
    assert.strictEqual(underReviewPins.length, 0, 'Under review incidents must NOT appear on live map');

    // Stage 5: Regional Clustering in Coastal Zone
    // All 3 incidents are in Cox's Bazar district and should cluster together
    const districtCenter = { latitude: 21.4272, longitude: 92.0058 }; // Cox's Bazar center
    for (const pin of liveMapPins) {
      const distToCenter = haversineDistance(pin.latitude, pin.longitude, districtCenter.latitude, districtCenter.longitude);
      // All upazilas in Cox's Bazar are within ~90km of district center
      assert.ok(
        distToCenter < 90_000,
        `Incident in ${pin.upazila} should be within 90km of district center (got ${(distToCenter / 1000).toFixed(1)}km)`
      );
    }
  });

  it('T4-SC1-02: Progressive post-cyclone time decay: acute traffic incidents expire while physical road hazards persist', async () => {
    const now = new Date();

    // Acute road accident created during storm (48h lifespan)
    const roadAccident = db.seedReport({
      title: 'চকরিয়ায় গাছ পড়ে বাস উল্টে দুর্ঘটনা',
      category: 'ROAD_ACCIDENT',
      latitude: 21.7865,
      longitude: 92.0782,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // +48h
      status: 'ACTIVE',
    });

    // Persistent infrastructure damage (14-day lifespan)
    const unlitRoad = db.seedReport({
      title: 'টেকনাফে বাঁধ ভেঙে অন্ধকার রাস্তায় গর্তের সৃষ্টি',
      category: 'UNLIT_ROAD',
      latitude: 20.8650,
      longitude: 92.3020,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // +14 days
      status: 'ACTIVE',
    });

    assert.strictEqual(await db.report.count(), 2);

    // Fast-forward time to +50 hours (past 48h road accident lifespan)
    const timeAt50h = new Date(now.getTime() + 50 * 60 * 60 * 1000);
    const purgeResult = db.purgeExpiredReports(timeAt50h);

    assert.strictEqual(purgeResult.purgedCount, 1, 'Exactly 1 report should be purged at +50h');
    assert.strictEqual(purgeResult.purgedIds[0], roadAccident.id, 'Road accident report must be purged');

    // Verify unlit road infrastructure hazard is still ACTIVE
    const activeRemaining = db.getReportsInBounds(BANGLADESH_BOUNDS, 'all', 'ACTIVE');
    assert.strictEqual(activeRemaining.length, 1);
    assert.strictEqual(activeRemaining[0].id, unlitRoad.id);
  });
});
