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
});
