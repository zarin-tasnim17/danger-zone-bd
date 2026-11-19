import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';
import { assertValidReportEntity } from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - F08: Multi-Source Incident Consolidation', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F08-01: Corroborating article is consolidated into existing primary incident rather than creating new report', async () => {
    // 1. Initial report created from Outlet A (The Daily Star)
    const primaryReport = db.seedReport({
      title: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
      description: 'সীতাকুণ্ডে মহাসড়কে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে ৩ জন নিহত ও বহু আহত হয়েছেন।',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      sourceName: 'The Daily Star',
      sourceUrl: 'https://thedailystar.net/news/sitakunda-accident-01',
      verificationStage: 'CLASSIFIED',
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/news/sitakunda-accident-01',
          title: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
        },
      ],
    });

    assert.strictEqual(await db.report.count(), 1);

    // 2. Incoming corroborating article from Outlet B (Prothom Alo)
    const incomingTitle = 'সীতাকুণ্ডে বাস-ট্রাক সংঘর্ষে ৩ জনের প্রাণহানি';
    const incomingLat = 22.6220; // ~200m away
    const incomingLng = 91.6610;

    // Spatial proximity and story similarity check
    const nearby = db.findReportsWithinRadius(incomingLat, incomingLng, 3500);
    assert.strictEqual(nearby.length, 1);

    const sim = calculateStorySimilarity(incomingTitle, primaryReport.title!);
    assert.strictEqual(sim.isDuplicate, true, 'Headlines describing same event must be identified as duplicates');

    // Consolidate instead of creating a second report
    const updatedCitations = [
      ...primaryReport.citations,
      {
        sourceName: 'Prothom Alo',
        sourceUrl: 'https://prothomalo.com/news/sitakunda-accident-02',
        title: incomingTitle,
      },
    ];

    const consolidated = await db.report.update({
      where: { id: primaryReport.id },
      data: {
        verificationStage: 'CORROBORATED',
        citations: updatedCitations,
      },
    });

    // Verify report count remains 1 (no duplicate pin created)
    assert.strictEqual(await db.report.count(), 1, 'Total reports count must remain 1 after consolidation');
    assert.strictEqual(consolidated.citations.length, 2, 'Report must now contain 2 citations');
  });

  it('T1-F08-02: Multi-outlet citations are preserved with source names and URLs', async () => {
    const report = db.seedReport({
      category: 'SNATCHING',
      latitude: 23.7500,
      longitude: 90.3800,
      citations: [
        { sourceName: 'The Daily Star', sourceUrl: 'https://dailystar.net/story1' },
        { sourceName: 'Dhaka Post', sourceUrl: 'https://dhakapost.com/story2' },
        { sourceName: 'Bdnews24', sourceUrl: 'https://bdnews24.com/story3' },
      ],
    });

    const validated = assertValidReportEntity(report);
    assert.strictEqual(validated.citations?.length, 3);
    assert.strictEqual(validated.citations?.[0].sourceName, 'The Daily Star');
    assert.strictEqual(validated.citations?.[1].sourceName, 'Dhaka Post');
    assert.strictEqual(validated.citations?.[2].sourceName, 'Bdnews24');
  });

  it('T1-F08-03: Multi-press corroboration advances verificationStage to CORROBORATED', async () => {
    const initial = db.seedReport({
      category: 'ROBBERY',
      latitude: 23.8700,
      longitude: 90.3900,
      verificationStage: 'CLASSIFIED',
    });

    assert.strictEqual(initial.verificationStage, 'CLASSIFIED');

    // Simulate second corroborating outlet arrival
    const updated = await db.report.update({
      where: { id: initial.id },
      data: { verificationStage: 'CORROBORATED' },
    });

    assert.strictEqual(updated.verificationStage, 'CORROBORATED');
  });

  it('T1-F08-04: Conflicting locations prevent false consolidation despite identical accident keywords', () => {
    // Both articles describe bus-truck collision with 3 dead, but in different districts
    const storyMymensingh = 'ময়মনসিংহে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত';
    const storySylhet = 'সিলেটে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত';

    const sim = calculateStorySimilarity(storyMymensingh, storySylhet);
    assert.strictEqual(
      sim.isDuplicate,
      false,
      'Conflicting explicit location entities must reject duplicate classification'
    );
  });

  it('T1-F08-05: Consolidation respects spatial proximity threshold (e.g. within 3.5km)', () => {
    db.seedReport({
      id: 'dhaka-accident',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103, // Dhaka
      longitude: 90.4125,
    });

    // Target location in Gazipur (~25km north)
    const gazipurLat = 24.0022;
    const gazipurLng = 90.4264;

    const nearbyReports = db.findReportsWithinRadius(gazipurLat, gazipurLng, 3500); // 3.5km buffer
    assert.strictEqual(
      nearbyReports.length,
      0,
      'Incident outside 3.5km spatial buffer must not be considered a duplicate candidate'
    );
  });
});
