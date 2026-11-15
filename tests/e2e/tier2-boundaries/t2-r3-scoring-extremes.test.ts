import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertSafetyScoreBounds,
} from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - R3: Scoring Extremes & Edge Cases', () => {
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

  it('T2-R3-01: Upper Score Clamp Saturation Invariant', async () => {
    // 300m route with zero hazards
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.7525,
      endLng: 90.3925,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const score = data.routes[0].safetyScore;

    // Invariant: Never exceeds 95.0, never claims 100% safe
    assertSafetyScoreBounds(score);
    assert.strictEqual(score, 95.0, `Expected upper clamp saturation at 95.0, got ${score}`);
    assert.notStrictEqual(score, 100.0, 'Must never return 100.0');
  });

  it('T2-R3-02: Lower Score Clamp Floor Invariant', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Seed 10 active high-severity armed assault incidents directly along the corridor
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      adapter.seedHazard({
        id: `extreme-hazard-${i}`,
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: startLat + t * (endLat - startLat),
        longitude: startLng + t * (endLng - startLng),
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
    const score = data.routes[0].safetyScore;

    // Invariant: Strictly bounded at minimum floor 15.0; never drops below 15.0
    assertSafetyScoreBounds(score);
    assert.strictEqual(
      score,
      15.0,
      `Expected lower clamp floor at 15.0, got ${score}`
    );
    assert.strictEqual(data.routes[0].safetyRating, 'HIGH_HAZARD_EXPOSURE');
  });

  it('T2-R3-03: Equal Score Tie-Breaking Preference', async () => {
    // Multi-route scenario in clear corridor where both routes have safetyScore === 95.0
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
    assert.ok(data.routes.length >= 2, 'Requires >= 2 routes');

    // Both routes are in clear corridor (score = 95.0)
    for (const r of data.routes) {
      assert.strictEqual(r.safetyScore, 95.0);
    }

    // Invariant: In the event of a tie in safety score, the faster route is recommended
    const recommended = data.routes.find((r) => r.isRecommended)!;
    const fastest = [...data.routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
    assert.strictEqual(
      recommended.id,
      fastest.id,
      'When safety scores are equal, the fastest route must be recommended'
    );
  });

  it('T2-R3-04: Recency Decay Boundary (Recent vs Decayed Incident)', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;
    const hazardLat = (startLat + endLat) / 2;
    const hazardLng = (startLng + endLng) / 2 + 0.002;

    const now = Date.now();

    // Run Fresh: Incident reported 5 minutes ago
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-fresh',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: hazardLat,
      longitude: hazardLng,
      createdAt: new Date(now - 5 * 60 * 1000), // 5 min ago
      isVerified: true,
    });

    const resFresh = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreFresh = assertValidSafeRouteResponse(resFresh.body).routes[0].safetyScore;

    // Run Decayed: Incident reported 23 hours 50 minutes ago (near 24h expiration)
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-decayed',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: hazardLat,
      longitude: hazardLng,
      createdAt: new Date(now - (23 * 3600 + 50 * 60) * 1000), // 23h 50m ago
      isVerified: true,
    });

    const resDecayed = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreDecayed = assertValidSafeRouteResponse(resDecayed.body).routes[0].safetyScore;

    // Invariant: Fresh incident penalty > Decayed incident penalty => scoreFresh < scoreDecayed
    assert.ok(
      scoreFresh < scoreDecayed,
      `Expected fresh incident score (${scoreFresh}) < decayed incident score (${scoreDecayed})`
    );
  });

  it('T2-R3-05: Ultra-Short Route Scoring Behavior (< 100m)', async () => {
    // Ultra-short route (~60 meters)
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.7505,
      endLng: 90.3905,
      mode: 'walking' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    // Invariant: Distance penalty formula does not produce NaN, negative, or invalid score
    assert.ok(route.distanceMeters < 150, `Expected distance < 150m, got ${route.distanceMeters}`);
    assertSafetyScoreBounds(route.safetyScore);
    assert.strictEqual(Number.isNaN(route.safetyScore), false);
    assert.strictEqual(Number.isFinite(route.safetyScore), true);
  });
});
