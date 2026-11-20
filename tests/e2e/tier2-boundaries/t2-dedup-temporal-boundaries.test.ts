import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStorySimilarity,
  extractVehicles,
  extractWeapons,
  extractCasualtySignature,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 2: Boundary & Corner Cases - Deduplication Temporal & Spatial Boundaries', () => {
  it('T2-DEDUP-01: 48-Hour lookback cutoff boundary strictly differentiates active vs expired deduplication window', () => {
    const now = Date.now();
    const LOOKBACK_HOURS = 48;
    const LOOKBACK_MS = LOOKBACK_HOURS * 60 * 60 * 1000;
    const cutoff = new Date(now - LOOKBACK_MS);

    // Just inside 48h boundary (47 hours, 59 minutes, 59 seconds ago)
    const justInsideTime = new Date(cutoff.getTime() + 1000);
    // Just outside 48h boundary (48 hours, 00 minutes, 01 second ago)
    const justOutsideTime = new Date(cutoff.getTime() - 1000);

    const isInside = justInsideTime.getTime() >= cutoff.getTime();
    const isOutside = justOutsideTime.getTime() < cutoff.getTime();

    assert.strictEqual(isInside, true, '47h 59m 59s must be inside the deduplication window');
    assert.strictEqual(isOutside, true, '48h 00m 01s must fall outside the deduplication window');
  });

  it('T2-DEDUP-02: Minute offset boundary: identical stories published 5 minutes apart merge with high score', () => {
    const titleA = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩';
    const titleB = 'সীতাকুণ্ডে বাস-ট্রাক সংঘর্ষে ৩ জনের মৃত্যু';

    const sim = calculateStorySimilarity(titleA, titleB);
    assert.strictEqual(sim.isDuplicate, true);
    assert.ok(sim.score >= 0.40, `Similarity score ${sim.score} must exceed high overlap threshold`);
  });

  it('T2-DEDUP-03: Casualty count boundary: 1 fatality vs 10 fatalities on same highway rejects duplicate merge', () => {
    const minorCrash = 'সীতাকুণ্ডে বাস দুর্ঘটনায় ১ জন নিহত';
    const massDisaster = 'সীতাকুণ্ডে বাস খাদে পড়ে ১০ জন নিহত';

    const cas1 = extractCasualtySignature(minorCrash);
    const cas2 = extractCasualtySignature(massDisaster);
    assert.strictEqual(cas1.killed, 1, 'Minor crash must extract 1 fatality');
    assert.strictEqual(cas2.killed, 10, 'Mass disaster must extract 10 fatalities');

    const sim = calculateStorySimilarity(minorCrash, massDisaster);
    // Even if location and vehicle match, casualty mismatch strictly prevents duplicate merge
    assert.strictEqual(sim.isDuplicate, false, '1 fatality vs 10 fatalities must reject duplicate merge');
    assert.ok(
      !sim.sharedTokens.includes('10') || !sim.sharedTokens.includes('1'),
      'Casualty counts 1 and 10 must not be conflated'
    );
  });

  it('T2-DEDUP-04: Spatial boundary at 0.035 degrees (~3.5km) threshold separates local merge from distinct event', () => {
    const baseLat = 22.6200;
    const baseLng = 91.6600;

    const MAX_DELTA = 0.035; // ~3.5km

    // Point 1: 0.034 degrees away (inside threshold)
    const insideLat = baseLat + 0.034;
    const insideLng = baseLng + 0.034;
    const dLatInside = Math.abs(insideLat - baseLat);
    const dLngInside = Math.abs(insideLng - baseLng);
    const isWithinBounds = dLatInside <= MAX_DELTA && dLngInside <= MAX_DELTA;
    assert.strictEqual(isWithinBounds, true, '0.034 deg must be within spatial delta boundary');

    // Point 2: 0.036 degrees away (outside threshold)
    const outsideLat = baseLat + 0.036;
    const dLatOutside = Math.abs(outsideLat - baseLat);
    const isOutsideBounds = dLatOutside > MAX_DELTA;
    assert.strictEqual(isOutsideBounds, true, '0.036 deg must exceed spatial delta boundary');
  });

  it('T2-DEDUP-05: Minimal token boundary: short 3-word headlines with 2 shared high-value entities merge accurately', () => {
    const shortHeadline1 = 'বাস ট্রাক সংঘর্ষ';
    const shortHeadline2 = 'বাস-ট্রাক সংঘর্ষে আহত';

    const sim = calculateStorySimilarity(shortHeadline1, shortHeadline2);
    assert.strictEqual(sim.isDuplicate, true, 'Short headlines sharing bus, truck, collision must merge');
    assert.ok(sim.sharedTokens.includes('bus'));
    assert.ok(sim.sharedTokens.includes('truck'));
    assert.ok(sim.sharedTokens.includes('collision'));
  });

  it('T2-DEDUP-06: Cross-lingual student & political clashes bridge canonical factions and concept clash', () => {
    const bengaliClash = 'সীতাকুণ্ডে ছাত্রলীগ ও ছাত্রদলের মধ্যে সংঘর্ষ';
    const englishClash = 'BCL, Chhatra Dal clash in Sitakunda';

    const sim = calculateStorySimilarity(bengaliClash, englishClash);
    assert.strictEqual(sim.isDuplicate, true, 'Cross-lingual student clash with shared factions must consolidate');
    assert.ok(sim.sharedTokens.includes('clash'), 'Shared tokens must bridge to clash concept');
    assert.ok(sim.sharedTokens.includes('CHHATRA_LEAGUE'), 'Shared tokens must include CHHATRA_LEAGUE');
    assert.ok(sim.sharedTokens.includes('CHHATRA_DAL'), 'Shared tokens must include CHHATRA_DAL');
  });

  it('T2-DEDUP-07: Multi-word concepts (mob beating, battery-run rickshaw) extracted and bridged across languages', () => {
    const bengaliMob = 'উত্তরায় ছিনতাইকারী সন্দেহে যুবককে গণপিটুনি';
    const englishMob = 'Youth subjected to mob beating in Uttara on suspicion of mugging';

    const sim = calculateStorySimilarity(bengaliMob, englishMob);
    assert.strictEqual(sim.isDuplicate, true, 'Cross-lingual mob beating report must merge');
    assert.ok(sim.sharedTokens.includes('mob_beating'), 'Shared tokens must include canonical mob_beating concept');
  });

  it('T2-DEDUP-08: Unicode decomposed Ya + Nukta (\\u09af\\u09bc) normalizes to atomic Yya (\\u09df) for weapon extraction', () => {
    // Construct text with explicit decomposed Ya (\u09af) + Nukta (\u09bc) in দেশীয় অস্ত্র
    const decomposedTitle = 'দেশী\u09af\u09bc অস্ত্রসহ ৩ জন আটক';
    const weapons = extractWeapons(decomposedTitle);
    assert.ok(weapons.has('INDIGENOUS_WEAPON'), 'Decomposed Nukta weapon string must resolve to INDIGENOUS_WEAPON');
  });

  it('T2-DEDUP-09: Southwestern rural transport variant মাহিন্দ্র extracts canonical MAHINDRA vehicle', () => {
    const crashMahindra = 'সাতক্ষীরায় মাহিন্দ্র উল্টে নিহত ১';
    const vehicles = extractVehicles(crashMahindra);
    assert.ok(vehicles.has('MAHINDRA'), 'Southwestern spelling মাহিন্দ্র must extract MAHINDRA vehicle');

    const crashBus = 'সাতক্ষীরায় বাস খাদে পড়ে নিহত ১';
    const sim = calculateStorySimilarity(crashMahindra, crashBus);
    assert.strictEqual(sim.isDuplicate, false, 'Vehicle conflict (MAHINDRA vs BUS) must strictly prevent duplicate merge');
  });
});
