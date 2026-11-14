import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import { assertValidSafeRouteResponse } from '../harness/contractValidator';
import { haversineDistance } from '../harness/geoUtils';

describe('Tier 2: Boundary & Corner Cases - R4: Transport Modes & Navigation Guidance', () => {
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

  it('T2-R4-01: Default Transport Mode Assignment When Omitted', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      // mode explicitly omitted
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    // Invariant: Defaults to 'driving'
    assert.strictEqual(data.mode, 'driving');
  });

  it('T2-R4-02: Mode Recalculation Distinct Metric Profiles', async () => {
    const coords = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
    };

    const resWalk = await adapter.calculateSafeRoute({ ...coords, mode: 'walking' });
    const resDrive = await adapter.calculateSafeRoute({ ...coords, mode: 'driving' });

    assert.strictEqual(resWalk.status, 200);
    assert.strictEqual(resDrive.status, 200);

    const dataWalk = assertValidSafeRouteResponse(resWalk.body);
    const dataDrive = assertValidSafeRouteResponse(resDrive.body);

    const walkRoute = dataWalk.routes[0];
    const driveRoute = dataDrive.routes[0];

    // Invariant: Walking duration must be substantially longer than driving duration (>= 3x)
    assert.ok(
      walkRoute.durationSeconds >= driveRoute.durationSeconds * 3,
      `Expected walking duration (${walkRoute.durationSeconds}s) >= 3x driving (${driveRoute.durationSeconds}s)`
    );
  });

  it('T2-R4-03: Minimum Turn-by-Turn Steps for Any Route', async () => {
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
    const steps = data.routes[0].steps;

    // Invariant: Any valid route must contain at least depart and arrive maneuvers
    assert.ok(steps.length >= 2, `Expected at least 2 steps, got ${steps.length}`);
    assert.strictEqual(steps[0].maneuverType, 'depart');
    assert.strictEqual(steps[steps.length - 1].maneuverType, 'arrive');

    for (const step of steps) {
      assert.ok(typeof step.instruction === 'string' && step.instruction.length > 0);
      assert.ok(typeof step.distanceMeters === 'number' && step.distanceMeters >= 0);
      assert.ok(typeof step.durationSeconds === 'number' && step.durationSeconds >= 0);
      assert.ok(Array.isArray(step.location) && step.location.length === 2);
    }
  });

  it('T2-R4-04: Localized Step Hazard Alert 180m Distance Proximity Boundary', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Get baseline route to locate step coordinates
    const baseRes = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const baseSteps = assertValidSafeRouteResponse(baseRes.body).routes[0].steps;
    assert.ok(baseSteps.length >= 2);

    const targetStep = baseSteps[0];
    const [stepLat, stepLng] = targetStep.location;

    // Seed hazard A at ~50m from step location (within 180m)
    adapter.seedHazard({
      id: 'hazard-step-near',
      category: 'MUGGING',
      severity: 'HIGH',
      latitude: stepLat + 0.0003,
      longitude: stepLng + 0.0003,
      isVerified: true,
    });

    // Seed hazard B far away from any step (> 300m) but along corridor
    adapter.seedHazard({
      id: 'hazard-step-far',
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: stepLat + 0.003,
      longitude: stepLng + 0.003,
      isVerified: true,
    });

    const res = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const steps = assertValidSafeRouteResponse(res.body).routes[0].steps;

    // Invariant: Target step has hazard warning
    assert.ok(steps[0].hazardWarning, 'Expected first step to have hazard warning');
    assert.ok(
      steps[0].hazardWarning.includes('MUGGING') || steps[0].hazardWarning.includes('HIGH'),
      `Expected warning to mention hazard, got ${steps[0].hazardWarning}`
    );
  });

  it('T2-R4-05: Alert Deduplication Across Steps', async () => {
    const startLat = 23.75;
    const startLng = 90.39;
    const endLat = 23.765;
    const endLng = 90.405;

    // Plant 1 HIGH hazard
    adapter.seedHazard({
      id: 'hazard-single-high',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.7502,
      longitude: 90.3902,
      isVerified: true,
    });

    const res = await adapter.calculateSafeRoute({
      startLat,
      startLng,
      endLat,
      endLng,
      mode: 'driving',
    });
    const steps = assertValidSafeRouteResponse(res.body).routes[0].steps;

    // Count how many steps display this hazard warning
    const warnings = steps
      .map((s) => s.hazardWarning)
      .filter((w): w is string => typeof w === 'string');

    // Invariant: The same hazard is not warned repeatedly on every single step
    assert.ok(warnings.length <= 1, `Expected at most 1 warning for single hazard, got ${warnings.length}`);
  });
});
