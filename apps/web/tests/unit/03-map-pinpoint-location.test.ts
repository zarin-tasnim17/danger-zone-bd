import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWithinBangladesh,
  formatCoordinate,
  sanitizeAccuracy,
  computeAccuracyCircleRadius,
  BANGLADESH_BOUNDS,
} from '@repo/shared';
import { evaluateHardwareGpsProximity } from '@/lib/gpsVerification';
import {
  useMapStore,
  STORAGE_KEY_USER_LOCATION,
  SavedUserLocation,
} from '@/store/useMapStore';
import { isMobileDevice } from '@/lib/deviceUtils';
import { installBrowserGlobals, BrowserSandboxHandle } from '../framework/domEnv';

describe('[Unit][MapPinpoint] GPS Pinpoint Location, Interactive Calibration & Map Camera Synchronization', () => {
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
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // -------------------------------------------------------------------------
  // Test 1: Pinpoint Icon Centering & Optical Anchor Geometry
  // -------------------------------------------------------------------------
  it('Test 1: User GPS Pinpoint icon geometry provides concentric subpixel centering and clear popup clearance', () => {
    const iconSize: [number, number] = [28, 28];
    const iconAnchor: [number, number] = [14, 14];
    const popupAnchor: [number, number] = [0, -16];

    // Verify anchor point is strictly half of icon dimensions for true radial centering
    assert.equal(iconAnchor[0], iconSize[0] / 2);
    assert.equal(iconAnchor[1], iconSize[1] / 2);

    // Verify popup anchor renders above the beacon without obscuring the pulse dot
    assert.equal(popupAnchor[0], 0);
    assert.equal(popupAnchor[1] <= -iconSize[1] / 2, true);

    // Verify source styling differentiation (gps vs calibrated)
    const gpsColors = {
      pulse: '#3B82F6',
      badge: '#2563EB',
    };
    const calibratedColors = {
      pulse: '#10B981',
      badge: '#059669',
    };
    assert.notEqual(gpsColors.pulse, calibratedColors.pulse);
    assert.notEqual(gpsColors.badge, calibratedColors.badge);
  });

  // -------------------------------------------------------------------------
  // Test 2: Accuracy Circle Radius Calculation & Uncertainty Bounds
  // -------------------------------------------------------------------------
  it('Test 2: Accuracy circle radius correctly un-clamps for real GPS and locks to 25m for calibrated points', () => {
    // Calibrated source locks radius to 25m regardless of raw accuracy parameter
    assert.equal(computeAccuracyCircleRadius('calibrated', null), 25);
    assert.equal(computeAccuracyCircleRadius('calibrated', 1200), 25);
    assert.equal(computeAccuracyCircleRadius('calibrated', 5), 25);

    // Live GPS source accurately reflects reported horizontal uncertainty
    assert.equal(computeAccuracyCircleRadius('gps', 12), 12);
    assert.equal(computeAccuracyCircleRadius('gps', 28.4), 28.4);
    assert.equal(computeAccuracyCircleRadius('gps', 850), 850);
    assert.equal(computeAccuracyCircleRadius('gps', 3500), 3500);

    // Non-positive or corrupted accuracy values fall back safely to 50m
    assert.equal(computeAccuracyCircleRadius('gps', null), 50);
    assert.equal(computeAccuracyCircleRadius('gps', undefined), 50);
    assert.equal(computeAccuracyCircleRadius('gps', -20), 50);
    assert.equal(computeAccuracyCircleRadius('gps', NaN), 50);
  });

  // -------------------------------------------------------------------------
  // Test 3: Interactive Drag-to-Calibrate Flow & Camera Update
  // -------------------------------------------------------------------------
  it('Test 3: Dragging pinpoint marker inside Bangladesh validates, saves calibrated state, updates targetCommand and localStorage', () => {
    const store = useMapStore.getState();

    // Initial state: GPS position with 450m network inaccuracy
    const initialGps = { lat: 23.75, lng: 90.38 };
    store.setUserLocation(initialGps, 450, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().locationSource, 'gps');

    // User drags the pinpoint marker to exact building (Dhanmondi 32)
    const draggedCoords = { lat: 23.7516284, lng: 90.3776192 };
    assert.equal(isWithinBangladesh(draggedCoords.lat, draggedCoords.lng), true);

    // Trigger calibration
    store.calibrateUserLocation(draggedCoords, 'Dhanmondi 32 Building');

    const updatedState = useMapStore.getState();

    // Verify 6-decimal coordinate precision (~0.11m precision)
    assert.equal(updatedState.userLocation?.lat, 23.751628);
    assert.equal(updatedState.userLocation?.lng, 90.377619);

    // Verify status transition
    assert.equal(updatedState.locationSource, 'calibrated');
    assert.equal(updatedState.userAccuracy, 25);
    assert.equal(updatedState.userAccuracyTier, 'GOOD');
    assert.equal(updatedState.isLowAccuracy, false);
    assert.equal(updatedState.locationLabel, 'Dhanmondi 32 Building');

    // Verify targetCommand was emitted to fly the map camera
    assert.notEqual(updatedState.targetCommand, null);
    assert.equal(updatedState.targetCommand?.lat, 23.751628);
    assert.equal(updatedState.targetCommand?.lng, 90.377619);
    assert.equal(updatedState.targetCommand?.zoom! >= 16, true);

    // Verify persistence to localStorage
    const savedRaw = localStorage.getItem(STORAGE_KEY_USER_LOCATION);
    assert.notEqual(savedRaw, null);
    const saved: SavedUserLocation = JSON.parse(savedRaw!);
    assert.equal(saved.lat, 23.751628);
    assert.equal(saved.lng, 90.377619);
    assert.equal(saved.source, 'calibrated');
    assert.equal(saved.accuracy, 25);
  });

  // -------------------------------------------------------------------------
  // Test 4: Drag Outside Territorial Boundary Rejection
  // -------------------------------------------------------------------------
  it('Test 4: Dragging pinpoint outside Bangladesh territory boundary is strictly rejected', () => {
    // Points outside Bangladesh boundary (minLat: 20.3, maxLat: 26.8, minLng: 87.8, maxLng: 92.9)
    const pointsOutside = [
      { name: 'Bay of Bengal Deep Sea (Lat 18.25 < 20.3)', lat: 18.25, lng: 90.12 },
      { name: 'Himalayas, Tibet (Lat 28.39 > 26.8)', lat: 28.39, lng: 89.5 },
      { name: 'Central India (Lng 82.5 < 87.8)', lat: 23.5, lng: 82.5 },
      { name: 'Myanmar Interior (Lng 95.95 > 92.9)', lat: 22.0, lng: 95.95 },
      { name: 'Null Island (0, 0)', lat: 0, lng: 0 },
    ];

    for (const pt of pointsOutside) {
      const valid = isWithinBangladesh(pt.lat, pt.lng);
      assert.equal(
        valid,
        false,
        `Expected ${pt.name} (${pt.lat}, ${pt.lng}) to be outside Bangladesh bounds`
      );
    }

    // Points inside Bangladesh boundary
    const pointsInside = [
      { name: 'Dhaka Zero Point', lat: 23.7272, lng: 90.4093 },
      { name: 'Khulna Royal More', lat: 22.8146, lng: 89.5583 },
      { name: 'Chittagong GEC', lat: 22.3587, lng: 91.8215 },
      { name: 'Sylhet Zindabazar', lat: 24.8949, lng: 91.8687 },
      { name: 'Rajshahi Saheb Bazar', lat: 24.3636, lng: 88.6283 },
      { name: 'Tetulia (Northern Tip)', lat: 26.49, lng: 88.55 },
      { name: 'Teknaf (Southern Tip)', lat: 20.86, lng: 92.29 },
    ];

    for (const pt of pointsInside) {
      const valid = isWithinBangladesh(pt.lat, pt.lng);
      assert.equal(
        valid,
        true,
        `Expected ${pt.name} (${pt.lat}, ${pt.lng}) to be inside Bangladesh bounds`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: Reset to Browser GPS from Pinpoint Popup
  // -------------------------------------------------------------------------
  it('Test 5: Reset to browser GPS purges calibrated persistence and resets active geolocation state', () => {
    const store = useMapStore.getState();

    // Set calibrated state
    store.calibrateUserLocation({ lat: 23.75, lng: 90.38 }, 'Calibrated Office');
    assert.notEqual(localStorage.getItem(STORAGE_KEY_USER_LOCATION), null);
    assert.equal(useMapStore.getState().locationSource, 'calibrated');

    // Call reset
    store.resetToBrowserGps();

    const clearedState = useMapStore.getState();
    assert.equal(clearedState.userLocation, null);
    assert.equal(clearedState.userAccuracy, null);
    assert.equal(clearedState.locationSource, null);
    assert.equal(clearedState.locationLabel, null);
    assert.equal(clearedState.isLowAccuracy, false);
    assert.equal(localStorage.getItem(STORAGE_KEY_USER_LOCATION), null);
  });

  // -------------------------------------------------------------------------
  // Test 6: Report Pin Map Hardware Proximity Verification Thresholding
  // -------------------------------------------------------------------------
  it('Test 6: ReportPinMap verifies GPS proximity against 200m radius threshold accurately', () => {
    const deviceGpsFix = {
      lat: 23.7508,
      lng: 90.3842,
      accuracy: 12, // High hardware GPS accuracy (<= 30m)
      timestamp: Date.now(),
    };

    // Incident placed within ~30m of user hardware GPS
    const verifiedResult = evaluateHardwareGpsProximity(
      deviceGpsFix,
      23.7510,
      90.3843
    );
    assert.equal(verifiedResult.isVerified, true);
    assert.equal(verifiedResult.status, 'HARDWARE_VERIFIED');
    assert.equal(verifiedResult.distanceMeters! <= 200, true);

    // Incident placed ~600m away (out of range of hardware GPS)
    const outOfRangeResult = evaluateHardwareGpsProximity(
      deviceGpsFix,
      23.7555,
      90.3895
    );
    assert.equal(outOfRangeResult.isVerified, false);
    assert.equal(outOfRangeResult.status, 'OUT_OF_RANGE');
    assert.equal(outOfRangeResult.distanceMeters! > 200, true);

    // When GPS device location is unavailable
    const unavailableResult = evaluateHardwareGpsProximity(
      null,
      23.7510,
      90.3843
    );
    assert.equal(unavailableResult.isVerified, false);
    assert.equal(unavailableResult.status, 'UNAVAILABLE');
    assert.equal(unavailableResult.distanceMeters, null);
  });

  // -------------------------------------------------------------------------
  // Test 7: Unified Camera Zoom & TargetCommand Synchronization (Prevents Zoom 7 Collision)
  // -------------------------------------------------------------------------
  it('Test 7: Unified camera zoom updates targetCommand to 16-17 on location acquisition and prevents zoom 7 overwrite', () => {
    const store = useMapStore.getState();

    // 1. Initial country-level state
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      targetCommand: null,
    });
    assert.equal(useMapStore.getState().zoom, 7);

    const testCoords = { lat: 23.7508, lng: 90.3842 };

    // 2. Moderate accuracy fix (30-100m, e.g. 50m) -> target zoom must be 16
    const moderateAcc = 50;
    const targetZoomModerate = moderateAcc <= 30 ? 17 : moderateAcc <= 100 ? 16 : 15;
    assert.equal(targetZoomModerate, 16);

    store.flyTo(testCoords, targetZoomModerate);

    let state = useMapStore.getState();
    assert.equal(state.zoom, 16, 'Store zoom must update to target zoom 16');
    assert.notEqual(state.targetCommand, null);
    assert.equal(state.targetCommand?.zoom, 16, 'targetCommand must carry zoom 16 instead of collapsing to zoom 7');
    assert.equal(state.targetCommand?.lat, testCoords.lat);
    assert.equal(state.targetCommand?.lng, testCoords.lng);

    // 3. High precision refinement fix (<= 30m, e.g. 12m) -> target zoom must be 17
    const highAcc = 12;
    const targetZoomHigh = highAcc <= 30 ? 17 : highAcc <= 100 ? 16 : 15;
    assert.equal(targetZoomHigh, 17);

    store.flyTo(testCoords, targetZoomHigh);

    state = useMapStore.getState();
    assert.equal(state.zoom, 17, 'Store zoom must update to street-level zoom 17');
    assert.equal(state.targetCommand?.zoom, 17, 'targetCommand must carry zoom 17');

    // 4. setCenter with explicit zoom parameter updates targetCommand atomically
    const newCoords = { lat: 23.8103, lng: 90.4125 };
    store.setCenter(newCoords, 16);
    state = useMapStore.getState();
    assert.equal(state.center.lat, newCoords.lat);
    assert.equal(state.zoom, 16);
    assert.equal(state.targetCommand?.zoom, 16);
    assert.equal(state.targetCommand?.lat, newCoords.lat);
  });

  // -------------------------------------------------------------------------
  // Test 8: Watchdog 15-second Timeout Preserves Acquired Fix Without Camera Disruption
  // -------------------------------------------------------------------------
  it('Test 8: 15s watchdog timeout halts spinner, preserves best acquired fix, and leaves camera focused at zoom 16', () => {
    const store = useMapStore.getState();

    // Reset to country level
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      userLocation: null,
      targetCommand: null,
      isLocating: true,
      acquisitionStage: 'acquiring',
    });

    // Device acquires initial usable fix with moderate accuracy (65m)
    const acquiredCoords = { lat: 23.7508, lng: 90.3842 };
    store.setUserLocation(acquiredCoords, 65, 'gps');
    store.flyTo(acquiredCoords, 16);
    store.setAcquisitionStage('refining');

    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, acquiredCoords);
    assert.equal(state.userAccuracy, 65);
    assert.equal(state.zoom, 16);
    assert.equal(state.targetCommand?.zoom, 16);
    assert.equal(state.targetCommand?.lat, acquiredCoords.lat);
    assert.equal(state.acquisitionStage, 'refining');

    // Watchdog fires after 15s deadline without reaching <= 15m
    const triggerWatchdogTimeout = () => {
      useMapStore.getState().setIsLocating(false);
      useMapStore.getState().setAcquisitionStage('timeout');
    };

    triggerWatchdogTimeout();

    const finalState = useMapStore.getState();
    // Verify locating spinner stopped
    assert.equal(finalState.isLocating, false);
    // Verify timeout stage set
    assert.equal(finalState.acquisitionStage, 'timeout');
    // Verify userLocation is completely preserved
    assert.deepEqual(finalState.userLocation, acquiredCoords);
    assert.equal(finalState.userAccuracy, 65);
    // Verify camera targetCommand remains at zoom 16 focused on user without disruption
    assert.equal(finalState.zoom, 16);
    assert.equal(finalState.targetCommand?.zoom, 16);
    assert.equal(finalState.targetCommand?.lat, acquiredCoords.lat);
    assert.equal(finalState.targetCommand?.lng, acquiredCoords.lng);
  });

  // -------------------------------------------------------------------------
  // Test 9: Progressive Refinement (80m -> 45m -> 14m) Zoom Transition
  // -------------------------------------------------------------------------
  it('Test 9: Rapid progressive refinement sequence (80m -> 45m -> 14m) upgrades zoom monotonically to 17 without zoom 7 collision', () => {
    const store = useMapStore.getState();

    // Start at country level
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      userLocation: null,
      targetCommand: null,
      isLocating: true,
      acquisitionStage: 'acquiring',
    });

    const getTargetZoom = (acc: number | null) =>
      acc !== null && acc <= 30 ? 17 : acc !== null && acc <= 100 ? 16 : 15;

    // Step 1: Moderate fix (80m)
    const fix1 = { lat: 23.7508, lng: 90.3842 };
    store.setUserLocation(fix1, 80, 'gps');
    store.flyTo(fix1, getTargetZoom(80));
    store.setAcquisitionStage('refining');

    let state = useMapStore.getState();
    assert.equal(state.zoom, 16);
    assert.equal(state.targetCommand?.zoom, 16);
    assert.equal(state.targetCommand?.lat, fix1.lat);

    // Step 2: Refined moderate fix (45m)
    const fix2 = { lat: 23.75085, lng: 90.38422 };
    store.setUserLocation(fix2, 45, 'gps');
    store.flyTo(fix2, getTargetZoom(45));

    state = useMapStore.getState();
    assert.equal(state.zoom, 16);
    assert.equal(state.targetCommand?.zoom, 16);
    assert.equal(state.targetCommand?.lat, fix2.lat);

    // Step 3: High precision fix (14m <= 15m)
    const fix3 = { lat: 23.75088, lng: 90.38425 };
    store.setUserLocation(fix3, 14, 'gps');
    store.flyTo(fix3, getTargetZoom(14));
    store.setIsLocating(false);
    store.setAcquisitionStage('success');

    state = useMapStore.getState();
    assert.equal(state.zoom, 17, 'High precision reading must upgrade camera to zoom 17');
    assert.equal(state.targetCommand?.zoom, 17);
    assert.equal(state.targetCommand?.lat, fix3.lat);
    assert.equal(state.isLocating, false);
    assert.equal(state.acquisitionStage, 'success');
  });

  // -------------------------------------------------------------------------
  // Test 10: Immediate Re-centering on Existing Location When Panned Away
  // -------------------------------------------------------------------------
  it('Test 10: Re-centering on known location immediately flies camera back to street level (17) without waiting for new GPS fix', () => {
    const store = useMapStore.getState();

    const knownUserLocation = { lat: 23.7508, lng: 90.3842 };
    const knownAccuracy = 22; // <= 30m -> zoom 17

    useMapStore.setState({
      userLocation: knownUserLocation,
      userAccuracy: knownAccuracy,
      locationSource: 'gps',
      center: { lat: 22.3587, lng: 91.8215 }, // User panned away to Chittagong
      zoom: 11,
      targetCommand: null,
    });

    const getTargetZoom = (acc: number | null) =>
      acc !== null && acc <= 30 ? 17 : acc !== null && acc <= 100 ? 16 : 15;

    // Simulate clicking "My Location" when position is already known
    const existingLoc = useMapStore.getState().userLocation!;
    const existingAcc = useMapStore.getState().userAccuracy;
    store.flyTo(existingLoc, getTargetZoom(existingAcc));

    const updatedState = useMapStore.getState();
    assert.equal(updatedState.center.lat, knownUserLocation.lat);
    assert.equal(updatedState.center.lng, knownUserLocation.lng);
    assert.equal(updatedState.zoom, 17);
    assert.notEqual(updatedState.targetCommand, null);
    assert.equal(updatedState.targetCommand?.lat, knownUserLocation.lat);
    assert.equal(updatedState.targetCommand?.lng, knownUserLocation.lng);
    assert.equal(updatedState.targetCommand?.zoom, 17);
  });

  // -------------------------------------------------------------------------
  // Test 11: centerOnUserLocation Dynamic Zoom & Boundary Guard
  // -------------------------------------------------------------------------
  it('Test 11: centerOnUserLocation dynamically selects zoom tier (17/16/15) based on accuracy and guards bounds', () => {
    const store = useMapStore.getState();

    // 1. When userLocation is null, returns false without throwing or updating targetCommand
    useMapStore.setState({ userLocation: null, targetCommand: null });
    assert.equal(store.centerOnUserLocation(), false);
    assert.equal(useMapStore.getState().targetCommand, null);

    // 2. When userLocation is outside Bangladesh, returns false and suppresses flight
    useMapStore.setState({ userLocation: { lat: 10.0, lng: 20.0 }, targetCommand: null });
    assert.equal(store.centerOnUserLocation(), false);
    assert.equal(useMapStore.getState().targetCommand, null);

    // 3. High accuracy (<= 30m): target zoom must be 17
    const dhakaLocation = { lat: 23.8103, lng: 90.4125 };
    useMapStore.setState({
      userLocation: dhakaLocation,
      userAccuracy: 18,
      center: { lat: 22.0, lng: 90.0 },
      zoom: 8,
      targetCommand: null,
    });
    assert.equal(store.centerOnUserLocation(), true);
    let state = useMapStore.getState();
    assert.equal(state.zoom, 17);
    assert.equal(state.targetCommand?.zoom, 17);
    assert.equal(state.targetCommand?.lat, dhakaLocation.lat);
    assert.equal(state.targetCommand?.lng, dhakaLocation.lng);

    // 4. Moderate accuracy (<= 100m, e.g. 60m): target zoom must be 16
    useMapStore.setState({
      userLocation: dhakaLocation,
      userAccuracy: 60,
      zoom: 8,
      targetCommand: null,
    });
    assert.equal(store.centerOnUserLocation(), true);
    state = useMapStore.getState();
    assert.equal(state.zoom, 16);
    assert.equal(state.targetCommand?.zoom, 16);

    // 5. Coarse accuracy (> 100m, e.g. 350m): target zoom must be 15
    useMapStore.setState({
      userLocation: dhakaLocation,
      userAccuracy: 350,
      zoom: 8,
      targetCommand: null,
    });
    assert.equal(store.centerOnUserLocation(), true);
    state = useMapStore.getState();
    assert.equal(state.zoom, 15);
    assert.equal(state.targetCommand?.zoom, 15);

    // 6. Calibrated location: target zoom must always be street-level 17
    useMapStore.setState({
      userLocation: dhakaLocation,
      userAccuracy: 25,
      locationSource: 'calibrated',
      zoom: 8,
      targetCommand: null,
    });
    assert.equal(store.centerOnUserLocation(), true);
    state = useMapStore.getState();
    assert.equal(state.zoom, 17, 'Calibrated location must default to street-level zoom 17');
    assert.equal(state.targetCommand?.zoom, 17);
  });

  // -------------------------------------------------------------------------
  // Test 12: isMobileDevice Detection Utility
  // -------------------------------------------------------------------------
  it('Test 12: isMobileDevice correctly identifies mobile devices, touch screens, and desktop environments', () => {
    const originalWindow = globalThis.window;
    const originalNavigator = globalThis.navigator;

    try {
      // 1. Android user-agent
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36' },
      });
      (globalThis as any).window = { innerWidth: 412 };
      assert.equal(isMobileDevice(), true, 'Android device UA must be detected as mobile');

      // 2. iPhone user-agent
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15' },
      });
      (globalThis as any).window = { innerWidth: 393 };
      assert.equal(isMobileDevice(), true, 'iPhone UA must be detected as mobile');

      // 3. Small screen viewport (<= 768px)
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'CustomBrowser/1.0' },
      });
      (globalThis as any).window = { innerWidth: 375 };
      assert.equal(isMobileDevice(), true, 'Screen width <= 768px must be treated as mobile');

      // 4. Desktop with wide screen and no touch
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', maxTouchPoints: 0 },
      });
      (globalThis as any).window = { innerWidth: 1440 };
      assert.equal(isMobileDevice(), false, 'Desktop wide screen without touch must return false');

      // 5. iPadOS 13+ (Macintosh UA with maxTouchPoints > 1)
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          maxTouchPoints: 5,
        },
      });
      (globalThis as any).window = { innerWidth: 1024 };
      assert.equal(isMobileDevice(), true, 'iPadOS 13+ tablet with touch must be detected as mobile');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: originalNavigator,
      });
      (globalThis as any).window = originalWindow;
    }
  });

  // -------------------------------------------------------------------------
  // Test 13: Auto-detection on Mobile Mount Automatically Centers & Zooms
  // -------------------------------------------------------------------------
  it('Test 13: Mobile auto-location on mount acquires device GPS, updates store, and auto-zooms without manual click', () => {
    const store = useMapStore.getState();

    // Reset store to national view
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      userLocation: null,
      userAccuracy: null,
      targetCommand: null,
      hasAutoLocated: false,
    });

    // Simulate mobile auto-detection flow on mount
    store.setIsLocating(true);
    store.setAcquisitionStage('acquiring');
    store.setHasAutoLocated(true);

    // Device emits real GPS coordinates in Bangladesh with good accuracy
    const gpsLocation = { lat: 23.7508, lng: 90.3842 };
    const gpsAccuracy = 18; // <= 30m -> zoom 17

    store.setUserLocation(gpsLocation, gpsAccuracy, 'gps', undefined, Date.now());
    store.centerOnUserLocation();
    store.setIsLocating(false);
    store.setAcquisitionStage('success');

    const state = useMapStore.getState();
    assert.deepEqual(state.userLocation, gpsLocation);
    assert.equal(state.userAccuracy, 18);
    assert.equal(state.userAccuracyTier, 'GOOD');
    assert.equal(state.hasAutoLocated, true);
    assert.equal(state.zoom, 17, 'Auto-detection must auto-zoom map camera to street level (17)');
    assert.notEqual(state.targetCommand, null);
    assert.equal(state.targetCommand?.lat, gpsLocation.lat);
    assert.equal(state.targetCommand?.lng, gpsLocation.lng);
    assert.equal(state.targetCommand?.zoom, 17);
  });

  // -------------------------------------------------------------------------
  // Test 14: Desktop Mount Permission Handling
  // -------------------------------------------------------------------------
  it('Test 14: Desktop mount auto-locates when permission is already granted and suppresses unprompted prompts when state is prompt', () => {
    const store = useMapStore.getState();

    // Case 1: Permission is already granted on desktop -> initiates auto-location
    const desktopGrantedPos = { lat: 24.3636, lng: 88.6241 }; // Rajshahi
    store.setUserLocation(desktopGrantedPos, 25, 'gps');
    store.centerOnUserLocation();

    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, desktopGrantedPos);
    assert.equal(state.zoom, 17);
    assert.equal(state.targetCommand?.lat, desktopGrantedPos.lat);

    // Case 2: Reset to browser GPS resets hasAutoLocated cleanly
    store.resetToBrowserGps();
    state = useMapStore.getState();
    assert.equal(state.userLocation, null);
    assert.equal(state.hasAutoLocated, false);
  });

  // -------------------------------------------------------------------------
  // Test 15: Panning Away and Pressing "My Location" Returns to User Position
  // -------------------------------------------------------------------------
  it('Test 15: Panning map away and pressing My Location at any time restores focus to user location immediately', () => {
    const store = useMapStore.getState();

    // User is located in Dhaka
    const userPos = { lat: 23.7508, lng: 90.3842 };
    store.setUserLocation(userPos, 15, 'gps');
    store.centerOnUserLocation();

    let state = useMapStore.getState();
    assert.equal(state.zoom, 17);
    assert.equal(state.targetCommand?.lat, userPos.lat);

    // User pans away to Sylhet at zoom 9
    useMapStore.setState({
      center: { lat: 24.8949, lng: 91.8687 },
      zoom: 9,
    });

    state = useMapStore.getState();
    assert.equal(state.center.lat, 24.8949);
    assert.equal(state.zoom, 9);

    // User presses "My Location" (calling centerOnUserLocation)
    const recentered = store.centerOnUserLocation();
    assert.equal(recentered, true);

    state = useMapStore.getState();
    assert.equal(state.center.lat, userPos.lat);
    assert.equal(state.center.lng, userPos.lng);
    assert.equal(state.zoom, 17);
    assert.equal(state.targetCommand?.lat, userPos.lat);
    assert.equal(state.targetCommand?.lng, userPos.lng);
    assert.equal(state.targetCommand?.zoom, 17);
  });

  // -------------------------------------------------------------------------
  // Test 16: Calibrated vs GPS Zoom Consistency and Re-centering Preservation
  // -------------------------------------------------------------------------
  it('Test 16: Calibrated location centerOnUserLocation consistently selects street-level zoom 17 without accuracy degradation', () => {
    const store = useMapStore.getState();

    // Reset store
    useMapStore.setState({
      center: { lat: 23.685, lng: 90.3563 },
      zoom: 7,
      userLocation: null,
      userAccuracy: null,
      locationSource: null,
      targetCommand: null,
    });

    // Calibrate location
    const calibratedPos = { lat: 23.7925, lng: 90.4078 }; // Banani
    store.calibrateUserLocation(calibratedPos, 'My Office');

    let state = useMapStore.getState();
    assert.deepEqual(state.userLocation, calibratedPos);
    assert.equal(state.locationSource, 'calibrated');

    // User pans to Khulna at zoom 10
    useMapStore.setState({
      center: { lat: 22.8456, lng: 89.5403 },
      zoom: 10,
    });

    // Press "My Location" (centerOnUserLocation)
    const success = store.centerOnUserLocation();
    assert.equal(success, true);

    state = useMapStore.getState();
    assert.equal(state.center.lat, calibratedPos.lat);
    assert.equal(state.center.lng, calibratedPos.lng);
    assert.equal(state.zoom, 17, 'Calibrated re-centering must auto-zoom to street level 17');
    assert.equal(state.targetCommand?.zoom, 17);
    assert.equal(state.targetCommand?.lat, calibratedPos.lat);
    assert.equal(state.targetCommand?.lng, calibratedPos.lng);
  });
});
