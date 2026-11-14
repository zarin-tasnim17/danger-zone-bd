import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertSafetyScoreBounds,
} from '../harness/contractValidator';
import {
  calculatePolylineLateralDeviation,
  assertCoordinateOrdering,
  haversineDistance,
} from '../harness/geoUtils';

describe('Tier 4: Real-World Scenarios - Bangladesh Critical Geographic Corridors', () => {
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

  it('T4-RW-01: Khulna Straight-Line Issue Elimination Verification', async () => {
    // Exact coordinates from user issue: Khulna Royal Square -> Khulna Railway Station
    const payload = {
      startLat: 22.8116,
      startLng: 89.5611,
      endLat: 22.802473,
      endLng: 89.558654,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

    const data = assertValidSafeRouteResponse(res.body);
    const primaryRoute = data.routes[0];

    // INVARIANT 1: Geometry must be genuine road network (NOT a 2-point or straight Euclidean chord)
    assert.ok(
      primaryRoute.geometry.length >= 15,
      `Expected Khulna street polyline >= 15 vertices, got ${primaryRoute.geometry.length}`
    );

    // INVARIANT 2: Coordinates strictly follow [lat, lng] ordering
    assertCoordinateOrdering(primaryRoute.geometry);

    // INVARIANT 3: Intermediate vertices have measurable lateral deviation following street curves
    const lateralDev = calculatePolylineLateralDeviation(primaryRoute.geometry);
    assert.ok(
      lateralDev > 15,
      `Expected street curve lateral deviation > 15m, got ${lateralDev.toFixed(2)}m`
    );

    // INVARIANT 4: Road network distance strictly exceeds direct Euclidean distance
    assert.ok(
      primaryRoute.distanceMeters > data.directDistanceMeters,
      `Khulna road distance (${primaryRoute.distanceMeters}m) must exceed direct distance (${data.directDistanceMeters}m)`
    );

    // INVARIANT 5: Turn-by-turn guidance steps exist
    assert.ok(primaryRoute.steps.length >= 2, 'Expected turn-by-turn steps');
    assert.strictEqual(primaryRoute.steps[0].maneuverType, 'depart');
    assert.strictEqual(primaryRoute.steps[primaryRoute.steps.length - 1].maneuverType, 'arrive');
  });

  it('T4-RW-02: Dhaka Mirpur 10 to Gulshan 2 High-Crime Corridor Multi-Route Alternatives', async () => {
    const payload = {
      startLat: 23.807,
      startLng: 90.3685,
      endLat: 23.7937,
      endLng: 90.4137,
      mode: 'driving' as const,
    };

    // Plant 2 active robberies on the primary fastest road corridor
    adapter.seedHazard({
      id: 'dhaka-robbery-1',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.801,
      longitude: 90.39,
      isVerified: true,
    });
    adapter.seedHazard({
      id: 'dhaka-robbery-2',
      category: 'MUGGING',
      severity: 'HIGH',
      latitude: 23.798,
      longitude: 90.4,
      isVerified: true,
    });

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);

    // INVARIANT: Multi-route alternatives generated
    assert.ok(data.routes.length >= 2, 'Expected at least 2 route alternatives');

    const fastest = data.routes.find((r) => r.id === 'fastest') || data.routes[0];
    const recommended = data.routes.find((r) => r.isRecommended)!;

    // Recommendation logic chose the safest alternative
    assert.ok(recommended.safetyScore >= fastest.safetyScore);

    // INVARIANT: Trade-off summary explains the choice
    assert.ok(data.tradeOffSummary, 'Expected explainable trade-off summary');
    assert.ok(
      data.tradeOffSummary.includes('safety score') || data.tradeOffSummary.includes('Recommended'),
      `Summary should explain trade-off: ${data.tradeOffSummary}`
    );
  });

  it('T4-RW-03: Chittagong GEC Circle to Agrabad Industrial Corridor', async () => {
    const payload = {
      startLat: 22.3592,
      startLng: 91.8217,
      endLat: 22.3275,
      endLng: 91.8122,
      mode: 'driving' as const,
    };

    adapter.seedHazard({
      id: 'ctg-unlit-road',
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: 22.345,
      longitude: 91.817,
      isVerified: false,
    });

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    assertSafetyScoreBounds(route.safetyScore);
    assert.ok(route.distanceMeters > 3000, `Expected Chittagong corridor > 3000m, got ${route.distanceMeters}`);
  });

  it('T4-RW-04: Sylhet Pedestrian Walking Mode with Localized Warning', async () => {
    const payload = {
      startLat: 24.8949,
      startLng: 91.8687,
      endLat: 24.9045,
      endLng: 91.8625,
      mode: 'walking' as const,
    };

    // Plant hazard within 180m of start depart step
    adapter.seedHazard({
      id: 'sylhet-caution',
      category: 'MUGGING',
      severity: 'MEDIUM',
      latitude: 24.8953,
      longitude: 91.8683,
      isVerified: true,
    });

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    assert.strictEqual(data.mode, 'walking');

    const route = data.routes[0];
    const stepsWithAlert = route.steps.filter((s) => s.hazardWarning);
    assert.ok(stepsWithAlert.length >= 1, 'Expected localized hazard warning on steps');
  });

  it('T4-RW-05: Real-World Expiration & Recency Temporal Decay Invariant', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Hazard 1: Expired 2 hours ago
    adapter.seedHazard({
      id: 'hazard-expired',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.758,
      longitude: 90.398,
      expiresAt: new Date(Date.now() - 2 * 3600 * 1000), // Expired
      isVerified: true,
    });

    const res1 = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const data1 = assertValidSafeRouteResponse(res1.body);

    // Invariant: Expired hazard must NOT be intercepted
    assert.strictEqual(data1.bypassedHazardsCount, 0, 'Expired hazard should be ignored');
    assert.strictEqual(data1.routes[0].hazardCount, 0);

    // Hazard 2: Active incident (now)
    adapter.seedHazard({
      id: 'hazard-active-recent',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.758,
      longitude: 90.398,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // Active
      createdAt: new Date(), // Just reported
      isVerified: true,
    });

    const res2 = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const data2 = assertValidSafeRouteResponse(res2.body);

    // Invariant: Active recent hazard IS intercepted
    assert.strictEqual(data2.bypassedHazardsCount, 1, 'Active hazard must be intercepted');
    assert.ok(data2.routes[0].safetyScore < data1.routes[0].safetyScore);
  });
});
