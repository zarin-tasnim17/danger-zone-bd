import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertValidErrorResponse,
  assertSafetyScoreBounds,
} from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - R1: Routing Engine Limits', () => {
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

  it('T2-R1-01: Zero-Distance Micro Route (Start Equals End)', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.75,
      endLng: 90.39,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    // Invariant: Handled cleanly without division-by-zero or crash
    assert.strictEqual(route.distanceMeters, 0);
    assert.strictEqual(route.durationSeconds, 0);
    assert.strictEqual(route.safetyScore, 95.0);
    assert.strictEqual(data.safeDistanceMeters, 0);
  });

  it('T2-R1-02: Maximum Geographic Distance Across Bangladesh', async () => {
    // Tetulia (Panchagarh) to Teknaf (Cox\'s Bazar) ~800km
    const payload = {
      startLat: 26.63,
      startLng: 88.55,
      endLat: 20.86,
      endLng: 92.29,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const route = data.routes[0];

    // Invariant: Long-haul highway distance exceeds 700km and duration > 10 hours
    assert.ok(
      route.distanceMeters > 700_000,
      `Expected long-haul distance > 700,000m, got ${route.distanceMeters}`
    );
    assert.ok(
      route.durationSeconds > 36_000,
      `Expected duration > 36,000s (10h), got ${route.durationSeconds}`
    );
    assertSafetyScoreBounds(route.safetyScore);
  });

  it('T2-R1-03: Disconnected Island Coordinates Without Vehicular Bridge', async () => {
    // Mainland Chittagong to Sandwip Island (no vehicular road connection)
    const payload = {
      startLat: 22.35,
      startLng: 91.8,
      endLat: 22.48,
      endLng: 91.45,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    // Invariant: Reject with 422 or 400 when road network is disconnected
    assert.ok(
      res.status === 422 || res.status === 400,
      `Expected 422 or 400 for disconnected island route, got ${res.status}`
    );
    assertValidErrorResponse(res.body, 'route');
  });

  it('T2-R1-04: OSRM Upstream 503 Service Unavailable Resilience', async () => {
    // Simulate upstream OSRM 503 outage
    adapter.setMockOsrmFault('503');

    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);

    // Invariant: Return 503 or 502 with error envelope; NEVER fall back to straight line
    assert.ok(
      res.status === 503 || res.status === 502,
      `Expected 503 or 502 for upstream outage, got ${res.status}`
    );
    assertValidErrorResponse(res.body, 'unavailable');
  });

  it('T2-R1-05: OSRM Upstream Network Timeout Abort', async () => {
    // Simulate upstream OSRM hanging (> 5000ms)
    adapter.setMockOsrmFault('timeout', 6500);

    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload, { timeoutMs: 8000 });

    // Invariant: Graceful timeout (504 or 503) without unhandled exception
    assert.ok(
      res.status === 504 || res.status === 503,
      `Expected 504 or 503 for timeout abort, got ${res.status}`
    );
    assertValidErrorResponse(res.body, 'timeout');
  });
});
