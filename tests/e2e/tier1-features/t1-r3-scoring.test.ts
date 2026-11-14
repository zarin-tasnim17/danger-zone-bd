import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertSafetyScoreBounds,
} from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - R3: Safety Scoring & Route Recommendation', () => {
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

  it('T1-R3-01: Continuous Score Range Invariant [15.0, 95.0]', async () => {
    // Pristine route in hazard-free corridor
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
    const score = data.routes[0].safetyScore;

    // Invariant: Bounded in [15.0, 95.0] and strictly capped at 95.0 (no false 100% claims)
    assertSafetyScoreBounds(score);
    assert.strictEqual(
      score,
      95.0,
      `Clean route must saturate at upper bound 95.0, got ${score}`
    );
    assert.notStrictEqual(
      score,
      100.0,
      'System must NEVER return 100% safety'
    );
  });

  it('T1-R3-02: Quadratic Proximity Falloff Penalty', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Run A: Hazard close to road (~35m)
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-close',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat + 0.0003,
      longitude: midLng + 0.0003,
      isVerified: true,
    });

    const resA = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreA = assertValidSafeRouteResponse(resA.body).routes[0].safetyScore;

    // Run B: Identical hazard further away from road (~190m, inside 250m buffer)
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-far',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat + 0.0016,
      longitude: midLng + 0.0016,
      isVerified: true,
    });

    const resB = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreB = assertValidSafeRouteResponse(resB.body).routes[0].safetyScore;

    // Invariant: Closer hazard incurs larger penalty, resulting in strictly lower safety score
    assert.ok(
      scoreA < scoreB,
      `Expected closer hazard score (${scoreA}) < further hazard score (${scoreB})`
    );
  });

  it('T1-R3-03: Severity Weight Hierarchy Ranking', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Run High: 1 HIGH severity incident at ~40m
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-high',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat + 0.0003,
      longitude: midLng + 0.0003,
      isVerified: true,
    });

    const resHigh = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreHigh = assertValidSafeRouteResponse(resHigh.body).routes[0].safetyScore;

    // Run Low: 1 LOW severity incident at same ~40m distance
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-low',
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: midLat + 0.0003,
      longitude: midLng + 0.0003,
      isVerified: true,
    });

    const resLow = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const scoreLow = assertValidSafeRouteResponse(resLow.body).routes[0].safetyScore;

    // Invariant: High severity penalty > Low severity penalty => scoreHigh < scoreLow
    assert.ok(
      scoreHigh < scoreLow,
      `Expected HIGH severity score (${scoreHigh}) < LOW severity score (${scoreLow})`
    );
  });

  it('T1-R3-04: Safety Rating Category Thresholds', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Scenario 1: Clean route -> LOW_HAZARD_EXPOSURE (>= 80)
    adapter.clearHazards();
    const res1 = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const data1 = assertValidSafeRouteResponse(res1.body).routes[0];
    assert.ok(data1.safetyScore >= 80.0);
    assert.strictEqual(data1.safetyRating, 'LOW_HAZARD_EXPOSURE');

    // Scenario 2: Moderate hazard exposure -> MODERATE_HAZARD_EXPOSURE (50 <= score < 80)
    adapter.clearHazards();
    adapter.seedHazard({
      id: 'hazard-mod-1',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: midLat,
      longitude: midLng + 0.002,
      isVerified: true,
    });
    const res2 = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const data2 = assertValidSafeRouteResponse(res2.body).routes[0];
    assert.ok(
      data2.safetyScore >= 50.0 && data2.safetyScore < 80.0,
      `Expected score in [50, 80), got ${data2.safetyScore}`
    );
    assert.strictEqual(data2.safetyRating, 'MODERATE_HAZARD_EXPOSURE');

    // Scenario 3: High hazard exposure -> HIGH_HAZARD_EXPOSURE (< 50)
    adapter.clearHazards();
    for (let i = 0; i < 5; i++) {
      adapter.seedHazard({
        id: `hazard-dense-${i}`,
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: midLat + 0.0001 * i,
        longitude: midLng + 0.002,
        isVerified: true,
      });
    }
    const res3 = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const data3 = assertValidSafeRouteResponse(res3.body).routes[0];
    assert.ok(data3.safetyScore < 50.0, `Expected score < 50.0, got ${data3.safetyScore}`);
    assert.strictEqual(data3.safetyRating, 'HIGH_HAZARD_EXPOSURE');
  });

  it('T1-R3-05: Explainable Trade-off Summary Formulation', async () => {
    // Multi-route scenario where alternative paths exist
    const startLat = 23.74;
    const startLng = 90.38;
    const endLat = 23.77;
    const endLng = 90.41;

    // Place hazard on primary route
    adapter.seedHazard({
      id: 'hazard-artery',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.755,
      longitude: 90.395,
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

    // Invariant: tradeOffSummary provided for multi-route comparison
    assert.ok(
      typeof data.tradeOffSummary === 'string' && data.tradeOffSummary.length > 10,
      `Expected descriptive tradeOffSummary, got "${data.tradeOffSummary}"`
    );
    // Invariant: Does not make false 100% safety claims
    assert.strictEqual(
      data.tradeOffSummary.toLowerCase().includes('100% safe'),
      false,
      'Trade-off summary must never claim 100% safety'
    );
  });
});
