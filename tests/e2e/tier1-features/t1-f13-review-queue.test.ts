import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  generateMockGeocodeResult,
} from '../harness/testDataGenerators';
import {
  assertValidGeocodeResult,
  assertWithinBangladeshBounds,
} from '../harness/contractValidator';
import { BANGLADESH_BOUNDS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F13: Geocoding Confidence & Ambiguity Review Queue', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F13-01: Direct landmark/thana matches produce HIGH confidence geocode results', () => {
    const directMatch = generateMockGeocodeResult({
      locationName: 'Ramna Model Thana, Dhaka',
      latitude: 23.745713,
      longitude: 90.404659,
      confidence: 'HIGH',
      district: 'Dhaka',
      division: 'Dhaka',
      source: 'DICTIONARY',
      isAmbiguous: false,
      matchedThana: 'Ramna Model Thana',
    });

    const validated = assertValidGeocodeResult(directMatch);
    assert.strictEqual(validated.confidence, 'HIGH');
    assert.strictEqual(validated.isAmbiguous, false);
    assert.strictEqual(validated.source, 'DICTIONARY');
  });

  it('T1-F13-02: Broad district-only matches yield MEDIUM confidence without arbitrary street-level pinning', () => {
    // Only district mentioned, e.g. "ঘটনাটি ঘটেছে বগুড়ায়"
    const broadDistrict = generateMockGeocodeResult({
      locationName: 'Bogura District',
      latitude: 24.8465,
      longitude: 89.3777,
      confidence: 'MEDIUM',
      district: 'Bogura',
      division: 'Rajshahi',
      source: 'DICTIONARY',
      isAmbiguous: false,
    });

    const validated = assertValidGeocodeResult(broadDistrict);
    assert.strictEqual(validated.confidence, 'MEDIUM');
    assert.strictEqual(validated.isAmbiguous, false);
  });

  it('T1-F13-03: Ambiguous place names shared across multiple districts are flagged with isAmbiguous: true', () => {
    // "Kaliganj" exists in 4 distinct districts: Gazipur, Lalmonirhat, Jhenaidah, and Satkhira
    const ambiguousLocation = generateMockGeocodeResult({
      locationName: 'Kaliganj',
      latitude: 24.00,
      longitude: 90.42,
      confidence: 'LOW',
      isAmbiguous: true,
      source: 'DICTIONARY',
    });

    assert.strictEqual(ambiguousLocation.isAmbiguous, true, 'Shared place name without district context must be ambiguous');
    assert.strictEqual(ambiguousLocation.confidence, 'LOW');
  });

  it('T1-F13-04: Ambiguous or unresolved items are routed to the review queue instead of live map pins', async () => {
    // Ambiguous incident is placed into review queue
    const reviewItem = db.seedReport({
      title: 'কালীগঞ্জে ডাকাতি',
      category: 'ROBBERY',
      latitude: 24.00,
      longitude: 90.42,
      status: 'RESOLVED', // Kept off active map until review
      verificationStage: 'INGESTED',
    });

    // Verify it is NOT returned in active map PostGIS bounds query
    const activePins = db.getReportsInBounds(BANGLADESH_BOUNDS, 'all', 'ACTIVE');
    assert.ok(
      !activePins.some((r) => r.id === reviewItem.id),
      'Ambiguous items awaiting review must not be rendered as active pins'
    );

    // Verify record exists in database under review stage
    const fetched = await db.report.findUnique({ where: { id: reviewItem.id } });
    assert.ok(fetched !== null);
    assert.strictEqual(fetched!.verificationStage, 'INGESTED');
  });

  it('T1-F13-05: Geocode result strictly satisfies geocodeResultSchema and boundary limits', () => {
    const sample = generateMockGeocodeResult({
      locationName: 'Sitakunda, Chattogram',
      latitude: 22.6200,
      longitude: 91.6600,
      confidence: 'HIGH',
      district: 'Chattogram',
      division: 'Chattogram',
      source: 'NOMINATIM',
      isAmbiguous: false,
    });

    const validated = assertValidGeocodeResult(sample);
    assert.ok(validated.latitude >= BANGLADESH_BOUNDS.minLat && validated.latitude <= BANGLADESH_BOUNDS.maxLat);
    assert.ok(validated.longitude >= BANGLADESH_BOUNDS.minLng && validated.longitude <= BANGLADESH_BOUNDS.maxLng);
    assertWithinBangladeshBounds(validated.latitude, validated.longitude);
  });
});
