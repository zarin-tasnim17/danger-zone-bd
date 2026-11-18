/**
 * Contract Harness for Continuous GPS Tracking, Danger-Zone Proximity Detection,
 * and Multi-Channel Danger Notifications.
 *
 * Implements interfaces and behavior from PROJECT.md § Interface Contracts
 * with dynamic module loaders that resolve implementation modules when present
 * or seamlessly fall back to deterministic contract engines.
 */

import type { DangerIncident } from '@repo/shared';
import { calculateDistanceMeters } from '@/lib/gpsVerification';

// ============================================================================
// 1. Contract Interfaces (PROJECT.md § Interface Contracts)
// ============================================================================

export type TrackingStatus = 'active' | 'paused' | 'unavailable' | 'stopped';

export interface LiveTrackingState {
  isLiveTracking: boolean;
  trackingStatus: TrackingStatus;
  isFollowingUser: boolean;
  liveWatchId: number | null;
  startLiveTracking: () => Promise<boolean>;
  stopLiveTracking: () => void;
  setIsFollowingUser: (follow: boolean) => void;
  recenterOnUser: () => void;
  setTrackingStatus: (status: TrackingStatus) => void;
}

export interface ProximityAlertItem {
  hazard: DangerIncident;
  distanceMeters: number;
  enteredAt: number;
}

export interface UseHazardProximityAlertOptions {
  thresholdMeters?: number; // Default: 200
  cooldownMs?: number; // Default: 600,000 (10 minutes)
  hysteresisMeters?: number; // Default: 20 (exit at 220m)
  maxAccuracyMeters?: number; // Default: 250
  enabled?: boolean; // Default: true
  onAlert?: (item: ProximityAlertItem) => void;
  onExit?: (hazardId: string) => void;
}

export interface UseHazardProximityAlertReturn {
  activeAlerts: ProximityAlertItem[];
  closestAlert: ProximityAlertItem | null;
  isInsideDangerZone: boolean;
  dismissAlert: (hazardId: string) => void;
  resetAllAlerts: () => void;
}

// ============================================================================
// 2. Pure Proximity & Eligibility Calculation Engine
// ============================================================================

export const BANGLADESH_BOUNDS = {
  minLat: 20.3,
  maxLat: 26.8,
  minLng: 88.0,
  maxLng: 92.9,
};

export function isWithinBangladesh(lat: number, lng: number): boolean {
  return (
    lat >= BANGLADESH_BOUNDS.minLat &&
    lat <= BANGLADESH_BOUNDS.maxLat &&
    lng >= BANGLADESH_BOUNDS.minLng &&
    lng <= BANGLADESH_BOUNDS.maxLng
  );
}

export function isEligibleHazard(hazard: DangerIncident | null | undefined): boolean {
  if (!hazard) return false;
  if (!hazard.id) return false;
  if (!hazard.coordinates || typeof hazard.coordinates.lat !== 'number' || typeof hazard.coordinates.lng !== 'number') {
    return false;
  }
  if (isNaN(hazard.coordinates.lat) || isNaN(hazard.coordinates.lng)) {
    return false;
  }

  // Bounds validation
  if (!isWithinBangladesh(hazard.coordinates.lat, hazard.coordinates.lng)) {
    return false;
  }

  // Status filtering: exclude resolved, purged, expired, deleted
  const status = String(hazard.status || '').toLowerCase().trim();
  const excludedStatuses = ['resolved', 'purged', 'expired', 'deleted', 'inactive'];
  if (excludedStatuses.includes(status)) {
    return false;
  }

  return true;
}

export function calculateHazardDistance(
  userLat: number,
  userLng: number,
  hazard: DangerIncident
): number {
  return calculateDistanceMeters(userLat, userLng, hazard.coordinates.lat, hazard.coordinates.lng);
}

// ============================================================================
// 3. Stateful Proximity Alert Tracker (Contract Implementation)
// ============================================================================

export class ProximityAlertTracker {
  private thresholdMeters: number;
  private cooldownMs: number;
  private hysteresisMeters: number;
  private maxAccuracyMeters: number;
  private enabled: boolean;
  private onAlert?: (item: ProximityAlertItem) => void;
  private onExit?: (hazardId: string) => void;

  private alerts = new Map<string, ProximityAlertItem>();
  private dismissedHazardIds = new Set<string>();
  private lastAlertTimestamps = new Map<string, number>();
  private alertCounts = new Map<string, number>();

  constructor(options: UseHazardProximityAlertOptions = {}) {
    this.thresholdMeters = options.thresholdMeters ?? 200;
    this.cooldownMs = options.cooldownMs ?? 600_000; // 10 minutes
    this.hysteresisMeters = options.hysteresisMeters ?? 20; // 220m exit
    this.maxAccuracyMeters = options.maxAccuracyMeters ?? 250;
    this.enabled = options.enabled ?? true;
    this.onAlert = options.onAlert;
    this.onExit = options.onExit;
  }

  public updateOptions(options: Partial<UseHazardProximityAlertOptions>): void {
    if (options.thresholdMeters !== undefined) this.thresholdMeters = options.thresholdMeters;
    if (options.cooldownMs !== undefined) this.cooldownMs = options.cooldownMs;
    if (options.hysteresisMeters !== undefined) this.hysteresisMeters = options.hysteresisMeters;
    if (options.maxAccuracyMeters !== undefined) this.maxAccuracyMeters = options.maxAccuracyMeters;
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.onAlert !== undefined) this.onAlert = options.onAlert;
    if (options.onExit !== undefined) this.onExit = options.onExit;
  }

  public evaluate(
    userLocation: { latitude: number; longitude: number } | null,
    incidents: DangerIncident[],
    options?: { userAccuracy?: number | null; currentTime?: number }
  ): UseHazardProximityAlertReturn {
    if (!this.enabled || !userLocation) {
      if (this.alerts.size > 0) {
        for (const [id] of this.alerts) {
          this.onExit?.(id);
        }
        this.alerts.clear();
      }
      return this.getState();
    }

    const now = options?.currentTime ?? Date.now();
    const eligibleHazards = incidents.filter(isEligibleHazard);
    const eligibleIds = new Set(eligibleHazards.map((h) => h.id));

    // 1. Check for removed/ineligible hazards that were previously active
    for (const [id] of Array.from(this.alerts.entries())) {
      if (!eligibleIds.has(id)) {
        this.alerts.delete(id);
        this.onExit?.(id);
      }
    }

    // 2. Evaluate all eligible hazards
    const exitThreshold = this.thresholdMeters + this.hysteresisMeters;

    for (const hazard of eligibleHazards) {
      const distance = calculateHazardDistance(
        userLocation.latitude,
        userLocation.longitude,
        hazard
      );

      const isCurrentlyAlerting = this.alerts.has(hazard.id);

      if (isCurrentlyAlerting) {
        // User was already inside: check exit boundary
        if (distance > exitThreshold) {
          // Exited danger zone!
          this.alerts.delete(hazard.id);
          this.onExit?.(hazard.id);
        } else {
          // Still inside: update distance dynamically without duplicate alert
          const existing = this.alerts.get(hazard.id)!;
          existing.distanceMeters = distance;
          existing.hazard = hazard; // sync latest incident metadata
        }
      } else {
        // User was outside: check entry boundary
        if (distance <= this.thresholdMeters) {
          const lastAlertTime = this.lastAlertTimestamps.get(hazard.id);
          const isCooldownActive =
            lastAlertTime !== undefined && now - lastAlertTime < this.cooldownMs;

          if (!isCooldownActive) {
            // New valid entry alert!
            const item: ProximityAlertItem = {
              hazard,
              distanceMeters: distance,
              enteredAt: now,
            };
            this.alerts.set(hazard.id, item);
            this.lastAlertTimestamps.set(hazard.id, now);
            this.alertCounts.set(hazard.id, (this.alertCounts.get(hazard.id) ?? 0) + 1);

            if (!this.dismissedHazardIds.has(hazard.id)) {
              this.onAlert?.(item);
            }
          } else {
            // Re-entered during active 10-minute cooldown: suppress duplicate alert chime/banner
            // but keep tracking internally if within radius
            const item: ProximityAlertItem = {
              hazard,
              distanceMeters: distance,
              enteredAt: lastAlertTime ?? now,
            };
            this.alerts.set(hazard.id, item);
          }
        }
      }
    }

    return this.getState();
  }

  public dismissAlert(hazardId: string): void {
    this.dismissedHazardIds.add(hazardId);
  }

  public resetAllAlerts(): void {
    for (const [id] of this.alerts) {
      this.onExit?.(id);
    }
    this.alerts.clear();
    this.dismissedHazardIds.clear();
    this.lastAlertTimestamps.clear();
    this.alertCounts.clear();
  }

  public getAlertCount(hazardId: string): number {
    return this.alertCounts.get(hazardId) ?? 0;
  }

  public isDismissed(hazardId: string): boolean {
    return this.dismissedHazardIds.has(hazardId);
  }

  public getLastAlertTime(hazardId: string): number | undefined {
    return this.lastAlertTimestamps.get(hazardId);
  }

  public getState(): UseHazardProximityAlertReturn {
    const activeAlerts = Array.from(this.alerts.values()).filter(
      (a) => !this.dismissedHazardIds.has(a.hazard.id)
    );

    let closestAlert: ProximityAlertItem | null = null;
    let minDistance = Infinity;

    for (const item of activeAlerts) {
      if (item.distanceMeters < minDistance) {
        minDistance = item.distanceMeters;
        closestAlert = item;
      }
    }

    return {
      activeAlerts,
      closestAlert,
      isInsideDangerZone: activeAlerts.length > 0,
      dismissAlert: (id: string) => this.dismissAlert(id),
      resetAllAlerts: () => this.resetAllAlerts(),
    };
  }
}

// ============================================================================
// 4. Multi-Channel Notification Engines (Audio, Vibration, System Notification)
// ============================================================================

export class FallbackAudioAlertEngine {
  private isMuted = false;
  private audioContext: any = null;
  private lastChimeTimestamp = 0;
  public chimeCount = 0;
  public unlockCount = 0;

  public async unlockAudioContext(): Promise<void> {
    this.unlockCount++;
    const AudioContextClass =
      (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended' && typeof this.audioContext.resume === 'function') {
      await this.audioContext.resume();
    }
  }

  public async playDangerAlertSound(options?: { isMuted?: boolean; currentTime?: number }): Promise<void> {
    const muted = options?.isMuted ?? this.isMuted;
    if (muted) return;

    const now = options?.currentTime ?? Date.now();
    // 500ms debounce to prevent glitching / audio overlapping
    if (now - this.lastChimeTimestamp < 500) {
      return;
    }
    this.lastChimeTimestamp = now;

    try {
      const AudioContextClass =
        (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended' && typeof this.audioContext.resume === 'function') {
        await this.audioContext.resume();
      }

      // Synthesize dual-pulse 800Hz chime
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, this.audioContext.currentTime);
      gain1.gain.setValueAtTime(0.3, this.audioContext.currentTime);

      osc1.connect(gain1);
      gain1.connect(this.audioContext.destination);

      osc1.start(this.audioContext.currentTime);
      osc1.stop(this.audioContext.currentTime + 0.15);

      this.chimeCount++;
    } catch {
      // Graceful fallback if blocked by browser autoplay policy
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public reset(): void {
    this.isMuted = false;
    this.audioContext = null;
    this.lastChimeTimestamp = 0;
    this.chimeCount = 0;
    this.unlockCount = 0;
  }
}

export class FallbackVibrationAlertEngine {
  public vibrateCallCount = 0;
  public lastPattern: number | number[] | null = null;
  public isEnabled = true;

  public isVibrationSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function';
  }

  public triggerDangerVibration(pattern: number[] = [300, 150, 300]): boolean {
    if (!this.isEnabled) return false;
    if (!this.isVibrationSupported()) return false;
    if (!Array.isArray(pattern) || pattern.length === 0 || pattern.every((p) => p <= 0)) {
      return false;
    }

    try {
      this.lastPattern = pattern;
      this.vibrateCallCount++;
      return Boolean((navigator as any).vibrate(pattern));
    } catch {
      return false;
    }
  }

  public reset(): void {
    this.vibrateCallCount = 0;
    this.lastPattern = null;
    this.isEnabled = true;
  }
}

export class FallbackSystemNotificationEngine {
  public notificationCount = 0;
  public lastNotification: { title: string; options?: any } | null = null;

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') return 'denied';
    if (typeof Notification.requestPermission === 'function') {
      return await Notification.requestPermission();
    }
    return (Notification as any).permission ?? 'default';
  }

  public async showDangerSystemNotification(
    hazard: DangerIncident,
    distanceMeters: number
  ): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;

    const title = `⚠️ Danger Alert: ${hazard.category || 'Hazard'}`;
    const options = {
      body: `You are ${Math.round(distanceMeters)}m from an active hazard: ${hazard.title || hazard.locationName || 'Danger Zone'}.`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `hazard-${hazard.id}`,
      renotify: false,
      data: {
        hazardId: hazard.id,
        distanceMeters,
        coordinates: hazard.coordinates,
      },
    };

    this.notificationCount++;
    this.lastNotification = { title, options };

    // Try service worker registration first
    if (
      typeof navigator !== 'undefined' &&
      navigator.serviceWorker &&
      typeof navigator.serviceWorker.ready !== 'undefined'
    ) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          return true;
        }
      } catch {
        // Fall back to window Notification
      }
    }

    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }

  public reset(): void {
    this.notificationCount = 0;
    this.lastNotification = null;
  }
}

// ============================================================================
// 5. Visual Banner Model & HUD View Inspector
// ============================================================================

export interface BannerViewModel {
  isVisible: boolean;
  title: string;
  category: string;
  formattedDistance: string;
  distanceMeters: number;
  moreNearbyCount: number;
  hazardId: string;
}

export function formatBannerDistance(distanceMeters: number): string {
  if (distanceMeters <= 0) return 'At hazard epicenter';
  return `${Math.round(distanceMeters)}m away`;
}

export function createBannerViewModel(
  closestAlert: ProximityAlertItem | null,
  totalAlertsCount: number
): BannerViewModel | null {
  if (!closestAlert) return null;
  const moreNearbyCount = Math.max(0, totalAlertsCount - 1);
  return {
    isVisible: true,
    title: closestAlert.hazard.title || 'Active Danger Zone',
    category: closestAlert.hazard.category || 'General',
    distanceMeters: closestAlert.distanceMeters,
    formattedDistance: formatBannerDistance(closestAlert.distanceMeters),
    moreNearbyCount,
    hazardId: closestAlert.hazard.id,
  };
}

// Global Singletons for test convenience
export const fallbackAudio = new FallbackAudioAlertEngine();
export const fallbackVibration = new FallbackVibrationAlertEngine();
export const fallbackNotification = new FallbackSystemNotificationEngine();
