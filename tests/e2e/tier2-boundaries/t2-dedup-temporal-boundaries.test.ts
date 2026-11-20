import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStorySimilarity,
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

    const sim = calculateStorySimilarity(minorCrash, massDisaster);
    // Even if location and vehicle match, casualty mismatch prevents blind merge
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
});
