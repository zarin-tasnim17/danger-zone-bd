import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import { assertValidSafeRouteResponse } from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - R2: PostGIS Street-Level Hazard Detection & Deduplication', () => {
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

  it('T1-R2-01: High Severity 250m Corridor Proximity Detection', async () => {
    // Farmgate to Mohakhali corridor
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Seed HIGH severity armed assault report within proximity of polyline midpoint
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;
    const hazardLat = midLat + 0.0003;
    const hazardLng = midLng + 0.0003;

    adapter.seedHazard({
      id: 'hazard-high-01',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: hazardLat,
      longitude: hazardLng,
      isVerified: true,
      description: 'Active mugging incident reported',
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

    // Invariant: Intercepts high hazard within 250m corridor
    assert.ok(route.hazardCount >= 1, `Expected hazardCount >= 1, got ${route.hazardCount}`);
    const intercepted = route.hazards.find((h) => h.id === 'hazard-high-01');
    assert.ok(intercepted, 'Seeded HIGH hazard must be present in hazards array');
    assert.strictEqual(intercepted.severity, 'HIGH');
    assert.ok(
      intercepted.distanceFromRouteMeters <= 250,
      `Expected distance <= 250m, got ${intercepted.distanceFromRouteMeters}`
    );

    // Invariant: Safety score penalized below clean saturation (95.0)
    assert.ok(
      route.safetyScore < 90.0,
      `Expected safetyScore < 90.0, got ${route.safetyScore}`
    );
  });

  it('T1-R2-02: Medium and Low Severity Buffer Boundary Interception', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // MEDIUM buffer is 150m. Place at ~110m (0.0009 deg)
    adapter.seedHazard({
      id: 'hazard-med-01',
      category: 'ROBBERY',
      severity: 'MEDIUM',
      latitude: midLat + 0.0008,
      longitude: midLng + 0.0005,
    });

    // LOW buffer is 80m. Place at ~120m (0.0011 deg) -> Must be EXCLUDED
    adapter.seedHazard({
      id: 'hazard-low-01',
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: midLat + 0.0012,
      longitude: midLng + 0.0008,
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

    // Invariant: MEDIUM hazard (within 150m) intercepted
    const medFound = route.hazards.some((h) => h.id === 'hazard-med-01');
    assert.ok(medFound, 'MEDIUM hazard at ~110m must be intercepted within 150m buffer');

    // Invariant: LOW hazard (at ~120m, exceeding 80m buffer) must NOT be intercepted
    const lowFound = route.hazards.some((h) => h.id === 'hazard-low-01');
    assert.strictEqual(
      lowFound,
      false,
      'LOW hazard beyond 80m buffer must be strictly excluded'
    );
  });

  it('T1-R2-03: Hazard Segment Deduplication Across Contiguous Street Nodes', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Single hazard located centrally near multiple adjacent nodes of the polyline
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    adapter.seedHazard({
      id: 'hazard-single-dedup-01',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat + 0.0003,
      longitude: midLng + 0.0003,
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

    // Invariant: Single hazard is counted exactly ONCE, not multiplied across adjacent segments
    assert.strictEqual(
      route.hazardCount,
      1,
      `Expected deduplicated hazardCount === 1, got ${route.hazardCount}`
    );
    assert.strictEqual(
      route.hazards.length,
      1,
      `Expected deduplicated hazards.length === 1, got ${route.hazards.length}`
    );
    assert.strictEqual(route.hazards[0].id, 'hazard-single-dedup-01');
  });

  it('T1-R2-04: Exclusion of RESOLVED and PURGED Hazards', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Seed RESOLVED hazard inside corridor (50m)
    adapter.seedHazard({
      id: 'hazard-resolved-01',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat + 0.0003,
      longitude: midLng + 0.0003,
      status: 'RESOLVED',
    });

    // Seed PURGED hazard inside corridor (50m)
    adapter.seedHazard({
      id: 'hazard-purged-01',
      category: 'SNATCHING',
      severity: 'HIGH',
      latitude: midLat + 0.0004,
      longitude: midLng + 0.0004,
      status: 'PURGED',
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

    // Invariant: Inactive reports have zero count and zero score impact
    assert.strictEqual(
      route.hazardCount,
      0,
      `Expected hazardCount === 0 for resolved/purged reports, got ${route.hazardCount}`
    );
    assert.strictEqual(
      route.hazards.length,
      0,
      'Hazards array must be empty'
    );
    assert.strictEqual(
      route.safetyScore,
      95.0,
      'Safety score must remain at pristine upper bound 95.0'
    );
  });

  it('T1-R2-05: Dynamic Recency & Expiration Time Decay Filtering', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Seed hazard that expired 15 minutes ago
    const expiredTime = new Date(Date.now() - 15 * 60 * 1000);

    adapter.seedHazard({
      id: 'hazard-expired-01',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: midLat + 0.0002,
      longitude: midLng + 0.0002,
      status: 'ACTIVE',
      expiresAt: expiredTime,
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

    // Invariant: Expired reports (expiresAt <= NOW()) are excluded
    assert.strictEqual(
      route.hazardCount,
      0,
      `Expected 0 hazards for expired reports, got ${route.hazardCount}`
    );
    assert.strictEqual(route.safetyScore, 95.0);
  });
});
