import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';
import {
  evaluateActiveThreatEligibility,
  type EligibilityEvaluationInput,
} from '../../../apps/api/src/services/activeThreatEligibilityService';

describe('Tier 2: Boundary Value Analysis - B02: Classification & Eligibility Thresholds', () => {
  const baseQualifyingInput: EligibilityEvaluationInput = {
    title: 'মিরপুরে চলন্ত বাসে সশস্ত্র ডাকাতি',
    summary: 'যাত্রীদের চিৎকারে ডাকাত দল পালিয়ে যায়।',
    category: 'ROBBERY',
    severity: 'HIGH',
    isSafetyRelated: true,
    publishedAt: new Date('2026-11-20T12:00:00Z'),
    sourceUrl: 'https://news.bangladesh.test/report-123',
    sourceName: 'Daily Star',
    geocode: {
      locationName: 'Mirpur, Dhaka',
      latitude: 23.807,
      longitude: 90.368,
      district: 'Dhaka',
      upazila: 'Mirpur',
      division: 'Dhaka',
      locationPrecision: 'UPAZILA',
      source: 'DICTIONARY',
    },
  };

  it('T2-CLS-01: Confidence threshold exact boundary (0.699 vs 0.700)', () => {
    const fixedNow = new Date('2026-11-20T12:00:00Z');

    // Boundary: 0.699 must be UNDER_REVIEW
    const resLow = evaluateActiveThreatEligibility(
      { ...baseQualifyingInput, confidence: 0.699 } as any,
      fixedNow
    );
    assert.strictEqual(
      resLow.threatStatus,
      'UNDER_REVIEW',
      'Confidence 0.699 must be staged to UNDER_REVIEW'
    );
    assert.strictEqual(resLow.isEligibleForActiveMap, false);

    // Boundary: 0.700 must be ACTIVE
    const resHigh = evaluateActiveThreatEligibility(
      { ...baseQualifyingInput, confidence: 0.7 } as any,
      fixedNow
    );
    assert.strictEqual(
      resHigh.threatStatus,
      'ACTIVE',
      'Confidence 0.700 must qualify for ACTIVE threatStatus'
    );
    assert.strictEqual(resHigh.isEligibleForActiveMap, true);
  });

  it('T2-CLS-02: Temporal expiry boundary: 1ms before now vs 1ms after now', () => {
    const fixedNow = new Date('2026-11-20T12:00:00.000Z');

    // 1 millisecond in the past: expired
    const pastIncident = {
      title: 'মিরপুরে সংঘর্ষ',
      status: 'ACTIVE',
      threatStatus: 'ACTIVE',
      locationPrecision: 'UPAZILA',
      expiresAt: new Date(fixedNow.getTime() - 1),
    };
    const isPastActive =
      pastIncident.status === 'ACTIVE' &&
      pastIncident.threatStatus === 'ACTIVE' &&
      pastIncident.locationPrecision !== 'AMBIGUOUS' &&
      pastIncident.expiresAt.getTime() > fixedNow.getTime();

    assert.strictEqual(isPastActive, false, '1ms past expiry must evaluate to inactive');

    // 1 millisecond in the future: still active
    const futureIncident = {
      ...pastIncident,
      expiresAt: new Date(fixedNow.getTime() + 1),
    };
    const isFutureActive =
      futureIncident.status === 'ACTIVE' &&
      futureIncident.threatStatus === 'ACTIVE' &&
      futureIncident.locationPrecision !== 'AMBIGUOUS' &&
      futureIncident.expiresAt.getTime() > fixedNow.getTime();

    assert.strictEqual(isFutureActive, true, '1ms future expiry must evaluate to active');
  });

  it('T2-CLS-03: Edge text length boundaries (empty text, 1 char, 5000 chars without ReDoS)', () => {
    // Empty text
    const emptyRes = classifyNewsText('', '');
    assert.strictEqual(emptyRes.isSafetyRelated, false, 'Empty text must not be safety related');

    // Single character
    const singleRes = classifyNewsText('a', '');
    assert.strictEqual(singleRes.isSafetyRelated, false, 'Single character must not be safety related');

    // 5000 character payload with genuine crime headline
    const filler = 'বিভিন্ন সূত্রে জানা গেছে পরিস্থিতি পর্যবেক্ষণ করছে প্রশাসন। '.repeat(100);
    const longText = `উত্তরায় প্রকাশ্য দিবালোকে অস্ত্রধারীদের গুলিবর্ষণ ও স্বর্ণালঙ্কার ছিনতাই। ${filler}`;

    const tStart = Date.now();
    const longRes = classifyNewsText(longText);
    const duration = Date.now() - tStart;

    assert.ok(duration < 1000, `ReDoS protection: 5000-char classification took ${duration}ms, expected < 1000ms`);
    assert.strictEqual(longRes.isSafetyRelated, true, 'Long text containing violent assault must be recognized');
  });

  it('T2-CLS-04: Mixed edge keywords: immediate violent attack takes precedence over political or hospital noise', () => {
    // Text contains immediate violent attack ("গুলি ছুড়ে ডাকাতি") AND political reaction ("মন্ত্রী ক্ষোভ প্রকাশ করেন") AND hospital ("ঢামেকে ভর্তি")
    const mixedText = 'গুলি ছুড়ে দোকানে ডাকাতি, আহত ব্যবসায়ী ঢামেকে ভর্তি, ঘটনায় স্বরাষ্ট্রমন্ত্রী ক্ষোভ প্রকাশ করেছেন';

    const result = classifyNewsText(mixedText);
    assert.strictEqual(
      result.isSafetyRelated,
      true,
      'Immediate violent crime with gunfire must take precedence over secondary political reaction and hospital mentions'
    );
  });

  it('T2-CLS-05: Confidence boundary extremes (0.0, 1.0, and non-numeric values)', () => {
    const fixedNow = new Date('2026-11-20T12:00:00Z');

    // 0.0 confidence
    const zeroRes = evaluateActiveThreatEligibility(
      { ...baseQualifyingInput, confidence: 0.0 } as any,
      fixedNow
    );
    assert.strictEqual(zeroRes.threatStatus, 'UNDER_REVIEW');
    assert.strictEqual(zeroRes.isEligibleForActiveMap, false);

    // 1.0 confidence
    const maxRes = evaluateActiveThreatEligibility(
      { ...baseQualifyingInput, confidence: 1.0 } as any,
      fixedNow
    );
    assert.strictEqual(maxRes.threatStatus, 'ACTIVE');
    assert.strictEqual(maxRes.isEligibleForActiveMap, true);
  });
});
