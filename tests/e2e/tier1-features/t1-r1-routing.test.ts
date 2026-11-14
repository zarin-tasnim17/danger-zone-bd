import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertSafetyScoreBounds,
  assertCoordinatesInBangladesh,
} from '../harness/contractValidator';
import {
  calculatePolylineLateralDeviation,
  assertCoordinateOrdering,
} from '../harness/geoUtils';

describe('Tier 1: Feature Coverage - R1: Road-Network Routing & Alternatives', () => {
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

  it('T1-R1-01: Genuine Street Network Geometry Generation', async () => {
    // Farmgate to Mohakhali, Dhaka
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

    const data = assertValidSafeRouteResponse(res.body);
    const primaryRoute = data.routes[0];

    // Invariant: Polyline must contain >= 15 coordinates reflecting actual street geometry
    assert.ok(
      primaryRoute.geometry.length >= 15,
      `Expected geometry length >= 15, got ${primaryRoute.geometry.length}`
    );

    // Invariant: Coordinates must follow [lat, lng] ordering
    assertCoordinateOrdering(primaryRoute.geometry);

    // Invariant: Intermediate vertices deviate from straight chord (street bends)
    const lateralDev = calculatePolylineLateralDeviation(primaryRoute.geometry);
    assert.ok(
      lateralDev > 10,
      `Expected lateral deviation > 10m proving street curve, got ${lateralDev.toFixed(2)}m`
    );

    // Invariant: Road distance strictly greater than direct Euclidean distance
    assert.ok(
      primaryRoute.distanceMeters > data.directDistanceMeters,
      `Road distance (${primaryRoute.distanceMeters}m) must be > direct distance (${data.directDistanceMeters}m)`
    );

    // Invariant: Safety score bounded in [15.0, 95.0]
    assertSafetyScoreBounds(primaryRoute.safetyScore);
  });

  it('T1-R1-02: Real-World Road Distance and Duration Ratio', async () => {
    // Banani to Gulshan, Dhaka
    const payload = {
      startLat: 23.78,
      startLng: 90.41,
      endLat: 23.795,
      endLng: 90.4,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    // Invariant: Road network distance is at least 5% longer than straight Euclidean line
    const ratio = route.distanceMeters / data.directDistanceMeters;
    assert.ok(
      ratio >= 1.05,
      `Expected road/direct distance ratio >= 1.05, got ${ratio.toFixed(3)}`
    );

    // Invariant: Duration is positive and realistic (> 60 seconds)
    assert.ok(
      route.durationSeconds > 60,
      `Expected realistic durationSeconds > 60, got ${route.durationSeconds}`
    );
  });

  it('T1-R1-03: Multi-Route Alternatives Generation', async () => {
    // Multi-artery corridor in central Dhaka
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

    // Invariant: At least 2 alternatives returned
    assert.ok(
      data.routes.length >= 2,
      `Expected at least 2 route alternatives, got ${data.routes.length}`
    );

    // Invariant: Route IDs include valid identifiers
    const ids = data.routes.map((r) => r.id);
    assert.ok(ids.includes('safest') || ids.includes('fastest'));

    for (const r of data.routes) {
      assertSafetyScoreBounds(r.safetyScore);
      assert.ok(r.geometry.length >= 5, 'Alternative must have valid geometry');
    }
  });

  it('T1-R1-04: Differentiated Alternative Trade-off Metrics', async () => {
    const payload = {
      startLat: 23.745,
      startLng: 90.375,
      endLat: 23.765,
      endLng: 90.395,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    assert.ok(data.routes.length >= 2, 'Requires >= 2 routes to compare metrics');

    const [route0, route1] = data.routes;
    const deltaD = Math.abs(route0.distanceMeters - route1.distanceMeters);
    const deltaT = Math.abs(route0.durationSeconds - route1.durationSeconds);
    const deltaH = Math.abs(route0.hazardCount - route1.hazardCount);

    // Invariant: Alternatives are not clones; at least one metric must differ
    assert.ok(
      deltaD > 0 || deltaT > 0 || deltaH > 0,
      `Alternative routes must exhibit differing metrics (deltaD=${deltaD}, deltaT=${deltaT}, deltaH=${deltaH})`
    );
  });

  it('T1-R1-05: Recommended Route Flag Assignment', async () => {
    const payload = {
      startLat: 23.73,
      startLng: 90.39,
      endLat: 23.75,
      endLng: 90.41,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);

    // Invariant: Exactly one route has isRecommended === true
    const recommendedRoutes = data.routes.filter((r) => r.isRecommended);
    assert.strictEqual(
      recommendedRoutes.length,
      1,
      `Expected exactly 1 recommended route, got ${recommendedRoutes.length}`
    );

    const recommended = recommendedRoutes[0];
    // Invariant: Recommended route is either safest score or breaks tie with fastest duration
    for (const other of data.routes) {
      if (other !== recommended) {
        assert.ok(
          recommended.safetyScore >= other.safetyScore ||
            (recommended.safetyScore === other.safetyScore &&
              recommended.durationSeconds <= other.durationSeconds),
          `Recommended route must have highest safetyScore or fastest duration if tied`
        );
      }
    }
  });
});
