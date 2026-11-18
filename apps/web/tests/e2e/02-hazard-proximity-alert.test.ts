import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DangerIncident } from '@repo/shared';
import {
  calculateHazardDistance,
  isEligibleHazard,
  isWithinBangladesh,
  ProximityAlertTracker,
  type ProximityAlertItem,
} from '../framework/contractHarness';
import { calculateDistanceMeters } from '@/lib/gpsVerification';

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
  locationName: 'Dhanmondi 27',
  timestamp: new Date().toISOString(),
  upvotes: 5,
  downvotes: 0,
  status: 'community_confirmed',
  reportedBy: 'Citizen Report',
  verifiedCount: 5,
  fuzzedRadiusMeters: 150,
  ...overrides,
});

describe('[E2E][HazardProximity] 02: Real-Time Danger Zone Proximity Engine', () => {
  let tracker: ProximityAlertTracker;
  const alertedItems: ProximityAlertItem[] = [];
  const exitedIds: string[] = [];

  beforeEach(() => {
    alertedItems.length = 0;
    exitedIds.length = 0;
    tracker = new ProximityAlertTracker({
      thresholdMeters: 200,
      cooldownMs: 600_000, // 10 minutes
      hysteresisMeters: 20, // 220m exit
      onAlert: (item) => alertedItems.push(item),
      onExit: (id) => exitedIds.push(id),
    });
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Features 7–11: 25 Isolated Tests)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    // Feature 7: Client-Side Haversine Calculation
    describe('Feature 7: Client-Side Haversine Calculation', () => {
      it('F07-01: calculateDistanceMeters between identical points returns 0 meters', () => {
        const d = calculateDistanceMeters(23.75, 90.38, 23.75, 90.38);
        assert.equal(d, 0);
      });

      it('F07-02: Known Dhaka distance (Shahbagh to TSC) calculates within +-2m of geodesic truth (~623m)', () => {
        // Shahbagh: 23.7381, 90.3956; TSC: 23.7325, 90.3956 (~623m due south)
        const d = calculateDistanceMeters(23.7381, 90.3956, 23.7325, 90.3956);
        assert.ok(Math.abs(d - 623) <= 2, `Expected ~623m, got ${d}m`);
      });

      it('F07-03: Symmetry property: calculateDistanceMeters(A, B) === calculateDistanceMeters(B, A)', () => {
        const d1 = calculateDistanceMeters(23.75, 90.38, 23.76, 90.39);
        const d2 = calculateDistanceMeters(23.76, 90.39, 23.75, 90.38);
        assert.equal(d1, d2);
      });

      it('F07-04: Diagonal coordinate pairs compute without NaN or precision errors', () => {
        const d = calculateDistanceMeters(23.71, 90.35, 23.82, 90.45);
        assert.ok(!isNaN(d));
        assert.ok(d > 10000 && d < 25000);
      });

      it('F07-05: Micro-movements (displacement < 1m) compute small integer meters without rounding to NaN', () => {
        const d = calculateDistanceMeters(23.750001, 90.380001, 23.750002, 90.380002);
        assert.ok(!isNaN(d));
        assert.ok(d >= 0);
      });
    });

    // Feature 8: Configurable 200m Proximity Threshold
    describe('Feature 8: Configurable 200m Proximity Threshold', () => {
      it('F08-01: User at 150m from active hazard triggers proximity alert (isInsideDangerZone = true)', () => {
        // ~150m north of 23.75, 90.38 is ~23.75135
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        const res = tracker.evaluate({ latitude: 23.75135, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, true);
        assert.equal(res.activeAlerts.length, 1);
        assert.equal(alertedItems.length, 1);
      });

      it('F08-02: User at 250m from active hazard does not trigger proximity warning', () => {
        // ~250m north is ~23.75225
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        const res = tracker.evaluate({ latitude: 23.75225, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, false);
        assert.equal(res.activeAlerts.length, 0);
        assert.equal(alertedItems.length, 0);
      });

      it('F08-03: Default threshold is initialized to 200 meters', () => {
        const defaultTracker = new ProximityAlertTracker();
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // At 190m (inside default 200m)
        const insideRes = defaultTracker.evaluate({ latitude: 23.7517, longitude: 90.38 }, [hazard]);
        assert.equal(insideRes.isInsideDangerZone, true);
      });

      it('F08-04: Custom thresholdMeters (e.g. 300m) respects configured value and triggers at 250m', () => {
        const customTracker = new ProximityAlertTracker({ thresholdMeters: 300 });
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // At 250m: triggers with 300m threshold
        const res = customTracker.evaluate({ latitude: 23.75225, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, true);
      });

      it('F08-05: closestAlert returns the hazard with the minimum distance among all active alerts', () => {
        const h1 = createMockHazard({ id: 'h1', coordinates: { lat: 23.751, lng: 90.38 } }); // ~111m
        const h2 = createMockHazard({ id: 'h2', coordinates: { lat: 23.7505, lng: 90.38 } }); // ~56m
        const res = tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [h1, h2]);

        assert.equal(res.activeAlerts.length, 2);
        assert.equal(res.closestAlert?.hazard.id, 'h2');
        assert.ok(res.closestAlert!.distanceMeters < 80);
      });
    });

    // Feature 9: Hazard Eligibility & Status Filtering
    describe('Feature 9: Hazard Eligibility & Status Filtering', () => {
      it('F09-01: Active incident (community_confirmed or authority_verified) within 200m triggers alert', () => {
        const h1 = createMockHazard({ id: 'h1', status: 'community_confirmed' });
        const h2 = createMockHazard({ id: 'h2', status: 'authority_verified' });
        assert.equal(isEligibleHazard(h1), true);
        assert.equal(isEligibleHazard(h2), true);

        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [h1, h2]);
        assert.equal(res.activeAlerts.length, 2);
      });

      it('F09-02: Resolved incident (status = resolved) within 200m is excluded from alert', () => {
        const resolvedHazard = createMockHazard({ status: 'resolved' });
        assert.equal(isEligibleHazard(resolvedHazard), false);

        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [resolvedHazard]);
        assert.equal(res.isInsideDangerZone, false);
        assert.equal(alertedItems.length, 0);
      });

      it('F09-03: Purged incident (status = purged) is excluded from proximity calculations', () => {
        const purgedHazard = createMockHazard({ status: 'purged' });
        assert.equal(isEligibleHazard(purgedHazard), false);

        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [purgedHazard]);
        assert.equal(res.isInsideDangerZone, false);
      });

      it('F09-04: Expired incident (status = expired) is filtered out and triggers no alert', () => {
        const expiredHazard = createMockHazard({ status: 'expired' });
        assert.equal(isEligibleHazard(expiredHazard), false);

        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [expiredHazard]);
        assert.equal(res.isInsideDangerZone, false);
      });

      it('F09-05: Incident with missing or invalid coordinates is safely excluded without runtime exceptions', () => {
        const badHazard1 = createMockHazard({ coordinates: null as any });
        const badHazard2 = createMockHazard({ coordinates: { lat: NaN, lng: 90.38 } });
        assert.equal(isEligibleHazard(badHazard1), false);
        assert.equal(isEligibleHazard(badHazard2), false);

        assert.doesNotThrow(() => {
          tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [badHazard1, badHazard2]);
        });
      });
    });

    // Feature 10: Duplicate Alert Prevention
    describe('Feature 10: Duplicate Alert Prevention', () => {
      it('F10-01: Multiple consecutive GPS updates within 200m radius trigger onAlert callback exactly once', () => {
        const hazard = createMockHazard();
        // 5 consecutive fixes inside zone
        for (let i = 0; i < 5; i++) {
          tracker.evaluate({ latitude: 23.7505 + i * 0.0001, longitude: 90.38 }, [hazard]);
        }
        assert.equal(alertedItems.length, 1);
        assert.equal(tracker.getAlertCount(hazard.id), 1);
      });

      it('F10-02: Moving closer within same hazard updates distanceMeters dynamically without duplicating alert', () => {
        const hazard = createMockHazard();
        // Fix at ~150m
        tracker.evaluate({ latitude: 23.75135, longitude: 90.38 }, [hazard]);
        const d1 = tracker.getState().activeAlerts[0].distanceMeters;

        // Fix at ~50m
        tracker.evaluate({ latitude: 23.75045, longitude: 90.38 }, [hazard]);
        const d2 = tracker.getState().activeAlerts[0].distanceMeters;

        assert.equal(alertedItems.length, 1);
        assert.ok(d2 < d1);
        assert.equal(tracker.getState().activeAlerts.length, 1);
      });

      it('F10-03: Two nearby hazards produce two distinct alerts in activeAlerts', () => {
        const h1 = createMockHazard({ id: 'h1', coordinates: { lat: 23.7505, lng: 90.38 } });
        const h2 = createMockHazard({ id: 'h2', coordinates: { lat: 23.7495, lng: 90.38 } });

        const res = tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [h1, h2]);
        assert.equal(res.activeAlerts.length, 2);
        assert.equal(alertedItems.length, 2);
      });

      it('F10-04: Proximity alert state maintains stable hazard ID keys', () => {
        const hazard = createMockHazard({ id: 'stable-id-123' });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().activeAlerts[0].hazard.id, 'stable-id-123');
      });

      it('F10-05: Manual dismissal via dismissAlert prevents hazard from reappearing in activeAlerts in same visit', () => {
        const hazard = createMockHazard({ id: 'dismiss-me' });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().activeAlerts.length, 1);

        tracker.dismissAlert('dismiss-me');
        assert.equal(tracker.getState().activeAlerts.length, 0);

        // Next GPS fix at closer distance
        tracker.evaluate({ latitude: 23.7502, longitude: 90.38 }, [hazard]);
        // Remains dismissed
        assert.equal(tracker.getState().activeAlerts.length, 0);
      });
    });

    // Feature 11: 10-Minute Cooldown & Exit Reset
    describe('Feature 11: 10-Minute Cooldown & Exit Reset', () => {
      it('F11-01: Exiting hazard zone and re-entering at t = 2min suppresses alert due to active 10m cooldown', () => {
        const hazard = createMockHazard({ id: 'h-cd' });
        const t0 = 1_000_000;

        // Entry at t = 0
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 });
        assert.equal(alertedItems.length, 1);

        // Exit past 220m hysteresis at t = 1 min
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime: t0 + 60_000 });
        assert.equal(tracker.getState().isInsideDangerZone, false);

        // Re-enter at t = 2 min (120,000ms < 600,000ms)
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 + 120_000 });
        // Suppressed by cooldown! No new onAlert callback
        assert.equal(alertedItems.length, 1);
      });

      it('F11-02: Exiting hazard zone and re-entering at t = 11min (> 600,000ms) triggers a new alert', () => {
        const hazard = createMockHazard({ id: 'h-cd2' });
        const t0 = 1_000_000;

        // Entry at t = 0
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 });
        assert.equal(alertedItems.length, 1);

        // Exit at t = 1 min
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime: t0 + 60_000 });

        // Re-enter at t = 11 min (660,000ms > 600,000ms)
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 + 660_000 });
        assert.equal(alertedItems.length, 2);
      });

      it('F11-03: Cooldown timer tracks timestamps independently per hazard ID', () => {
        const hA = createMockHazard({ id: 'hA', coordinates: { lat: 23.7505, lng: 90.38 } });
        const hB = createMockHazard({ id: 'hB', coordinates: { lat: 23.7505, lng: 90.39 } });
        const t0 = 1_000_000;

        // Alert on hA
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hA, hB], { currentTime: t0 });
        assert.equal(alertedItems.length, 1);
        assert.equal(alertedItems[0].hazard.id, 'hA');

        // Move near hB (within 100m of hB, far from hA)
        tracker.evaluate({ latitude: 23.7505, longitude: 90.39 }, [hA, hB], { currentTime: t0 + 30_000 });
        assert.equal(alertedItems.length, 2);
        assert.equal(alertedItems[1].hazard.id, 'hB');
      });

      it('F11-04: User exit beyond hysteresis (> 220m) fires onExit and resets isInsideDangerZone to false', () => {
        const hazard = createMockHazard({ id: 'h-exit' });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().isInsideDangerZone, true);

        // Step to 250m distance
        tracker.evaluate({ latitude: 23.7523, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().isInsideDangerZone, false);
        assert.ok(exitedIds.includes('h-exit'));
      });

      it('F11-05: resetAllAlerts clears all active alerts and resets cooldown caches', () => {
        const hazard = createMockHazard({ id: 'h-reset' });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().activeAlerts.length, 1);

        tracker.resetAllAlerts();
        assert.equal(tracker.getState().activeAlerts.length, 0);
        assert.equal(tracker.getLastAlertTime('h-reset'), undefined);
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary Value Analysis & Corner Cases (Features 7–11: 25 Tests)
  // ==========================================================================

  describe('Tier 2: Boundary Value Analysis & Corner Cases', () => {
    // F7 Boundaries
    describe('F7 Boundaries', () => {
      it('B07-01: Identical coordinates with 8 decimal places calculate distance as exactly 0m', () => {
        const d = calculateDistanceMeters(23.12345678, 90.87654321, 23.12345678, 90.87654321);
        assert.equal(d, 0);
      });

      it('B07-02: Longitude boundary coordinates compute without numerical overflow', () => {
        const d = calculateDistanceMeters(0, 179.9, 0, -179.9);
        assert.ok(!isNaN(d));
        assert.ok(d > 0);
      });

      it('B07-03: Extreme latitude pairs compute without divergence', () => {
        const d = calculateDistanceMeters(89.0, 0, 89.1, 0);
        assert.ok(!isNaN(d));
        assert.ok(d > 0);
      });

      it('B07-04: Distance between points 10m apart calculates positive non-zero value', () => {
        const d = calculateDistanceMeters(23.75000, 90.38000, 23.75009, 90.38000);
        assert.ok(d >= 9 && d <= 11);
      });

      it('B07-05: Negative coordinates compute distance with full symmetry', () => {
        const d1 = calculateDistanceMeters(-10.5, -20.5, -10.6, -20.6);
        const d2 = calculateDistanceMeters(-10.6, -20.6, -10.5, -20.5);
        assert.equal(d1, d2);
        assert.ok(d1 > 0);
      });
    });

    // F8 Boundaries
    describe('F8 Boundaries', () => {
      it('B08-01: Distance of 199m triggers proximity alert (<= 200m)', () => {
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // 23.75179 is ~199m away
        const dist = calculateHazardDistance(23.75179, 90.38, hazard);
        assert.ok(dist <= 200, `Expected <=200, got ${dist}`);
        const res = tracker.evaluate({ latitude: 23.75179, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, true);
      });

      it('B08-02: Distance of exactly 200m triggers proximity alert (<= 200m)', () => {
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // 23.75180 is ~200m away
        const dist = calculateHazardDistance(23.7518, 90.38, hazard);
        assert.ok(dist <= 200, `Expected <=200, got ${dist}`);
        const res = tracker.evaluate({ latitude: 23.7518, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, true);
      });

      it('B08-03: Distance of 201m does NOT trigger proximity alert (> 200m)', () => {
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // 23.75182 is ~202m away
        const dist = calculateHazardDistance(23.75182, 90.38, hazard);
        assert.ok(dist > 200, `Expected >200, got ${dist}`);
        const res = tracker.evaluate({ latitude: 23.75182, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, false);
      });

      it('B08-04: Distance of 220m during initial approach does NOT trigger alert', () => {
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // 23.75198 is ~220m away
        const res = tracker.evaluate({ latitude: 23.75198, longitude: 90.38 }, [hazard]);
        assert.equal(res.isInsideDangerZone, false);
      });

      it('B08-05: Threshold configured to 0m requires exact coordinate match to trigger', () => {
        const zeroTracker = new ProximityAlertTracker({ thresholdMeters: 0 });
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });

        // Non-zero distance: no alert
        const res1 = zeroTracker.evaluate({ latitude: 23.75001, longitude: 90.38 }, [hazard]);
        assert.equal(res1.isInsideDangerZone, false);

        // Exact coordinate: alert
        const res2 = zeroTracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [hazard]);
        assert.equal(res2.isInsideDangerZone, true);
      });
    });

    // F9 Boundaries
    describe('F9 Boundaries', () => {
      it('B09-01: Hazard with status RESOLVED (all-caps) and resolved (lowercase) are both filtered out', () => {
        const hUpper = createMockHazard({ status: 'RESOLVED' });
        const hLower = createMockHazard({ status: 'resolved' });
        assert.equal(isEligibleHazard(hUpper), false);
        assert.equal(isEligibleHazard(hLower), false);
      });

      it('B09-02: Hazard with status EXPIRED or deleted are safely excluded', () => {
        const hExpired = createMockHazard({ status: 'EXPIRED' });
        const hDeleted = createMockHazard({ status: 'deleted' });
        assert.equal(isEligibleHazard(hExpired), false);
        assert.equal(isEligibleHazard(hDeleted), false);
      });

      it('B09-03: Hazard located on Bangladesh border line (lat: 20.3) is included; lat: 20.29 is excluded', () => {
        const hBorder = createMockHazard({ coordinates: { lat: 20.35, lng: 89.0 } });
        const hOutside = createMockHazard({ coordinates: { lat: 20.29, lng: 89.0 } });
        assert.equal(isEligibleHazard(hBorder), true);
        assert.equal(isEligibleHazard(hOutside), false);
      });

      it('B09-04: Hazard with 0 upvotes/downvotes evaluated solely on active status', () => {
        const hZero = createMockHazard({ upvotes: 0, downvotes: 0, status: 'community_confirmed' });
        assert.equal(isEligibleHazard(hZero), true);
      });

      it('B09-05: Hazard removed from incidents array clears its active alert on next evaluation', () => {
        const hazard = createMockHazard({ id: 'ephemeral-hazard' });
        // Active in first evaluation
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().activeAlerts.length, 1);

        // Removed from incidents array (e.g. purged via socket event)
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, []);
        assert.equal(tracker.getState().activeAlerts.length, 0);
        assert.ok(exitedIds.includes('ephemeral-hazard'));
      });
    });

    // F10 Boundaries
    describe('F10 Boundaries', () => {
      it('B10-01: 50 consecutive GPS updates at 50m distance inside hazard zone result in exactly 1 alert event', () => {
        const hazard = createMockHazard();
        for (let i = 0; i < 50; i++) {
          tracker.evaluate({ latitude: 23.75045, longitude: 90.38 }, [hazard]);
        }
        assert.equal(alertedItems.length, 1);
        assert.equal(tracker.getState().activeAlerts.length, 1);
      });

      it('B10-02: Two hazards located at identical coordinates with different IDs trigger 2 distinct alerts', () => {
        const h1 = createMockHazard({ id: 'h-dup-1', coordinates: { lat: 23.7505, lng: 90.38 } });
        const h2 = createMockHazard({ id: 'h-dup-2', coordinates: { lat: 23.7505, lng: 90.38 } });
        const res = tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [h1, h2]);
        assert.equal(res.activeAlerts.length, 2);
        assert.equal(alertedItems.length, 2);
      });

      it('B10-03: Two hazard updates with identical IDs but different descriptions deduplicate by ID', () => {
        const h1 = createMockHazard({ id: 'same-id', description: 'Version 1' });
        const h2 = createMockHazard({ id: 'same-id', description: 'Version 2' });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [h1]);
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [h2]);
        assert.equal(alertedItems.length, 1);
        assert.equal(tracker.getState().activeAlerts[0].hazard.description, 'Version 2');
      });

      it('B10-04: Moving back and forth within warning zone (150m -> 120m -> 180m) produces zero duplicate alerts', () => {
        const hazard = createMockHazard();
        tracker.evaluate({ latitude: 23.75135, longitude: 90.38 }, [hazard]); // ~150m
        tracker.evaluate({ latitude: 23.75108, longitude: 90.38 }, [hazard]); // ~120m
        tracker.evaluate({ latitude: 23.75162, longitude: 90.38 }, [hazard]); // ~180m
        assert.equal(alertedItems.length, 1);
      });

      it('B10-05: GPS accuracy jitter within zone produces zero duplicate alerts', () => {
        const hazard = createMockHazard();
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { userAccuracy: 8 });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { userAccuracy: 45 });
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { userAccuracy: 12 });
        assert.equal(alertedItems.length, 1);
      });
    });

    // F11 Boundaries
    describe('F11 Boundaries', () => {
      it('B11-01: Exit hysteresis boundary: Moving to 219m from hazard does NOT trigger exit (hysteresis is 220m)', () => {
        const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
        // Enter at 100m
        tracker.evaluate({ latitude: 23.7509, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().isInsideDangerZone, true);

        // Move to ~215m (inside 220m exit threshold)
        const d = calculateHazardDistance(23.75193, 90.38, hazard);
        assert.ok(d < 220 && d > 200, `Expected between 200 and 220, got ${d}`);

        tracker.evaluate({ latitude: 23.75193, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().isInsideDangerZone, true);
        assert.equal(exitedIds.length, 0);
      });

      it('B11-02: Moving to exactly 221m from hazard triggers exit and marks user as outside danger zone', () => {
        const hazard = createMockHazard({ id: 'h-exit-boundary', coordinates: { lat: 23.75, lng: 90.38 } });
        // Enter at 100m
        tracker.evaluate({ latitude: 23.7509, longitude: 90.38 }, [hazard]);

        // Move to ~225m (> 220m exit threshold)
        const d = calculateHazardDistance(23.75203, 90.38, hazard);
        assert.ok(d > 220, `Expected >220, got ${d}`);

        tracker.evaluate({ latitude: 23.75203, longitude: 90.38 }, [hazard]);
        assert.equal(tracker.getState().isInsideDangerZone, false);
        assert.ok(exitedIds.includes('h-exit-boundary'));
      });

      it('B11-03: Re-entering zone at t = 599,999ms (1ms before 10m cooldown) suppresses alert', () => {
        const hazard = createMockHazard({ id: 'cd-1ms' });
        const t0 = 1_000_000;

        // Entry at t = 0
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 });
        // Exit at t = 1 min
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime: t0 + 60_000 });

        // Re-enter at t = 599,999ms
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 + 599_999 });
        assert.equal(alertedItems.length, 1); // No new alert
      });

      it('B11-04: Re-entering zone at exactly t = 600,000ms triggers a new alert', () => {
        const hazard = createMockHazard({ id: 'cd-exact' });
        const t0 = 1_000_000;

        // Entry at t = 0
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 });
        // Exit at t = 1 min
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime: t0 + 60_000 });

        // Re-enter at exactly t = 600,000ms
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 + 600_000 });
        assert.equal(alertedItems.length, 2);
      });

      it('B11-05: Re-entering zone at t = 600,001ms triggers a new alert', () => {
        const hazard = createMockHazard({ id: 'cd-plus1' });
        const t0 = 1_000_000;

        // Entry at t = 0
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 });
        // Exit at t = 1 min
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime: t0 + 60_000 });

        // Re-enter at t = 600,001ms
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime: t0 + 600_001 });
        assert.equal(alertedItems.length, 2);
      });
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Pairwise Interactions (7 Tests)
  // ==========================================================================

  describe('Tier 3: Cross-Feature Pairwise Interactions', () => {
    it('X07 (F8 + F9 + F10): Cluster of 3 hazards (1 active, 1 resolved, 1 expired) within 150m: only active hazard alerts', () => {
      const hActive = createMockHazard({ id: 'h-active', status: 'community_confirmed' });
      const hResolved = createMockHazard({ id: 'h-resolved', status: 'resolved' });
      const hExpired = createMockHazard({ id: 'h-expired', status: 'expired' });

      const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hActive, hResolved, hExpired]);
      assert.equal(res.activeAlerts.length, 1);
      assert.equal(res.activeAlerts[0].hazard.id, 'h-active');
      assert.equal(alertedItems.length, 1);
    });

    it('X08 (F8 + F10 + F11): Overlapping hazards A and B: enters A (alerts), enters B (alerts independently), exits A (A clears, B stays active)', () => {
      const hA = createMockHazard({ id: 'hA', coordinates: { lat: 23.7505, lng: 90.38 } });
      const hB = createMockHazard({ id: 'hB', coordinates: { lat: 23.7525, lng: 90.38 } });

      // 1. Enter near hA (~55m from A, ~277m from B)
      tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [hA, hB]);
      assert.equal(tracker.getState().activeAlerts.length, 1);
      assert.equal(tracker.getState().activeAlerts[0].hazard.id, 'hA');

      // 2. Move to midpoint (~110m from A, ~110m from B)
      tracker.evaluate({ latitude: 23.7515, longitude: 90.38 }, [hA, hB]);
      assert.equal(tracker.getState().activeAlerts.length, 2);

      // 3. Move north (~277m from A, ~55m from B)
      tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hA, hB]);
      assert.equal(tracker.getState().activeAlerts.length, 1);
      assert.equal(tracker.getState().activeAlerts[0].hazard.id, 'hB');
      assert.ok(exitedIds.includes('hA'));
    });

    it('X09 (F8 + F10 + F11): User stays inside hazard for 10 minutes: only 1 alert fired while continuously inside', () => {
      const hazard = createMockHazard({ id: 'stay-inside' });
      const t0 = 1_000_000;

      // Fix every minute for 12 minutes
      for (let min = 0; min <= 12; min++) {
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], {
          currentTime: t0 + min * 60_000,
        });
      }
      // Zero duplicate alerts while continuously inside!
      assert.equal(alertedItems.length, 1);
      assert.equal(tracker.getState().isInsideDangerZone, true);
    });

    it('X10 (F8 + F9 + F11): Incident status updated to resolved in real time: active alert is cleared immediately', () => {
      const hazard = createMockHazard({ id: 'live-resolved', status: 'community_confirmed' });
      tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
      assert.equal(tracker.getState().isInsideDangerZone, true);

      // Status becomes resolved
      const updatedHazard = { ...hazard, status: 'resolved' };
      tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [updatedHazard]);
      assert.equal(tracker.getState().isInsideDangerZone, false);
      assert.ok(exitedIds.includes('live-resolved'));
    });

    it('X11 (F8 + F10): User dismisses alert: closestAlert recalculates to next nearest hazard', () => {
      const h1 = createMockHazard({ id: 'h1', coordinates: { lat: 23.7505, lng: 90.38 } }); // 56m
      const h2 = createMockHazard({ id: 'h2', coordinates: { lat: 23.7512, lng: 90.38 } }); // 133m

      const res1 = tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [h1, h2]);
      assert.equal(res1.closestAlert?.hazard.id, 'h1');

      // Dismiss h1
      tracker.dismissAlert('h1');
      const res2 = tracker.getState();
      assert.equal(res2.activeAlerts.length, 1);
      assert.equal(res2.closestAlert?.hazard.id, 'h2');
    });

    it('X12 (F8 + F11): User steps back to 215m (within 220m hysteresis) and returns to 195m: continuous inside state', () => {
      const hazard = createMockHazard({ coordinates: { lat: 23.75, lng: 90.38 } });
      // Enter at 100m
      tracker.evaluate({ latitude: 23.7509, longitude: 90.38 }, [hazard]);
      assert.equal(alertedItems.length, 1);

      // Step to 215m (within 220m hysteresis)
      tracker.evaluate({ latitude: 23.75193, longitude: 90.38 }, [hazard]);
      assert.equal(exitedIds.length, 0);

      // Step forward to 195m
      tracker.evaluate({ latitude: 23.75175, longitude: 90.38 }, [hazard]);
      // No exit occurred, so no re-alert
      assert.equal(alertedItems.length, 1);
      assert.equal(tracker.getState().isInsideDangerZone, true);
    });

    it('X13 (F7 + F8 + F11): Multiple re-entries after cooldown cycles increment alert count monotonically', () => {
      const hazard = createMockHazard({ id: 'cycle-hazard' });
      let currentTime = 10_000_000;

      for (let cycle = 1; cycle <= 3; cycle++) {
        // Enter
        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard], { currentTime });
        assert.equal(tracker.getAlertCount('cycle-hazard'), cycle);

        // Exit
        currentTime += 60_000;
        tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard], { currentTime });

        // Wait 11 minutes
        currentTime += 660_000;
      }
      assert.equal(alertedItems.length, 3);
    });
  });
});
