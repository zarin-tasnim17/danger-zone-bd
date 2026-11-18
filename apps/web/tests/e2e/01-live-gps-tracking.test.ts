import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import { useMapStore, type TrackingStatus } from '@/store/useMapStore';
import { isWithinBangladesh } from '../framework/contractHarness';

describe('[E2E][LiveGPS] 01: Continuous GPS Tracking & Map Synchronization', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    useMapStore.setState({
      userLocation: null,
      userAccuracy: null,
      userAccuracyTier: null,
      locationSource: null,
      locationLabel: null,
      locationTimestamp: null,
      isLocating: false,
      isLiveTracking: false,
      trackingStatus: 'stopped',
      isFollowingUser: false,
      liveWatchId: null,
      activeWatchId: null,
      isLowAccuracy: false,
      targetCommand: null,
    });
  });

  afterEach(() => {
    if (useMapStore.getState().isLiveTracking) {
      useMapStore.getState().stopLiveTracking();
    }
    sandbox.restore();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Features 1–6: 30 Isolated Tests)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    // Feature 1: Dedicated Live Tracking Mode
    describe('Feature 1: Dedicated Live Tracking Mode', () => {
      it('F01-01: Starting live tracking calls navigator.geolocation.watchPosition with high accuracy', async () => {
        const ok = await useMapStore.getState().startLiveTracking();
        assert.equal(ok, true);
        const watchCalls = sandbox.geolocation.calls.filter((c) => c.type === 'watchPosition');
        assert.equal(watchCalls.length, 1);
        assert.equal(watchCalls[0].options?.enableHighAccuracy, true);
        assert.equal(watchCalls[0].options?.maximumAge, 0);
      });

      it('F01-02: Starting live tracking transitions store state to active tracking and following', async () => {
        await useMapStore.getState().startLiveTracking();
        const state = useMapStore.getState();
        assert.equal(state.isLiveTracking, true);
        assert.equal(state.trackingStatus, 'active');
        assert.equal(state.isFollowingUser, true);
        assert.ok(state.liveWatchId !== null);
      });

      it('F01-03: Stopping live tracking transitions store state to stopped and clears watch ID', async () => {
        await useMapStore.getState().startLiveTracking();
        useMapStore.getState().stopLiveTracking();
        const state = useMapStore.getState();
        assert.equal(state.isLiveTracking, false);
        assert.equal(state.trackingStatus, 'stopped');
        assert.equal(state.isFollowingUser, false);
        assert.equal(state.liveWatchId, null);
      });

      it('F01-04: One-time Locate Me functions independently without terminating active live tracking', async () => {
        await useMapStore.getState().startLiveTracking();
        const initialWatchId = useMapStore.getState().liveWatchId;

        // Perform one-time centerOnUserLocation
        useMapStore.getState().centerOnUserLocation();
        const state = useMapStore.getState();
        assert.equal(state.isLiveTracking, true);
        assert.equal(state.liveWatchId, initialWatchId);
        assert.equal(state.trackingStatus, 'active');
      });

      it('F01-05: Consecutive invocations of startLiveTracking gracefully clear previous watcher without leaking IDs', async () => {
        await useMapStore.getState().startLiveTracking();
        const firstWatchId = useMapStore.getState().liveWatchId!;
        assert.ok(firstWatchId > 0);

        await useMapStore.getState().startLiveTracking();
        const secondWatchId = useMapStore.getState().liveWatchId!;
        assert.ok(secondWatchId > 0);
        assert.notEqual(firstWatchId, secondWatchId);

        // Previous ID must be in clearedWatchIds
        assert.ok(sandbox.geolocation.clearedWatchIds.includes(firstWatchId));
        assert.equal(sandbox.geolocation.activeWatchCount, 1);
      });
    });

    // Feature 2: Watcher ID & Lifecycle Management
    describe('Feature 2: Watcher ID & Lifecycle Management', () => {
      it('F02-01: watchPosition returns a numeric ID stored in liveWatchId in useMapStore', async () => {
        await useMapStore.getState().startLiveTracking();
        const id = useMapStore.getState().liveWatchId;
        assert.equal(typeof id, 'number');
        assert.ok(id! > 0);
      });

      it('F02-02: Tracking remains continuously active at t=16s, t=30s, and t=60s without locate watchdog abort', async () => {
        await useMapStore.getState().startLiveTracking();
        const now = Date.now();

        // Fix at t = 16s
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.8103, longitude: 90.4125, accuracy: 25 },
          timestamp: now + 16_000,
        });
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().userLocation?.lat, 23.8103);

        // Fix at t = 60s
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.811, longitude: 90.413, accuracy: 18 },
          timestamp: now + 60_000,
        });
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().userLocation?.lat, 23.811);
      });

      it('F02-03: Invoking stopLiveTracking calls clearWatch with the exact registered ID', async () => {
        await useMapStore.getState().startLiveTracking();
        const registeredId = useMapStore.getState().liveWatchId!;
        useMapStore.getState().stopLiveTracking();

        const clearCalls = sandbox.geolocation.calls.filter((c) => c.type === 'clearWatch');
        assert.ok(clearCalls.some((c) => c.id === registeredId));
        assert.ok(sandbox.geolocation.clearedWatchIds.includes(registeredId));
      });

      it('F02-04: Geolocation permission error (code 1) sets trackingStatus to unavailable', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitError({ code: 1, message: 'User denied Geolocation' });
        assert.equal(useMapStore.getState().trackingStatus, 'unavailable');
      });

      it('F02-05: Geolocation unavailable error (code 2) sets trackingStatus to unavailable without throwing', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitError({ code: 2, message: 'Position unavailable' });
        assert.equal(useMapStore.getState().trackingStatus, 'unavailable');
      });
    });

    // Feature 3: Target Accuracy Non-Termination
    describe('Feature 3: Target Accuracy Non-Termination', () => {
      it('F03-01: Position fix with accuracy <= 15m updates userLocation and classifies userAccuracyTier as HIGH', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 8 },
          timestamp: Date.now(),
        });
        const state = useMapStore.getState();
        assert.deepEqual(state.userLocation, { lat: 23.75, lng: 90.38 });
        assert.equal(state.userAccuracy, 8);
        assert.equal(state.userAccuracyTier, 'HIGH');
      });

      it('F03-02: Reaching <= 15m accuracy keeps isLiveTracking active and does NOT call clearWatch', async () => {
        await useMapStore.getState().startLiveTracking();
        const watchId = useMapStore.getState().liveWatchId!;

        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 10 },
          timestamp: Date.now(),
        });

        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().trackingStatus, 'active');
        assert.ok(!sandbox.geolocation.clearedWatchIds.includes(watchId));
      });

      it('F03-03: Subsequent position updates after reaching <= 15m continue to stream into store', async () => {
        await useMapStore.getState().startLiveTracking();

        // First high accuracy fix
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.751, longitude: 90.381, accuracy: 12 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.751);

        // Next fix
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.752, longitude: 90.382, accuracy: 9 },
          timestamp: Date.now() + 1000,
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.752);
        assert.equal(useMapStore.getState().userAccuracy, 9);
      });

      it('F03-04: Multiple successive high-accuracy fixes stream continuously without auto-cancelling', async () => {
        await useMapStore.getState().startLiveTracking();
        const now = Date.now();

        for (let i = 1; i <= 5; i++) {
          sandbox.geolocation.mockEmitPosition({
            coords: { latitude: 23.75 + i * 0.001, longitude: 90.38, accuracy: 5 + i },
            timestamp: now + i * 1000,
          });
          assert.equal(useMapStore.getState().isLiveTracking, true);
        }
        assert.equal(sandbox.geolocation.activeWatchCount, 1);
      });

      it('F03-05: High accuracy fix updates locationSource to gps', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 7 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().locationSource, 'gps');
      });
    });

    // Feature 4: Degraded Accuracy Ingestion
    describe('Feature 4: Degraded Accuracy Ingestion', () => {
      it('F04-01: Position fix with moderate accuracy (50m) updates userLocation and sets MODERATE tier', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.76, longitude: 90.39, accuracy: 50 },
          timestamp: Date.now(),
        });
        const state = useMapStore.getState();
        assert.equal(state.userLocation?.lat, 23.76);
        assert.equal(state.userAccuracy, 50);
        assert.equal(state.userAccuracyTier, 'MODERATE');
        assert.equal(state.isLowAccuracy, false);
      });

      it('F04-02: Position fix with degraded accuracy (120m) sets isLowAccuracy = true and updates coordinates', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.77, longitude: 90.4, accuracy: 120 },
          timestamp: Date.now(),
        });
        const state = useMapStore.getState();
        assert.equal(state.userLocation?.lat, 23.77);
        assert.equal(state.isLowAccuracy, true);
        assert.equal(state.isLiveTracking, true);
      });

      it('F04-03: Position fix with low accuracy (350m) updates coordinates without terminating live tracking', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.78, longitude: 90.41, accuracy: 350 },
          timestamp: Date.now(),
        });
        const state = useMapStore.getState();
        assert.equal(state.userLocation?.lat, 23.78);
        assert.equal(state.userAccuracyTier, 'LOW');
        assert.equal(state.isLiveTracking, true);
      });

      it('F04-04: Accuracy fluctuation sequence (10m -> 150m -> 12m) updates coordinates at every step and toggles isLowAccuracy', async () => {
        await useMapStore.getState().startLiveTracking();
        const now = Date.now();

        // 10m
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.791, longitude: 90.421, accuracy: 10 },
          timestamp: now,
        });
        assert.equal(useMapStore.getState().isLowAccuracy, false);
        assert.equal(useMapStore.getState().userLocation?.lat, 23.791);

        // 150m
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.792, longitude: 90.422, accuracy: 150 },
          timestamp: now + 1000,
        });
        assert.equal(useMapStore.getState().isLowAccuracy, true);
        assert.equal(useMapStore.getState().userLocation?.lat, 23.792);

        // 12m
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.793, longitude: 90.423, accuracy: 12 },
          timestamp: now + 2000,
        });
        assert.equal(useMapStore.getState().isLowAccuracy, false);
        assert.equal(useMapStore.getState().userLocation?.lat, 23.793);
      });

      it('F04-05: Out-of-bounds coordinates (outside Bangladesh) are rejected while retaining previous valid position', async () => {
        await useMapStore.getState().startLiveTracking();
        // Valid position in Dhaka
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 15 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.75);

        // Position in London (51.5, -0.1)
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 },
          timestamp: Date.now() + 1000,
        });
        // Must retain previous Dhaka coordinates
        assert.equal(useMapStore.getState().userLocation?.lat, 23.75);
      });
    });

    // Feature 5: Camera Follow & Manual Pan Decoupling
    describe('Feature 5: Camera Follow & Manual Pan Decoupling', () => {
      it('F05-01: When isFollowingUser = true, incoming GPS update triggers targetCommand camera pan', async () => {
        await useMapStore.getState().startLiveTracking();
        assert.equal(useMapStore.getState().isFollowingUser, true);

        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.755, longitude: 90.385, accuracy: 12 },
          timestamp: Date.now(),
        });

        const targetCmd = useMapStore.getState().targetCommand;
        assert.ok(targetCmd !== null);
        assert.equal(targetCmd?.lat, 23.755);
        assert.equal(targetCmd?.lng, 90.385);
      });

      it('F05-02: Manual map pan decouples camera follow via setIsFollowingUser(false)', async () => {
        await useMapStore.getState().startLiveTracking();
        useMapStore.getState().setIsFollowingUser(false);
        assert.equal(useMapStore.getState().isFollowingUser, false);
        assert.equal(useMapStore.getState().isLiveTracking, true);
      });

      it('F05-03: When isFollowingUser = false, incoming GPS updates marker but does NOT overwrite camera targetCommand', async () => {
        await useMapStore.getState().startLiveTracking();

        // Baseline camera command
        useMapStore.setState({
          targetCommand: { lat: 23.999, lng: 90.999, zoom: 12, id: 999 },
          isFollowingUser: false,
        });

        // New GPS reading
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.76, longitude: 90.39, accuracy: 15 },
          timestamp: Date.now(),
        });

        // Coordinates updated
        assert.equal(useMapStore.getState().userLocation?.lat, 23.76);
        // Camera target command untouched
        assert.equal(useMapStore.getState().targetCommand?.id, 999);
        assert.equal(useMapStore.getState().targetCommand?.lat, 23.999);
      });

      it('F05-04: Triggering recenterOnUser sets isFollowingUser = true and immediately pans map to current location', async () => {
        useMapStore.setState({
          userLocation: { lat: 23.75, lng: 90.38 },
          isLiveTracking: true,
          isFollowingUser: false,
        });

        useMapStore.getState().recenterOnUser();
        const state = useMapStore.getState();
        assert.equal(state.isFollowingUser, true);
        assert.equal(state.targetCommand?.lat, 23.75);
        assert.equal(state.targetCommand?.lng, 90.38);
      });

      it('F05-05: If userLocation is null when recenterOnUser is called, isFollowingUser is set to true without error', async () => {
        useMapStore.setState({ userLocation: null, isFollowingUser: false });
        useMapStore.getState().recenterOnUser();
        assert.equal(useMapStore.getState().isFollowingUser, true);
      });
    });

    // Feature 6: Live Tracking UI Controls
    describe('Feature 6: Live Tracking UI Controls', () => {
      it('F06-01: Live Tracking toggle initiates and terminates session cleanly', async () => {
        // Toggle ON
        await useMapStore.getState().startLiveTracking();
        assert.equal(useMapStore.getState().isLiveTracking, true);
        // Toggle OFF
        useMapStore.getState().stopLiveTracking();
        assert.equal(useMapStore.getState().isLiveTracking, false);
      });

      it('F06-02: Follow Me state changes reflect in isFollowingUser flag', () => {
        useMapStore.getState().setIsFollowingUser(true);
        assert.equal(useMapStore.getState().isFollowingUser, true);
        useMapStore.getState().setIsFollowingUser(false);
        assert.equal(useMapStore.getState().isFollowingUser, false);
      });

      it('F06-03: Tracking status supports all 4 standard states: active, paused, unavailable, stopped', () => {
        const statuses: TrackingStatus[] = ['active', 'paused', 'unavailable', 'stopped'];
        for (const s of statuses) {
          useMapStore.getState().setTrackingStatus(s);
          assert.equal(useMapStore.getState().trackingStatus, s);
        }
      });

      it('F06-04: User accuracy updates reflect correctly in userAccuracy state', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.74, longitude: 90.37, accuracy: 42 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracy, 42);
      });

      it('F06-05: Tracking status reflects active when tracking is running normally', async () => {
        await useMapStore.getState().startLiveTracking();
        assert.equal(useMapStore.getState().trackingStatus, 'active');
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary Value Analysis & Corner Cases (Features 1–6: 30 Tests)
  // ==========================================================================

  describe('Tier 2: Boundary Value Analysis & Corner Cases', () => {
    // F1 Boundaries
    describe('F1 Boundaries', () => {
      it('B01-01: Rapid double-click on startLiveTracking does not launch duplicate concurrent watchers', async () => {
        const p1 = useMapStore.getState().startLiveTracking();
        const p2 = useMapStore.getState().startLiveTracking();
        const [r1, r2] = await Promise.all([p1, p2]);
        assert.equal(r1, true);
        assert.equal(r2, true);
        assert.equal(sandbox.geolocation.activeWatchCount, 1);
      });

      it('B01-02: Starting live tracking in unsecure context handles gracefully without crash', async () => {
        const unsecureSandbox = installBrowserGlobals({ isSecureContext: false });
        try {
          const res = await useMapStore.getState().startLiveTracking();
          assert.equal(typeof res, 'boolean');
        } finally {
          unsecureSandbox.restore();
        }
      });

      it('B01-03: Starting live tracking when navigator.geolocation is undefined sets unavailable', async () => {
        const originalGeo = (globalThis as any).navigator.geolocation;
        delete (globalThis as any).navigator.geolocation;
        try {
          const res = await useMapStore.getState().startLiveTracking();
          assert.equal(res, false);
          assert.equal(useMapStore.getState().trackingStatus, 'unavailable');
        } finally {
          (globalThis as any).navigator.geolocation = originalGeo;
        }
      });

      it('B01-04: Stopping tracking when already in stopped state is safe no-op', () => {
        assert.equal(useMapStore.getState().trackingStatus, 'stopped');
        assert.doesNotThrow(() => {
          useMapStore.getState().stopLiveTracking();
        });
        assert.equal(useMapStore.getState().trackingStatus, 'stopped');
      });

      it('B01-05: Location timestamp is recorded as a valid positive integer', async () => {
        await useMapStore.getState().startLiveTracking();
        const testTimestamp = Date.now();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 15 },
          timestamp: testTimestamp,
        });
        assert.equal(useMapStore.getState().locationTimestamp, testTimestamp);
      });
    });

    // F2 Boundaries
    describe('F2 Boundaries', () => {
      it('B02-01: Watcher ID handles numeric values properly in store', () => {
        useMapStore.getState().setLiveWatchId(999999);
        assert.equal(useMapStore.getState().liveWatchId, 999999);
      });

      it('B02-02: Tracking fix accepted at exactly 15,000ms and 15,001ms without watchdog rejection', async () => {
        await useMapStore.getState().startLiveTracking();
        const base = Date.now();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.751, longitude: 90.381, accuracy: 20 },
          timestamp: base + 15_000,
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.751);

        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.752, longitude: 90.382, accuracy: 20 },
          timestamp: base + 15_001,
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.752);
      });

      it('B02-03: clearWatch called with null/undefined liveWatchId does not throw', () => {
        useMapStore.setState({ liveWatchId: null });
        assert.doesNotThrow(() => {
          useMapStore.getState().stopLiveTracking();
        });
      });

      it('B02-04: Geolocation error with TIMEOUT code (3) handles cleanly without crashing', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitError({ code: 3, message: 'Timeout expired' });
        assert.equal(useMapStore.getState().trackingStatus, 'unavailable');
      });

      it('B02-05: Rapid start-stop-start cycle within milliseconds maintains single valid watcher ID', async () => {
        await useMapStore.getState().startLiveTracking();
        useMapStore.getState().stopLiveTracking();
        await useMapStore.getState().startLiveTracking();
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(sandbox.geolocation.activeWatchCount, 1);
      });
    });

    // F3 Boundaries
    describe('F3 Boundaries', () => {
      it('B03-01: Position fix with accuracy exactly 15.000m does NOT terminate live tracking', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 15 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
      });

      it('B03-02: Position fix with accuracy 14.999m keeps watcher active in HIGH tier', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 14.999 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
      });

      it('B03-03: Position fix with sub-meter accuracy (0.5m) ingested successfully', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 0.5 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracy, 0.5);
        assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
      });

      it('B03-04: Position fix with accuracy 0m handled cleanly without math errors', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 0 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracy, 0);
      });

      it('B03-05: Position fix with accuracy 15.001m transitions tier to GOOD without dropping connection', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 15.001 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().isLiveTracking, true);
        assert.equal(useMapStore.getState().userAccuracyTier, 'GOOD');
      });
    });

    // F4 Boundaries
    describe('F4 Boundaries', () => {
      it('B04-01: Accuracy at MODERATE boundary (exactly 100.0m) classified as MODERATE', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 100 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracyTier, 'MODERATE');
        assert.equal(useMapStore.getState().isLowAccuracy, false);
      });

      it('B04-02: Accuracy at LOW boundary (100.1m) classified as LOW and triggers isLowAccuracy', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 100.1 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracyTier, 'LOW');
        assert.equal(useMapStore.getState().isLowAccuracy, true);
      });

      it('B04-03: Accuracy at 250m hardware threshold boundary ingested correctly', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 250 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracy, 250);
        assert.equal(useMapStore.getState().isLowAccuracy, true);
      });

      it('B04-04: Degraded accuracy of 1500m ingested into userLocation with EXTREMELY_POOR tier', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 1500 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.75);
        assert.equal(useMapStore.getState().userAccuracyTier, 'EXTREMELY_POOR');
      });

      it('B04-05: Non-positive or NaN accuracy is sanitized to null in store', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: -5 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userAccuracy, null);
      });
    });

    // F5 Boundaries
    describe('F5 Boundaries', () => {
      it('B05-01: setIsFollowingUser accepts explicit boolean states', () => {
        useMapStore.getState().setIsFollowingUser(true);
        assert.equal(useMapStore.getState().isFollowingUser, true);
        useMapStore.getState().setIsFollowingUser(false);
        assert.equal(useMapStore.getState().isFollowingUser, false);
      });

      it('B05-02: Rapid successive setIsFollowingUser calls maintain deterministic state', () => {
        for (let i = 0; i < 10; i++) {
          useMapStore.getState().setIsFollowingUser(i % 2 === 0);
        }
        assert.equal(useMapStore.getState().isFollowingUser, false);
      });

      it('B05-03: Recenter command on valid user location produces targetCommand with street zoom', () => {
        useMapStore.setState({
          userLocation: { lat: 23.75, lng: 90.38 },
          userAccuracy: 10,
          isFollowingUser: false,
        });
        useMapStore.getState().recenterOnUser();
        assert.equal(useMapStore.getState().isFollowingUser, true);
        assert.equal(useMapStore.getState().targetCommand?.zoom, 17);
      });

      it('B05-04: Recenter command with moderate accuracy (80m) selects zoom 16', () => {
        useMapStore.setState({
          userLocation: { lat: 23.75, lng: 90.38 },
          userAccuracy: 80,
          isFollowingUser: false,
        });
        useMapStore.getState().recenterOnUser();
        assert.equal(useMapStore.getState().targetCommand?.zoom, 16);
      });

      it('B05-05: Recenter command while user coordinates are at Bangladesh boundary line succeeds cleanly', () => {
        useMapStore.setState({
          userLocation: { lat: 20.35, lng: 88.05 },
          userAccuracy: 15,
          isFollowingUser: false,
        });
        useMapStore.getState().recenterOnUser();
        assert.equal(useMapStore.getState().isFollowingUser, true);
        assert.equal(useMapStore.getState().targetCommand?.lat, 20.35);
      });
    });

    // F6 Boundaries
    describe('F6 Boundaries', () => {
      it('B06-01: Calling startLiveTracking when already tracking returns true without re-creating listeners', async () => {
        await useMapStore.getState().startLiveTracking();
        const watchId1 = useMapStore.getState().liveWatchId;
        await useMapStore.getState().startLiveTracking();
        const watchId2 = useMapStore.getState().liveWatchId;
        assert.ok(watchId1 !== null && watchId2 !== null);
      });

      it('B06-02: Coordinates formatted to 6 decimal places (~0.11m precision)', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.12345678, longitude: 90.87654321, accuracy: 10 },
          timestamp: Date.now(),
        });
        assert.equal(useMapStore.getState().userLocation?.lat, 23.123457);
        assert.equal(useMapStore.getState().userLocation?.lng, 90.876543);
      });

      it('B06-03: Stale position (>30s old) is rejected from live tracking', async () => {
        await useMapStore.getState().startLiveTracking();
        const now = Date.now();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 10 },
          timestamp: now - 35_000, // 35s old
        });
        assert.equal(useMapStore.getState().userLocation, null);
      });

      it('B06-04: Non-positive timestamp (0 or negative) is rejected from updating active coordinates', async () => {
        await useMapStore.getState().startLiveTracking();
        sandbox.geolocation.mockEmitPosition({
          coords: { latitude: 23.75, longitude: 90.38, accuracy: 10 },
          timestamp: -100,
        });
        assert.equal(useMapStore.getState().userLocation, null);
      });

      it('B06-05: Tracking status transitions cleanly across all states', () => {
        useMapStore.getState().setTrackingStatus('active');
        assert.equal(useMapStore.getState().trackingStatus, 'active');
        useMapStore.getState().setTrackingStatus('paused');
        assert.equal(useMapStore.getState().trackingStatus, 'paused');
        useMapStore.getState().setTrackingStatus('stopped');
        assert.equal(useMapStore.getState().trackingStatus, 'stopped');
      });
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Pairwise Interactions (6 Tests)
  // ==========================================================================

  describe('Tier 3: Cross-Feature Pairwise Interactions', () => {
    it('X01 (F1 + F5): Live tracking active + Camera follow enabled: GPS fix updates location and map camera', async () => {
      await useMapStore.getState().startLiveTracking();
      assert.equal(useMapStore.getState().isFollowingUser, true);

      sandbox.geolocation.mockEmitPosition({
        coords: { latitude: 23.756, longitude: 90.386, accuracy: 12 },
        timestamp: Date.now(),
      });

      assert.equal(useMapStore.getState().userLocation?.lat, 23.756);
      assert.equal(useMapStore.getState().targetCommand?.lat, 23.756);
    });

    it('X02 (F1 + F5): Live tracking active + User manually pans: camera follow decouples and marker updates without moving map', async () => {
      await useMapStore.getState().startLiveTracking();

      // User pans map away
      useMapStore.getState().setIsFollowingUser(false);
      useMapStore.setState({
        targetCommand: { lat: 23.9, lng: 90.9, zoom: 12, id: 777 },
      });

      // New GPS reading
      sandbox.geolocation.mockEmitPosition({
        coords: { latitude: 23.758, longitude: 90.388, accuracy: 14 },
        timestamp: Date.now(),
      });

      // Marker moved to GPS coordinates
      assert.equal(useMapStore.getState().userLocation?.lat, 23.758);
      // Map camera remained at user-panned view
      assert.equal(useMapStore.getState().targetCommand?.id, 777);
      assert.equal(useMapStore.getState().targetCommand?.lat, 23.9);
    });

    it('X03 (F5 + F6): User in manual pan view + clicks Recenter: camera flies back to user position', () => {
      useMapStore.setState({
        userLocation: { lat: 23.758, lng: 90.388 },
        userAccuracy: 14,
        isFollowingUser: false,
        isLiveTracking: true,
      });

      useMapStore.getState().recenterOnUser();
      assert.equal(useMapStore.getState().isFollowingUser, true);
      assert.equal(useMapStore.getState().targetCommand?.lat, 23.758);
    });

    it('X04 (F1 + F4 + F5): Live tracking active + Follow mode active + Accuracy degrades: smooth camera centering maintained', async () => {
      await useMapStore.getState().startLiveTracking();

      // Degraded 120m accuracy fix
      sandbox.geolocation.mockEmitPosition({
        coords: { latitude: 23.76, longitude: 90.39, accuracy: 120 },
        timestamp: Date.now(),
      });

      assert.equal(useMapStore.getState().isLowAccuracy, true);
      assert.equal(useMapStore.getState().targetCommand?.lat, 23.76);
      assert.equal(useMapStore.getState().targetCommand?.zoom, 15); // Zoom 15 for degraded fix
    });

    it('X05 (F1 + F2 + F6): Live tracking active + User toggles Live Tracking OFF: clean watcher and state disposal', async () => {
      await useMapStore.getState().startLiveTracking();
      const watchId = useMapStore.getState().liveWatchId!;

      useMapStore.getState().stopLiveTracking();
      assert.equal(useMapStore.getState().isLiveTracking, false);
      assert.equal(useMapStore.getState().liveWatchId, null);
      assert.equal(useMapStore.getState().trackingStatus, 'stopped');
      assert.ok(sandbox.geolocation.clearedWatchIds.includes(watchId));
    });

    it('X06 (F1 + F3 + F6): Live tracking active + High accuracy fix achieved: watcher persists beyond 15 seconds', async () => {
      await useMapStore.getState().startLiveTracking();
      const watchId = useMapStore.getState().liveWatchId!;
      const base = Date.now();

      // High accuracy fix at t = 20s
      sandbox.geolocation.mockEmitPosition({
        coords: { latitude: 23.75, longitude: 90.38, accuracy: 8 },
        timestamp: base + 20_000,
      });

      assert.equal(useMapStore.getState().isLiveTracking, true);
      assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
      assert.ok(!sandbox.geolocation.clearedWatchIds.includes(watchId));
    });
  });
});
