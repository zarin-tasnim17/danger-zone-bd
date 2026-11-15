import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';
import { assertValidSafeRouteResponse } from '../harness/contractValidator';
import { assertCoordinateOrdering } from '../harness/geoUtils';

describe('Tier 1: Feature Coverage - R4: Transport Modes & Turn-by-Turn Navigation', () => {
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

  it('T1-R4-01: Walking Transport Mode Routing Profile', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.758,
      endLng: 90.398,
      mode: 'walking' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    assert.strictEqual(data.mode, 'walking');

    const route = data.routes[0];
    assert.ok(route.durationSeconds > 0, 'Walking route must have positive duration');
    assert.ok(route.distanceMeters > 0, 'Walking route must have positive distance');
  });

  it('T1-R4-02: Driving Transport Mode Routing Profile', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.758,
      endLng: 90.398,
      mode: 'driving' as const,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    assert.strictEqual(data.mode, 'driving');

    const route = data.routes[0];
    assert.ok(route.durationSeconds > 0);
  });

  it('T1-R4-03: Walking vs Driving Duration Divergence Ratio', async () => {
    const coordinates = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
    };

    // Driving query
    const resDrive = await adapter.calculateSafeRoute({ ...coordinates, mode: 'driving' });
    assert.strictEqual(resDrive.status, 200);
    const driveDuration = assertValidSafeRouteResponse(resDrive.body).routes[0].durationSeconds;

    // Walking query
    const resWalk = await adapter.calculateSafeRoute({ ...coordinates, mode: 'walking' });
    assert.strictEqual(resWalk.status, 200);
    const walkDuration = assertValidSafeRouteResponse(resWalk.body).routes[0].durationSeconds;

    // Invariant: Walking time is substantially longer than driving time (ratio >= 3.0)
    const ratio = walkDuration / driveDuration;
    assert.ok(
      ratio >= 3.0,
      `Expected walking/driving duration ratio >= 3.0, got ${ratio.toFixed(2)} (${walkDuration}s vs ${driveDuration}s)`
    );
  });

  it('T1-R4-04: Turn-by-Turn Maneuver Instructions Generation', async () => {
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

    // Invariant: Navigation steps array contains >= 2 structured maneuvers (depart and arrive)
    assert.ok(
      route.steps.length >= 2,
      `Expected route to contain >= 2 navigation steps, got ${route.steps.length}`
    );

    for (const step of route.steps) {
      assert.ok(typeof step.instruction === 'string' && step.instruction.length > 0);
      assert.ok(typeof step.maneuverType === 'string' && step.maneuverType.length > 0);
      assert.ok(typeof step.distanceMeters === 'number' && step.distanceMeters >= 0);
      assert.ok(typeof step.durationSeconds === 'number' && step.durationSeconds >= 0);
      assert.ok(Array.isArray(step.location) && step.location.length === 2);
      assertCoordinateOrdering([step.location]);
    }

    // First step is depart; last step is arrive
    assert.strictEqual(route.steps[0].maneuverType, 'depart');
    assert.strictEqual(route.steps[route.steps.length - 1].maneuverType, 'arrive');
  });

  it('T1-R4-05: Localized Hazard Alert Pairing on Navigation Steps', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving' as const,
    };

    // First fetch steps to get maneuver location
    const initialRes = await adapter.calculateSafeRoute(payload);
    const steps = assertValidSafeRouteResponse(initialRes.body).routes[0].steps;
    assert.ok(steps.length >= 2, 'Route must have multiple steps');

    // Place hazard near step 1 maneuver location
    const targetStep = steps[1];
    const hazardLat = targetStep.location[0];
    const hazardLng = targetStep.location[1];

    adapter.seedHazard({
      id: 'hazard-step-alert',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: hazardLat,
      longitude: hazardLng,
      isVerified: true,
      description: 'Major collision blocking intersection',
    });

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 200);

    const data = assertValidSafeRouteResponse(res.body);
    const updatedSteps = data.routes[0].steps;

    // Invariant: The step near the hazard contains a localized hazardWarning
    const warnedStep = updatedSteps.find((s) => s.hazardWarning !== undefined);
    assert.ok(
      warnedStep !== undefined,
      'Expected at least one navigation step to contain a localized hazardWarning'
    );
    assert.ok(
      warnedStep.hazardWarning!.includes('HIGH') ||
        warnedStep.hazardWarning!.toLowerCase().includes('accident') ||
        warnedStep.hazardWarning!.toLowerCase().includes('caution'),
      `Expected warning to describe the threat, got "${warnedStep.hazardWarning}"`
    );
  });
});
