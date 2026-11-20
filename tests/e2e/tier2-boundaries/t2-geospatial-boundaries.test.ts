import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import {
  validateCoordinateHierarchy,
  LOCAL_LANDMARK_MAP,
} from '../../../apps/api/src/services/geocodingService';

describe('Tier 2: Boundary Value Analysis - B01: Geospatial Boundaries & Limits', () => {
  it('T2-GEO-01: Boundary tests on sovereign envelope edges (minLat, maxLat, minLng, maxLng)', () => {
    // Exact inner bounds
    assert.strictEqual(
      isWithinBangladesh(BANGLADESH_BOUNDS.minLat, BANGLADESH_BOUNDS.minLng),
      true,
      'Point on SW boundary must be within Bangladesh'
    );
    assert.strictEqual(
      isWithinBangladesh(BANGLADESH_BOUNDS.maxLat, BANGLADESH_BOUNDS.maxLng),
      true,
      'Point on NE boundary must be within Bangladesh'
    );

    // Points just outside the boundary limits (1e-4 degree deviation)
    assert.strictEqual(
      isWithinBangladesh(BANGLADESH_BOUNDS.minLat - 0.001, 90.0),
      false,
      'Point south of minLat must be outside Bangladesh'
    );
    assert.strictEqual(
      isWithinBangladesh(BANGLADESH_BOUNDS.maxLat + 0.001, 90.0),
      false,
      'Point north of maxLat must be outside Bangladesh'
    );
    assert.strictEqual(
      isWithinBangladesh(23.5, BANGLADESH_BOUNDS.minLng - 0.001),
      false,
      'Point west of minLng must be outside Bangladesh'
    );
    assert.strictEqual(
      isWithinBangladesh(23.5, BANGLADESH_BOUNDS.maxLng + 0.001),
      false,
      'Point east of maxLng must be outside Bangladesh'
    );
  });

  it('T2-GEO-02: District centroid distance threshold limit boundary (0.70 degrees)', () => {
    // Dhaka center: { lat: 23.8103, lng: 90.4125 }
    const center = LOCAL_LANDMARK_MAP['dhaka'];
    assert.ok(center, 'Dhaka landmark must exist');

    // Case A: Just within threshold (distance ~0.65° < 0.70°)
    // lat offset 0.45, lng offset 0.45 -> dist = sqrt(0.45^2 + 0.45^2) = 0.636°
    const insideRes = validateCoordinateHierarchy(
      center.lat + 0.45,
      center.lng + 0.45,
      'Dhaka'
    );
    assert.strictEqual(
      insideRes.isValid,
      true,
      'Distance 0.636° (< 0.70°) must pass district boundary validation'
    );

    // Case B: Just beyond threshold (distance ~0.72° > 0.70°)
    // lat offset 0.51, lng offset 0.51 -> dist = sqrt(0.51^2 + 0.51^2) = 0.721°
    const outsideRes = validateCoordinateHierarchy(
      center.lat + 0.51,
      center.lng + 0.51,
      'Dhaka'
    );
    assert.strictEqual(
      outsideRes.isValid,
      false,
      'Distance 0.721° (> 0.70°) must be rejected by district boundary validation'
    );
  });

  it('T2-GEO-03: Upazila centroid distance threshold limit boundary (0.50 degrees)', () => {
    // Savar upazila center in bangladesh_upazilas.json: { lat: 23.8583, lng: 90.2667 }
    // Case A: Just within threshold (~0.42° < 0.50°)
    const insideUpazila = validateCoordinateHierarchy(
      23.8583 + 0.3,
      90.2667 + 0.3,
      undefined,
      'Savar'
    );
    assert.strictEqual(
      insideUpazila.isValid,
      true,
      'Upazila distance ~0.42° (< 0.50°) must pass validation'
    );

    // Case B: Just beyond threshold (~0.52° > 0.50°)
    const outsideUpazila = validateCoordinateHierarchy(
      23.8583 + 0.37,
      90.2667 + 0.37,
      undefined,
      'Savar'
    );
    assert.strictEqual(
      outsideUpazila.isValid,
      false,
      'Upazila distance ~0.52° (> 0.50°) must be rejected'
    );
  });

  it('T2-GEO-04: Extreme geographic corners of Bangladesh remain valid within sovereign bounds', () => {
    const extremeCorners = [
      { name: 'Tetulia (Northernmost)', lat: 26.6, lng: 88.35 },
      { name: 'St. Martin\'s Island (Southernmost)', lat: 20.62, lng: 92.32 },
      { name: 'Shibganj (Westernmost)', lat: 24.7, lng: 88.15 },
      { name: 'Thanchi (Easternmost)', lat: 21.75, lng: 92.65 },
    ];

    for (const corner of extremeCorners) {
      assert.strictEqual(
        isWithinBangladesh(corner.lat, corner.lng),
        true,
        `Geographic extreme "${corner.name}" (${corner.lat}, ${corner.lng}) must be within Bangladesh`
      );

      const res = validateCoordinateHierarchy(corner.lat, corner.lng);
      assert.strictEqual(
        res.isValid,
        true,
        `Geographic extreme "${corner.name}" must pass sovereign bounds validation`
      );
    }
  });

  it('T2-GEO-05: Coordinate precision edge cases (high floating-point precision, zeros, NaNs)', () => {
    // Very high decimal precision point in Dhaka
    const highPrecisionLat = 23.810300000000003;
    const highPrecisionLng = 90.412500000000003;
    const resHigh = validateCoordinateHierarchy(highPrecisionLat, highPrecisionLng, 'Dhaka');
    assert.strictEqual(resHigh.isValid, true, 'High precision float coordinates must be accepted');

    // Zero coordinates [0, 0] (Null Island)
    const resZero = validateCoordinateHierarchy(0.0, 0.0);
    assert.strictEqual(resZero.isValid, false, '[0, 0] must be rejected');

    // NaN coordinates
    const resNaN = validateCoordinateHierarchy(NaN, NaN);
    assert.strictEqual(resNaN.isValid, false, 'NaN coordinates must be rejected');
  });
});
