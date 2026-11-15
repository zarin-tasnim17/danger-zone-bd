import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertValidErrorResponse,
} from '../harness/contractValidator';
import { haversineDistance } from '../harness/geoUtils';

describe('Tier 2: Boundary & Corner Cases - R2: Spatial Corridor Envelope & Incident Densities', () => {
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

  it('T2-R2-01: Coordinates on Exact Northern/Southern Bangladesh Territorial Boundary', async () => {
    // Extreme territorial edges within envelope: Tetulia tip (26.634, 88.550) to Teknaf tip (20.850, 92.290)
    const payload = {
      startLat: 26.634,
      startLng: 88.55,
      endLat: 20.85,
      endLng: 92.29,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    assert.ok(data.routes.length >= 1);
  });

  it('T2-R2-02: Coordinates Strictly Outside Bangladesh Territory Envelope', async () => {
    // Coordinates located in New Delhi, India
    const payload = {
      startLat: 28.6139,
      startLng: 77.209,
      endLat: 28.7,
      endLng: 77.3,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 400);

    // Invariant: Rejected immediately with descriptive validation error
    assertValidErrorResponse(res.body, 'boundaries');
  });

  it('T2-R2-03: Completely Empty Hazard Corridor', async () => {
    adapter.clearHazards();

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
    const route = data.routes[0];

    // Invariant: Zero hazards in corridor results in clean count and upper score clamp
    assert.strictEqual(route.hazardCount, 0);
    assert.strictEqual(route.hazards.length, 0);
    assert.strictEqual(route.safetyScore, 95.0);
    assert.strictEqual(route.safetyRating, 'LOW_HAZARD_EXPOSURE');
  });

  it('T2-R2-04: Extreme High Hazard Density Corridor (50+ Active Incidents)', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Seed 50 active HIGH severity incidents in the corridor
    for (let i = 0; i < 50; i++) {
      const t = i / 50;
      const lat = startLat + t * (endLat - startLat);
      const lng = startLng + t * (endLng - startLng);
      adapter.seedHazard({
        id: `dense-hazard-${i}`,
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: lat,
        longitude: lng,
        isVerified: true,
      });
    }

    const res = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });

    assert.strictEqual(res.status, 200);
    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    // Invariant: Handles dense clustering without crash; deduplicated hazardCount >= 30
    assert.ok(
      route.hazardCount >= 30,
      `Expected high hazard count >= 30, got ${route.hazardCount}`
    );

    // Invariant: Safety score strictly floored at 15.0; never drops below 15.0
    assert.strictEqual(
      route.safetyScore,
      15.0,
      `Expected score floored at 15.0, got ${route.safetyScore}`
    );
    assert.strictEqual(route.safetyRating, 'HIGH_HAZARD_EXPOSURE');
  });

  it('T2-R2-05: Incident Located Precisely at Proximity Buffer Boundary Threshold', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // First fetch the route to inspect the exact polyline coordinate
    const routeRes = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const polyline = assertValidSafeRouteResponse(routeRes.body).routes[0].geometry;
    const node = polyline[Math.floor(polyline.length / 2)];

    // 1 deg latitude is approx 111,139 meters.
    // Place inside hazard ~200m orthogonal to the route
    const insideLat = node[0] + 0.0018; 
    // Place outside hazard ~350m away from the route (> 250m buffer)
    const outsideLat = node[0] + 0.0035; 

    adapter.seedHazard({
      id: 'hazard-inside-threshold',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: insideLat,
      longitude: node[1],
      isVerified: true,
    });

    adapter.seedHazard({
      id: 'hazard-outside-threshold',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: outsideLat,
      longitude: node[1],
      isVerified: true,
    });

    const res = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });

    assert.strictEqual(res.status, 200);
    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    const insideFound = route.hazards.some((h) => h.id === 'hazard-inside-threshold');
    const outsideFound = route.hazards.some((h) => h.id === 'hazard-outside-threshold');

    assert.ok(insideFound, 'Incident inside 250m threshold must be detected');
    assert.strictEqual(outsideFound, false, 'Incident outside 250m threshold must be excluded');
  });
});
