import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  installBrowserGlobals,
  type BrowserSandboxHandle,
  MockAudioContext,
  MockNotification,
} from '../framework/domEnv';

import {
  playDangerAlertSound,
  unlockAudioContext,
  isAudioUnlocked,
  setAudioMuted,
  isAudioMuted,
  _resetAudioStateForTesting,
} from '@/lib/audioAlert';

import {
  triggerDangerVibration,
  isVibrationSupported,
  DEFAULT_VIBRATION_PATTERN,
} from '@/lib/vibrationAlert';

import {
  showDangerSystemNotification,
  requestNotificationPermission,
  getNotificationPermission,
  type DangerZoneHazardMetadata,
} from '@/lib/systemNotification';

import HazardProximityBanner, {
  formatBannerDistance,
  type HazardProximityBannerItem,
} from '@/components/map/HazardProximityBanner';

const createHazardFixture = (
  overrides: Partial<DangerZoneHazardMetadata> = {}
): DangerZoneHazardMetadata => ({
  id: 'hazard-test-101',
  title: 'Police Barricade & Teargas',
  category: 'Clash',
  locationName: 'Dhanmondi 27 Intersection',
  description: 'Protesters assembled near intersection, teargas deployed.',
  coordinates: {
    lat: 23.7505,
    lng: 90.3802,
  },
  ...overrides,
});

describe('[Unit][Notifications] Milestone 3: Multi-Channel Danger Notifications', () => {
  let sandbox: BrowserSandboxHandle;

  beforeEach(() => {
    sandbox = installBrowserGlobals({
      notificationPermission: 'granted',
      supportsVibration: true,
      supportsServiceWorker: true,
    });
    _resetAudioStateForTesting();
    MockAudioContext.reset();
  });

  afterEach(() => {
    _resetAudioStateForTesting();
    MockAudioContext.reset();
    sandbox.restore();
  });

  // ==========================================================================
  // SECTION 1: Web Audio API Danger Synthesizer (apps/web/lib/audioAlert.ts)
  // ==========================================================================
  describe('1. Web Audio API Danger Synthesizer', () => {
    it('01-01: Synthesizes dual-pulse 800 Hz alert tone using Web Audio API', async () => {
      const played = await playDangerAlertSound();
      assert.equal(played, true);

      assert.equal(MockAudioContext.instances.length, 1);
      const ctx = MockAudioContext.instances[0];
      assert.equal(ctx.oscillators.length, 2, 'Should create exactly 2 oscillators for dual-pulse tone');
      assert.equal(ctx.gains.length, 2, 'Should create exactly 2 gain nodes for pulse envelopes');

      // Check frequency of both pulses
      assert.equal(ctx.oscillators[0].frequency.value, 800);
      assert.equal(ctx.oscillators[1].frequency.value, 800);

      // Verify timing: pulse 1 starts at t0, pulse 2 starts at t0 + 0.18s
      assert.equal(ctx.oscillators[0].started, true);
      assert.equal(ctx.oscillators[0].stopped, true);
      assert.equal(ctx.oscillators[0].startTime, 0);
      assert.equal(ctx.oscillators[0].stopTime, 0.12);

      assert.equal(ctx.oscillators[1].started, true);
      assert.equal(ctx.oscillators[1].stopped, true);
      assert.equal(ctx.oscillators[1].startTime, 0.18);
      assert.equal(ctx.oscillators[1].stopTime, 0.30);
    });

    it('01-02: Allows custom frequency configuration', async () => {
      const played = await playDangerAlertSound({ frequency: 950 });
      assert.equal(played, true);

      const ctx = MockAudioContext.instances[0];
      assert.equal(ctx.oscillators[0].frequency.value, 950);
      assert.equal(ctx.oscillators[1].frequency.value, 950);
    });

    it('01-03: unlockAudioContext transitions audio context to running state', async () => {
      assert.equal(isAudioUnlocked(), false);

      await unlockAudioContext();
      assert.equal(isAudioUnlocked(), true);

      const ctx = MockAudioContext.instances[0];
      assert.equal(ctx.state, 'running');
    });

    it('01-04: unlockAudioContext is idempotent and handles multiple calls cleanly', async () => {
      await unlockAudioContext();
      await unlockAudioContext();
      await unlockAudioContext();

      assert.equal(isAudioUnlocked(), true);
      assert.equal(MockAudioContext.instances.length, 1, 'Should reuse existing AudioContext instance');
    });

    it('01-05: Global mute state suppresses alert chime and returns false', async () => {
      setAudioMuted(true);
      assert.equal(isAudioMuted(), true);

      const played = await playDangerAlertSound();
      assert.equal(played, false);
      assert.equal(MockAudioContext.instances.length, 0, 'No audio context should be instantiated when muted');
    });

    it('01-06: Unmuting via setAudioMuted(false) restores chime capability', async () => {
      setAudioMuted(true);
      assert.equal(await playDangerAlertSound(), false);

      setAudioMuted(false);
      assert.equal(isAudioMuted(), false);
      assert.equal(await playDangerAlertSound(), true);
    });

    it('01-07: Options isMuted flag overrides global state', async () => {
      setAudioMuted(false);
      const played = await playDangerAlertSound({ isMuted: true });
      assert.equal(played, false);
      assert.equal(MockAudioContext.instances.length, 0);
    });

    it('01-08: 10-second cooldown suppresses siren spam within 10,000ms', async () => {
      const t0 = 1_000_000;
      const first = await playDangerAlertSound({ currentTime: t0 });
      assert.equal(first, true);

      // Call 3 seconds later: within 10s cooldown
      const second = await playDangerAlertSound({ currentTime: t0 + 3_000 });
      assert.equal(second, false, 'Second chime within 10s cooldown must be suppressed');

      // Call 9.999 seconds later: still within cooldown
      const third = await playDangerAlertSound({ currentTime: t0 + 9_999 });
      assert.equal(third, false);

      // Call at exactly 10.000 seconds: cooldown elapsed
      const fourth = await playDangerAlertSound({ currentTime: t0 + 10_000 });
      assert.equal(fourth, true, 'Chime at cooldown boundary must play');
    });

    it('01-09: Custom cooldownMs option is respected', async () => {
      const t0 = 1_000_000;
      const first = await playDangerAlertSound({ currentTime: t0, cooldownMs: 3_000 });
      assert.equal(first, true);

      const second = await playDangerAlertSound({ currentTime: t0 + 2_000, cooldownMs: 3_000 });
      assert.equal(second, false);

      const third = await playDangerAlertSound({ currentTime: t0 + 3_000, cooldownMs: 3_000 });
      assert.equal(third, true);
    });

    it('01-10: Handles missing AudioContext in unsupported browser safely without throwing', async () => {
      _resetAudioStateForTesting();
      delete (globalThis as any).AudioContext;
      delete (globalThis as any).webkitAudioContext;
      if (typeof window !== 'undefined') {
        delete (window as any).AudioContext;
        delete (window as any).webkitAudioContext;
      }

      await unlockAudioContext();
      const played = await playDangerAlertSound();
      assert.equal(played, false);
    });
  });

  // ==========================================================================
  // SECTION 2: Mobile Vibration Wrapper (apps/web/lib/vibrationAlert.ts)
  // ==========================================================================
  describe('2. Mobile Vibration Wrapper', () => {
    it('02-01: Dispatches standard pattern [300, 150, 300] to navigator.vibrate', () => {
      const triggered = triggerDangerVibration();
      assert.equal(triggered, true);
      assert.equal(sandbox.vibrations.length, 1);
      assert.deepEqual(sandbox.vibrations[0], DEFAULT_VIBRATION_PATTERN);
      assert.deepEqual(DEFAULT_VIBRATION_PATTERN, [300, 150, 300]);
    });

    it('02-02: Allows custom vibration pattern', () => {
      const customPattern = [500, 200, 500];
      const triggered = triggerDangerVibration(customPattern);
      assert.equal(triggered, true);
      assert.equal(sandbox.vibrations.length, 1);
      assert.deepEqual(sandbox.vibrations[0], customPattern);
    });

    it('02-03: Rejects invalid or empty pattern safely without calling navigator.vibrate', () => {
      assert.equal(triggerDangerVibration([]), false);
      assert.equal(triggerDangerVibration([0, 0, 0]), false);
      assert.equal(triggerDangerVibration([-100, -200]), false);
      assert.equal(sandbox.vibrations.length, 0);
    });

    it('02-04: Gracefully handles unsupported devices (desktop / iOS Safari)', () => {
      delete (globalThis as any).navigator.vibrate;
      assert.equal(isVibrationSupported(), false);

      const triggered = triggerDangerVibration();
      assert.equal(triggered, false);
      assert.equal(sandbox.vibrations.length, 0);
    });

    it('02-05: Absorbs internal navigator.vibrate exceptions without throwing', () => {
      (globalThis as any).navigator.vibrate = () => {
        throw new Error('User activation required');
      };
      assert.doesNotThrow(() => {
        const result = triggerDangerVibration();
        assert.equal(result, false);
      });
    });
  });

  // ==========================================================================
  // SECTION 3: Browser System Notifications (apps/web/lib/systemNotification.ts)
  // ==========================================================================
  describe('3. Browser System Notifications', () => {
    it('03-01: Dispatches system notification via ServiceWorker registration when available', async () => {
      const hazard = createHazardFixture({ title: 'Teargas Clashes', category: 'Conflict' });
      const emitted = await showDangerSystemNotification(hazard, 142.6);

      assert.equal(emitted, true);
      assert.ok(sandbox.serviceWorkerRegistration !== null);
      assert.equal(sandbox.serviceWorkerRegistration?.notifications.length, 1);

      const notif = sandbox.serviceWorkerRegistration?.notifications[0];
      assert.equal(notif?.title, '⚠️ DANGER ZONE ALERT: Conflict - Teargas Clashes');
      assert.equal(notif?.options?.body, 'You are 143m from an active danger zone. Stay alert.');
      assert.equal(notif?.options?.tag, 'hazard-hazard-test-101');
      assert.equal(notif?.options?.data?.hazardId, 'hazard-test-101');
      assert.equal(notif?.options?.data?.distanceMeters, 143);
    });

    it('03-02: Falls back to window Notification constructor when ServiceWorker is unavailable', async () => {
      // Remove service worker support from sandbox
      delete (globalThis as any).navigator.serviceWorker;

      const hazard = createHazardFixture({ title: 'Bridge Blockade', category: 'Protest' });
      const emitted = await showDangerSystemNotification(hazard, 75.2);

      assert.equal(emitted, true);
      assert.equal(MockNotification.instances.length, 1);

      const notif = MockNotification.instances[0];
      assert.equal(notif.title, '⚠️ DANGER ZONE ALERT: Protest - Bridge Blockade');
      assert.equal(notif.options?.body, 'You are 75m from an active danger zone. Stay alert.');
    });

    it('03-03: Suppresses system notification when permission is denied', async () => {
      MockNotification.permission = 'denied';
      assert.equal(getNotificationPermission(), 'denied');

      const hazard = createHazardFixture();
      const emitted = await showDangerSystemNotification(hazard, 100);

      assert.equal(emitted, false);
      assert.equal(sandbox.serviceWorkerRegistration?.notifications.length, 0);
      assert.equal(MockNotification.instances.length, 0);
    });

    it('03-04: Suppresses system notification when permission is default (unprompted)', async () => {
      MockNotification.permission = 'default';
      assert.equal(getNotificationPermission(), 'default');

      const hazard = createHazardFixture();
      const emitted = await showDangerSystemNotification(hazard, 50);

      assert.equal(emitted, false);
    });

    it('03-05: requestNotificationPermission requests user permission and returns state', async () => {
      MockNotification.permission = 'granted';
      const perm = await requestNotificationPermission();
      assert.equal(perm, 'granted');
    });

    it('03-06: requestNotificationPermission returns denied safely when Notification API is absent', async () => {
      delete (globalThis as any).Notification;
      const perm = await requestNotificationPermission();
      assert.equal(perm, 'denied');
      assert.equal(getNotificationPermission(), 'denied');
    });

    it('03-07: Formats title correctly when hazard only has category without title', async () => {
      const hazard = createHazardFixture({ title: undefined, category: 'Fire Outbreak' });
      const emitted = await showDangerSystemNotification(hazard, 88);

      assert.equal(emitted, true);
      const notif = sandbox.serviceWorkerRegistration?.notifications[0];
      assert.equal(notif?.title, '⚠️ DANGER ZONE ALERT: Fire Outbreak');
      assert.equal(notif?.options?.body, 'You are 88m from an active danger zone. Stay alert.');
    });

    it('03-08: Formats zero distance cleanly as 0m', async () => {
      const hazard = createHazardFixture();
      const emitted = await showDangerSystemNotification(hazard, 0);

      assert.equal(emitted, true);
      const notif = sandbox.serviceWorkerRegistration?.notifications[0];
      assert.equal(notif?.options?.body, 'You are 0m from an active danger zone. Stay alert.');
    });
  });

  // ==========================================================================
  // SECTION 4: Visual Warning Banner HUD (apps/web/components/map/HazardProximityBanner.tsx)
  // ==========================================================================
  describe('4. Visual Warning Banner HUD', () => {
    it('04-01: formatBannerDistance formats positive distance to nearest meter', () => {
      assert.equal(formatBannerDistance(145.2), '145m away');
      assert.equal(formatBannerDistance(145.8), '146m away');
      assert.equal(formatBannerDistance(12.0), '12m away');
    });

    it('04-02: formatBannerDistance returns "At hazard epicenter" for distance <= 0', () => {
      assert.equal(formatBannerDistance(0), 'At hazard epicenter');
      assert.equal(formatBannerDistance(-5), 'At hazard epicenter');
    });

    it('04-03: Banner renders null when alerts array is empty or undefined', () => {
      const html1 = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts: [],
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );
      assert.equal(html1, '');

      const html2 = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts: null as any,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );
      assert.equal(html2, '');
    });

    it('04-04: Banner displays closest hazard title, category badge, and formatted distance', () => {
      const alerts: HazardProximityBannerItem[] = [
        {
          hazard: {
            id: 'h-101',
            title: 'Mirpur 10 Unrest',
            category: 'Demonstration',
            locationName: 'Mirpur 10 Roundabout',
          },
          distanceMeters: 132.4,
          enteredAt: Date.now(),
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );

      assert.ok(html.includes('Demonstration'), 'Must render hazard category');
      assert.ok(html.includes('Mirpur 10 Unrest'), 'Must render hazard title');
      assert.ok(html.includes('132m away'), 'Must render dynamic distance rounded');
      assert.ok(html.includes('Mirpur 10 Roundabout'), 'Must render location landmark');
    });

    it('04-05: Banner displays "+N more nearby" badge when multiple alerts are present', () => {
      const alerts: HazardProximityBannerItem[] = [
        {
          hazard: { id: 'h-1', title: 'Hazard 1', category: 'Conflict' },
          distanceMeters: 50,
          enteredAt: Date.now(),
        },
        {
          hazard: { id: 'h-2', title: 'Hazard 2', category: 'Blockade' },
          distanceMeters: 120,
          enteredAt: Date.now(),
        },
        {
          hazard: { id: 'h-3', title: 'Hazard 3', category: 'Fire' },
          distanceMeters: 180,
          enteredAt: Date.now(),
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );

      assert.ok(html.includes('+2 more nearby'), 'Should indicate 2 additional nearby hazards');
    });

    it('04-06: Banner does NOT display "+N more nearby" badge when exactly 1 alert is present', () => {
      const alerts: HazardProximityBannerItem[] = [
        {
          hazard: { id: 'h-1', title: 'Solo Hazard', category: 'Fire' },
          distanceMeters: 90,
          enteredAt: Date.now(),
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );

      assert.equal(html.includes('more nearby'), false);
    });

    it('04-07: Banner mute button reflects current mute status in aria-label and icon', () => {
      const alerts: HazardProximityBannerItem[] = [
        {
          hazard: { id: 'h-1', title: 'Hazard', category: 'Danger' },
          distanceMeters: 100,
          enteredAt: Date.now(),
        },
      ];

      // Unmuted banner
      const unmutedHtml = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );
      assert.ok(unmutedHtml.includes('aria-label="Mute hazard alert audio"'));

      // Muted banner
      const mutedHtml = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: true,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );
      assert.ok(mutedHtml.includes('aria-label="Unmute hazard alert audio"'));
    });

    it('04-08: Banner includes accessible dismiss button with aria-label', () => {
      const alerts: HazardProximityBannerItem[] = [
        {
          hazard: { id: 'h-dismiss', title: 'Dismissable Hazard', category: 'Danger' },
          distanceMeters: 60,
          enteredAt: Date.now(),
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(HazardProximityBanner, {
          alerts,
          isMuted: false,
          onToggleMute: () => {},
          onDismiss: () => {},
        })
      );

      assert.ok(html.includes('aria-label="Dismiss danger warning banner"'));
    });
  });

  // ==========================================================================
  // SECTION 5: Integrated Multi-Channel Proximity Alert Dispatch
  // ==========================================================================
  describe('5. Integrated Multi-Channel Proximity Alert Dispatch', () => {
    it('05-01: Proximity alert entry triggers audio chime, haptic vibration, and system notification in concert', async () => {
      const hazard = createHazardFixture({ title: 'Severe Teargas Barrage', category: 'Clash' });
      const distanceMeters = 110;

      // Simulate onAlert callback behavior in MapClient
      const audioResult = await playDangerAlertSound({ isMuted: isAudioMuted() });
      const vibrationResult = triggerDangerVibration();
      const notificationResult = await showDangerSystemNotification(hazard, distanceMeters);

      assert.equal(audioResult, true, 'Audio chime should succeed');
      assert.equal(vibrationResult, true, 'Vibration should succeed');
      assert.equal(notificationResult, true, 'System notification should succeed');

      // Verify states in each mocked subsystem
      assert.equal(MockAudioContext.instances.length, 1);
      assert.equal(sandbox.vibrations.length, 1);
      assert.equal(sandbox.serviceWorkerRegistration?.notifications.length, 1);
    });

    it('05-02: Audio mute preserves vibration and system notification channels intact', async () => {
      setAudioMuted(true);
      const hazard = createHazardFixture();

      const audioResult = await playDangerAlertSound({ isMuted: isAudioMuted() });
      const vibrationResult = triggerDangerVibration();
      const notificationResult = await showDangerSystemNotification(hazard, 80);

      assert.equal(audioResult, false, 'Audio should be suppressed');
      assert.equal(vibrationResult, true, 'Vibration channel must still fire');
      assert.equal(notificationResult, true, 'Notification channel must still fire');
    });

    it('05-03: Notification denial preserves audio chime and vibration channels intact', async () => {
      MockNotification.permission = 'denied';
      const hazard = createHazardFixture();

      const audioResult = await playDangerAlertSound({ isMuted: isAudioMuted() });
      const vibrationResult = triggerDangerVibration();
      const notificationResult = await showDangerSystemNotification(hazard, 95);

      assert.equal(audioResult, true, 'Audio must still fire');
      assert.equal(vibrationResult, true, 'Vibration must still fire');
      assert.equal(notificationResult, false, 'Notification suppressed on permission denial');
    });

    it('05-04: Gracefully degrades when all channels are disabled or unsupported without runtime errors', async () => {
      setAudioMuted(true);
      delete (globalThis as any).navigator.vibrate;
      delete (globalThis as any).Notification;

      const hazard = createHazardFixture();

      assert.doesNotThrow(async () => {
        const audioResult = await playDangerAlertSound({ isMuted: isAudioMuted() });
        const vibrationResult = triggerDangerVibration();
        const notificationResult = await showDangerSystemNotification(hazard, 120);

        assert.equal(audioResult, false);
        assert.equal(vibrationResult, false);
        assert.equal(notificationResult, false);
      });
    });

    it('05-05: Consecutive rapid proximity events respect audio cooldown while allowing notifications', async () => {
      const hazard = createHazardFixture();
      const t0 = 1_000_000;

      // First entry
      const a1 = await playDangerAlertSound({ currentTime: t0 });
      const v1 = triggerDangerVibration();
      const n1 = await showDangerSystemNotification(hazard, 150);
      assert.equal(a1, true);
      assert.equal(v1, true);
      assert.equal(n1, true);

      // Second entry 2 seconds later (cooldown active for audio)
      const a2 = await playDangerAlertSound({ currentTime: t0 + 2_000 });
      assert.equal(a2, false, 'Audio cooldown should prevent chime spam');
    });
  });
});
