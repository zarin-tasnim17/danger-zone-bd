import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DangerIncident } from '@repo/shared';
import {
  calculateDistanceMeters,
  evaluateHazardProximity,
  isHazardEligible,
  isEligibleHazard,
  ProximityAlertTracker,
  type ProximityAlertItem,
  type ProximityTrackerEntry,
} from '@/lib/proximityEngine';
import { useMapStore } from '@/store/useMapStore';
import { useIncidentStore } from '@/store/useIncidentStore';
import { installBrowserGlobals, BrowserSandboxHandle } from '../framework/domEnv';

// Helper to generate consistent mock DangerIncident fixtures
const createMockHazard = (overrides: Partial<DangerIncident> = {}): DangerIncident => ({
  id: 'hazard-dhaka-001',
  title: 'Roadblock / Clash Warning',
  description: 'Clash reported near intersection',
  category: 'Clash',
  severity: 'high',
  coordinates: {
    lat: 23.75,
    lng: 90.38,
  },
  locationName: 'Dhanmondi 27, Dhaka',
  timestamp: new Date().toISOString(),
  upvotes: 5,
  downvotes: 0,
  status: 'community_confirmed',
  reportedBy: 'Citizen Report',
  verifiedCount: 5,
  fuzzedRadiusMeters: 150,
  ...overrides,
});

describe('[Unit][ProximityEngine] Milestone 2 Real-Time Danger Zone Proximity Engine', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    useMapStore.setState({
      userLocation: null,
      userAccuracy: null,
    });
    useIncidentStore.setState({
      incidents: [],
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // ============================================================================
  // SECTION 1: Haversine Geodesic Distance Accuracy across Bangladesh
  // ============================================================================
  describe('1. Haversine Geodesic Distance Accuracy across Bangladesh', () => {
    it('01-01: calculateDistanceMeters between identical points returns exactly 0m', () => {
      const d1 = calculateDistanceMeters(23.75, 90.38, 23.75, 90.38);
      const d2 = calculateDistanceMeters(22.3587, 91.8215, 22.3587, 91.8215);
      assert.equal(d1, 0);
      assert.equal(d2, 0);
    });

    it('01-02: Known Dhaka distance (Shahbagh to TSC) calculates within +-2m of geodesic truth (~623m)', () => {
      // Shahbagh: 23.7381, 90.3956; TSC: 23.7325, 90.3956
      const d = calculateDistanceMeters(23.7381, 90.3956, 23.7325, 90.3956);
      assert.ok(Math.abs(d - 623) <= 2, `Expected ~623m, got ${d}m`);
    });

    it('01-03: Known Chittagong distance (GEC Circle to Agrabad) calculates within +-25m of geodesic truth (~3,605m)', () => {
      // GEC Circle: 22.3587, 91.8215; Agrabad Commercial Area: 22.3275, 91.8122
      const d = calculateDistanceMeters(22.3587, 91.8215, 22.3275, 91.8122);
      assert.ok(Math.abs(d - 3605) <= 25, `Expected ~3,605m, got ${d}m`);
    });

    it('01-04: Known Sylhet distance (Zindabazar to Amberkhana) calculates within +-10m of geodesic truth (~990m)', () => {
      // Zindabazar: 24.8949, 91.8687; Amberkhana: 24.9037, 91.8702
      const d = calculateDistanceMeters(24.8949, 91.8687, 24.9037, 91.8702);
      assert.ok(Math.abs(d - 990) <= 10, `Expected ~990m, got ${d}m`);
    });

    it('01-05: Symmetry property calculateDistanceMeters(A, B) === calculateDistanceMeters(B, A) and sub-meter precision', () => {
      const dAB = calculateDistanceMeters(23.75, 90.38, 23.76, 90.39);
      const dBA = calculateDistanceMeters(23.76, 90.39, 23.75, 90.38);
      assert.equal(dAB, dBA);

      // Micro-displacement < 1 meter does not produce NaN or negative distance
      const microD = calculateDistanceMeters(23.750000, 90.380000, 23.750001, 90.380001);
      assert.ok(!Number.isNaN(microD));
      assert.ok(microD >= 0);
    });
  });

  // ============================================================================
  // SECTION 2: Proximity Entry Detection (Threshold <= 200m)
  // ============================================================================
  describe('2. Proximity Entry Detection (Threshold <= 200m)', () => {
    it('02-01: User entering at 150m triggers proximity alert and sets isInsideDangerZone = true', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      // ~150m north is 23.751349, 90.380000
      const tracker = new ProximityAlertTracker({ thresholdMeters: 200 });
      const res = tracker.evaluate({ lat: 23.751349, lng: 90.380000 }, [hazard]);

      assert.equal(res.isInsideDangerZone, true);
      assert.equal(res.activeAlerts.length, 1);
      assert.equal(res.closestAlert?.hazard.id, hazard.id);
      assert.ok(res.activeAlerts[0].distanceMeters <= 200);
    });

    it('02-02: User at exactly 200m boundary triggers proximity alert (boundary condition <= 200m)', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      // Exactly 200m north: 23.751799, 90.380000
      const d = calculateDistanceMeters(23.750000, 90.380000, 23.751799, 90.380000);
      assert.equal(d, 200);

      const result = evaluateHazardProximity(
        { lat: 23.751799, lng: 90.380000 },
        10,
        [hazard],
        new Map(),
        { thresholdMeters: 200 }
      );

      assert.equal(result.newAlerts.length, 1);
      assert.equal(result.activeAlerts.length, 1);
      assert.equal(result.activeAlerts[0].distanceMeters, 200);
    });

    it('02-03: Proximity alert item contains correct hazard metadata, distanceMeters, and enteredAt timestamp', () => {
      const timestampNow = 1700000000000;
      const hazard = createMockHazard({
        id: 'hazard-meta-test',
        title: 'Intersection Obstruction',
        category: 'Roadblock',
        coordinates: { lat: 23.750000, lng: 90.380000 },
      });

      const result = evaluateHazardProximity(
        { lat: 23.751349, lng: 90.380000 },
        15,
        [hazard],
        new Map(),
        { currentTime: timestampNow }
      );

      assert.equal(result.newAlerts.length, 1);
      const alert = result.newAlerts[0];
      assert.equal(alert.hazard.id, 'hazard-meta-test');
      assert.equal(alert.hazard.title, 'Intersection Obstruction');
      assert.equal(alert.hazard.category, 'Roadblock');
      assert.equal(alert.distanceMeters, 150);
      assert.equal(alert.enteredAt, timestampNow);
    });

    it('02-04: Custom thresholdMeters (e.g. 300m) respects configured value and triggers at 250m', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      // 250m north: 23.752248, 90.380000
      const resultDefault = evaluateHazardProximity(
        { lat: 23.752248, lng: 90.380000 },
        10,
        [hazard],
        new Map(),
        { thresholdMeters: 200 }
      );
      assert.equal(resultDefault.newAlerts.length, 0);

      const resultCustom = evaluateHazardProximity(
        { lat: 23.752248, lng: 90.380000 },
        10,
        [hazard],
        new Map(),
        { thresholdMeters: 300 }
      );
      assert.equal(resultCustom.newAlerts.length, 1);
      assert.equal(resultCustom.activeAlerts.length, 1);
    });

    it('02-05: Disabled engine (enabled: false) suppresses proximity evaluation and triggers zero alerts', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const result = evaluateHazardProximity(
        { lat: 23.750500, lng: 90.380000 }, // ~55m away
        10,
        [hazard],
        new Map(),
        { enabled: false }
      );

      assert.equal(result.newAlerts.length, 0);
      assert.equal(result.activeAlerts.length, 0);
      assert.equal(result.closestAlert, null);
    });
  });

  // ============================================================================
  // SECTION 3: Distance Outside Threshold (> 200m)
  // ============================================================================
  describe('3. Distance Outside Threshold (> 200m)', () => {
    it('03-01: User at 201m boundary does NOT trigger proximity alert (> 200m)', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      // Exactly 201m north: 23.751808, 90.380000
      const d = calculateDistanceMeters(23.750000, 90.380000, 23.751808, 90.380000);
      assert.equal(d, 201);

      const result = evaluateHazardProximity(
        { lat: 23.751808, lng: 90.380000 },
        10,
        [hazard],
        new Map(),
        { thresholdMeters: 200 }
      );

      assert.equal(result.newAlerts.length, 0);
      assert.equal(result.activeAlerts.length, 0);
      assert.equal(result.closestAlert, null);
    });

    it('03-02: User at 250m does not trigger proximity warning', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const result = evaluateHazardProximity(
        { lat: 23.752248, lng: 90.380000 }, // 250m
        10,
        [hazard],
        new Map(),
        { thresholdMeters: 200 }
      );

      assert.equal(result.newAlerts.length, 0);
      assert.equal(result.activeAlerts.length, 0);
    });

    it('03-03: Distant hazard (e.g. 200km in Chittagong while user is in Dhaka) produces zero active alerts', () => {
      const ctgHazard = createMockHazard({
        id: 'hazard-ctg-001',
        coordinates: { lat: 22.3587, lng: 91.8215 }, // Chittagong
      });
      // User is in Dhaka
      const result = evaluateHazardProximity(
        { lat: 23.750000, lng: 90.380000 },
        10,
        [ctgHazard],
        new Map()
      );

      assert.equal(result.newAlerts.length, 0);
      assert.equal(result.activeAlerts.length, 0);
      assert.equal(result.closestAlert, null);
    });
  });

  // ============================================================================
  // SECTION 4: Incident Status & Boundary Eligibility Filtering
  // ============================================================================
  describe('4. Incident Status & Boundary Eligibility Filtering', () => {
    it('04-01: Active incidents (community_confirmed, authority_verified, unverified, disputed) within 200m are eligible and trigger alerts', () => {
      const statuses = ['community_confirmed', 'authority_verified', 'unverified', 'disputed', 'active'] as const;
      for (const st of statuses) {
        const h = createMockHazard({ id: `hazard-${st}`, status: st as any });
        assert.equal(isHazardEligible(h), true, `Status ${st} must be eligible`);
        assert.equal(isEligibleHazard(h), true, 'Alias isEligibleHazard must match');

        const result = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [h]);
        assert.equal(result.newAlerts.length, 1, `Status ${st} must trigger alert`);
      }
    });

    it('04-02: Resolved incident (status = resolved, case-insensitive) within 200m is excluded', () => {
      for (const val of ['resolved', 'Resolved', 'RESOLVED']) {
        const h = createMockHazard({ id: `res-${val}`, status: val as any });
        assert.equal(isHazardEligible(h), false);

        const result = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [h]);
        assert.equal(result.newAlerts.length, 0);
      }
    });

    it('04-03: Purged incident (status = purged, case-insensitive) within 200m is excluded', () => {
      for (const val of ['purged', 'Purged', 'PURGED']) {
        const h = createMockHazard({ id: `purged-${val}`, status: val as any });
        assert.equal(isHazardEligible(h), false);

        const result = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [h]);
        assert.equal(result.newAlerts.length, 0);
      }
    });

    it('04-04: Expired incident (status = expired, case-insensitive, or expiresAt <= currentTime) is excluded from alerts', () => {
      const hExpiredStatus = createMockHazard({ id: 'exp-status', status: 'expired' as any });
      assert.equal(isHazardEligible(hExpiredStatus), false);

      const pastTime = Date.now() - 60000;
      const hExpiredField = createMockHazard({
        id: 'exp-field',
        ...({ expiresAt: new Date(pastTime).toISOString() } as any),
      });
      assert.equal(isHazardEligible(hExpiredField, { currentTime: Date.now() }), false);

      const result = evaluateHazardProximity(
        { lat: 23.751349, lng: 90.380000 },
        10,
        [hExpiredStatus, hExpiredField]
      );
      assert.equal(result.newAlerts.length, 0);
    });

    it('04-05: Deleted or inactive incident (deleted, inactive, archived, rejected) is safely excluded', () => {
      for (const st of ['deleted', 'inactive', 'archived', 'rejected']) {
        const h = createMockHazard({ id: `del-${st}`, status: st as any });
        assert.equal(isHazardEligible(h), false);

        const result = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [h]);
        assert.equal(result.newAlerts.length, 0);
      }
    });

    it('04-06: Incident with null, NaN, or missing coordinates is excluded without throwing runtime errors', () => {
      const invalidCoords = [
        null,
        undefined,
        { lat: NaN, lng: 90.38 },
        { lat: 23.75, lng: NaN },
        { lat: Infinity, lng: 90.38 },
        { lat: 100, lng: 90.38 }, // invalid latitude > 90
      ];

      for (const coords of invalidCoords) {
        const h = createMockHazard({ coordinates: coords as any });
        assert.doesNotThrow(() => {
          assert.equal(isHazardEligible(h), false);
        });
      }
    });

    it('04-07: Incident outside Bangladesh territorial bounds is excluded from proximity alerts', () => {
      // London: 51.5074, -0.1278 (outside Bangladesh)
      const foreignHazard = createMockHazard({
        coordinates: { lat: 51.5074, lng: -0.1278 },
      });
      assert.equal(isHazardEligible(foreignHazard, { checkBangladeshBounds: true }), false);

      const result = evaluateHazardProximity(
        { lat: 51.5074, lng: -0.1278 },
        10,
        [foreignHazard],
        new Map(),
        { checkBangladeshBounds: true }
      );
      assert.equal(result.newAlerts.length, 0);
    });

    it('04-08: Active incident that becomes resolved in real time while user is inside is immediately removed and fires onExit', () => {
      const hazard = createMockHazard({ id: 'hazard-dynamic-res', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const userCoords = { lat: 23.751349, lng: 90.380000 }; // 150m inside

      // Tick 1: user enters active hazard
      const tick1 = evaluateHazardProximity(userCoords, 10, [hazard]);
      assert.equal(tick1.newAlerts.length, 1);
      assert.equal(tick1.activeAlerts.length, 1);

      // Tick 2: hazard is marked resolved via WebSocket / REST
      const resolvedHazard = { ...hazard, status: 'resolved' as any };
      const tick2 = evaluateHazardProximity(
        userCoords,
        10,
        [resolvedHazard],
        tick1.updatedTrackerState
      );

      assert.equal(tick2.newAlerts.length, 0);
      assert.equal(tick2.activeAlerts.length, 0);
      assert.deepEqual(tick2.exitedHazardIds, ['hazard-dynamic-res']);
    });
  });

  // ============================================================================
  // SECTION 5: Alert Deduplication during Continuous Inside Movement
  // ============================================================================
  describe('5. Alert Deduplication during Continuous Inside Movement', () => {
    it('05-01: Multiple consecutive GPS updates within 200m radius fire onAlert callback exactly once', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const alerted: ProximityAlertItem[] = [];
      const tracker = new ProximityAlertTracker({
        onAlert: (item) => alerted.push(item),
      });

      // 20 GPS position fixes while user walks inside 150m – 100m zone
      for (let i = 0; i < 20; i++) {
        const offsetLat = 23.751349 - i * 0.00002;
        tracker.evaluate({ lat: offsetLat, lng: 90.380000 }, [hazard]);
      }

      assert.equal(alerted.length, 1, 'onAlert must be called exactly once during continuous presence');
      assert.equal(tracker.getAlertCount(hazard.id), 1);
    });

    it('05-02: Moving closer within hazard updates distanceMeters dynamically without duplicate alert', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      let trackerState = new Map<string, ProximityTrackerEntry>();

      // Entry at ~180m
      const step1 = evaluateHazardProximity(
        { lat: 23.75162, lng: 90.380000 },
        10,
        [hazard],
        trackerState
      );
      assert.equal(step1.newAlerts.length, 1);
      assert.equal(step1.activeAlerts[0].distanceMeters, 180);
      trackerState = step1.updatedTrackerState;

      // Moving to ~100m
      const step2 = evaluateHazardProximity(
        { lat: 23.75090, lng: 90.380000 },
        10,
        [hazard],
        trackerState
      );
      assert.equal(step2.newAlerts.length, 0, 'No duplicate alert on movement');
      assert.equal(step2.activeAlerts[0].distanceMeters, 100, 'Distance must update dynamically');
      trackerState = step2.updatedTrackerState;

      // Moving to ~50m
      const step3 = evaluateHazardProximity(
        { lat: 23.75045, lng: 90.380000 },
        10,
        [hazard],
        trackerState
      );
      assert.equal(step3.newAlerts.length, 0);
      assert.equal(step3.activeAlerts[0].distanceMeters, 50);
    });

    it('05-03: Wandering back and forth inside danger zone produces zero duplicate alerts', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const alerted: ProximityAlertItem[] = [];
      const tracker = new ProximityAlertTracker({
        onAlert: (item) => alerted.push(item),
      });

      // Wander back and forth between 60m and 160m
      const points = [
        { lat: 23.75144, lng: 90.380000 }, // 160m
        { lat: 23.75054, lng: 90.380000 }, // 60m
        { lat: 23.75135, lng: 90.380000 }, // 150m
        { lat: 23.75072, lng: 90.380000 }, // 80m
        { lat: 23.75150, lng: 90.380000 }, // 167m
      ];

      for (const pt of points) {
        tracker.evaluate(pt, [hazard]);
      }

      assert.equal(alerted.length, 1);
    });

    it('05-04: Incident metadata updates (e.g. description or vote changes) update existing alert item without duplicating', () => {
      const hazardV1 = createMockHazard({
        id: 'h-meta-update',
        coordinates: { lat: 23.750000, lng: 90.380000 },
        upvotes: 5,
        description: 'Initial report',
      });

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const userCoords = { lat: 23.751349, lng: 90.380000 };

      const res1 = evaluateHazardProximity(userCoords, 10, [hazardV1], trackerState);
      assert.equal(res1.newAlerts.length, 1);
      assert.equal(res1.activeAlerts[0].hazard.upvotes, 5);
      trackerState = res1.updatedTrackerState;

      // Metadata changes while user is inside
      const hazardV2 = { ...hazardV1, upvotes: 12, description: 'Updated report with photos' };
      const res2 = evaluateHazardProximity(userCoords, 10, [hazardV2], trackerState);
      assert.equal(res2.newAlerts.length, 0);
      assert.equal(res2.activeAlerts[0].hazard.upvotes, 12);
      assert.equal(res2.activeAlerts[0].hazard.description, 'Updated report with photos');
    });
  });

  // ============================================================================
  // SECTION 6: 10-Minute (600s) Cooldown per Hazard ID
  // ============================================================================
  describe('6. 10-Minute (600s) Cooldown per Hazard ID', () => {
    it('06-01: Re-entering hazard zone at t = 2 minutes suppresses alert due to active 10-minute cooldown', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const insidePos = { lat: 23.751349, lng: 90.380000 }; // 150m
      const outsidePos = { lat: 23.752500, lng: 90.380000 }; // 278m (clean exit > 220m)

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const t0 = 1000000000000;

      // 1. Initial entry at t = 0
      const step1 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 });
      assert.equal(step1.newAlerts.length, 1);
      trackerState = step1.updatedTrackerState;

      // 2. User exits at t = 1 minute (60,000ms)
      const step2 = evaluateHazardProximity(outsidePos, 10, [hazard], trackerState, { currentTime: t0 + 60000 });
      assert.deepEqual(step2.exitedHazardIds, [hazard.id]);
      trackerState = step2.updatedTrackerState;

      // 3. User re-enters at t = 2 minutes (120,000ms < 600,000ms cooldown)
      const step3 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 + 120000 });
      assert.equal(step3.newAlerts.length, 0, 'New alert chime must be suppressed within 10-minute cooldown');
      assert.equal(step3.activeAlerts.length, 1, 'Hazard must still appear in activeAlerts for HUD display');
    });

    it('06-02: Re-entering hazard zone at t = 599,999ms (1ms before cooldown) suppresses alert', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const insidePos = { lat: 23.751349, lng: 90.380000 };
      const outsidePos = { lat: 23.752500, lng: 90.380000 };

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const t0 = 1000000000000;

      const step1 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 });
      trackerState = step1.updatedTrackerState;

      const step2 = evaluateHazardProximity(outsidePos, 10, [hazard], trackerState, { currentTime: t0 + 300000 });
      trackerState = step2.updatedTrackerState;

      // Re-enter 1ms before 10 minutes (599,999ms)
      const step3 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 + 599999 });
      assert.equal(step3.newAlerts.length, 0, 'Must suppress alert at 599,999ms');
    });

    it('06-03: Re-entering hazard zone at exactly t = 600,000ms triggers a new alert', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const insidePos = { lat: 23.751349, lng: 90.380000 };
      const outsidePos = { lat: 23.752500, lng: 90.380000 };

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const t0 = 1000000000000;

      const step1 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 });
      trackerState = step1.updatedTrackerState;

      const step2 = evaluateHazardProximity(outsidePos, 10, [hazard], trackerState, { currentTime: t0 + 300000 });
      trackerState = step2.updatedTrackerState;

      // Re-enter at exactly 600,000ms (10 minutes)
      const step3 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 + 600000 });
      assert.equal(step3.newAlerts.length, 1, 'Must fire new alert at exactly 600,000ms');
      assert.equal(step3.activeAlerts.length, 1);
    });

    it('06-04: Re-entering hazard zone at t = 11 minutes (> 600s) triggers a new alert', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const insidePos = { lat: 23.751349, lng: 90.380000 };
      const outsidePos = { lat: 23.752500, lng: 90.380000 };

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const t0 = 1000000000000;

      const step1 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 });
      trackerState = step1.updatedTrackerState;

      const step2 = evaluateHazardProximity(outsidePos, 10, [hazard], trackerState, { currentTime: t0 + 300000 });
      trackerState = step2.updatedTrackerState;

      // Re-enter at 11 minutes (660,000ms)
      const step3 = evaluateHazardProximity(insidePos, 10, [hazard], trackerState, { currentTime: t0 + 660000 });
      assert.equal(step3.newAlerts.length, 1, 'Must fire new alert at 11 minutes');
    });

    it('06-05: Cooldown timestamps are tracked independently per hazard ID', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.755000, lng: 90.380000 } });

      let trackerState = new Map<string, ProximityTrackerEntry>();
      const t0 = 1000000000000;

      // Enter Hazard A at t = 0
      const step1 = evaluateHazardProximity(
        { lat: 23.751349, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState,
        { currentTime: t0 }
      );
      assert.equal(step1.newAlerts.length, 1);
      assert.equal(step1.newAlerts[0].hazard.id, 'hazard-A');
      trackerState = step1.updatedTrackerState;

      // Move to neutral zone at t = 60,000
      const step2 = evaluateHazardProximity(
        { lat: 23.753000, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState,
        { currentTime: t0 + 60000 }
      );
      assert.deepEqual(step2.exitedHazardIds, ['hazard-A']);
      trackerState = step2.updatedTrackerState;

      // Enter Hazard B for first time at t = 120,000
      const step3 = evaluateHazardProximity(
        { lat: 23.754000, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState,
        { currentTime: t0 + 120000 }
      );
      assert.equal(step3.newAlerts.length, 1);
      assert.equal(step3.newAlerts[0].hazard.id, 'hazard-B', 'Hazard B must alert independently');
    });
  });

  // ============================================================================
  // SECTION 7: Exit Reset with Hysteresis Buffer (220m) & Re-entry
  // ============================================================================
  describe('7. Exit Reset with Hysteresis Buffer (220m) & Re-entry', () => {
    it('07-01: User moving to 210m remains inside danger zone (hysteresis buffer = 200m + 20m = 220m)', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      let trackerState = new Map<string, ProximityTrackerEntry>();

      // Entry at 150m
      const step1 = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [hazard], trackerState);
      assert.equal(step1.newAlerts.length, 1);
      trackerState = step1.updatedTrackerState;

      // Move to 210m (23.751888, 90.380000)
      const d = calculateDistanceMeters(23.750000, 90.380000, 23.751888, 90.380000);
      assert.equal(d, 210);

      const step2 = evaluateHazardProximity({ lat: 23.751888, lng: 90.380000 }, 10, [hazard], trackerState);
      assert.equal(step2.exitedHazardIds.length, 0, 'Must NOT exit at 210m due to hysteresis buffer');
      assert.equal(step2.activeAlerts.length, 1);
      assert.equal(step2.activeAlerts[0].distanceMeters, 210);
    });

    it('07-02: User moving to 221m (> 220m) triggers onExit and resets isInsideDangerZone to false', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const exited: string[] = [];
      const tracker = new ProximityAlertTracker({
        onExit: (id) => exited.push(id),
      });

      // Entry at 150m
      tracker.evaluate({ lat: 23.751349, lng: 90.380000 }, [hazard]);

      // Move beyond 220m to 221m (23.751988, 90.380000)
      const d = calculateDistanceMeters(23.750000, 90.380000, 23.751988, 90.380000);
      assert.equal(d, 221);

      const res = tracker.evaluate({ lat: 23.751988, lng: 90.380000 }, [hazard]);
      assert.equal(res.isInsideDangerZone, false);
      assert.equal(res.activeAlerts.length, 0);
      assert.deepEqual(exited, [hazard.id]);
    });

    it('07-03: Fluctuation between 205m and 218m maintains continuous inside state without exit flutter', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      let trackerState = new Map<string, ProximityTrackerEntry>();

      // Enter at 150m
      const initial = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [hazard], trackerState);
      trackerState = initial.updatedTrackerState;

      // Jitter back and forth inside the 200m - 220m hysteresis corridor
      const hysteresisPositions = [
        { lat: 23.751844, lng: 90.380000 }, // ~205m
        { lat: 23.751960, lng: 90.380000 }, // ~218m
        { lat: 23.751853, lng: 90.380000 }, // ~206m
        { lat: 23.751933, lng: 90.380000 }, // ~215m
      ];

      for (const pos of hysteresisPositions) {
        const res = evaluateHazardProximity(pos, 10, [hazard], trackerState);
        assert.equal(res.exitedHazardIds.length, 0, 'No exit should trigger within hysteresis corridor');
        assert.equal(res.newAlerts.length, 0, 'No re-alert within corridor');
        assert.equal(res.activeAlerts.length, 1, 'Must remain inside');
        trackerState = res.updatedTrackerState;
      }
    });

    it('07-04: Clean exit beyond 220m resets proximity visit tracking state cleanly', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      let trackerState = new Map<string, ProximityTrackerEntry>();

      // Entry
      const res1 = evaluateHazardProximity({ lat: 23.751349, lng: 90.380000 }, 10, [hazard], trackerState);
      trackerState = res1.updatedTrackerState;
      assert.equal(trackerState.get(hazard.id)?.isInside, true);

      // Clean exit at 300m
      const res2 = evaluateHazardProximity({ lat: 23.752697, lng: 90.380000 }, 10, [hazard], trackerState);
      trackerState = res2.updatedTrackerState;
      assert.equal(trackerState.get(hazard.id)?.isInside, false);
      assert.deepEqual(res2.exitedHazardIds, [hazard.id]);
    });
  });

  // ============================================================================
  // SECTION 8: Multiple Nearby Hazards & Proximity Sorting
  // ============================================================================
  describe('8. Multiple Nearby Hazards & Proximity Sorting', () => {
    it('08-01: Two nearby hazards within 200m produce two distinct alerts in activeAlerts', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750719, lng: 90.380000 } }); // ~80m away
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.751439, lng: 90.380000 } }); // ~160m away

      const res = evaluateHazardProximity(
        { lat: 23.750000, lng: 90.380000 },
        10,
        [hazardA, hazardB]
      );

      assert.equal(res.activeAlerts.length, 2);
      assert.equal(res.newAlerts.length, 2);
    });

    it('08-02: closestAlert strictly selects the hazard with the minimum distance', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750719, lng: 90.380000 } }); // ~80m
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.751439, lng: 90.380000 } }); // ~160m

      const res = evaluateHazardProximity(
        { lat: 23.750000, lng: 90.380000 },
        10,
        [hazardB, hazardA] // passed in reverse order
      );

      // Must be sorted ascending: closest first
      assert.equal(res.activeAlerts[0].hazard.id, 'hazard-A');
      assert.equal(res.activeAlerts[1].hazard.id, 'hazard-B');
      assert.equal(res.closestAlert?.hazard.id, 'hazard-A');
      assert.equal(res.closestAlert?.distanceMeters, 80);
    });

    it('08-03: User moving closer to second hazard dynamically switches closestAlert', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.752500, lng: 90.380000 } });

      let trackerState = new Map<string, ProximityTrackerEntry>();

      // User at 23.750500: closer to A (~56m) than B (~222m)
      const res1 = evaluateHazardProximity(
        { lat: 23.750500, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState
      );
      assert.equal(res1.closestAlert?.hazard.id, 'hazard-A');
      trackerState = res1.updatedTrackerState;

      // User moves north to 23.752100: closer to B (~44m) than A (~233m)
      const res2 = evaluateHazardProximity(
        { lat: 23.752100, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState
      );
      assert.equal(res2.closestAlert?.hazard.id, 'hazard-B', 'closestAlert must dynamically switch to nearest hazard');
    });

    it('08-04: Exiting one hazard while remaining inside another updates activeAlerts and keeps closestAlert accurate', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.751500, lng: 90.380000 } });

      let trackerState = new Map<string, ProximityTrackerEntry>();

      // User starts at 23.750800 (~89m from A, ~78m from B: inside both)
      const res1 = evaluateHazardProximity(
        { lat: 23.750800, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState
      );
      assert.equal(res1.activeAlerts.length, 2);
      trackerState = res1.updatedTrackerState;

      // User moves north to 23.752200 (~245m from A [exited >220m], ~78m from B [inside])
      const res2 = evaluateHazardProximity(
        { lat: 23.752200, lng: 90.380000 },
        10,
        [hazardA, hazardB],
        trackerState
      );

      assert.deepEqual(res2.exitedHazardIds, ['hazard-A']);
      assert.equal(res2.activeAlerts.length, 1);
      assert.equal(res2.activeAlerts[0].hazard.id, 'hazard-B');
      assert.equal(res2.closestAlert?.hazard.id, 'hazard-B');
    });
  });

  // ============================================================================
  // SECTION 9: GPS Accuracy Guard (Coarse Accuracy Rejection)
  // ============================================================================
  describe('9. GPS Accuracy Guard (Coarse Accuracy Rejection)', () => {
    it('09-01: Degraded GPS accuracy (> 250m) ignores proximity evaluation to prevent false sirens', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const userCoords = { lat: 23.750500, lng: 90.380000 }; // ~55m inside

      // Reading with degraded accuracy = 300m (> 250m ceiling)
      const res = evaluateHazardProximity(userCoords, 300, [hazard], new Map(), { maxAccuracyMeters: 250 });
      assert.equal(res.newAlerts.length, 0, 'Degraded accuracy fix must not trigger alerts');
      assert.equal(res.activeAlerts.length, 0);
      assert.equal(res.closestAlert, null);
    });

    it('09-02: Valid high GPS accuracy (<= 15m) triggers proximity alerts normally', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const userCoords = { lat: 23.750500, lng: 90.380000 };

      const res = evaluateHazardProximity(userCoords, 10, [hazard]);
      assert.equal(res.newAlerts.length, 1);
      assert.equal(res.activeAlerts.length, 1);
    });

    it('09-03: Corrupted or negative GPS accuracy is safely guarded from triggering false alerts', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const userCoords = { lat: 23.750500, lng: 90.380000 };

      // Negative accuracy
      const resNeg = evaluateHazardProximity(userCoords, -15, [hazard]);
      assert.equal(resNeg.newAlerts.length, 0);
      assert.equal(resNeg.activeAlerts.length, 0);

      // NaN accuracy
      const resNaN = evaluateHazardProximity(userCoords, NaN, [hazard]);
      assert.equal(resNaN.newAlerts.length, 0);
      assert.equal(resNaN.activeAlerts.length, 0);

      // Infinite accuracy
      const resInf = evaluateHazardProximity(userCoords, Infinity, [hazard]);
      assert.equal(resInf.newAlerts.length, 0);
      assert.equal(resInf.activeAlerts.length, 0);
    });

    it('09-04: Coarse fix followed by refined GPS fix at same coordinates triggers alert immediately upon refinement', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.750000, lng: 90.380000 } });
      const userCoords = { lat: 23.750800, lng: 90.380000 }; // ~89m inside

      let trackerState = new Map<string, ProximityTrackerEntry>();

      // Step 1: Initial fix arrives with accuracy 400m (cellular triangulation coarse fix)
      const coarseRes = evaluateHazardProximity(userCoords, 400, [hazard], trackerState);
      assert.equal(coarseRes.newAlerts.length, 0);
      trackerState = coarseRes.updatedTrackerState;

      // Step 2: Device locks GPS satellites, refining accuracy to 12m at same coordinates
      const refinedRes = evaluateHazardProximity(userCoords, 12, [hazard], trackerState);
      assert.equal(refinedRes.newAlerts.length, 1, 'Alert must trigger once accuracy refines to <= 250m');
      assert.equal(refinedRes.activeAlerts.length, 1);
    });
  });

  // ============================================================================
  // SECTION 10: Manual Dismissal, Reset & Store Integration
  // ============================================================================
  describe('10. Manual Dismissal, Reset & Store Integration', () => {
    it('10-01: dismissAlert removes hazard from activeAlerts and updates closestAlert to next nearest hazard', () => {
      const hazardA = createMockHazard({ id: 'hazard-A', coordinates: { lat: 23.750719, lng: 90.380000 } }); // ~80m
      const hazardB = createMockHazard({ id: 'hazard-B', coordinates: { lat: 23.751439, lng: 90.380000 } }); // ~160m

      const tracker = new ProximityAlertTracker();
      tracker.evaluate({ lat: 23.750000, lng: 90.380000 }, [hazardA, hazardB]);

      // Initially closestAlert is hazardA
      assert.equal(tracker.getState().closestAlert?.hazard.id, 'hazard-A');
      assert.equal(tracker.getState().activeAlerts.length, 2);

      // Dismiss hazardA
      tracker.dismissAlert('hazard-A');

      const stateAfterDismiss = tracker.getState();
      assert.equal(stateAfterDismiss.activeAlerts.length, 1);
      assert.equal(stateAfterDismiss.activeAlerts[0].hazard.id, 'hazard-B');
      assert.equal(stateAfterDismiss.closestAlert?.hazard.id, 'hazard-B');
    });

    it('10-02: Dismissed hazard remains suppressed during continued movement inside zone in same visit', () => {
      const hazard = createMockHazard({ id: 'hazard-dismiss-test', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const tracker = new ProximityAlertTracker();

      // Enter at 150m
      tracker.evaluate({ lat: 23.751349, lng: 90.380000 }, [hazard]);
      assert.equal(tracker.getState().isInsideDangerZone, true);

      // Dismiss
      tracker.dismissAlert(hazard.id);
      assert.equal(tracker.getState().isInsideDangerZone, false);

      // Move around inside hazard zone (100m, 60m)
      tracker.evaluate({ lat: 23.750900, lng: 90.380000 }, [hazard]);
      assert.equal(tracker.getState().isInsideDangerZone, false, 'Must remain dismissed while inside');

      tracker.evaluate({ lat: 23.750500, lng: 90.380000 }, [hazard]);
      assert.equal(tracker.getState().isInsideDangerZone, false);

      // Exit beyond 220m (to 250m)
      tracker.evaluate({ lat: 23.752248, lng: 90.380000 }, [hazard]);
      assert.equal(tracker.isDismissed(hazard.id), false, 'Exiting zone must un-dismiss hazard');
    });

    it('10-03: resetAllAlerts flushes all active alerts, dismissals, and cooldown records', () => {
      const hazard = createMockHazard({ id: 'hazard-reset-test', coordinates: { lat: 23.750000, lng: 90.380000 } });
      const exited: string[] = [];
      const tracker = new ProximityAlertTracker({
        onExit: (id) => exited.push(id),
      });

      tracker.evaluate({ lat: 23.751349, lng: 90.380000 }, [hazard]);
      assert.equal(tracker.getState().activeAlerts.length, 1);

      tracker.resetAllAlerts();

      assert.deepEqual(exited, [hazard.id], 'onExit must be triggered on reset');
      assert.equal(tracker.getState().activeAlerts.length, 0);
      assert.equal(tracker.getState().isInsideDangerZone, false);
      assert.equal(tracker.getState().closestAlert, null);
    });

    it('10-04: Reactive Zustand store subscription triggers proximity engine on location and incident updates', () => {
      const hazard = createMockHazard({ id: 'hazard-store-sub', coordinates: { lat: 23.750000, lng: 90.380000 } });

      // Subscription harness simulating useHazardProximityAlert
      let activeAlerts: ProximityAlertItem[] = [];
      let trackerState = new Map<string, ProximityTrackerEntry>();

      const runEvaluation = () => {
        const { userLocation, userAccuracy } = useMapStore.getState();
        const { incidents } = useIncidentStore.getState();

        if (!userLocation) {
          activeAlerts = [];
          return;
        }

        const res = evaluateHazardProximity(userLocation, userAccuracy, incidents, trackerState);
        trackerState = res.updatedTrackerState;
        activeAlerts = res.activeAlerts;
      };

      const unsubMap = useMapStore.subscribe(runEvaluation);
      const unsubInc = useIncidentStore.subscribe(runEvaluation);

      // 1. Initial empty state
      assert.equal(activeAlerts.length, 0);

      // 2. Incident arrives in store
      useIncidentStore.setState({ incidents: [hazard] });
      assert.equal(activeAlerts.length, 0, 'No alerts until location is acquired');

      // 3. User location arrives within 150m of hazard
      useMapStore.setState({
        userLocation: { lat: 23.751349, lng: 90.380000 },
        userAccuracy: 10,
      });

      assert.equal(activeAlerts.length, 1, 'Store subscription must trigger proximity alert on GPS acquisition');
      assert.equal(activeAlerts[0].hazard.id, 'hazard-store-sub');

      // 4. Incident resolved in store
      useIncidentStore.setState({
        incidents: [{ ...hazard, status: 'resolved' as any }],
      });

      assert.equal(activeAlerts.length, 0, 'Store subscription must clear alert when hazard is resolved');

      unsubMap();
      unsubInc();
    });
  });
});
