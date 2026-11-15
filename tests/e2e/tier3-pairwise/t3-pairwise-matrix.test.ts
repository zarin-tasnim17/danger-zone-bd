import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter, TestHazard } from '../harness/apiAdapter';
import {
  assertValidSafeRouteResponse,
  assertSafetyScoreBounds,
  assertCoordinatesInBangladesh,
} from '../harness/contractValidator';
import { assertCoordinateOrdering } from '../harness/geoUtils';
import type { TransportMode } from '@repo/shared';

describe('Tier 3: Pairwise Combinatorial Matrix - All Parameter Intersections', () => {
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

  // Test Matrix Definitions
  interface PairwiseTestCase {
    id: string;
    description: string;
    mode: TransportMode;
    start: [number, number];
    end: [number, number];
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    density: number; // number of hazards
    isVerified: boolean;
    expectedScoreMax?: number;
    expectedScoreMin?: number;
  }

  const MATRIX_CASES: PairwiseTestCase[] = [
    {
      id: 'T3-PW-01',
      description: 'Walking + Short Route (<1km) + Clear Corridor (0 hazards)',
      mode: 'walking',
      start: [23.75, 90.39],
      end: [23.755, 90.395],
      severity: 'LOW',
      density: 0,
      isVerified: false,
      expectedScoreMin: 90.0,
      expectedScoreMax: 95.0,
    },
    {
      id: 'T3-PW-02',
      description: 'Driving + Medium Corridor (3km) + 1 HIGH Verified Hazard',
      mode: 'driving',
      start: [23.75, 90.39],
      end: [23.765, 90.405],
      severity: 'HIGH',
      density: 1,
      isVerified: true,
      expectedScoreMin: 65.0,
      expectedScoreMax: 85.0,
    },
    {
      id: 'T3-PW-03',
      description: 'Walking + Medium Corridor (3km) + 5 MEDIUM Unverified Hazards',
      mode: 'walking',
      start: [23.75, 90.39],
      end: [23.765, 90.405],
      severity: 'MEDIUM',
      density: 5,
      isVerified: false,
      expectedScoreMin: 60.0,
      expectedScoreMax: 85.0,
    },
    {
      id: 'T3-PW-04',
      description: 'Driving + Long Route (>10km) + 10 HIGH Clustered Hazards',
      mode: 'driving',
      start: [23.74, 90.38],
      end: [23.82, 90.42],
      severity: 'HIGH',
      density: 10,
      isVerified: true,
      expectedScoreMin: 15.0,
      expectedScoreMax: 45.0,
    },
    {
      id: 'T3-PW-05',
      description: 'Walking + Short Route + 3 LOW Verified Road Hazards',
      mode: 'walking',
      start: [23.78, 90.41],
      end: [23.788, 90.415],
      severity: 'LOW',
      density: 3,
      isVerified: true,
      expectedScoreMin: 70.0,
      expectedScoreMax: 90.0,
    },
    {
      id: 'T3-PW-06',
      description: 'Driving + Extreme Density (20 Mixed Hazards) Floor Saturation',
      mode: 'driving',
      start: [23.75, 90.39],
      end: [23.765, 90.405],
      severity: 'HIGH',
      density: 20,
      isVerified: true,
      expectedScoreMin: 15.0,
      expectedScoreMax: 25.0,
    },
  ];

  for (const tc of MATRIX_CASES) {
    it(`${tc.id}: ${tc.description}`, async () => {
      // Seed hazards
      const midLat = (tc.start[0] + tc.end[0]) / 2;
      const midLng = (tc.start[1] + tc.end[1]) / 2;

      for (let i = 0; i < tc.density; i++) {
        const offset = (i - tc.density / 2) * 0.0003;
        adapter.seedHazard({
          id: `pw-hazard-${tc.id}-${i}`,
          category: tc.severity === 'HIGH' ? 'ARMED_ASSAULT' : tc.severity === 'MEDIUM' ? 'MUGGING' : 'UNLIT_ROAD',
          severity: tc.severity,
          latitude: midLat + offset,
          longitude: midLng + offset,
          isVerified: tc.isVerified,
        });
      }

      const res = await adapter.calculateSafeRoute({
        startLat: tc.start[0],
        startLng: tc.start[1],
        endLat: tc.end[0],
        endLng: tc.end[1],
        mode: tc.mode,
      });

      assert.strictEqual(res.status, 200, `Expected 200 OK for ${tc.id}`);
      const data = assertValidSafeRouteResponse(res.body);
      const rec = data.routes.find((r) => r.isRecommended)!;

      // Invariant: Safety score within bounds
      assertSafetyScoreBounds(rec.safetyScore);

      if (tc.expectedScoreMin !== undefined) {
        assert.ok(
          rec.safetyScore >= tc.expectedScoreMin,
          `[${tc.id}] Expected safetyScore >= ${tc.expectedScoreMin}, got ${rec.safetyScore}`
        );
      }
      if (tc.expectedScoreMax !== undefined) {
        assert.ok(
          rec.safetyScore <= tc.expectedScoreMax,
          `[${tc.id}] Expected safetyScore <= ${tc.expectedScoreMax}, got ${rec.safetyScore}`
        );
      }

      // Invariant: Geometry ordering strictly [lat, lng]
      assertCoordinateOrdering(rec.geometry);

      // Invariant: Top-level parity with recommended
      assert.strictEqual(data.safeDistanceMeters, rec.distanceMeters);
      assert.strictEqual(data.waypoints.length, rec.geometry.length);
      assert.strictEqual(data.bypassedHazardsCount, rec.hazardCount);
    });
  }
});
