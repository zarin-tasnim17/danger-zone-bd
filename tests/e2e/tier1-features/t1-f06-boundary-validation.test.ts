import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCoordinateHierarchy } from '../../../apps/api/src/services/geocodingService';
import { DISTRICT_CENTERS } from '../harness/testDataGenerators';

describe('Tier 1: Feature Coverage - F06: Geospatial Coordinate Boundary Validation', () => {
  it('T1-F06-01: Authentic coordinates inside declared district pass validation with isValid: true', () => {
    const validCases = [
      { lat: 21.4272, lng: 92.0058, district: "Cox's Bazar" },
      { lat: 23.8103, lng: 90.4125, district: 'Dhaka' },
      { lat: 22.3569, lng: 91.7832, district: 'Chattogram' },
      { lat: 24.8949, lng: 91.8687, district: 'Sylhet' },
      { lat: 24.3745, lng: 88.6042, district: 'Rajshahi' },
    ];

    for (const tc of validCases) {
      const result = validateCoordinateHierarchy(tc.lat, tc.lng, tc.district);
      assert.strictEqual(
        result.isValid,
        true,
        `Expected valid coordinates for district "${tc.district}", got reason: ${result.reason}`
      );
      assert.ok(
        result.distanceDeg !== undefined && result.distanceDeg <= 0.7,
        `Expected distanceDeg <= 0.7, got ${result.distanceDeg}`
      );
    }
  });

  it('T1-F06-02: Cross-district coordinate collisions are strictly rejected (distance > 0.7°)', () => {
    const collisionCases = [
      {
        // Savar / Dhaka coordinates assigned to Cox's Bazar district
        lat: 23.8583,
        lng: 90.2667,
        district: "Cox's Bazar",
        desc: 'Savar coordinates falsely assigned to Cox\'s Bazar',
      },
      {
        // Sylhet coordinates assigned to Khulna district
        lat: 24.8949,
        lng: 91.8687,
        district: 'Khulna',
        desc: 'Sylhet coordinates falsely assigned to Khulna',
      },
      {
        // Rangpur coordinates assigned to Barishal district
        lat: 25.7439,
        lng: 89.2752,
        district: 'Barishal',
        desc: 'Rangpur coordinates falsely assigned to Barishal',
      },
    ];

    for (const tc of collisionCases) {
      const result = validateCoordinateHierarchy(tc.lat, tc.lng, tc.district);
      assert.strictEqual(
        result.isValid,
        false,
        `Cross-district collision (${tc.desc}) must be rejected with isValid: false`
      );
      assert.ok(
        result.distanceDeg !== undefined && result.distanceDeg > 0.7,
        `Expected distanceDeg > 0.7, got: ${result.distanceDeg}`
      );
      assert.ok(
        result.reason && result.reason.includes('deviate'),
        `Expected descriptive rejection reason, got: ${result.reason}`
      );
    }
  });

  it('T1-F06-03: Upazila-level proximity validation rejects coordinates deviating > 0.5° from upazila center', () => {
    // Teknaf upazila center is in Cox's Bazar (lat ~21.35, lng ~91.96)
    // A coordinate at Chattogram (lat 22.3569, lng 91.7832) deviates by ~1.01° from Teknaf center
    const result = validateCoordinateHierarchy(22.3569, 91.7832, undefined, 'Teknaf');

    assert.strictEqual(
      result.isValid,
      false,
      'Coordinate deviating > 0.5° from Teknaf upazila center must be rejected'
    );
    assert.ok(
      result.distanceDeg !== undefined && result.distanceDeg > 0.5,
      `Expected distanceDeg > 0.5°, got: ${result.distanceDeg}`
    );
  });

  it('T1-F06-04: Coordinates outside sovereign Bangladesh bounds are rejected immediately', () => {
    const extraterritorialPoints = [
      { lat: 15.0, lng: 75.0, desc: 'India / Arabian Sea' },
      { lat: 0.0, lng: 0.0, desc: 'Null Island' },
      { lat: 28.5, lng: 90.0, desc: 'Himalayas / Tibet' },
      { lat: 18.0, lng: 90.0, desc: 'Bay of Bengal international waters' },
    ];

    for (const pt of extraterritorialPoints) {
      const result = validateCoordinateHierarchy(pt.lat, pt.lng);
      assert.strictEqual(
        result.isValid,
        false,
        `Point outside Bangladesh (${pt.desc}) must fail with isValid: false`
      );
      assert.ok(
        result.reason && result.reason.includes('sovereign bounds'),
        `Expected sovereign bounds rejection reason for ${pt.desc}, got: ${result.reason}`
      );
    }
  });

  it('T1-F06-05: Inverted latitude/longitude coordinates are caught and rejected as out-of-bounds', () => {
    // Dhaka is [23.8103, 90.4125]. Inverted is [90.4125, 23.8103].
    const invertedLat = 90.4125;
    const invertedLng = 23.8103;

    const result = validateCoordinateHierarchy(invertedLat, invertedLng, 'Dhaka');
    assert.strictEqual(
      result.isValid,
      false,
      'Inverted coordinates [lng, lat] must fail sovereign bounds validation'
    );
  });
});
