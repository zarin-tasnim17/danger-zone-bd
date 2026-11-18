import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGeolocationAccuracy,
  isFreshPosition,
  sanitizeAccuracy,
  isWithinBangladesh,
} from '@repo/shared';
import { useMapStore, STORAGE_KEY_USER_LOCATION } from '@/store/useMapStore';
import { installBrowserGlobals, BrowserSandboxHandle } from '../framework/domEnv';

describe('[Unit][LiveGPS] Milestone 1 Continuous GPS Tracking & Map Synchronization', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    // Reset Zustand store to clean initial state
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      userLocation: null,
      userAccuracy: null,
      userAccuracyTier: null,
      locationSource: null,
      locationLabel: null,
      locationTimestamp: null,
      isLocating: false,
      acquisitionStage: 'idle',
      activeRequestId: 0,
      activeWatchId: null,
      isLowAccuracy: false,
      dismissedCalibrationBanner: false,
      isCalibrationModalOpen: false,
      targetCommand: null,
      // Continuous Live Tracking State
      isLiveTracking: false,
      trackingStatus: 'stopped',
      isFollowingUser: false,
      liveWatchId: null,
    });
  });

  afterEach(() => {
    // Ensure any active live tracking is cleanly stopped before restoring
    useMapStore.getState().stopLiveTracking();
    sandbox.restore();
  });

  // -------------------------------------------------------------------------
  // Test 1: Start, Toggle, and Stop Live Tracking Lifecycle
  // -------------------------------------------------------------------------
  it('Test 1: Start, toggle, and stop live tracking state transitions and cleanup', async () => {
    const store = useMapStore.getState();

    assert.equal(store.isLiveTracking, false);
    assert.equal(store.trackingStatus, 'stopped');
    assert.equal(store.isFollowingUser, false);
    assert.equal(store.liveWatchId, null);

    // 1. Start Live Tracking
    const started = await store.startLiveTracking();
    assert.equal(started, true);

    const activeState = useMapStore.getState();
    assert.equal(activeState.isLiveTracking, true);
    assert.equal(activeState.trackingStatus, 'active');
    assert.equal(activeState.isFollowingUser, true);
    assert.notEqual(activeState.liveWatchId, null);
    assert.equal(activeState.locationSource, 'gps');

    // 2. Stop Live Tracking
    activeState.stopLiveTracking();

    const stoppedState = useMapStore.getState();
    assert.equal(stoppedState.isLiveTracking, false);
    assert.equal(stoppedState.trackingStatus, 'stopped');
    assert.equal(stoppedState.isFollowingUser, false);
    assert.equal(stoppedState.liveWatchId, null);
  });

  // -------------------------------------------------------------------------
  // Test 2: Watcher ID Lifecycle & Clean clearWatch() Verification
  // -------------------------------------------------------------------------
  it('Test 2: Watcher ID is tracked and clearWatch() is invoked cleanly on stop', async () => {
    const store = useMapStore.getState();

    await store.startLiveTracking();
    const liveWatchId = useMapStore.getState().liveWatchId;
    assert.notEqual(liveWatchId, null);

    // Verify geolocation watchPosition was called with high accuracy options
    const watchCalls = sandbox.geolocation.calls.filter((c) => c.type === 'watchPosition');
    assert.equal(watchCalls.length >= 1, true);
    const lastWatchCall = watchCalls[watchCalls.length - 1];
    assert.equal(lastWatchCall.options?.enableHighAccuracy, true);
    assert.equal(lastWatchCall.options?.maximumAge, 0);

    // Stop live tracking
    useMapStore.getState().stopLiveTracking();

    // Verify clearWatch was called with exact liveWatchId
    assert.equal(sandbox.geolocation.clearedWatchIds.includes(liveWatchId!), true);
    assert.equal(sandbox.geolocation.activeWatchCount, 0);
  });

  // -------------------------------------------------------------------------
  // Test 3: Reaching Target High Accuracy (<= 15m) Does NOT Terminate Live Tracking
  // -------------------------------------------------------------------------
  it('Test 3: Reaching target accuracy <= 15m does not terminate live tracking or clear watch', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();
    const liveWatchId = useMapStore.getState().liveWatchId;

    // Fix 1: Moderate accuracy reading (25m)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 25 },
      timestamp: Date.now(),
    });

    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7508, lng: 90.3842 });
    assert.equal(state.userAccuracy, 25);
    assert.equal(state.isLiveTracking, true);

    // Fix 2: High accuracy reading (11m <= 15m target)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7512, longitude: 90.3845, accuracy: 11 },
      timestamp: Date.now(),
    });

    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7512, lng: 90.3845 });
    assert.equal(state.userAccuracy, 11);
    assert.equal(state.userAccuracyTier, 'HIGH');

    // CRITICAL: Live tracking MUST remain active and watch MUST NOT be cleared
    assert.equal(state.isLiveTracking, true);
    assert.equal(state.trackingStatus, 'active');
    assert.equal(state.liveWatchId, liveWatchId);
    assert.equal(sandbox.geolocation.clearedWatchIds.includes(liveWatchId!), false);
    assert.equal(sandbox.geolocation.activeWatchCount, 1);

    // Fix 3: Subsequent reading continues arriving and updating coordinates
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7518, longitude: 90.3850, accuracy: 9 },
      timestamp: Date.now(),
    });

    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7518, lng: 90.3850 });
    assert.equal(state.userAccuracy, 9);
    assert.equal(state.isLiveTracking, true);
  });

  // -------------------------------------------------------------------------
  // Test 4: Continuous Tracking Beyond 15-Second Watchdog Cutoff
  // -------------------------------------------------------------------------
  it('Test 4: Positions arriving after 15 seconds are accepted without watchdog cutoff', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();
    const startTime = Date.now();

    // Fix at T = 0
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 20 },
      timestamp: startTime,
    });
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.7508, lng: 90.3842 });

    // Fix at T = 25 seconds later (past the 15-second one-time watchdog limit)
    const timePast15s = startTime + 25000;
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7535, longitude: 90.3865, accuracy: 18 },
      timestamp: timePast15s,
    });

    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7535, lng: 90.3865 });
    assert.equal(state.locationTimestamp, timePast15s);
    assert.equal(state.isLiveTracking, true);
    assert.equal(state.trackingStatus, 'active');

    // Fix at T = 60 seconds later
    const timePast60s = startTime + 60000;
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7560, longitude: 90.3890, accuracy: 16 },
      timestamp: timePast60s,
    });

    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7560, lng: 90.3890 });
    assert.equal(state.locationTimestamp, timePast60s);
    assert.equal(state.isLiveTracking, true);
  });

  // -------------------------------------------------------------------------
  // Test 5: Degraded Accuracy Updates Position Without Freezing
  // -------------------------------------------------------------------------
  it('Test 5: Degraded accuracy readings do not freeze coordinates or get discarded', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();

    // Fix 1: High accuracy reading (10m)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 10 },
      timestamp: Date.now(),
    });
    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7508, lng: 90.3842 });
    assert.equal(state.userAccuracy, 10);
    assert.equal(state.userAccuracyTier, 'HIGH');
    assert.equal(state.isLowAccuracy, false);

    // Fix 2: User moves into covered walkway, accuracy degrades to 45m (45m > 10m)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7525, longitude: 90.3858, accuracy: 45 },
      timestamp: Date.now(),
    });
    state = useMapStore.getState();
    // In live tracking, this reading MUST NOT be discarded; coordinates MUST update!
    assert.deepEqual(state.userLocation, { lat: 23.7525, lng: 90.3858 });
    assert.equal(state.userAccuracy, 45);
    assert.equal(state.userAccuracyTier, 'MODERATE');
    assert.equal(state.isLowAccuracy, false);

    // Fix 3: Further degraded accuracy into 120m (Low accuracy tier)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7540, longitude: 90.3872, accuracy: 120 },
      timestamp: Date.now(),
    });
    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7540, lng: 90.3872 });
    assert.equal(state.userAccuracy, 120);
    assert.equal(state.userAccuracyTier, 'LOW');
    assert.equal(state.isLowAccuracy, true);

    // Fix 4: Signal clears back to high accuracy (12m)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7555, longitude: 90.3888, accuracy: 12 },
      timestamp: Date.now(),
    });
    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7555, lng: 90.3888 });
    assert.equal(state.userAccuracy, 12);
    assert.equal(state.userAccuracyTier, 'HIGH');
    assert.equal(state.isLowAccuracy, false);
  });

  // -------------------------------------------------------------------------
  // Test 6: Camera Follow, Manual Pan Suspension, and Recenter Resumption
  // -------------------------------------------------------------------------
  it('Test 6: Manual pan suspends camera following and recenter resumes following with active tracking', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();

    assert.equal(useMapStore.getState().isFollowingUser, true);
    assert.equal(useMapStore.getState().trackingStatus, 'active');

    // Fix 1: Camera follows user
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 15 },
      timestamp: Date.now(),
    });

    let state = useMapStore.getState();
    assert.notEqual(state.targetCommand, null);
    assert.equal(state.targetCommand?.lat, 23.7508);
    assert.equal(state.targetCommand?.lng, 90.3842);
    const targetCmdIdBeforePan = state.targetCommand?.id;

    // Simulate manual map drag/pan: suspends following and sets status to 'paused'
    store.setIsFollowingUser(false);
    store.setTrackingStatus('paused');

    state = useMapStore.getState();
    assert.equal(state.isFollowingUser, false);
    assert.equal(state.trackingStatus, 'paused');
    assert.equal(state.isLiveTracking, true);

    // Fix 2 arrives while following is paused: coordinates update in store, but camera does NOT snatch focus
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7530, longitude: 90.3865, accuracy: 15 },
      timestamp: Date.now(),
    });

    state = useMapStore.getState();
    assert.deepEqual(state.userLocation, { lat: 23.7530, lng: 90.3865 });
    // targetCommand id must remain untouched so camera stays where user panned
    assert.equal(state.targetCommand?.id, targetCmdIdBeforePan);

    // User clicks Recenter / Follow Me button
    store.recenterOnUser();

    state = useMapStore.getState();
    assert.equal(state.isFollowingUser, true);
    assert.equal(state.trackingStatus, 'active');
    assert.notEqual(state.targetCommand?.id, targetCmdIdBeforePan);
    assert.equal(state.targetCommand?.lat, 23.7530);
    assert.equal(state.targetCommand?.lng, 90.3865);
    assert.equal(state.targetCommand?.zoom, 17);
  });

  // -------------------------------------------------------------------------
  // Test 7: Error and Permission Denial Handling
  // -------------------------------------------------------------------------
  it('Test 7: Geolocation error or denial sets trackingStatus to unavailable gracefully', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();
    assert.equal(useMapStore.getState().trackingStatus, 'active');

    // Simulate permission denied error (code 1)
    sandbox.geolocation.mockEmitError({
      code: 1,
      message: 'User denied Geolocation',
    });

    const errorState = useMapStore.getState();
    assert.equal(errorState.trackingStatus, 'unavailable');

    // Test when navigator.geolocation is unavailable
    const originalGeo = window.navigator.geolocation;
    // @ts-expect-error simulating missing geolocation
    delete window.navigator.geolocation;

    const startResult = await store.startLiveTracking();
    assert.equal(startResult, false);
    assert.equal(useMapStore.getState().trackingStatus, 'unavailable');

    // Restore geolocation
    Object.defineProperty(window.navigator, 'geolocation', {
      value: originalGeo,
      configurable: true,
      writable: true,
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: Stale Position and Boundary Rejection in Live Stream
  // -------------------------------------------------------------------------
  it('Test 8: Rejects stale timestamps (>30s old) and out-of-bounds positions during live tracking', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();

    // 1. Valid initial fix
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 15 },
      timestamp: Date.now(),
    });
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.7508, lng: 90.3842 });

    // 2. Stale position fix (45 seconds old)
    const staleTimestamp = Date.now() - 45000;
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7600, longitude: 90.3900, accuracy: 15 },
      timestamp: staleTimestamp,
    });
    // Must remain at initial fix; stale position rejected
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.7508, lng: 90.3842 });

    // 3. Out-of-bounds position (outside Bangladesh bounds)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 40.7128, longitude: -74.0060, accuracy: 15 },
      timestamp: Date.now(),
    });
    // Must remain at initial fix; out-of-bounds rejected
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.7508, lng: 90.3842 });
  });

  // -------------------------------------------------------------------------
  // Test 9: Calibration and Reset Interaction with Live Tracking
  // -------------------------------------------------------------------------
  it('Test 9: Manual calibration clears live watch and resetToBrowserGps restores clean state', async () => {
    const store = useMapStore.getState();
    await store.startLiveTracking();
    const liveWatchId = useMapStore.getState().liveWatchId;
    assert.notEqual(liveWatchId, null);

    // User calibrates location manually
    store.calibrateUserLocation({ lat: 23.755, lng: 90.385 }, 'Calibrated Point');

    const calState = useMapStore.getState();
    assert.equal(calState.isLiveTracking, false);
    assert.equal(calState.trackingStatus, 'stopped');
    assert.equal(calState.liveWatchId, null);
    assert.equal(calState.locationSource, 'calibrated');
    assert.equal(sandbox.geolocation.clearedWatchIds.includes(liveWatchId!), true);

    // Reset to browser GPS
    store.resetToBrowserGps();

    const resetState = useMapStore.getState();
    assert.equal(resetState.userLocation, null);
    assert.equal(resetState.locationSource, null);
    assert.equal(resetState.isLiveTracking, false);
    assert.equal(resetState.liveWatchId, null);
  });

  // -------------------------------------------------------------------------
  // Test 10: Independence of One-Time Locate Me and Continuous Live Tracking
  // -------------------------------------------------------------------------
  it('Test 10: One-time Locate Me states and Live Tracking states operate independently', async () => {
    const store = useMapStore.getState();

    // 1. Simulate one-time Locate Me progressive refinement
    store.setIsLocating(true);
    store.setAcquisitionStage('refining');
    store.setActiveWatchId(404);

    // 2. Start Live Tracking concurrently
    await store.startLiveTracking();
    const liveWatchId = useMapStore.getState().liveWatchId;

    // Both watcher IDs coexist without collision
    assert.equal(useMapStore.getState().activeWatchId, 404);
    assert.notEqual(liveWatchId, 404);
    assert.equal(useMapStore.getState().isLiveTracking, true);

    // 3. Stop Live Tracking
    store.stopLiveTracking();

    // Live tracking stopped, but one-time activeWatchId is preserved
    assert.equal(useMapStore.getState().isLiveTracking, false);
    assert.equal(useMapStore.getState().liveWatchId, null);
    assert.equal(useMapStore.getState().activeWatchId, 404);
  });
});
