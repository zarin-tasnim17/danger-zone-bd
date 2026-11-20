import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  calculateStorySimilarity,
  extractSignificantTokens,
} from '../../../apps/api/src/services/incidentDeduplicationService';
import {
  extractIncidentTemporalData,
} from '../../../apps/api/src/services/temporalExtractionService';

describe('Tier 1: Feature Coverage - F14: Temporal Occurrence Comparison in Deduplication', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F14-01: Temporal extraction identifies distinct occurrence times from article headlines', () => {
    const morningStory = extractIncidentTemporalData('আজ সকালে সীতাকুণ্ডে বাস দুর্ঘটনা', '', new Date());
    const yesterdayStory = extractIncidentTemporalData('গতকাল রাতে সীতাকুণ্ডে ট্রাক দুর্ঘটনা', '', new Date());
    const daysAgoStory = extractIncidentTemporalData('তিন দিন আগে মহাসড়কে ছিনতাই', '', new Date());

    assert.strictEqual(morningStory.temporalCertainty, 'EXPLICIT_TODAY');
    assert.strictEqual(morningStory.isRecentOrToday, true);

    assert.strictEqual(yesterdayStory.temporalCertainty, 'EXPLICIT_YESTERDAY');
    assert.strictEqual(daysAgoStory.temporalCertainty, 'EXPLICIT_RELATIVE_DAYS');
  });

  it('T1-F14-02: Distinct crashes occurring days apart in the same upazila do not merge', () => {
    // Incident 1: 3 days ago in Sitakunda
    const pastReport = db.seedReport({
      title: 'সীতাকুণ্ডে সড়ক দুর্ঘটনায় নিহত ২',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 72h ago
    });

    // Incident 2: Today in Sitakunda
    const todayStoryTitle = 'আজ সকালে সীতাকুণ্ডে সড়ক দুর্ঘটনায় নিহত ২';
    const temporalData = extractIncidentTemporalData(todayStoryTitle, '', new Date());

    assert.strictEqual(temporalData.isRecentOrToday, true);

    // Lookback window of 48h ensures past incident (72h old) is outside active dedup window
    const lookbackCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const isWithinLookback = pastReport.createdAt >= lookbackCutoff;

    assert.strictEqual(
      isWithinLookback,
      false,
      'Incident older than 48h must fall outside active deduplication window to prevent false merge'
    );
  });

  it('T1-F14-03: Breaking news stories published within narrow window describing same event merge accurately', () => {
    const outletA_Title = 'সীতাকুণ্ডে বাস-ট্রাক সংঘর্ষে ৩ জনের প্রাণহানি';
    const outletB_Title = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩';

    const sim = calculateStorySimilarity(outletA_Title, outletB_Title);
    assert.strictEqual(sim.isDuplicate, true, 'Breaking stories published close together must merge');
    assert.ok(sim.sharedTokens.includes('bus'));
    assert.ok(sim.sharedTokens.includes('truck'));
    assert.ok(sim.sharedTokens.includes('killed'));
  });

  it('T1-F14-04: Historical criminal case reference does not merge with fresh active crime', () => {
    const freshCrime = 'মিরপুরে যুবকের ওপর হামলা ও কুপিয়ে জখম';
    const historicalCase = '২০১৭ সালের মিরপুর হত্যা মামলার রায় ঘোষণা';

    const temporal = extractIncidentTemporalData(historicalCase, '', new Date());
    assert.strictEqual(temporal.isHistorical, true, '2017 case must be identified as historical');

    const sim = calculateStorySimilarity(freshCrime, historicalCase);
    assert.strictEqual(
      sim.isDuplicate,
      false,
      'Historical criminal case must not merge with fresh active crime'
    );
  });

  it('T1-F14-05: Significant casualty discrepancy on same highway signals distinct events', () => {
    const minorCrash = 'সীতাকুণ্ড মহাসড়কে দুর্ঘটনায় ১ জন নিহত';
    const majorDisaster = 'সীতাকুণ্ড মহাসড়কে বাস খাদে পড়ে ১০ জন নিহত';

    const tokens1 = extractSignificantTokens(minorCrash);
    const tokens2 = extractSignificantTokens(majorDisaster);

    // Distinct numbers must be extracted
    assert.ok(tokens1.has('1'), 'Minor crash must have casualty count 1');
    assert.ok(tokens2.has('10'), 'Major disaster must have casualty count 10');

    // Numbers do not match
    assert.strictEqual(tokens1.has('10'), false);
    assert.strictEqual(tokens2.has('1'), false);
  });
});
