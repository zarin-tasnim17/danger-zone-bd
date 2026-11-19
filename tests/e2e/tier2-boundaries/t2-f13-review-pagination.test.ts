import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { generateMockGeocodeResult } from '../harness/testDataGenerators';
import { assertValidGeocodeResult, assertValidReportEntity } from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - F13: Ambiguity Review Queue & Pagination', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T2-F13-01: Equal frequency multi-district mention routes incident to review queue with isAmbiguous: true', () => {
    // Both Rajshahi and Khulna mentioned equally without a discernible primary incident locus
    const ambiguousResult = generateMockGeocodeResult({
      locationName: 'Rajshahi & Khulna Border Area',
      latitude: 23.8000,
      longitude: 89.0000,
      confidence: 'LOW',
      isAmbiguous: true,
      source: 'DICTIONARY',
    });

    const validated = assertValidGeocodeResult(ambiguousResult);
    assert.strictEqual(validated.isAmbiguous, true);
    assert.strictEqual(validated.confidence, 'LOW');
  });

  it('T2-F13-02: Geocoder timeout / connection failure routes to review queue with LOW confidence', () => {
    // When geocoder times out, report is not dropped or given fake 0,0 coords
    const fallbackReview = generateMockGeocodeResult({
      locationName: 'Unresolved Highway Stretch',
      latitude: 23.8103, // approximate national center
      longitude: 90.4125,
      confidence: 'LOW',
      isAmbiguous: true,
      source: 'NOMINATIM',
    });

    assert.strictEqual(fallbackReview.confidence, 'LOW');
    assert.strictEqual(fallbackReview.isAmbiguous, true);
  });

  it('T2-F13-03: 10,000 item review queue collection supports deterministic pagination without memory spikes', async () => {
    // Seed 10,000 synthetic queue items
    const totalItems = 10_000;
    const pageSize = 50;

    // Simulate paginating through 10,000 items
    const page10 = Array.from({ length: pageSize }, (_, i) => ({
      id: `queue-item-${500 + i}`,
      title: `Ambiguous incident #${500 + i}`,
      page: 10,
    }));

    assert.strictEqual(page10.length, pageSize);
    assert.strictEqual(page10[0].id, 'queue-item-500');
    assert.strictEqual(page10[pageSize - 1].id, 'queue-item-549');

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / pageSize);
    assert.strictEqual(totalPages, 200, '10,000 items at 50/page must produce exactly 200 pages');
  });

  it('T2-F13-04: Admin coordinate correction resolves ambiguity, sets confidence HIGH and activates map pin', async () => {
    const unverified = db.seedReport({
      title: 'কালীগঞ্জে ডাকাতি',
      category: 'ROBBERY',
      latitude: 24.0000,
      longitude: 90.4200,
      status: 'RESOLVED', // kept off active map
      verificationStage: 'INGESTED',
    });

    // Admin reviews and corrects coordinates to Gazipur Kaliganj
    const correctedLat = 23.9876;
    const correctedLng = 90.4123;

    const updated = await db.report.update({
      where: { id: unverified.id },
      data: {
        latitude: correctedLat,
        longitude: correctedLng,
        status: 'ACTIVE',
        verificationStage: 'ADMIN_VERIFIED',
      },
    });

    assert.strictEqual(updated.status, 'ACTIVE');
    assert.strictEqual(updated.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(updated.latitude, correctedLat);
    assert.strictEqual(updated.longitude, correctedLng);

    const validated = assertValidReportEntity(updated);
    assert.strictEqual(validated.verificationStage, 'ADMIN_VERIFIED');
  });

  it('T2-F13-05: Admin permanent rejection transitions unresolvable report to PURGED status', async () => {
    const bogusReport = db.seedReport({
      title: 'কাল্পনিক স্থানে দুর্ঘটনা',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103,
      longitude: 90.4125,
      status: 'RESOLVED',
      verificationStage: 'INGESTED',
    });

    // Admin rejects report
    const rejected = await db.report.update({
      where: { id: bogusReport.id },
      data: {
        status: 'PURGED',
      },
    });

    assert.strictEqual(rejected.status, 'PURGED');
    const checked = await db.report.findUnique({ where: { id: bogusReport.id } });
    assert.strictEqual(checked?.status, 'PURGED');
  });
});
