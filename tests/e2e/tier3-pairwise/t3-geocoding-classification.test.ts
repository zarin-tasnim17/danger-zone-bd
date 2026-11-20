import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateActiveThreatEligibility,
  type EligibilityEvaluationInput,
} from '../../../apps/api/src/services/activeThreatEligibilityService';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';
import { resolveLocationFromText } from '../../../apps/api/src/services/geocodingService';

describe('Tier 3: Pairwise Combinatorial Interactions - P01: Geocoding Precision & Classification Staging', () => {
  const baseQualifyingInput: EligibilityEvaluationInput = {
    title: 'মিরপুরে চলন্ত বাসে সশস্ত্র ডাকাতি',
    summary: 'যাত্রীদের চিৎকারে ডাকাত দল পালিয়ে যায়।',
    category: 'ROBBERY',
    severity: 'HIGH',
    isSafetyRelated: true,
    publishedAt: new Date('2026-11-20T12:00:00Z'),
    sourceUrl: 'https://news.bangladesh.test/rep-001',
    sourceName: 'The Daily Star',
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

  it('T3-GC-01: Pairwise: High Confidence (>= 0.70) + EXACT precision yields ACTIVE threat pin', () => {
    const input = {
      ...baseQualifyingInput,
      confidence: 0.92,
      geocode: {
        ...baseQualifyingInput.geocode!,
        locationPrecision: 'EXACT' as const,
      },
    };

    const result = evaluateActiveThreatEligibility(input as any);
    assert.strictEqual(
      result.threatStatus,
      'ACTIVE',
      'High confidence + EXACT precision must yield threatStatus: ACTIVE'
    );
    assert.strictEqual(
      result.isEligibleForActiveMap,
      true,
      'High confidence + EXACT precision must be eligible for active map'
    );
  });

  it('T3-GC-02: Pairwise: High Confidence (>= 0.70) + AMBIGUOUS precision is staged to UNDER_REVIEW', () => {
    // Geospatial ambiguity must override high classification confidence
    const input = {
      ...baseQualifyingInput,
      confidence: 0.95,
      geocode: {
        ...baseQualifyingInput.geocode!,
        locationPrecision: 'AMBIGUOUS' as const,
      },
    };

    const result = evaluateActiveThreatEligibility(input as any);
    assert.strictEqual(
      result.threatStatus,
      'UNDER_REVIEW',
      'Geospatial ambiguity must stage high-confidence incident to UNDER_REVIEW'
    );
    assert.strictEqual(
      result.isEligibleForActiveMap,
      false,
      'Ambiguous precision must NOT create an active map pin'
    );
  });

  it('T3-GC-03: Pairwise: Low Confidence (< 0.70) + UPAZILA precision is staged to UNDER_REVIEW', () => {
    // Classification uncertainty must override unambiguous geocoding precision
    const input = {
      ...baseQualifyingInput,
      confidence: 0.55,
      geocode: {
        ...baseQualifyingInput.geocode!,
        locationPrecision: 'UPAZILA' as const,
      },
    };

    const result = evaluateActiveThreatEligibility(input as any);
    assert.strictEqual(
      result.threatStatus,
      'UNDER_REVIEW',
      'Classification uncertainty (<0.70) must stage incident to UNDER_REVIEW regardless of UPAZILA precision'
    );
    assert.strictEqual(
      result.isEligibleForActiveMap,
      false,
      'Uncertain classification must NOT create an active map pin'
    );
  });

  it('T3-GC-04: Pairwise: High Confidence (>= 0.70) + DISTRICT precision preserves DISTRICT precision', () => {
    const input = {
      ...baseQualifyingInput,
      confidence: 0.85,
      geocode: {
        ...baseQualifyingInput.geocode!,
        locationPrecision: 'DISTRICT' as const,
      },
    };

    const result = evaluateActiveThreatEligibility(input as any);
    assert.strictEqual(
      result.threatStatus,
      'ACTIVE',
      'High confidence + DISTRICT precision should qualify for ACTIVE threat'
    );
    assert.strictEqual(
      result.isEligibleForActiveMap,
      true,
      'District-level incident should be eligible for active map'
    );
    assert.strictEqual(
      input.geocode.locationPrecision,
      'DISTRICT',
      'District precision must be preserved truthfully without coercing to EXACT'
    );
  });

  it('T3-GC-05: Pairwise: Disqualified non-incident + EXACT geocoding overrides coordinates and rejects active map pin', async () => {
    // Article reports an arrest at a specific exact landmark
    const headline = 'মিরপুর ১০ গোলচত্বরে চিহ্নিত ছিনতাইকারী গ্রেফতার';
    const classification = classifyNewsText(headline, 'পুলিশ গোপন সংবাদের ভিত্তিতে আসামিকে আটক করে।');

    // Classification should identify this as non-incident
    assert.strictEqual(
      classification.isSafetyRelated,
      false,
      'Arrest follow-up must have isSafetyRelated: false'
    );

    const geoResult = await resolveLocationFromText(headline);

    const evaluation = evaluateActiveThreatEligibility({
      title: headline,
      category: classification.category,
      severity: classification.severity,
      isSafetyRelated: classification.isSafetyRelated,
      disqualifiedReason: classification.disqualifiedReason,
      geocode: geoResult,
      publishedAt: new Date(),
      sourceUrl: 'https://news.bangladesh.test/arrest-101',
    });

    assert.notStrictEqual(
      evaluation.threatStatus,
      'ACTIVE',
      'Disqualified non-incident must never receive threatStatus: ACTIVE even with valid geocode'
    );
    assert.strictEqual(
      evaluation.isEligibleForActiveMap,
      false,
      'Disqualified non-incident must be ineligible for active map'
    );
  });
});
