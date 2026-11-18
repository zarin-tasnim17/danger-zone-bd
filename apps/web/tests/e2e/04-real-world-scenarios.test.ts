import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DangerIncident } from '@repo/shared';
import {
  installBrowserGlobals,
  type BrowserSandboxHandle,
} from '../framework/domEnv';
import { useMapStore } from '@/store/useMapStore';
import {
  FallbackAudioAlertEngine,
  FallbackVibrationAlertEngine,
  FallbackSystemNotificationEngine,
  ProximityAlertTracker,
  createBannerViewModel,
  calculateHazardDistance,
} from '../framework/contractHarness';

describe('[E2E][Scenarios] 04: Real-World Application Scenarios (Tier 4)', () => {
  let sandbox: BrowserSandboxHandle;
  let audio: FallbackAudioAlertEngine;
  let vibration: FallbackVibrationAlertEngine;
  let notification: FallbackSystemNotificationEngine;
  let tracker: ProximityAlertTracker;

  beforeEach(() => {
    sandbox = installBrowserGlobals({
      notificationPermission: 'granted',
      supportsVibration: true,
      supportsServiceWorker: true,
    });
    audio = new FallbackAudioAlertEngine();
    vibration = new FallbackVibrationAlertEngine();
    notification = new FallbackSystemNotificationEngine();
    tracker = new ProximityAlertTracker({
      thresholdMeters: 200,
      cooldownMs: 600_000, // 10 minutes
      hysteresisMeters: 20, // 220m exit
    });

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
    audio.reset();
    vibration.reset();
    notification.reset();
    tracker.resetAllAlerts();
    sandbox.restore();
  });

  // ==========================================================================
  // SCENARIO 1: Urban Walk through Active Clash Zone
  // ==========================================================================

  it('Scenario 1: Urban Walk through Active Clash Zone (7 Stages)', async () => {
    const clashHazard: DangerIncident = {
      id: 'clash-science-lab-01',
      title: 'Clash / Roadblock Hazard',
      description: 'Heavy tear gas and road barricade near Science Lab',
      category: 'Clash',
      severity: 'high',
      coordinates: { lat: 23.738, lng: 90.385 },
      locationName: 'Science Lab, Dhaka',
      timestamp: new Date().toISOString(),
      upvotes: 18,
      downvotes: 1,
      status: 'community_confirmed',
      reportedBy: 'Citizen Report',
      verifiedCount: 18,
      fuzzedRadiusMeters: 150,
    };

    // Stage 1: Initialization
    const started = await useMapStore.getState().startLiveTracking();
    assert.equal(started, true);
    assert.equal(useMapStore.getState().isLiveTracking, true);
    assert.equal(useMapStore.getState().trackingStatus, 'active');
    assert.equal(useMapStore.getState().isFollowingUser, true);

    // Stage 2: Approach (350m away)
    // Coordinates at 23.7410, 90.3850 (~333m north)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.741, longitude: 90.385, accuracy: 12 },
      timestamp: Date.now(),
    });
    const distStage2 = calculateHazardDistance(23.741, 90.385, clashHazard);
    assert.ok(distStage2 > 300);

    const resStage2 = tracker.evaluate({ latitude: 23.741, longitude: 90.385 }, [clashHazard]);
    assert.equal(resStage2.isInsideDangerZone, false);
    assert.equal(resStage2.activeAlerts.length, 0);
    assert.equal(createBannerViewModel(resStage2.closestAlert, resStage2.activeAlerts.length), null);
    assert.equal(audio.chimeCount, 0);
    assert.equal(vibration.vibrateCallCount, 0);

    // Stage 3: Entry (180m away)
    // Coordinates at 23.7395, 90.3850 (~166m north)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7395, longitude: 90.385, accuracy: 14 },
      timestamp: Date.now() + 10_000,
    });
    const distStage3 = calculateHazardDistance(23.7395, 90.385, clashHazard);
    assert.ok(distStage3 < 200);

    const resStage3 = tracker.evaluate({ latitude: 23.7395, longitude: 90.385 }, [clashHazard]);
    assert.equal(resStage3.isInsideDangerZone, true);
    assert.equal(resStage3.activeAlerts.length, 1);

    const bannerStage3 = createBannerViewModel(resStage3.closestAlert, resStage3.activeAlerts.length);
    assert.ok(bannerStage3 !== null);
    assert.equal(bannerStage3?.category, 'Clash');
    assert.ok(bannerStage3?.title.includes('Clash / Roadblock'));

    // Multi-channel dispatch on entry
    await audio.playDangerAlertSound();
    vibration.triggerDangerVibration();
    assert.equal(audio.chimeCount, 1);
    assert.equal(vibration.vibrateCallCount, 1);

    // Stage 4: Manual Map Inspection
    // User pans map to inspect side streets
    useMapStore.getState().setIsFollowingUser(false);
    useMapStore.setState({
      targetCommand: { lat: 23.735, lng: 90.38, zoom: 16, id: 888 },
    });
    assert.equal(useMapStore.getState().isFollowingUser, false);
    assert.equal(useMapStore.getState().isLiveTracking, true);

    // Stage 5: Deep Penetration with Tall Building GPS Jitter
    // Walks to 23.7382, 90.3850 (~22m away) with 65m accuracy (MODERATE)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7382, longitude: 90.385, accuracy: 65 },
      timestamp: Date.now() + 30_000,
    });
    assert.equal(useMapStore.getState().userAccuracyTier, 'MODERATE');
    assert.equal(useMapStore.getState().isLowAccuracy, false);
    // Camera target command remained at manual pan view
    assert.equal(useMapStore.getState().targetCommand?.id, 888);

    const resStage5 = tracker.evaluate({ latitude: 23.7382, longitude: 90.385 }, [clashHazard]);
    assert.equal(resStage5.isInsideDangerZone, true);
    assert.ok(resStage5.closestAlert!.distanceMeters < 30);
    // Anti-spam: no duplicate alert chime or vibration while inside
    assert.equal(tracker.getAlertCount(clashHazard.id), 1);

    // Stage 6: Recenter
    useMapStore.getState().recenterOnUser();
    assert.equal(useMapStore.getState().isFollowingUser, true);
    assert.equal(useMapStore.getState().targetCommand?.lat, 23.7382);
    assert.equal(useMapStore.getState().targetCommand?.lng, 90.385);

    // Stage 7: Safe Egress (past 220m hysteresis)
    // Moves to 23.7355, 90.3850 (~278m south)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7355, longitude: 90.385, accuracy: 15 },
      timestamp: Date.now() + 60_000,
    });
    const distStage7 = calculateHazardDistance(23.7355, 90.385, clashHazard);
    assert.ok(distStage7 > 220);

    const resStage7 = tracker.evaluate({ latitude: 23.7355, longitude: 90.385 }, [clashHazard]);
    assert.equal(resStage7.isInsideDangerZone, false);
    assert.equal(resStage7.activeAlerts.length, 0);
    assert.equal(createBannerViewModel(resStage7.closestAlert, resStage7.activeAlerts.length), null);
  });

  // ==========================================================================
  // SCENARIO 2: High-Speed Rickshaw Commute across Multiple Danger Zones
  // ==========================================================================

  it('Scenario 2: High-Speed Rickshaw Commute across Multiple Danger Zones (5 Stages)', async () => {
    const zoneA: DangerIncident = {
      id: 'zone-farmgate-unlit',
      title: 'Unlit Road & Potholes Hazard',
      description: 'Dangerous open manhole and pitch dark street',
      category: 'Infrastructure',
      severity: 'medium',
      coordinates: { lat: 23.757, lng: 90.39 },
      locationName: 'Farmgate, Dhaka',
      timestamp: new Date().toISOString(),
      upvotes: 8,
      downvotes: 0,
      status: 'authority_verified',
      reportedBy: 'City Patrol',
      verifiedCount: 8,
      fuzzedRadiusMeters: 150,
    };

    const zoneB: DangerIncident = {
      id: 'zone-karwanbazar-gang',
      title: 'Youth Gang & Extortion Activity',
      description: 'Hostile youth gathering reported near fish market',
      category: 'Crime',
      severity: 'high',
      coordinates: { lat: 23.751, lng: 90.393 },
      locationName: 'Karwan Bazar, Dhaka',
      timestamp: new Date().toISOString(),
      upvotes: 21,
      downvotes: 0,
      status: 'authority_verified',
      reportedBy: 'Police Bulletin',
      verifiedCount: 21,
      fuzzedRadiusMeters: 150,
    };

    let simTime = 1_000_000;

    // Stage 1: Tracking at Speed
    await useMapStore.getState().startLiveTracking();
    assert.equal(useMapStore.getState().isLiveTracking, true);

    // Stage 2: Zone A Entry at ~170m
    // Coordinates at 23.7585, 90.3900 (~167m north of Zone A)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7585, longitude: 90.39, accuracy: 18 },
      timestamp: simTime,
    });
    const resStage2 = tracker.evaluate({ latitude: 23.7585, longitude: 90.39 }, [zoneA, zoneB], {
      currentTime: simTime,
    });
    assert.equal(resStage2.activeAlerts.length, 1);
    assert.equal(resStage2.closestAlert?.hazard.id, 'zone-farmgate-unlit');

    await notification.showDangerSystemNotification(zoneA, resStage2.closestAlert!.distanceMeters);
    vibration.triggerDangerVibration();
    assert.equal(notification.notificationCount, 1);
    assert.equal(vibration.vibrateCallCount, 1);

    // Stage 3: Rapid Transit through Zone A to Exit (235m south of Zone A)
    simTime += 20_000;
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7548, longitude: 90.39, accuracy: 20 },
      timestamp: simTime,
    });
    const resStage3 = tracker.evaluate({ latitude: 23.7548, longitude: 90.39 }, [zoneA, zoneB], {
      currentTime: simTime,
    });
    // Exited Zone A (> 220m), not yet in Zone B (~500m)
    assert.equal(resStage3.activeAlerts.length, 0);
    assert.equal(resStage3.isInsideDangerZone, false);

    // Stage 4: Zone B Entry (45s later, at ~185m from Zone B)
    simTime += 45_000;
    // Zone B is at 23.7510, 90.3930. Rickshaw at 23.7525, 90.3930 (~167m north)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7525, longitude: 90.393, accuracy: 15 },
      timestamp: simTime,
    });
    const resStage4 = tracker.evaluate({ latitude: 23.7525, longitude: 90.393 }, [zoneA, zoneB], {
      currentTime: simTime,
    });
    assert.equal(resStage4.activeAlerts.length, 1);
    assert.equal(resStage4.closestAlert?.hazard.id, 'zone-karwanbazar-gang');
    // Alert B triggered independently
    assert.equal(tracker.getAlertCount('zone-karwanbazar-gang'), 1);

    // Stage 5: U-Turn & Re-Entry into Zone A within 3 minutes (t = 180s < 600s)
    simTime += 180_000;
    // Back into Zone A at 23.7575, 90.3900 (~55m)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7575, longitude: 90.39, accuracy: 12 },
      timestamp: simTime,
    });
    const resStage5 = tracker.evaluate({ latitude: 23.7575, longitude: 90.39 }, [zoneA, zoneB], {
      currentTime: simTime,
    });
    // Suppressed by active 10-minute cooldown on Zone A! Alert count remains 1
    assert.equal(tracker.getAlertCount('zone-farmgate-unlit'), 1);
  });

  // ==========================================================================
  // SCENARIO 3: Perimeter Boundary Hovering (Hysteresis Check)
  // ==========================================================================

  it('Scenario 3: Perimeter Boundary Hovering & Hysteresis (7 Stages)', () => {
    const manholeHazard: DangerIncident = {
      id: 'hazard-manhole-boundary',
      title: 'Open Manhole Pit',
      description: 'Deep unshielded sewer excavation',
      category: 'Hazard',
      severity: 'high',
      coordinates: { lat: 23.77, lng: 90.4 },
      locationName: 'Gulshan Link Road',
      timestamp: new Date().toISOString(),
      upvotes: 10,
      downvotes: 0,
      status: 'community_confirmed',
      reportedBy: 'Citizen Report',
      verifiedCount: 10,
      fuzzedRadiusMeters: 150,
    };

    // Stage 1: Approach at 205m distance
    // 23.77185 is ~205m north of 23.7700
    const d1 = calculateHazardDistance(23.77185, 90.4, manholeHazard);
    assert.ok(d1 > 200);
    const res1 = tracker.evaluate({ latitude: 23.77185, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res1.isInsideDangerZone, false);

    // Stage 2: Threshold Crossing to 198m
    // 23.77178 is ~198m north
    const d2 = calculateHazardDistance(23.77178, 90.4, manholeHazard);
    assert.ok(d2 <= 200);
    const res2 = tracker.evaluate({ latitude: 23.77178, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res2.isInsideDangerZone, true);
    assert.equal(tracker.getAlertCount(manholeHazard.id), 1);

    // Stage 3: Minor Step Back to 205m (Inside 220m Hysteresis Zone)
    // User steps back to 205m. Because 205m <= 220m, user is still inside!
    const res3 = tracker.evaluate({ latitude: 23.77185, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res3.isInsideDangerZone, true);
    assert.equal(tracker.getAlertCount(manholeHazard.id), 1);

    // Stage 4: Further Step to 218m (Still Inside Hysteresis)
    // 23.77196 is ~218m north
    const d4 = calculateHazardDistance(23.77196, 90.4, manholeHazard);
    assert.ok(d4 > 200 && d4 < 220);
    const res4 = tracker.evaluate({ latitude: 23.77196, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res4.isInsideDangerZone, true);

    // Stage 5: Definitive Exit (225m > 220m Exit Threshold)
    // 23.77203 is ~225m north
    const d5 = calculateHazardDistance(23.77203, 90.4, manholeHazard);
    assert.ok(d5 > 220);
    const res5 = tracker.evaluate({ latitude: 23.77203, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res5.isInsideDangerZone, false);
    assert.equal(res5.activeAlerts.length, 0);

    // Stage 6: Hovering Back to 205m
    // Because user already exited, 205m is outside the 200m entry threshold
    const res6 = tracker.evaluate({ latitude: 23.77185, longitude: 90.4 }, [manholeHazard]);
    assert.equal(res6.isInsideDangerZone, false);

    // Stage 7: Verification: Zero fluttering across 15 boundary transitions
    for (let i = 0; i < 15; i++) {
      const lat = 23.77185 + (i % 2 === 0 ? 0.0001 : -0.00005);
      tracker.evaluate({ latitude: lat, longitude: 90.4 }, [manholeHazard]);
    }
    // Still exactly 1 alert event fired throughout the entire run
    assert.equal(tracker.getAlertCount(manholeHazard.id), 1);
  });

  // ==========================================================================
  // SCENARIO 4: Offline / Low Accuracy GPS Degradation & Recovery
  // ==========================================================================

  it('Scenario 4: Offline / Low Accuracy GPS Degradation & Recovery (6 Stages)', async () => {
    // Stage 1: Open Sky Baseline (10m accuracy)
    await useMapStore.getState().startLiveTracking();
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.725, longitude: 90.415, accuracy: 10 },
      timestamp: Date.now(),
    });
    assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
    assert.equal(useMapStore.getState().isLowAccuracy, false);
    assert.equal(useMapStore.getState().userLocation?.lat, 23.725);

    // Stage 2: Signal Degradation (120m accuracy)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7255, longitude: 90.4155, accuracy: 120 },
      timestamp: Date.now() + 5000,
    });
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().userAccuracyTier, 'LOW');
    assert.equal(useMapStore.getState().userLocation?.lat, 23.7255);

    // Stage 3: Severe Degradation (450m accuracy)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.726, longitude: 90.416, accuracy: 450 },
      timestamp: Date.now() + 10_000,
    });
    assert.equal(useMapStore.getState().userAccuracyTier, 'LOW');
    assert.equal(useMapStore.getState().isLiveTracking, true);

    // Stage 4: Hardware Cutoff Level (800m accuracy)
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7265, longitude: 90.4165, accuracy: 800 },
      timestamp: Date.now() + 15_000,
    });
    assert.equal(useMapStore.getState().userAccuracyTier, 'VERY_LOW');
    assert.equal(useMapStore.getState().isLowAccuracy, true);
    assert.equal(useMapStore.getState().isLiveTracking, true);

    // Stage 5: Temporary Outage (TIMEOUT error)
    sandbox.geolocation.mockEmitError({ code: 3, message: 'Geolocation timeout' });
    assert.equal(useMapStore.getState().trackingStatus, 'unavailable');

    // Stage 6: Recovery in Open Plaza
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.727, longitude: 90.417, accuracy: 12 },
      timestamp: Date.now() + 30_000,
    });
    assert.equal(useMapStore.getState().userLocation?.lat, 23.727);
    assert.equal(useMapStore.getState().userAccuracyTier, 'HIGH');
    assert.equal(useMapStore.getState().isLowAccuracy, false);
  });

  // ==========================================================================
  // SCENARIO 5: Background Tab & Browser Notification Fallback
  // ==========================================================================

  it('Scenario 5: Background Tab & Browser Notification Fallback (7 Stages)', async () => {
    const backgroundHazard: DangerIncident = {
      id: 'hazard-bg-clash',
      title: 'Armed Robbery / Looting Alert',
      description: 'Active looting reported on warehouse strip',
      category: 'Armed Clash',
      severity: 'critical',
      coordinates: { lat: 23.76, lng: 90.39 },
      locationName: 'Tejgaon Industrial Area',
      timestamp: new Date().toISOString(),
      upvotes: 35,
      downvotes: 0,
      status: 'authority_verified',
      reportedBy: 'Emergency Command',
      verifiedCount: 35,
      fuzzedRadiusMeters: 150,
    };

    // Stage 1: Foreground Setup
    await useMapStore.getState().startLiveTracking();
    assert.equal(useMapStore.getState().isLiveTracking, true);
    assert.equal(document.visibilityState, 'visible');

    // Stage 2: Tab Backgrounding
    sandbox.setVisibilityState('hidden');
    assert.equal(document.visibilityState, 'hidden');

    // Stage 3: Zone Entry in Background (User enters 180m zone)
    // 23.7615, 90.3900 is ~167m north of hazard
    sandbox.geolocation.mockEmitPosition({
      coords: { latitude: 23.7615, longitude: 90.39, accuracy: 15 },
      timestamp: Date.now(),
    });
    const resStage3 = tracker.evaluate({ latitude: 23.7615, longitude: 90.39 }, [backgroundHazard]);
    assert.equal(resStage3.isInsideDangerZone, true);

    // Stage 4: Notification Dispatch while tab is hidden
    if (document.visibilityState === 'hidden' && resStage3.isInsideDangerZone) {
      await notification.showDangerSystemNotification(backgroundHazard, resStage3.closestAlert!.distanceMeters);
      vibration.triggerDangerVibration();
    }
    assert.equal(notification.notificationCount, 1);
    assert.equal(vibration.vibrateCallCount, 1);
    assert.ok(notification.lastNotification?.title.includes('Danger Alert'));
    assert.ok(notification.lastNotification?.options?.body.includes('Armed Robbery'));

    // Stage 5: Notification Click & Tab Restore
    sandbox.setVisibilityState('visible');
    assert.equal(document.visibilityState, 'visible');

    // Stage 6: HUD Synchronization
    const resStage6 = tracker.getState();
    const banner = createBannerViewModel(resStage6.closestAlert, resStage6.activeAlerts.length);
    assert.ok(banner !== null);
    assert.equal(banner?.title, 'Armed Robbery / Looting Alert');
    assert.match(banner?.formattedDistance || '', /^\d+m away$/);

    // Map camera follow centers map on user
    useMapStore.getState().recenterOnUser();
    assert.equal(useMapStore.getState().isFollowingUser, true);
    assert.equal(useMapStore.getState().targetCommand?.lat, 23.7615);

    // Stage 7: Truthful Limitations Guard: Service worker registration captured notification safely
    assert.equal(sandbox.serviceWorkerRegistration?.notifications.length, 1);
  });
});
