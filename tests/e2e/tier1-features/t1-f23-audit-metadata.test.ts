import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  reportCategorySchema,
  reportSeveritySchema,
  geocodeConfidenceSchema,
  auditMetadataSchema,
  assertValidAuditMetadata,
} from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - F23: Diagnostic Audit Metadata Schema & Provenance', () => {
  it('T1-F23-01: Ingestion metadata schema validates mandatory crawlRunId and timestamp', () => {
    const validMeta = {
      crawlRunId: 'crawl_20261120_abc123',
      ingestedAt: new Date().toISOString(),
      classification: {
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        confidence: 0.95,
        isSafetyRelated: true,
        matchedKeywords: ['বাস', 'ট্রাক', 'সংঘর্ষ'],
      },
      geocoding: {
        method: 'UPAZILA_DATASET',
        matchedKey: 'সীতাকুণ্ড',
        locationPrecision: 'UPAZILA',
        district: 'Chattogram',
        upazila: 'Sitakunda',
        division: 'Chattogram',
      },
    };

    const parsed = auditMetadataSchema.parse(validMeta);
    assert.strictEqual(parsed.crawlRunId, 'crawl_20261120_abc123');
    assert.strictEqual(parsed.classification.category, 'ROAD_ACCIDENT');
    assert.strictEqual(parsed.geocoding.upazila, 'Sitakunda');

    // Exercise exported contract assertion validator
    const validated = assertValidAuditMetadata(validMeta);
    assert.strictEqual(validated.crawlRunId, 'crawl_20261120_abc123');
    assert.strictEqual(validated.classification.confidence, 0.95);
    assert.strictEqual(validated.geocoding.district, 'Chattogram');
  });

  it('T1-F23-02: Classification stage decision records explainable confidence score and matched keywords', () => {
    const meta = {
      crawlRunId: 'crawl_20261120_xyz',
      ingestedAt: new Date().toISOString(),
      classification: {
        category: 'SNATCHING_ARMED_ASSAULT',
        severity: 'HIGH',
        confidence: 0.88,
        isSafetyRelated: true,
        matchedKeywords: ['ছিনতাই', 'কুপিয়ে জখম', 'ছুরিকাঘাত'],
      },
      geocoding: {
        method: 'LOCAL_LANDMARK',
        matchedKey: 'Farmgate Overpass',
        locationPrecision: 'EXACT',
        district: 'Dhaka',
      },
    };

    const parsed = auditMetadataSchema.parse(meta);
    assert.ok(parsed.classification.confidence >= 0.70, 'Confidence must be tracked');
    assert.strictEqual(parsed.classification.matchedKeywords?.length, 3);
    assert.ok(parsed.classification.matchedKeywords?.includes('ছিনতাই'));
  });

  it('T1-F23-03: Geocode provenance explicitly records resolution method, key, and administrative hierarchy', () => {
    const upazilaResolution = {
      crawlRunId: 'crawl_run_003',
      ingestedAt: new Date().toISOString(),
      classification: {
        category: 'THEFT',
        severity: 'LOW',
        confidence: 0.82,
        isSafetyRelated: true,
      },
      geocoding: {
        method: 'UPAZILA_DATASET' as const,
        matchedKey: 'টেকনাফ',
        locationPrecision: 'UPAZILA' as const,
        district: "Cox's Bazar",
        upazila: 'Teknaf',
        division: 'Chattogram',
        distanceToDistrictCenterKm: 78.4,
      },
    };

    const parsed = auditMetadataSchema.parse(upazilaResolution);
    assert.strictEqual(parsed.geocoding.method, 'UPAZILA_DATASET');
    assert.strictEqual(parsed.geocoding.locationPrecision, 'UPAZILA');
    assert.strictEqual(parsed.geocoding.district, "Cox's Bazar");
    assert.strictEqual(parsed.geocoding.upazila, 'Teknaf');
  });

  it('T1-F23-04: Deduplication provenance records candidate comparisons, Jaccard scores, and shared tokens', () => {
    const dedupProvenance = {
      crawlRunId: 'crawl_run_004',
      ingestedAt: new Date().toISOString(),
      classification: {
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        confidence: 0.92,
        isSafetyRelated: true,
      },
      geocoding: {
        method: 'UPAZILA_DATASET' as const,
        matchedKey: 'সীতাকুণ্ড',
        locationPrecision: 'UPAZILA' as const,
        district: 'Chattogram',
        upazila: 'Sitakunda',
      },
      deduplication: {
        checkedCandidatesCount: 4,
        isDuplicate: true,
        matchedCanonicalReportId: 'rep_canonical_sitakunda_01',
        similarityScore: 0.75,
        sharedTokens: ['bus', 'truck', 'sitakunda', 'killed'],
      },
    };

    const parsed = auditMetadataSchema.parse(dedupProvenance);
    assert.ok(parsed.deduplication);
    assert.strictEqual(parsed.deduplication.isDuplicate, true);
    assert.strictEqual(parsed.deduplication.matchedCanonicalReportId, 'rep_canonical_sitakunda_01');
    assert.strictEqual(parsed.deduplication.similarityScore, 0.75);
    assert.deepStrictEqual(parsed.deduplication.sharedTokens, ['bus', 'truck', 'sitakunda', 'killed']);
  });

  it('T1-F23-05: Audit metadata is serializable and rejects malformed payloads missing mandatory lineage', () => {
    const invalidMetaMissingCrawlId = {
      // crawlRunId missing!
      ingestedAt: new Date().toISOString(),
      classification: {
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        confidence: 0.9,
        isSafetyRelated: true,
      },
      geocoding: {
        method: 'DICTIONARY',
        matchedKey: 'Dhaka',
        locationPrecision: 'DISTRICT',
      },
    };

    assert.throws(
      () => auditMetadataSchema.parse(invalidMetaMissingCrawlId),
      /crawlRunId/,
      'Payload missing crawlRunId must be rejected by schema validator'
    );
    assert.throws(
      () => assertValidAuditMetadata(invalidMetaMissingCrawlId),
      /crawlRunId/,
      'Payload missing crawlRunId must be rejected by assertValidAuditMetadata validator'
    );
  });
});
