import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateActiveThreatEligibility,
  type EligibilityEvaluationInput,
} from '../../../apps/api/src/services/activeThreatEligibilityService';

describe('Tier 1: Feature Coverage - F09: Classification Uncertainty Staging', () => {
  const baseQualifyingInput: EligibilityEvaluationInput = {
    title: 'মিরপুরে চলন্ত বাসে ডাকাতির চেষ্টা',
    summary: 'যাত্রীদের চিৎকারে চালক বাস থামিয়ে দিলে ডাকাতরা পালিয়ে যায়।',
    category: 'ROBBERY',
    severity: 'HIGH',
    isSafetyRelated: true,
    publishedAt: new Date(),
    sourceUrl: 'https://news.bangladesh.test/report-robbery-101',
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

  it('T1-F09-01: Low classification confidence (< 0.70) stages candidate to threatStatus: UNDER_REVIEW', () => {
    const lowConfidenceScores = [0.45, 0.60, 0.68, 0.699];

    for (const score of lowConfidenceScores) {
      const input: any = {
        ...baseQualifyingInput,
        confidence: score,
      };

      const result = evaluateActiveThreatEligibility(input);
      assert.strictEqual(
        result.threatStatus,
        'UNDER_REVIEW',
        `Score ${score} (<0.70) must result in threatStatus: 'UNDER_REVIEW', got: '${result.threatStatus}'`
      );
      assert.strictEqual(
        result.isEligibleForActiveMap,
        false,
        `Score ${score} must NOT be eligible for active map`
      );
    }
  });

  it('T1-F09-02: Qualifying incident with confidence >= 0.70 is granted threatStatus: ACTIVE', () => {
    const highConfidenceScores = [0.70, 0.75, 0.88, 0.95];

    for (const score of highConfidenceScores) {
      const input: any = {
        ...baseQualifyingInput,
        confidence: score,
      };

      const result = evaluateActiveThreatEligibility(input);
      assert.strictEqual(
        result.threatStatus,
        'ACTIVE',
        `Score ${score} (>=0.70) should qualify for threatStatus: 'ACTIVE', got: '${result.threatStatus}'`
      );
      assert.strictEqual(
        result.isEligibleForActiveMap,
        true,
        `Score ${score} should be eligible for active map`
      );
    }
  });

  it('T1-F09-03: Ambiguous or unresolved geocode stages incident to threatStatus: UNDER_REVIEW', () => {
    const ambiguousInput: EligibilityEvaluationInput = {
      ...baseQualifyingInput,
      geocode: {
        ...baseQualifyingInput.geocode!,
        locationPrecision: 'AMBIGUOUS',
      },
    };

    const resAmbiguous = evaluateActiveThreatEligibility(ambiguousInput);
    assert.strictEqual(resAmbiguous.threatStatus, 'UNDER_REVIEW');
    assert.strictEqual(resAmbiguous.isEligibleForActiveMap, false);

    const missingGeocodeInput: EligibilityEvaluationInput = {
      ...baseQualifyingInput,
      geocode: null,
    };

    const resMissing = evaluateActiveThreatEligibility(missingGeocodeInput);
    assert.strictEqual(resMissing.threatStatus, 'UNDER_REVIEW');
    assert.strictEqual(resMissing.isEligibleForActiveMap, false);
  });

  it('T1-F09-04: Anonymous report without source citation is staged to threatStatus: UNDER_REVIEW', () => {
    const uncitedInput: EligibilityEvaluationInput = {
      ...baseQualifyingInput,
      sourceUrl: undefined,
    };

    const result = evaluateActiveThreatEligibility(uncitedInput);
    assert.strictEqual(
      result.threatStatus,
      'UNDER_REVIEW',
      'Uncited anonymous report must be staged to UNDER_REVIEW'
    );
    assert.strictEqual(result.isEligibleForActiveMap, false);
    assert.strictEqual(result.conceptualOutcome, 'TEMPORARILY_UNDER_REVIEW');
  });

  it('T1-F09-05: Non-qualifying or disqualified reports do not receive ACTIVE status or active map pins', () => {
    const disqualifiedInput: EligibilityEvaluationInput = {
      ...baseQualifyingInput,
      isSafetyRelated: false,
      disqualifiedReason: 'ARREST_FOLLOWUP',
    };

    const result = evaluateActiveThreatEligibility(disqualifiedInput);
    assert.notStrictEqual(result.threatStatus, 'ACTIVE');
    assert.strictEqual(result.isEligibleForActiveMap, false);
    assert.strictEqual(result.effectiveLifespanHours, 0);
  });

  it('T1-F09-06: Unscored or missing confidence defaults to 0.0 and stages to UNDER_REVIEW, not ACTIVE', () => {
    const missingConfidenceInput: EligibilityEvaluationInput = {
      ...baseQualifyingInput,
      confidence: undefined,
    };

    const result = evaluateActiveThreatEligibility(missingConfidenceInput);
    assert.strictEqual(
      result.threatStatus,
      'UNDER_REVIEW',
      `Omitted confidence must stage to threatStatus: 'UNDER_REVIEW', got: '${result.threatStatus}'`
    );
    assert.strictEqual(
      result.isEligibleForActiveMap,
      false,
      'Omitted confidence must not be eligible for active map'
    );
    assert.strictEqual(
      result.conceptualOutcome,
      'TEMPORARILY_UNDER_REVIEW'
    );
  });
});
