import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import { assertValidSafeRouteResponse } from '../harness/contractValidator';
import { assertCoordinateOrdering } from '../harness/geoUtils';

describe('Tier 1: Feature Coverage - R5: Frontend & Contract Data Integrity', () => {
  const adapter = new ApiAdapter();

  before(async () => {
    await adapter.start();
  });

  after(async () => {
    await adapter.stop();
  });

  beforeEach(() => {
    adapter.clearHazards();
    adapter.setMockOsrmFault('none');
  });

  it('T1-R5-01: Legacy Top-Level Backward Compatibility Envelope', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.76,
      endLng: 90.4,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const body = res.body;
    assert.strictEqual(body.success, true);
    const data = body.data;

    // Invariant: Top-level legacy fields exist with proper types
    assert.ok(Array.isArray(data.origin) && data.origin.length === 2, 'data.origin must be [lat, lng]');
    assert.ok(Array.isArray(data.destination) && data.destination.length === 2, 'data.destination must be [lat, lng]');
    assert.strictEqual(typeof data.directDistanceMeters, 'number');
    assert.strictEqual(typeof data.safeDistanceMeters, 'number');
    assert.strictEqual(typeof data.safetyRating, 'string');
    assert.strictEqual(typeof data.bypassedHazardsCount, 'number');
    assert.ok(Array.isArray(data.bypassedHazards), 'data.bypassedHazards must be an array');
    assert.ok(Array.isArray(data.waypoints) && data.waypoints.length >= 2, 'data.waypoints must be an array');
  });

  it('T1-R5-02: Enhanced Multi-Route Schema Structure', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.76,
      endLng: 90.4,
      mode: 'walking' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);

    // Invariant: Enhanced fields present alongside legacy
    assert.strictEqual(data.mode, 'walking');
    assert.ok(Array.isArray(data.routes), 'data.routes must be an array');
    assert.ok(data.routes.length >= 1, 'data.routes must contain at least 1 route');

    for (const alt of data.routes) {
      assert.ok(['safest', 'fastest', 'alternative'].includes(alt.id));
      assert.strictEqual(typeof alt.title, 'string');
      assert.strictEqual(typeof alt.isRecommended, 'boolean');
      assert.strictEqual(typeof alt.distanceMeters, 'number');
      assert.strictEqual(typeof alt.durationSeconds, 'number');
      assert.strictEqual(typeof alt.safetyScore, 'number');
      assert.ok(Array.isArray(alt.geometry));
      assert.ok(Array.isArray(alt.steps));
    }
  });

  it('T1-R5-03: Parity Between Top-Level Envelope and Recommended Alternative', async () => {
    const payload = {
      startLat: 23.74,
      startLng: 90.38,
      endLat: 23.77,
      endLng: 90.41,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const recommended = data.routes.find((r) => r.isRecommended)!;

    // Invariant: Top-level safeDistanceMeters === recommended.distanceMeters
    assert.strictEqual(
      data.safeDistanceMeters,
      recommended.distanceMeters,
      'Top-level safeDistanceMeters must match recommended alternative distanceMeters'
    );

    // Invariant: Top-level waypoints length === recommended.geometry length
    assert.strictEqual(
      data.waypoints.length,
      recommended.geometry.length,
      'Top-level waypoints must match recommended alternative geometry'
    );

    // Invariant: Top-level bypassedHazardsCount === recommended.hazardCount
    assert.strictEqual(
      data.bypassedHazardsCount,
      recommended.hazardCount,
      'Top-level bypassedHazardsCount must match recommended alternative hazardCount'
    );
  });

  it('T1-R5-04: Coordinate Ordering Invariant [Latitude, Longitude]', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);

    // Invariant: Origin and destination follow [lat, lng]
    assertCoordinateOrdering([data.origin]);
    assertCoordinateOrdering([data.destination]);

    // Invariant: Top-level waypoints follow [lat, lng]
    assertCoordinateOrdering(data.waypoints);

    // Invariant: Every alternative route's geometry follows [lat, lng]
    for (const route of data.routes) {
      assertCoordinateOrdering(route.geometry);
      // Invariant: Every step maneuver location follows [lat, lng]
      for (const step of route.steps) {
        assertCoordinateOrdering([step.location]);
      }
    }
  });

  it('T1-R5-05: Non-Nullability and Schema Integrity of All Route Alternatives', async () => {
    const payload = {
      startLat: 23.74,
      startLng: 90.38,
      endLat: 23.77,
      endLng: 90.41,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);

    // Invariant: No undefined or null values in any required properties across all alternatives
    for (const r of data.routes) {
      assert.notStrictEqual(r.id, null);
      assert.notStrictEqual(r.id, undefined);
      assert.notStrictEqual(r.title, null);
      assert.notStrictEqual(r.title, undefined);
      assert.notStrictEqual(r.isRecommended, null);
      assert.notStrictEqual(r.isRecommended, undefined);
      assert.notStrictEqual(r.distanceMeters, null);
      assert.notStrictEqual(r.distanceMeters, undefined);
      assert.notStrictEqual(r.durationSeconds, null);
      assert.notStrictEqual(r.durationSeconds, undefined);
      assert.notStrictEqual(r.safetyScore, null);
      assert.notStrictEqual(r.safetyScore, undefined);
      assert.notStrictEqual(r.safetyRating, null);
      assert.notStrictEqual(r.safetyRating, undefined);
      assert.notStrictEqual(r.hazardCount, null);
      assert.notStrictEqual(r.hazardCount, undefined);
      assert.notStrictEqual(r.geometry, null);
      assert.notStrictEqual(r.geometry, undefined);
      assert.notStrictEqual(r.steps, null);
      assert.notStrictEqual(r.steps, undefined);
    }
  });
});
