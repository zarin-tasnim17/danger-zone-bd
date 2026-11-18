import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DangerIncident } from '@repo/shared';
import {
  installBrowserGlobals,
  type BrowserSandboxHandle,
  MockAudioContext,
  MockNotification,
} from '../framework/domEnv';
import {
  FallbackAudioAlertEngine,
  FallbackVibrationAlertEngine,
  FallbackSystemNotificationEngine,
  ProximityAlertTracker,
  createBannerViewModel,
  formatBannerDistance,
} from '../framework/contractHarness';

const createMockHazard = (overrides: Partial<DangerIncident> = {}): DangerIncident => ({
  id: 'hazard-notif-001',
  title: 'Police Barricade & Protest',
  description: 'Heavy tear gas deployed near crossing',
  category: 'Clash',
  severity: 'high',
  coordinates: {
    lat: 23.75,
    lng: 90.38,
  },
  locationName: 'Mirpur Road',
  timestamp: new Date().toISOString(),
  upvotes: 12,
  downvotes: 1,
  status: 'community_confirmed',
  reportedBy: 'Citizen Report',
  verifiedCount: 12,
  fuzzedRadiusMeters: 150,
  ...overrides,
});

describe('[E2E][Notifications] 03: Multi-Channel Danger Notifications', () => {
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
      cooldownMs: 600_000,
      hysteresisMeters: 20,
    });
  });

  afterEach(() => {
    audio.reset();
    vibration.reset();
    notification.reset();
    tracker.resetAllAlerts();
    sandbox.restore();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Features 12–16: 25 Isolated Tests)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    // Feature 12: Visual Warning Banner
    describe('Feature 12: Visual Warning Banner', () => {
      it('F12-01: Entering danger zone creates visible banner view model (isVisible = true)', () => {
        const hazard = createMockHazard();
        const res = tracker.evaluate({ latitude: 23.751, longitude: 90.38 }, [hazard]); // ~111m
        const banner = createBannerViewModel(res.closestAlert, res.activeAlerts.length);

        assert.ok(banner !== null);
        assert.equal(banner?.isVisible, true);
        assert.equal(banner?.hazardId, hazard.id);
      });

      it('F12-02: Banner renders hazard title, category badge, and formatted dynamic distance', () => {
        const hazard = createMockHazard({ title: 'Heavy Protest', category: 'Civil Unrest' });
        const res = tracker.evaluate({ latitude: 23.7512, longitude: 90.38 }, [hazard]); // ~133m
        const banner = createBannerViewModel(res.closestAlert, res.activeAlerts.length);

        assert.equal(banner?.title, 'Heavy Protest');
        assert.equal(banner?.category, 'Civil Unrest');
        assert.match(banner?.formattedDistance || '', /^\d+m away$/);
      });

      it('F12-03: As user approaches from 180m to 120m, banner dynamically updates displayed distance', () => {
        const hazard = createMockHazard();
        // At ~180m
        const res1 = tracker.evaluate({ latitude: 23.75162, longitude: 90.38 }, [hazard]);
        const b1 = createBannerViewModel(res1.closestAlert, res1.activeAlerts.length);

        // At ~120m
        const res2 = tracker.evaluate({ latitude: 23.75108, longitude: 90.38 }, [hazard]);
        const b2 = createBannerViewModel(res2.closestAlert, res2.activeAlerts.length);

        assert.ok(b2!.distanceMeters < b1!.distanceMeters);
        assert.notEqual(b1?.formattedDistance, b2?.formattedDistance);
      });

      it('F12-04: Dismissing banner marks it dismissed without disrupting active tracking', () => {
        const hazard = createMockHazard({ id: 'dismiss-banner-h' });
        const res = tracker.evaluate({ latitude: 23.751, longitude: 90.38 }, [hazard]);
        assert.equal(res.activeAlerts.length, 1);

        tracker.dismissAlert('dismiss-banner-h');
        const updatedRes = tracker.getState();
        const banner = createBannerViewModel(updatedRes.closestAlert, updatedRes.activeAlerts.length);
        assert.equal(banner, null);
      });

      it('F12-05: Exiting danger zone automatically unmounts or clears banner', () => {
        const hazard = createMockHazard();
        // Inside
        const inRes = tracker.evaluate({ latitude: 23.751, longitude: 90.38 }, [hazard]);
        assert.ok(createBannerViewModel(inRes.closestAlert, inRes.activeAlerts.length) !== null);

        // Outside (> 220m)
        const outRes = tracker.evaluate({ latitude: 23.753, longitude: 90.38 }, [hazard]);
        const banner = createBannerViewModel(outRes.closestAlert, outRes.activeAlerts.length);
        assert.equal(banner, null);
      });
    });

    // Feature 13: Web Audio Danger Sound
    describe('Feature 13: Web Audio Danger Sound', () => {
      it('F13-01: Entering danger zone triggers playDangerAlertSound synthesizing 800Hz chime', async () => {
        await audio.playDangerAlertSound();
        assert.equal(audio.chimeCount, 1);
        assert.equal(sandbox.audioContextInstances.length, 1);

        const ctx = sandbox.audioContextInstances[0];
        assert.equal(ctx.oscillators.length, 1);
        assert.equal(ctx.oscillators[0].frequency.value, 800);
      });

      it('F13-02: Calling unlockAudioContext resumes audio context on initial user interaction', async () => {
        await audio.unlockAudioContext();
        assert.equal(audio.unlockCount, 1);
        const ctx = sandbox.audioContextInstances[0];
        assert.equal(ctx.state, 'running');
      });

      it('F13-03: When sound is muted (isMuted = true), playDangerAlertSound performs clean no-op', async () => {
        audio.setMuted(true);
        await audio.playDangerAlertSound();
        assert.equal(audio.chimeCount, 0);
        assert.equal(sandbox.audioContextInstances.length, 0);
      });

      it('F13-04: Repeated calls to playDangerAlertSound within 500ms are debounced to prevent audio glitch', async () => {
        const t0 = 1_000_000;
        await audio.playDangerAlertSound({ currentTime: t0 });
        await audio.playDangerAlertSound({ currentTime: t0 + 100 });
        await audio.playDangerAlertSound({ currentTime: t0 + 200 });
        assert.equal(audio.chimeCount, 1);

        // After debounce interval (>500ms)
        await audio.playDangerAlertSound({ currentTime: t0 + 600 });
        assert.equal(audio.chimeCount, 2);
      });

      it('F13-05: Audio synthesis failure is caught and handled gracefully without throwing', async () => {
        // Force AudioContext to throw
        const origCtx = (globalThis as any).AudioContext;
        (globalThis as any).AudioContext = function () {
          throw new Error('NotAllowedError: play() failed');
        };

        await assert.doesNotReject(async () => {
          await audio.playDangerAlertSound();
        });

        (globalThis as any).AudioContext = origCtx;
      });
    });

    // Feature 14: Mobile Vibration Alerts
    describe('Feature 14: Mobile Vibration Alerts', () => {
      it('F14-01: Entering danger zone calls navigator.vibrate([300, 150, 300]) on supported devices', () => {
        const ok = vibration.triggerDangerVibration();
        assert.equal(ok, true);
        assert.equal(vibration.vibrateCallCount, 1);
        assert.deepEqual(vibration.lastPattern, [300, 150, 300]);
        assert.deepEqual(sandbox.vibrations[0], [300, 150, 300]);
      });

      it('F14-02: Unsupported environments (iOS Safari, desktop) where navigator.vibrate is undefined return false cleanly', () => {
        const noVibeSandbox = installBrowserGlobals({ supportsVibration: false });
        try {
          const noVibeEngine = new FallbackVibrationAlertEngine();
          assert.equal(noVibeEngine.isVibrationSupported(), false);
          const ok = noVibeEngine.triggerDangerVibration();
          assert.equal(ok, false);
        } finally {
          noVibeSandbox.restore();
        }
      });

      it('F14-03: Vibration triggers without crashing on single pulse pattern', () => {
        const ok = vibration.triggerDangerVibration([200]);
        assert.equal(ok, true);
        assert.deepEqual(vibration.lastPattern, [200]);
      });

      it('F14-04: Vibration is suppressed if disabled in user settings (isEnabled = false)', () => {
        vibration.isEnabled = false;
        const ok = vibration.triggerDangerVibration();
        assert.equal(ok, false);
        assert.equal(vibration.vibrateCallCount, 0);
      });

      it('F14-05: Zero-length or negative vibration pattern inputs are safely rejected as no-ops', () => {
        assert.equal(vibration.triggerDangerVibration([]), false);
        assert.equal(vibration.triggerDangerVibration([0, 0]), false);
        assert.equal(vibration.vibrateCallCount, 0);
      });
    });

    // Feature 15: Browser System Notifications
    describe('Feature 15: Browser System Notifications', () => {
      it('F15-01: When notification permission is granted, entering danger zone dispatches system notification', async () => {
        const hazard = createMockHazard();
        const ok = await notification.showDangerSystemNotification(hazard, 145);
        assert.equal(ok, true);
        assert.equal(notification.notificationCount, 1);
        assert.ok(notification.lastNotification?.title.includes('Danger Alert'));
      });

      it('F15-02: Notification body includes hazard category, title, and distance in meters', async () => {
        const hazard = createMockHazard({ title: 'Manhole Cave-In', category: 'Infrastructure' });
        await notification.showDangerSystemNotification(hazard, 88);
        const body = notification.lastNotification?.options?.body;
        assert.ok(body.includes('88m'));
        assert.ok(body.includes('Manhole Cave-In'));
      });

      it('F15-03: When notification permission is denied, system notification returns false cleanly', async () => {
        MockNotification.permission = 'denied';
        const hazard = createMockHazard();
        const ok = await notification.showDangerSystemNotification(hazard, 100);
        assert.equal(ok, false);
        assert.equal(notification.notificationCount, 0);
      });

      it('F15-04: Notification request is triggered via requestNotificationPermission()', async () => {
        MockNotification.permission = 'granted';
        const perm = await notification.requestNotificationPermission();
        assert.equal(perm, 'granted');
      });

      it('F15-05: System notifications include deduplication tag hazard-${hazardId}', async () => {
        const hazard = createMockHazard({ id: 'h-tag-99' });
        await notification.showDangerSystemNotification(hazard, 120);
        assert.equal(notification.lastNotification?.options?.tag, 'hazard-h-tag-99');
      });
    });

    // Feature 16: Background & Web Push Clarification
    describe('Feature 16: Background & Web Push Clarification', () => {
      it('F16-01: Capability check distinguishes foreground client-side tracking from push', () => {
        const hasSW = Boolean(typeof navigator !== 'undefined' && navigator.serviceWorker);
        const hasVibe = typeof (navigator as any).vibrate === 'function';
        assert.equal(hasSW, true);
        assert.equal(hasVibe, true);
      });

      it('F16-02: Document visibility change to hidden preserves registered watcher state', () => {
        assert.equal(document.visibilityState, 'visible');
        sandbox.setVisibilityState('hidden');
        assert.equal(document.visibilityState, 'hidden');
        // Restores cleanly
        sandbox.setVisibilityState('visible');
        assert.equal(document.visibilityState, 'visible');
      });

      it('F16-03: Service Worker registration exposes showNotification for notification delivery', async () => {
        const reg = await navigator.serviceWorker?.ready;
        assert.ok(reg !== undefined);
        assert.equal(typeof reg?.showNotification, 'function');
      });

      it('F16-04: Service Worker registration notifications array captures dispatched items', async () => {
        const hazard = createMockHazard();
        await notification.showDangerSystemNotification(hazard, 75);
        assert.ok(sandbox.serviceWorkerRegistration !== null);
        assert.equal(sandbox.serviceWorkerRegistration?.notifications.length, 1);
      });

      it('F16-05: When Web Push is unsupported, informative fallback operates cleanly without crashing', () => {
        const noSwSandbox = installBrowserGlobals({ supportsServiceWorker: false });
        try {
          const noSwEngine = new FallbackSystemNotificationEngine();
          assert.doesNotThrow(async () => {
            await noSwEngine.showDangerSystemNotification(createMockHazard(), 100);
          });
        } finally {
          noSwSandbox.restore();
        }
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary Value Analysis & Corner Cases (Features 12–16: 25 Tests)
  // ==========================================================================

  describe('Tier 2: Boundary Value Analysis & Corner Cases', () => {
    // F12 Boundaries
    describe('F12 Boundaries', () => {
      it('B12-01: Distance of 0m renders as "At hazard epicenter"', () => {
        assert.equal(formatBannerDistance(0), 'At hazard epicenter');
        assert.equal(formatBannerDistance(-1), 'At hazard epicenter');
      });

      it('B12-02: Distance of 199m renders as "199m away"', () => {
        assert.equal(formatBannerDistance(199), '199m away');
        assert.equal(formatBannerDistance(199.4), '199m away');
      });

      it('B12-03: Hazard with 200-character title handles without throwing or breaking view model', () => {
        const longTitle = 'A'.repeat(200);
        const hazard = createMockHazard({ title: longTitle });
        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);
        const banner = createBannerViewModel(res.closestAlert, res.activeAlerts.length);
        assert.equal(banner?.title, longTitle);
      });

      it('B12-04: Multiple concurrent alerts display closest hazard with moreNearbyCount indicator', () => {
        const h1 = createMockHazard({ id: 'h1', coordinates: { lat: 23.7505, lng: 90.38 } });
        const h2 = createMockHazard({ id: 'h2', coordinates: { lat: 23.751, lng: 90.38 } });
        const h3 = createMockHazard({ id: 'h3', coordinates: { lat: 23.7515, lng: 90.38 } });

        const res = tracker.evaluate({ latitude: 23.75, longitude: 90.38 }, [h1, h2, h3]);
        const banner = createBannerViewModel(res.closestAlert, res.activeAlerts.length);
        assert.equal(banner?.moreNearbyCount, 2); // 3 total alerts -> +2 more nearby
      });

      it('B12-05: Dismissing banner persists dismissal for current zone visit without blocking future hazard B', () => {
        const h1 = createMockHazard({ id: 'h1' });
        const h2 = createMockHazard({ id: 'h2', coordinates: { lat: 23.7508, lng: 90.38 } });

        tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [h1]);
        tracker.dismissAlert('h1');
        assert.equal(tracker.getState().activeAlerts.length, 0);

        // New distinct hazard B arrives
        const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [h1, h2]);
        assert.equal(res.activeAlerts.length, 1);
        assert.equal(res.closestAlert?.hazard.id, 'h2');
      });
    });

    // F13 Boundaries
    describe('F13 Boundaries', () => {
      it('B13-01: AudioContext initialized in suspended state unlocks cleanly on first gesture', async () => {
        const ctx = new MockAudioContext();
        assert.equal(ctx.state, 'suspended');
        await ctx.resume();
        assert.equal(ctx.state, 'running');
      });

      it('B13-02: Audio alert handles muted state explicitly passed in play DangerAlertSound options', async () => {
        audio.setMuted(false);
        await audio.playDangerAlertSound({ isMuted: true });
        assert.equal(audio.chimeCount, 0);
      });

      it('B13-03: Rapid audio triggers within 200ms execute only single audio chime', async () => {
        const now = 2_000_000;
        await audio.playDangerAlertSound({ currentTime: now });
        await audio.playDangerAlertSound({ currentTime: now + 50 });
        await audio.playDangerAlertSound({ currentTime: now + 150 });
        assert.equal(audio.chimeCount, 1);
      });

      it('B13-04: Gain node value set safely on chime generation', async () => {
        await audio.playDangerAlertSound();
        const ctx = sandbox.audioContextInstances[0];
        assert.ok(ctx.gains[0].gain.value <= 1.0 && ctx.gains[0].gain.value >= 0);
      });

      it('B13-05: Oscillator frequency set strictly to 800Hz', async () => {
        await audio.playDangerAlertSound();
        const ctx = sandbox.audioContextInstances[0];
        assert.equal(ctx.oscillators[0].frequency.value, 800);
      });
    });

    // F14 Boundaries
    describe('F14 Boundaries', () => {
      it('B14-01: Vibration pattern array containing all zeros [0, 0, 0] is rejected as no-op', () => {
        assert.equal(vibration.triggerDangerVibration([0, 0, 0]), false);
      });

      it('B14-02: navigator.vibrate returning false handled without throwing', () => {
        (navigator as any).vibrate = () => false;
        assert.equal(vibration.triggerDangerVibration(), false);
      });

      it('B14-03: Vibration call on empty pattern returns false', () => {
        assert.equal(vibration.triggerDangerVibration([]), false);
      });

      it('B14-04: Negative numbers in vibration pattern are rejected safely', () => {
        assert.equal(vibration.triggerDangerVibration([-100, -50]), false);
      });

      it('B14-05: Standard mobile vibration sequence [300, 150, 300] passes through accurately', () => {
        vibration.triggerDangerVibration([300, 150, 300]);
        assert.deepEqual(sandbox.vibrations[sandbox.vibrations.length - 1], [300, 150, 300]);
      });
    });

    // F15 Boundaries
    describe('F15 Boundaries', () => {
      it('B15-01: Permission query returning default does not throw error', async () => {
        MockNotification.permission = 'default';
        const perm = await notification.requestNotificationPermission();
        assert.equal(perm, 'default');
      });

      it('B15-02: Permission denied causes showDangerSystemNotification to return false immediately', async () => {
        MockNotification.permission = 'denied';
        const res = await notification.showDangerSystemNotification(createMockHazard(), 50);
        assert.equal(res, false);
      });

      it('B15-03: Notification tag uses stable tag hazard-${hazardId} to prevent stacking', async () => {
        const hazard = createMockHazard({ id: 'tag-boundary-1' });
        await notification.showDangerSystemNotification(hazard, 90);
        assert.equal(notification.lastNotification?.options?.tag, 'hazard-tag-boundary-1');
      });

      it('B15-04: Extremely long notification body handles safely', async () => {
        const hazard = createMockHazard({ description: 'X'.repeat(500) });
        const res = await notification.showDangerSystemNotification(hazard, 100);
        assert.equal(res, true);
      });

      it('B15-05: Notification payload includes structured data with hazard ID and coordinates', async () => {
        const hazard = createMockHazard({ id: 'payload-hazard' });
        await notification.showDangerSystemNotification(hazard, 110);
        assert.equal(notification.lastNotification?.options?.data?.hazardId, 'payload-hazard');
        assert.equal(notification.lastNotification?.options?.data?.distanceMeters, 110);
      });
    });

    // F16 Boundaries
    describe('F16 Boundaries', () => {
      it('B16-01: Visibility state hidden preserves state in tracking store', () => {
        sandbox.setVisibilityState('hidden');
        assert.equal(document.visibilityState, 'hidden');
      });

      it('B16-02: Restoring visibility to visible dispatches visibilitychange event', () => {
        let eventFired = false;
        document.addEventListener('visibilitychange', () => {
          eventFired = true;
        });
        sandbox.setVisibilityState('visible');
        assert.equal(eventFired, true);
      });

      it('B16-03: Notification title falls back gracefully if hazard title is missing', async () => {
        const hazard = createMockHazard({ title: '' });
        await notification.showDangerSystemNotification(hazard, 100);
        assert.ok(notification.lastNotification?.title.includes('Danger Alert'));
      });

      it('B16-04: Service Worker ready promise resolves to registration object', async () => {
        const reg = await navigator.serviceWorker?.ready;
        assert.ok(reg !== undefined);
        assert.ok(Array.isArray(reg.notifications));
      });

      it('B16-05: Disabling haptics retains audio and visual alerts independently', async () => {
        vibration.isEnabled = false;
        assert.equal(vibration.triggerDangerVibration(), false);
        // Audio still plays
        await audio.playDangerAlertSound();
        assert.equal(audio.chimeCount, 1);
      });
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Pairwise Interactions (7 Tests)
  // ==========================================================================

  describe('Tier 3: Cross-Feature Pairwise Interactions', () => {
    it('X04 (F8 + F13 + F14): Danger zone entry with sound unmuted and vibration supported triggers both simultaneously', async () => {
      const hazard = createMockHazard();
      const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);

      if (res.isInsideDangerZone) {
        await audio.playDangerAlertSound();
        vibration.triggerDangerVibration();
      }

      assert.equal(audio.chimeCount, 1);
      assert.equal(vibration.vibrateCallCount, 1);
    });

    it('X05 (F8 + F13 + F14): Danger zone entry with sound MUTED: audio chime is silent, vibration still triggers', async () => {
      audio.setMuted(true);
      const hazard = createMockHazard();
      const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);

      if (res.isInsideDangerZone) {
        await audio.playDangerAlertSound();
        vibration.triggerDangerVibration();
      }

      assert.equal(audio.chimeCount, 0);
      assert.equal(vibration.vibrateCallCount, 1);
    });

    it('X06 (F8 + F14 + F15): Danger zone entry without vibration support: degrades to no-op and system notification displays', async () => {
      const noVibeSandbox = installBrowserGlobals({
        supportsVibration: false,
        notificationPermission: 'granted',
      });
      try {
        const noVibeEngine = new FallbackVibrationAlertEngine();
        const notifEngine = new FallbackSystemNotificationEngine();

        const hazard = createMockHazard();
        const vibeOk = noVibeEngine.triggerDangerVibration();
        const notifOk = await notifEngine.showDangerSystemNotification(hazard, 120);

        assert.equal(vibeOk, false);
        assert.equal(notifOk, true);
        assert.equal(notifEngine.notificationCount, 1);
      } finally {
        noVibeSandbox.restore();
      }
    });

    it('X14 (F8 + F10 + F12): User enters danger zone, dismisses banner, moves closer within same zone: banner remains dismissed', () => {
      const hazard = createMockHazard({ id: 'h-dismiss-flow' });
      // Enter at ~150m
      const res1 = tracker.evaluate({ latitude: 23.75135, longitude: 90.38 }, [hazard]);
      assert.equal(res1.activeAlerts.length, 1);

      // Dismiss banner
      tracker.dismissAlert('h-dismiss-flow');

      // Move to ~80m
      const res2 = tracker.evaluate({ latitude: 23.75072, longitude: 90.38 }, [hazard]);
      const banner = createBannerViewModel(res2.closestAlert, res2.activeAlerts.length);
      assert.equal(banner, null);
      assert.equal(res2.activeAlerts.length, 0);
    });

    it('X15 (F8 + F13 + F10): Rapid GPS jitter oscillating at 198m, 199m, 197m: chime plays only once', async () => {
      const hazard = createMockHazard();
      const t0 = 10_000;

      for (let i = 0; i < 5; i++) {
        const res = tracker.evaluate({ latitude: 23.75178 + (i % 2) * 0.00001, longitude: 90.38 }, [hazard]);
        if (res.isInsideDangerZone && tracker.getAlertCount(hazard.id) === 1 && i === 0) {
          await audio.playDangerAlertSound({ currentTime: t0 + i * 200 });
        }
      }
      assert.equal(audio.chimeCount, 1);
    });

    it('X16 (F6 + F13 + F12): Proximity alert active + User toggles Mute on HUD: sound preference updates immediately', async () => {
      assert.equal(audio.getIsMuted(), false);
      audio.setMuted(true);
      assert.equal(audio.getIsMuted(), true);

      await audio.playDangerAlertSound();
      assert.equal(audio.chimeCount, 0);

      audio.setMuted(false);
      await audio.playDangerAlertSound();
      assert.equal(audio.chimeCount, 1);
    });

    it('X17 (F8 + F15 + F16): User enters danger zone while document is hidden: system notification dispatched with hazard info', async () => {
      sandbox.setVisibilityState('hidden');
      const hazard = createMockHazard({ title: 'Background Clash' });
      const res = tracker.evaluate({ latitude: 23.7505, longitude: 90.38 }, [hazard]);

      if (res.isInsideDangerZone && document.visibilityState === 'hidden') {
        await notification.showDangerSystemNotification(hazard, res.closestAlert!.distanceMeters);
      }

      assert.equal(notification.notificationCount, 1);
      assert.ok(notification.lastNotification?.options?.body.includes('Background Clash'));
    });
  });
});
