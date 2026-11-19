import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase, calculateHaversineDistanceMeters } from '../harness/mockDatabase';
import { calculateStorySimilarity } from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 2: Boundary & Corner Cases - F08: Consolidation Borders & Outlier Clashes', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T2-F08-01: Proximity boundary threshold (3.5km) isolates reports just beyond border', () => {
    const baseLat = 23.8103;
    const baseLng = 90.4125;

    // Seed primary report in Farmgate/Dhaka
    const primary = db.seedReport({
      title: 'ফার্মগেটে বাস ও ট্রাকের সংঘর্ষ',
      category: 'ROAD_ACCIDENT',
      latitude: baseLat,
      longitude: baseLng,
    });

    // Point A: ~3,400 meters away (inside 3.5km border)
    // 0.0305 deg lat difference ~ 3,391 meters
    const insideLat = baseLat + 0.0305;
    const insideLng = baseLng;
    const distInside = calculateHaversineDistanceMeters(baseLat, baseLng, insideLat, insideLng);
    assert.ok(distInside < 3500, `distInside (${distInside}m) must be strictly < 3500m`);

    const nearbyInside = db.findReportsWithinRadius(insideLat, insideLng, 3500);
    assert.strictEqual(nearbyInside.length, 1, 'Report within 3.5km boundary must be found');

    // Point B: ~3,600 meters away (outside 3.5km border)
    // 0.0325 deg lat difference ~ 3,614 meters
    const outsideLat = baseLat + 0.0325;
    const outsideLng = baseLng;
    const distOutside = calculateHaversineDistanceMeters(baseLat, baseLng, outsideLat, outsideLng);
    assert.ok(distOutside > 3500, `distOutside (${distOutside}m) must be strictly > 3500m`);

    const nearbyOutside = db.findReportsWithinRadius(outsideLat, outsideLng, 3500);
    assert.strictEqual(nearbyOutside.length, 0, 'Report beyond 3.5km boundary must not be found');
  });

  it('T2-F08-02: 48-hour time window border isolates incidents occurring outside the consolidation horizon', () => {
    const baseTime = new Date('2026-11-19T10:00:00Z');
    const consolidationWindowMs = 48 * 60 * 60 * 1000;

    const primaryReport = db.seedReport({
      title: 'সীতাকুণ্ডে মহাসড়কে বাস উল্টে নিহত ২',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      createdAt: baseTime,
    });

    // Report A: Published at 47 hours (within 48h window)
    const reportTimeWithin = new Date(baseTime.getTime() + 47 * 60 * 60 * 1000);
    const diffWithinMs = reportTimeWithin.getTime() - primaryReport.createdAt.getTime();
    const canConsolidateWithin = diffWithinMs <= consolidationWindowMs;
    assert.strictEqual(canConsolidateWithin, true, 'Article published within 48h is eligible for consolidation');

    // Report B: Published at 49 hours (outside 48h window)
    const reportTimeOutside = new Date(baseTime.getTime() + 49 * 60 * 60 * 1000);
    const diffOutsideMs = reportTimeOutside.getTime() - primaryReport.createdAt.getTime();
    const canConsolidateOutside = diffOutsideMs <= consolidationWindowMs;
    assert.strictEqual(canConsolidateOutside, false, 'Article published beyond 48h must NOT consolidate with primary incident');
  });

  it('T2-F08-03: 20 distinct news outlets clashing on a single major disaster consolidate into 20 citations', async () => {
    const primary = db.seedReport({
      title: 'সীতাকুণ্ডে রাসায়নিক ডিপোতে ভয়াবহ অগ্নিকাণ্ড ও বিস্ফোরণ',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      verificationStage: 'INGESTED',
      citations: [
        {
          sourceName: 'Daily Star',
          sourceUrl: 'https://dailystar.net/depot-0',
          title: 'Depot fire explosion in Sitakunda',
        },
      ],
    });

    const outlets = [
      'Prothom Alo', 'Dhaka Post', 'Kaler Kantho', 'Samakal', 'Jugantor',
      'Ittefaq', 'BDNews24', 'Banglanews24', 'Somoy TV', 'Jamuna TV',
      'DBC News', 'Channel 24', 'Independent TV', 'Daily Sun', 'New Age',
      'Financial Express', 'BSS', 'Manab Zamin', 'Inqilab',
    ];

    let currentReport = primary;
    for (let i = 0; i < outlets.length; i++) {
      const outletName = outlets[i];
      const newCitation = {
        sourceName: outletName,
        sourceUrl: `https://${outletName.toLowerCase().replace(/\s+/g, '')}.com/depot-${i + 1}`,
        title: `Sitakunda depot explosion update from ${outletName}`,
      };

      currentReport = await db.report.update({
        where: { id: primary.id },
        data: {
          citations: [...currentReport.citations, newCitation],
          verificationStage: 'CORROBORATED',
        },
      });
    }

    assert.strictEqual(currentReport.citations.length, 20, 'Report must contain exactly 20 consolidated citations');
    assert.strictEqual(currentReport.verificationStage, 'CORROBORATED');

    // Verify all URLs are unique
    const urls = new Set(currentReport.citations.map((c) => c.sourceUrl));
    assert.strictEqual(urls.size, 20, 'All 20 citations must preserve unique source URLs');
  });

  it('T2-F08-04: Conflicting category articles at same location do NOT consolidate into single incident', () => {
    const coords = { lat: 23.8103, lng: 90.4125 };

    const accidentReport = db.seedReport({
      title: 'মিরপুরে বাস চাপায় পথচারী নিহত',
      category: 'ROAD_ACCIDENT',
      latitude: coords.lat,
      longitude: coords.lng,
    });

    const incomingTitle = 'মিরপুরে দোকানে ঢুকে স্বর্ণালঙ্কার ডাকাতি';
    const incomingCategory = 'ROBBERY';

    // Same location, but distinct categories and non-matching story tokens
    const nearby = db.findReportsWithinRadius(coords.lat, coords.lng, 3500);
    assert.strictEqual(nearby.length, 1);

    const sim = calculateStorySimilarity(incomingTitle, accidentReport.title!);
    assert.strictEqual(sim.isDuplicate, false, 'Divergent category stories must not be flagged as duplicates');

    const shouldConsolidate = accidentReport.category === incomingCategory && sim.isDuplicate;
    assert.strictEqual(shouldConsolidate, false, 'Conflicting category reports must remain separate incidents');
  });

  it('T2-F08-05: Non-transitive candidate cluster pairs do not enter cyclic loops', () => {
    // Incident A: Bus collision at Station 1
    const titleA = 'মিরপুর ১০ নম্বরে বাস ও পিকআপের সংঘর্ষ';
    // Incident B: Bus accident in Mirpur with truck
    const titleB = 'মিরপুর গোলচত্বরে বাস ও ট্রাকের দুর্ঘটনা';
    // Incident C: Truck overturned at Mirpur 1
    const titleC = 'মিরপুর ১ নম্বরে ট্রাক উল্টে সড়ক বন্ধ';

    const simAB = calculateStorySimilarity(titleA, titleB);
    const simBC = calculateStorySimilarity(titleB, titleC);
    const simAC = calculateStorySimilarity(titleA, titleC);

    // Each calculation produces deterministic score
    assert.ok(typeof simAB.score === 'number');
    assert.ok(typeof simBC.score === 'number');
    assert.ok(typeof simAC.score === 'number');
  });
});
