import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  GeolocationAccuracyTier,
  GEOLOCATION_THRESHOLDS,
  classifyGeolocationAccuracy,
  isFreshPosition,
  sanitizeAccuracy,
  computeAccuracyCircleRadius,
  isWithinBangladesh,
  formatCoordinate,
  BANGLADESH_BOUNDS,
} from '@repo/shared';
import { useMapStore, STORAGE_KEY_USER_LOCATION } from '@/store/useMapStore';
import { geoTranslations } from '@/lib/translations';
import { installBrowserGlobals, BrowserSandboxHandle } from '../framework/domEnv';

describe('[Unit][Geolocation] Milestone 1 Geolocation Accuracy, Progressive Refinement & Verification (Tests A through J)', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    // Reset Zustand store to clean initial state
    useMapStore.setState({
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
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // -------------------------------------------------------------------------
  // Test A: Accurate Location Acquisition
  // -------------------------------------------------------------------------
  it('Test A: Fresh position acquisition with accuracy <= 15m classifies as HIGH, commits to store, and resolves cleanly', () => {
    const freshTimestamp = Date.now();
    const testCoords = { lat: 23.7508, lng: 90.3842 };
    const accuracyMeters = 12;

    assert.equal(classifyGeolocationAccuracy(accuracyMeters), 'HIGH');
    assert.equal(accuracyMeters <= GEOLOCATION_THRESHOLDS.HIGH_MAX, true);

    const store = useMapStore.getState();
    store.setIsLocating(true);
    store.setAcquisitionStage('acquiring');

    store.setUserLocation(testCoords, accuracyMeters, 'gps', undefined, freshTimestamp);
    store.setIsLocating(false);
    store.setAcquisitionStage('success');

    const updated = useMapStore.getState();
    assert.deepEqual(updated.userLocation, testCoords);
    assert.equal(updated.userAccuracy, 12);
    assert.equal(updated.userAccuracyTier, 'HIGH');
    assert.equal(updated.locationSource, 'gps');
    assert.equal(updated.locationTimestamp, freshTimestamp);
    assert.equal(updated.isLowAccuracy, false);
    assert.equal(updated.isLocating, false);
    assert.equal(updated.acquisitionStage, 'success');
  });

  // -------------------------------------------------------------------------
  // Test B: Progressive Refinement
  // -------------------------------------------------------------------------
  it('Test B: Progressive GPS refinement updates on improvement, rejects degraded fixes, prevents negative accuracy poisoning, and terminates watch at target <=15m', () => {
    let activeWatchId: number | null = 101;
    let watchCleared = false;
    let bestAccuracy = Infinity;

    const processPositionFix = (pos: {
      coords: { latitude: number; longitude: number; accuracy: number };
      timestamp?: number;
    }) => {
      // 1. Timestamp freshness check: reject stale (>30s) or non-positive timestamps
      const now = Date.now();
      if (!isFreshPosition(pos.timestamp, 30000, now)) {
        return false;
      }

      // 2. Non-negative accuracy sanitization matching shared helper
      const acc = sanitizeAccuracy(pos.coords.accuracy);

      // 3. Accuracy improvement check
      const candidateAcc = acc ?? 1000;
      if (candidateAcc > bestAccuracy) {
        // Degraded or unverified reading; preserve superior fix
        return false;
      }

      bestAccuracy = candidateAcc;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      useMapStore.getState().setUserLocation(coords, acc, 'gps', undefined, pos.timestamp || now);

      if (acc !== null && acc <= 15) {
        watchCleared = true;
        activeWatchId = null;
        useMapStore.getState().setIsLocating(false);
        useMapStore.getState().setAcquisitionStage('success');
      } else {
        useMapStore.getState().setAcquisitionStage('refining');
      }
      return true;
    };

    useMapStore.getState().setIsLocating(true);
    useMapStore.getState().setAcquisitionStage('acquiring');

    // Fix 1: Coarse initial fix (85m)
    const fix1Accepted = processPositionFix({
      coords: { latitude: 23.7500, longitude: 90.3800, accuracy: 85 },
      timestamp: Date.now(),
    });
    assert.equal(fix1Accepted, true);
    let state = useMapStore.getState();
    assert.equal(state.userAccuracy, 85);
    assert.equal(state.userAccuracyTier, 'MODERATE');
    assert.equal(state.acquisitionStage, 'refining');
    assert.equal(watchCleared, false);
    assert.equal(bestAccuracy, 85);

    // Fix 2: Intermediate refinement (40m)
    const fix2Accepted = processPositionFix({
      coords: { latitude: 23.7505, longitude: 90.3820, accuracy: 40 },
      timestamp: Date.now(),
    });
    assert.equal(fix2Accepted, true);
    state = useMapStore.getState();
    assert.equal(state.userAccuracy, 40);
    assert.equal(state.userAccuracyTier, 'MODERATE');
    assert.equal(state.userLocation?.lat, 23.7505);
    assert.equal(bestAccuracy, 40);

    // Fix 3: Corrupt/Adversarial negative accuracy (-10m)
    // Must NOT terminate acquisition as success and must NOT poison bestAccuracy
    const fix3Accepted = processPositionFix({
      coords: { latitude: 23.7510, longitude: 90.3830, accuracy: -10 },
      timestamp: Date.now(),
    });
    assert.equal(fix3Accepted, false, 'Negative accuracy fix must be discarded');
    assert.equal(bestAccuracy, 40, 'bestAccuracy must NOT be poisoned by negative accuracy (-10)');
    assert.equal(watchCleared, false, 'Watch must NOT terminate prematurely on negative accuracy');
    state = useMapStore.getState();
    assert.equal(state.userAccuracy, 40, 'Store accuracy must remain at best valid fix (40m)');
    assert.notEqual(state.acquisitionStage, 'success', 'Acquisition stage must NOT be success for negative accuracy');

    // Fix 4: Degraded reading (70m) - must be rejected
    const fix4Accepted = processPositionFix({
      coords: { latitude: 23.7520, longitude: 90.3860, accuracy: 70 },
      timestamp: Date.now(),
    });
    assert.equal(fix4Accepted, false, 'Degraded reading (70m > 40m) must be rejected');
    state = useMapStore.getState();
    assert.equal(state.userAccuracy, 40);
    assert.equal(state.userLocation?.lat, 23.7505);

    // Fix 5: High precision lock (12m) - target achieved
    const fix5Accepted = processPositionFix({
      coords: { latitude: 23.7508, longitude: 90.3842, accuracy: 12 },
      timestamp: Date.now(),
    });
    assert.equal(fix5Accepted, true);
    state = useMapStore.getState();
    assert.equal(state.userAccuracy, 12);
    assert.equal(state.userAccuracyTier, 'HIGH');
    assert.equal(state.acquisitionStage, 'success');
    assert.equal(state.isLocating, false);
    assert.equal(watchCleared, true, 'Watch must be cleared when target <= 15m is reached');
  });

  // -------------------------------------------------------------------------
  // Test C: Stale Location Rejection
  // -------------------------------------------------------------------------
  it('Test C: Position reading with stale timestamp (>30s old) or non-positive timestamp is rejected from updating active live coordinates', () => {
    const now = Date.now();
    const staleTimestamp = now - 65000; // 65 seconds in the past
    const zeroTimestamp = 0;
    const negativeTimestamp = -500;
    const freshTimestamp = now - 2000;  // 2 seconds ago

    const initialCoords = { lat: 23.75, lng: 90.38 };
    useMapStore.getState().setUserLocation(initialCoords, 25, 'gps', undefined, freshTimestamp);

    assert.equal(isFreshPosition(staleTimestamp, 30000, now), false, 'Timestamp > 30s old must be invalid');
    assert.equal(isFreshPosition(zeroTimestamp, 30000, now), false, 'Timestamp <= 0 must be invalid');
    assert.equal(isFreshPosition(negativeTimestamp, 30000, now), false, 'Negative timestamp must be invalid');
    assert.equal(isFreshPosition(freshTimestamp, 30000, now), true, 'Recent timestamp within 30s must be valid');

    const evaluateAndApplyFix = (
      coords: { lat: number; lng: number },
      acc: number,
      timestamp: number
    ): boolean => {
      if (!isFreshPosition(timestamp, 30000, Date.now())) {
        return false;
      }
      useMapStore.getState().setUserLocation(coords, acc, 'gps', undefined, timestamp);
      return true;
    };

    const staleAccepted = evaluateAndApplyFix({ lat: 23.99, lng: 90.99 }, 10, staleTimestamp);
    assert.equal(staleAccepted, false, 'Stale fix older than 30s must be rejected');

    const zeroAccepted = evaluateAndApplyFix({ lat: 23.99, lng: 90.99 }, 10, zeroTimestamp);
    assert.equal(zeroAccepted, false, 'Zero timestamp fix must be rejected');

    const negativeAccepted = evaluateAndApplyFix({ lat: 23.99, lng: 90.99 }, 10, negativeTimestamp);
    assert.equal(negativeAccepted, false, 'Negative timestamp fix must be rejected');

    const stateAfterStale = useMapStore.getState();
    assert.deepEqual(stateAfterStale.userLocation, initialCoords);
    assert.equal(stateAfterStale.locationTimestamp, freshTimestamp);

    const freshAccepted = evaluateAndApplyFix({ lat: 23.751, lng: 90.381 }, 14, now);
    assert.equal(freshAccepted, true, 'Fresh fix within 30s must be accepted');
    assert.equal(useMapStore.getState().userLocation?.lat, 23.751);
  });

  // -------------------------------------------------------------------------
  // Test D: Poor Accuracy Handling
  // -------------------------------------------------------------------------
  it('Test D: Classifies all 6 accuracy tiers, flags isLowAccuracy when accuracy > 100m, null, or negative, sanitizes negative values, and accurately reflects circle radius', () => {
    // 6-Tier Verification
    assert.equal(classifyGeolocationAccuracy(8), 'HIGH');
    assert.equal(classifyGeolocationAccuracy(15), 'HIGH');
    assert.equal(classifyGeolocationAccuracy(15.1), 'GOOD');
    assert.equal(classifyGeolocationAccuracy(30), 'GOOD');
    assert.equal(classifyGeolocationAccuracy(30.1), 'MODERATE');
    assert.equal(classifyGeolocationAccuracy(100), 'MODERATE');
    assert.equal(classifyGeolocationAccuracy(100.1), 'LOW');
    assert.equal(classifyGeolocationAccuracy(500), 'LOW');
    assert.equal(classifyGeolocationAccuracy(500.1), 'VERY_LOW');
    assert.equal(classifyGeolocationAccuracy(1000), 'VERY_LOW');
    assert.equal(classifyGeolocationAccuracy(1000.1), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(2500), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(null), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(undefined), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(-10), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(NaN), 'EXTREMELY_POOR');
    assert.equal(classifyGeolocationAccuracy(Infinity), 'EXTREMELY_POOR');

    // Test store isLowAccuracy flag for > 100m
    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, 45, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, false);
    assert.equal(useMapStore.getState().userAccuracyTier, 'MODERATE');

    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, 450, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'LOW');

    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, 850, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'VERY_LOW');

    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, 2400, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'EXTREMELY_POOR');

    // Explicitly assert that negative accuracy (e.g. -10) classifies as EXTREMELY_POOR, sets isLowAccuracy: true, and sanitizes userAccuracy to null
    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, -10, 'gps');
    assert.equal(useMapStore.getState().userAccuracyTier, 'EXTREMELY_POOR');
    assert.equal(useMapStore.getState().isLowAccuracy, true, 'Negative accuracy must set isLowAccuracy: true');
    assert.equal(useMapStore.getState().userAccuracy, null, 'Negative accuracy must be sanitized to null in store');

    // Explicitly assert that null accuracy classifies as EXTREMELY_POOR and sets isLowAccuracy: true
    useMapStore.getState().setUserLocation({ lat: 23.75, lng: 90.38 }, null, 'gps');
    assert.equal(useMapStore.getState().userAccuracyTier, 'EXTREMELY_POOR');
    assert.equal(useMapStore.getState().isLowAccuracy, true, 'Null accuracy must set isLowAccuracy: true');

    // Verify un-clamped circle radius rule using production computeAccuracyCircleRadius helper:
    // radius = locationSource === 'calibrated' ? 25 : (sanitizedAcc !== null ? sanitizedAcc : 50)

    assert.equal(computeAccuracyCircleRadius('gps', 8), 8, '8m accuracy must not be clamped up to 40m');
    assert.equal(computeAccuracyCircleRadius('gps', 1450), 1450, '1450m accuracy must not be clamped down to 500m');
    assert.equal(computeAccuracyCircleRadius('gps', -10), 50, 'Negative accuracy must fall back to default 50m radius');
    assert.equal(computeAccuracyCircleRadius('gps', null), 50, 'Null accuracy must fall back to default 50m radius');
    assert.equal(computeAccuracyCircleRadius('calibrated', 1450), 25, 'Calibrated accuracy is fixed at 25m');
  });

  // -------------------------------------------------------------------------
  // Test E: Permission Denial
  // -------------------------------------------------------------------------
  it('Test E: Handles PERMISSION_DENIED (code 1) gracefully without crashing, resets locating flag, and exposes guidance', () => {
    const store = useMapStore.getState();
    store.setIsLocating(true);
    store.setAcquisitionStage('acquiring');

    const errorEvent = { code: 1, message: 'User denied Geolocation' };

    // Handler simulating MapClient onPositionError
    if (errorEvent.code === 1) {
      store.setIsLocating(false);
      store.setAcquisitionStage('error');
    }

    const updated = useMapStore.getState();
    assert.equal(updated.isLocating, false);
    assert.equal(updated.acquisitionStage, 'error');

    // Assert bilingual denial translations exist and contain recovery instructions
    assert.ok(geoTranslations.en.status.denied.includes('denied'));
    assert.ok(geoTranslations.bn.status.denied.includes('পারমিশন'));
  });

  // -------------------------------------------------------------------------
  // Test F: Timeout Handling
  // -------------------------------------------------------------------------
  it('Test F: Handles TIMEOUT (code 3) or watchdog deadline cleanly, stopping spinner while preserving best acquired fix', () => {
    const store = useMapStore.getState();

    // User acquired a moderate fix initially
    store.setUserLocation({ lat: 23.75, lng: 90.38 }, 65, 'gps');
    store.setIsLocating(true);
    store.setAcquisitionStage('refining');

    // Watchdog or timeout fires at 11s deadline
    const handleTimeout = () => {
      useMapStore.getState().setIsLocating(false);
      useMapStore.getState().setAcquisitionStage('timeout');
    };

    handleTimeout();

    const updated = useMapStore.getState();
    assert.equal(updated.isLocating, false, 'isLocating must be false after timeout');
    assert.equal(updated.acquisitionStage, 'timeout');
    assert.deepEqual(updated.userLocation, { lat: 23.75, lng: 90.38 }, 'Best fix must be preserved');
    assert.equal(updated.userAccuracy, 65);

    // Verify bilingual timeout messages
    assert.ok(geoTranslations.en.status.timeout.includes('timed out'));
    assert.ok(geoTranslations.bn.status.timeout.includes('সময় শেষ'));
  });

  // -------------------------------------------------------------------------
  // Test G: Concurrent Requests & Race Conditions (Rapid Clicks)
  // -------------------------------------------------------------------------
  it('Test G: Monotonic request ID shields store from out-of-order asynchronous responses from rapid clicks', () => {
    const store = useMapStore.getState();

    // Simulate 3 rapid clicks on "My Location"
    const req1 = store.incrementRequestId();
    const req2 = store.incrementRequestId();
    const req3 = store.incrementRequestId();

    assert.equal(req1, 1);
    assert.equal(req2, 2);
    assert.equal(req3, 3);
    assert.equal(useMapStore.getState().activeRequestId, 3);

    // Helper that simulates a callback delivering coordinates tagged with its originating requestId
    const handleAsyncCallback = (
      requestId: number,
      coords: { lat: number; lng: number },
      acc: number
    ) => {
      if (requestId !== useMapStore.getState().activeRequestId) {
        // Discard obsolete response!
        return false;
      }
      useMapStore.getState().setUserLocation(coords, acc, 'gps');
      return true;
    };

    // Callback 1 resolves very late (obsolete)
    const applied1 = handleAsyncCallback(req1, { lat: 22.0, lng: 89.0 }, 10);
    assert.equal(applied1, false, 'Callback from Request 1 must be discarded');
    assert.equal(useMapStore.getState().userLocation, null);

    // Callback 2 resolves out of order (obsolete)
    const applied2 = handleAsyncCallback(req2, { lat: 22.5, lng: 89.5 }, 12);
    assert.equal(applied2, false, 'Callback from Request 2 must be discarded');
    assert.equal(useMapStore.getState().userLocation, null);

    // Callback 3 resolves (valid, active)
    const applied3 = handleAsyncCallback(req3, { lat: 23.75, lng: 90.38 }, 15);
    assert.equal(applied3, true, 'Callback from Request 3 must be applied');
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.75, lng: 90.38 });
  });

  // -------------------------------------------------------------------------
  // Test H: Manual Calibration State & Persistence
  // -------------------------------------------------------------------------
  it('Test H: Manual calibration persists to localStorage, blocks GPS overwrites, immediately clears active watch, and resets cleanly', () => {
    const store = useMapStore.getState();
    const calibratedCoords = { lat: 23.751234, lng: 90.385678 };

    // Register active watch before calibration
    const watchId = navigator.geolocation.watchPosition(() => {});
    useMapStore.getState().setActiveWatchId(watchId);
    useMapStore.getState().setIsLocating(true);
    useMapStore.getState().setAcquisitionStage('refining');
    assert.equal(sandbox.geolocation.activeWatchCount, 1);
    assert.equal(useMapStore.getState().activeWatchId, watchId);

    // 1. User calibrates landmark
    store.calibrateUserLocation(calibratedCoords, 'Dhanmondi Lake Bridge');

    // Assert that active watch was immediately cleared!
    assert.equal(sandbox.geolocation.activeWatchCount, 0, 'Active watch must be cleared immediately upon manual calibration');
    assert.ok(sandbox.geolocation.clearedWatchIds.includes(watchId), 'Watch ID must be recorded in clearedWatchIds');
    assert.equal(useMapStore.getState().activeWatchId, null, 'activeWatchId in store must be null');
    assert.equal(useMapStore.getState().isLocating, false, 'isLocating must be reset to false');
    assert.equal(useMapStore.getState().acquisitionStage, 'idle', 'acquisitionStage must be reset to idle');

    const stateAfterCalib = useMapStore.getState();
    assert.deepEqual(stateAfterCalib.userLocation, calibratedCoords);
    assert.equal(stateAfterCalib.locationSource, 'calibrated');
    assert.equal(stateAfterCalib.userAccuracy, 25);
    assert.equal(stateAfterCalib.userAccuracyTier, 'GOOD');
    assert.equal(stateAfterCalib.locationLabel, 'Dhanmondi Lake Bridge');
    assert.equal(stateAfterCalib.dismissedCalibrationBanner, false, 'dismissedCalibrationBanner must be reset on calibration');

    // Verify localStorage persistence
    const savedRaw = sandbox.localStorage.getItem(STORAGE_KEY_USER_LOCATION);
    assert.ok(savedRaw !== null);
    const parsed = JSON.parse(savedRaw!);
    assert.equal(parsed.lat, 23.751234);
    assert.equal(parsed.lng, 90.385678);
    assert.equal(parsed.source, 'calibrated');

    // 2. An in-flight GPS update attempts to overwrite the user location
    store.setUserLocation({ lat: 23.9999, lng: 90.9999 }, 10, 'gps');

    const stateAfterGpsAttempt = useMapStore.getState();
    assert.deepEqual(
      stateAfterGpsAttempt.userLocation,
      calibratedCoords,
      'In-flight GPS must NOT overwrite calibrated location'
    );
    assert.equal(stateAfterGpsAttempt.locationSource, 'calibrated');

    // 3. User explicitly resets to browser GPS
    store.setDismissedCalibrationBanner(true); // Simulate previous dismissal
    store.resetToBrowserGps();

    const stateAfterReset = useMapStore.getState();
    assert.equal(stateAfterReset.userLocation, null);
    assert.equal(stateAfterReset.locationSource, null);
    assert.equal(stateAfterReset.dismissedCalibrationBanner, false, 'dismissedCalibrationBanner must be reset to false on resetToBrowserGps');
    assert.equal(sandbox.localStorage.getItem(STORAGE_KEY_USER_LOCATION), null);

    // 4. Once reset, fresh GPS can now be applied
    store.setUserLocation({ lat: 23.8103, lng: 90.4125 }, 14, 'gps');
    assert.deepEqual(useMapStore.getState().userLocation, { lat: 23.8103, lng: 90.4125 });
    assert.equal(useMapStore.getState().locationSource, 'gps');
  });

  // -------------------------------------------------------------------------
  // Test I: Coordinate Precision Integrity
  // -------------------------------------------------------------------------
  it('Test I: Preserves 6 decimal places (~0.11m precision) across objects, JSON, and queries without truncation or lat/lng inversion', () => {
    const rawLat = 23.810332;
    const rawLng = 90.412518;

    const coords = { lat: rawLat, lng: rawLng };

    // Serialization integrity
    const serialized = JSON.stringify(coords);
    const deserialized = JSON.parse(serialized);

    assert.equal(deserialized.lat, 23.810332);
    assert.equal(deserialized.lng, 90.412518);

    // Check 6 decimal places precision
    assert.equal(deserialized.lat.toFixed(6), '23.810332');
    assert.equal(deserialized.lng.toFixed(6), '90.412518');
    assert.equal(formatCoordinate(deserialized.lat), 23.810332);
    assert.equal(formatCoordinate(deserialized.lng), 90.412518);

    // Verify lat/lng order integrity using Bangladesh bounding constants
    assert.ok(isWithinBangladesh(deserialized.lat, deserialized.lng), 'Coordinates inside Bangladesh bounding box');
    assert.ok(deserialized.lat >= BANGLADESH_BOUNDS.minLat && deserialized.lat <= BANGLADESH_BOUNDS.maxLat, 'Latitude within Bangladesh');
    assert.ok(deserialized.lng >= BANGLADESH_BOUNDS.minLng && deserialized.lng <= BANGLADESH_BOUNDS.maxLng, 'Longitude within Bangladesh');
    assert.ok(deserialized.lat < deserialized.lng, 'Latitude and Longitude not inverted');

    // PostGIS Point query formatting verification: X=longitude, Y=latitude
    const postGisPointSql = `ST_SetSRID(ST_MakePoint(${deserialized.lng}, ${deserialized.lat}), 4326)::geography`;
    assert.ok(postGisPointSql.includes('ST_MakePoint(90.412518, 23.810332)'));
  });

  // -------------------------------------------------------------------------
  // Test J: Mobile vs Desktop & Environment Behavior
  // -------------------------------------------------------------------------
  it('Test J: Enforces secure context requirements on non-localhost and manages desktop ISP coarse fallback', () => {
    // 1. Insecure context test
    const checkSecureContext = (origin: string, isSecure: boolean) => {
      const url = new URL(origin);
      if (
        !isSecure &&
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1'
      ) {
        return {
          allowed: false,
          warning: geoTranslations.en.status.insecureContext,
        };
      }
      return { allowed: true };
    };

    const insecureMobile = checkSecureContext('http://192.168.1.100:3000', false);
    assert.equal(insecureMobile.allowed, false);
    assert.ok(insecureMobile.warning?.includes('Secure Context'));

    const localhostDev = checkSecureContext('http://localhost:3000', false);
    assert.equal(localhostDev.allowed, true, 'Localhost is exempt from secure context restrictions');

    const httpsProd = checkSecureContext('https://dangerzonebd.app', true);
    assert.equal(httpsProd.allowed, true);

    // 2. Desktop ISP coarse location handling
    const desktopAccuracy = 1200; // Typical ISP / broadband cell tower fix
    const tier = classifyGeolocationAccuracy(desktopAccuracy);
    assert.equal(tier, 'EXTREMELY_POOR');

    useMapStore.getState().setUserLocation({ lat: 23.81, lng: 90.41 }, desktopAccuracy, 'gps');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'EXTREMELY_POOR');

    // 3. Android coarse permission fallback test
    const handleAndroidPermissionFallback = (
      errCode: number,
      coarsePos?: { lat: number; lng: number; accuracy: number },
      options?: PositionOptions
    ) => {
      if ((errCode === 2 || errCode === 3) && coarsePos) {
        // Must request with enableHighAccuracy: false, timeout: 8000, maximumAge: 60000
        assert.equal(options?.enableHighAccuracy, false);
        assert.equal(options?.timeout, 8000);
        assert.equal(options?.maximumAge, 60000);

        useMapStore.getState().setUserLocation(
          { lat: coarsePos.lat, lng: coarsePos.lng },
          coarsePos.accuracy,
          'gps'
        );
        return true;
      }
      return false;
    };

    const fallbackSuccess = handleAndroidPermissionFallback(
      2,
      { lat: 23.75, lng: 90.38, accuracy: 250 },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
    assert.equal(fallbackSuccess, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'LOW');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
  });
});
