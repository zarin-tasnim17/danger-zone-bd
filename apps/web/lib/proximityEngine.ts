import {
  DangerIncident,
  MAX_GPS_PROXIMITY_METERS,
  MAX_HARDWARE_GPS_ACCURACY_METERS,
  isWithinBangladesh,
  isHazardWithinTimeWindow,
} from '@repo/shared';
import { calculateDistanceMeters } from './gpsVerification';

export { calculateDistanceMeters };

export interface ProximityAlertItem {
  hazard: DangerIncident;
  distanceMeters: number;
  enteredAt: number;
}

export interface ProximityTrackerEntry {
  hazardId: string;
  isInside: boolean;
  enteredAt: number;
  lastAlertTimestamp: number;
  lastDistanceMeters: number;
}

export interface EvaluateHazardProximityOptions {
  thresholdMeters?: number;          // Default: 200 (MAX_GPS_PROXIMITY_METERS)
  cooldownMs?: number;               // Default: 600,000 (10 minutes)
  hysteresisMeters?: number;         // Default: 20 (exit boundary = threshold + 20)
  maxAccuracyMeters?: number;        // Default: 250 (MAX_HARDWARE_GPS_ACCURACY_METERS)
  currentTime?: number;              // Default: Date.now()
  checkBangladeshBounds?: boolean;   // Default: true
  enabled?: boolean;                 // Default: true
}

export interface ProximityEvaluationResult {
  newAlerts: ProximityAlertItem[];
  exitedHazardIds: string[];
  activeAlerts: ProximityAlertItem[];
  closestAlert: ProximityAlertItem | null;
  updatedTrackerState: Map<string, ProximityTrackerEntry>;
}

export type CoordinateLike =
  | { lat: number; lng: number }
  | { latitude: number; longitude: number };

const ELIGIBLE_STATUSES = new Set([
  'unverified',
  'community_confirmed',
  'authority_verified',
  'disputed',
  'active',
]);

const EXCLUDED_STATUSES = new Set([
  'resolved',
  'purged',
  'deleted',
  'archived',
  'rejected',
  'inactive',
  'expired',
]);

/**
 * Validates whether a hazard incident is eligible for proximity evaluation.
 * Defense-in-depth: status normalization, boundary checking, and timestamp validation.
 */
export function isHazardEligible(
  hazard: DangerIncident | null | undefined,
  options?: { currentTime?: number; checkBangladeshBounds?: boolean }
): boolean {
  if (!hazard || typeof hazard !== 'object') return false;
  if (typeof hazard.id !== 'string' || hazard.id.trim() === '') return false;

  // Status check (case-insensitive normalization)
  const normStatus = String(hazard.status || '').toLowerCase().trim();
  if (EXCLUDED_STATUSES.has(normStatus)) return false;
  if (!ELIGIBLE_STATUSES.has(normStatus)) return false;

  // Coordinates check
  if (!hazard.coordinates || typeof hazard.coordinates !== 'object') return false;
  const { lat, lng } = hazard.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

  if (options?.checkBangladeshBounds !== false) {
    if (!isWithinBangladesh(lat, lng)) return false;
  }

  // Timestamp check
  if (!hazard.timestamp || typeof hazard.timestamp !== 'string') return false;
  const createdAtMs = Date.parse(hazard.timestamp);
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return false;

  // Expiration check (expiresAt field if present)
  const expiresAt = (hazard as unknown as Record<string, unknown>).expiresAt;
  if (expiresAt) {
    const expiresAtMs = Date.parse(String(expiresAt));
    const now = options?.currentTime ?? Date.now();
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) return false;
  }

  // Recurring danger time-window check (only alert if within active window)
  const refDate = options?.currentTime ? new Date(options.currentTime) : new Date();
  if (!isHazardWithinTimeWindow(hazard.activeTimeStart, hazard.activeTimeEnd, refDate)) {
    return false;
  }

  return true;
}

/** Backward-compatible alias for isHazardEligible */
export const isEligibleHazard = isHazardEligible;

/**
 * Pure evaluation function computing proximity transitions, entry/exit events,
 * and deduplication against tracking state at $0 budget.
 */
export function evaluateHazardProximity(
  userCoords: CoordinateLike | null | undefined,
  userAccuracy: number | null | undefined,
  hazards: DangerIncident[] | null | undefined,
  trackerState: Map<string, ProximityTrackerEntry> = new Map(),
  options: EvaluateHazardProximityOptions = {}
): ProximityEvaluationResult {
  const thresholdMeters = options.thresholdMeters ?? MAX_GPS_PROXIMITY_METERS;
  const cooldownMs = options.cooldownMs ?? 600_000;
  const hysteresisMeters = options.hysteresisMeters ?? 20;
  const maxAccuracyMeters = options.maxAccuracyMeters ?? MAX_HARDWARE_GPS_ACCURACY_METERS;
  const currentTime = options.currentTime ?? Date.now();
  const checkBangladeshBounds = options.checkBangladeshBounds ?? true;
  const enabled = options.enabled ?? true;
  const exitThresholdMeters = thresholdMeters + hysteresisMeters;

  // Return empty result while preserving state
  const emptyResult = (state: Map<string, ProximityTrackerEntry>): ProximityEvaluationResult => ({
    newAlerts: [],
    exitedHazardIds: [],
    activeAlerts: [],
    closestAlert: null,
    updatedTrackerState: state,
  });

  if (!enabled) {
    // If disabled, transition all currently inside hazards to exited
    const disabledState = new Map<string, ProximityTrackerEntry>(trackerState);
    const exited: string[] = [];
    disabledState.forEach((entry, id) => {
      if (entry.isInside) {
        exited.push(id);
        disabledState.set(id, { ...entry, isInside: false });
      }
    });
    return {
      newAlerts: [],
      exitedHazardIds: exited,
      activeAlerts: [],
      closestAlert: null,
      updatedTrackerState: disabledState,
    };
  }

  // 1. User coordinates check
  if (!userCoords || typeof userCoords !== 'object') {
    return emptyResult(trackerState);
  }

  const rawLat = (userCoords as { lat?: unknown; latitude?: unknown }).lat ??
    (userCoords as { lat?: unknown; latitude?: unknown }).latitude;
  const rawLng = (userCoords as { lng?: unknown; longitude?: unknown }).lng ??
    (userCoords as { lng?: unknown; longitude?: unknown }).longitude;

  if (
    typeof rawLat !== 'number' ||
    typeof rawLng !== 'number' ||
    !Number.isFinite(rawLat) ||
    !Number.isFinite(rawLng) ||
    rawLat < -90 ||
    rawLat > 90 ||
    rawLng < -180 ||
    rawLng > 180
  ) {
    return emptyResult(trackerState);
  }

  const userLat = rawLat;
  const userLng = rawLng;

  if (checkBangladeshBounds && !isWithinBangladesh(userLat, userLng)) {
    return emptyResult(trackerState);
  }

  // 2. Hardware GPS accuracy guard: discard evaluation if accuracy degraded beyond threshold or negative/invalid
  if (userAccuracy !== null && userAccuracy !== undefined) {
    if (!Number.isFinite(userAccuracy) || userAccuracy < 0 || userAccuracy > maxAccuracyMeters) {
      return emptyResult(trackerState);
    }
  }

  // Clone tracker state for immutability
  const updatedTrackerState = new Map<string, ProximityTrackerEntry>(trackerState);
  const safeHazards = Array.isArray(hazards) ? hazards : [];
  const eligibleHazards = safeHazards.filter((h) =>
    isHazardEligible(h, { currentTime, checkBangladeshBounds })
  );
  const eligibleMap = new Map<string, DangerIncident>(eligibleHazards.map((h) => [h.id, h]));

  const newAlerts: ProximityAlertItem[] = [];
  const exitedHazardIds: string[] = [];
  const activeAlerts: ProximityAlertItem[] = [];

  // 3. Clear hazards in tracker that became ineligible or were removed in real time
  updatedTrackerState.forEach((entry, hazardId) => {
    if (entry.isInside && !eligibleMap.has(hazardId)) {
      exitedHazardIds.push(hazardId);
      updatedTrackerState.set(hazardId, {
        ...entry,
        isInside: false,
      });
    }
  });

  // 4. Evaluate all eligible hazards
  for (const hazard of eligibleHazards) {
    const distance = calculateDistanceMeters(
      userLat,
      userLng,
      hazard.coordinates.lat,
      hazard.coordinates.lng
    );

    const prevEntry = updatedTrackerState.get(hazard.id);
    const wasInside = prevEntry ? prevEntry.isInside : false;
    const lastAlertTime = prevEntry ? prevEntry.lastAlertTimestamp : 0;
    const enteredAtTime = prevEntry && wasInside ? prevEntry.enteredAt : currentTime;

    if (distance <= thresholdMeters) {
      // User is within entry threshold (e.g. <= 200m)
      if (!wasInside) {
        // Transition: ENTRY
        const isCooldownElapsed = lastAlertTime === 0 || currentTime - lastAlertTime >= cooldownMs;
        const newAlertTime = isCooldownElapsed ? currentTime : lastAlertTime;

        if (isCooldownElapsed) {
          newAlerts.push({
            hazard,
            distanceMeters: distance,
            enteredAt: currentTime,
          });
        }

        updatedTrackerState.set(hazard.id, {
          hazardId: hazard.id,
          isInside: true,
          enteredAt: currentTime,
          lastAlertTimestamp: newAlertTime,
          lastDistanceMeters: distance,
        });

        activeAlerts.push({
          hazard,
          distanceMeters: distance,
          enteredAt: currentTime,
        });
      } else {
        // Remaining inside: update distance, deduplicate alert
        updatedTrackerState.set(hazard.id, {
          ...prevEntry!,
          lastDistanceMeters: distance,
        });

        activeAlerts.push({
          hazard,
          distanceMeters: distance,
          enteredAt: enteredAtTime,
        });
      }
    } else if (distance <= exitThresholdMeters) {
      // Within hysteresis zone (e.g. 200m < d <= 220m)
      if (wasInside) {
        // Hysteresis preserves inside state
        updatedTrackerState.set(hazard.id, {
          ...prevEntry!,
          lastDistanceMeters: distance,
        });

        activeAlerts.push({
          hazard,
          distanceMeters: distance,
          enteredAt: enteredAtTime,
        });
      } else {
        // Still outside
        if (prevEntry) {
          updatedTrackerState.set(hazard.id, {
            ...prevEntry,
            lastDistanceMeters: distance,
          });
        }
      }
    } else {
      // Outside exit threshold (d > 220m)
      if (wasInside) {
        // Transition: EXIT
        exitedHazardIds.push(hazard.id);
        updatedTrackerState.set(hazard.id, {
          ...prevEntry!,
          isInside: false,
          lastDistanceMeters: distance,
        });
      } else {
        if (prevEntry) {
          updatedTrackerState.set(hazard.id, {
            ...prevEntry,
            lastDistanceMeters: distance,
          });
        }
      }
    }
  }

  // 5. Sort active alerts by distance ascending (closest first)
  activeAlerts.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const closestAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;

  return {
    newAlerts,
    exitedHazardIds,
    activeAlerts,
    closestAlert,
    updatedTrackerState,
  };
}

/**
 * Stateful class tracker wrapping evaluateHazardProximity for object-oriented consumers.
 */
export class ProximityAlertTracker {
  private trackerState = new Map<string, ProximityTrackerEntry>();
  private dismissedHazardIds = new Set<string>();
  private options: EvaluateHazardProximityOptions;
  private onAlertCallback?: (item: ProximityAlertItem) => void;
  private onExitCallback?: (hazardId: string) => void;
  private alertCounts = new Map<string, number>();
  private latestActiveAlerts: ProximityAlertItem[] = [];

  constructor(
    options: EvaluateHazardProximityOptions & {
      onAlert?: (item: ProximityAlertItem) => void;
      onExit?: (hazardId: string) => void;
    } = {}
  ) {
    this.options = { ...options };
    this.onAlertCallback = options.onAlert;
    this.onExitCallback = options.onExit;
  }

  public updateOptions(
    options: Partial<
      EvaluateHazardProximityOptions & {
        onAlert?: (item: ProximityAlertItem) => void;
        onExit?: (hazardId: string) => void;
      }
    >
  ): void {
    this.options = { ...this.options, ...options };
    if (options.onAlert !== undefined) this.onAlertCallback = options.onAlert;
    if (options.onExit !== undefined) this.onExitCallback = options.onExit;
  }

  public evaluate(
    userLocation: CoordinateLike | null | undefined,
    incidents: DangerIncident[] | null | undefined,
    opts?: { userAccuracy?: number | null; currentTime?: number }
  ): {
    activeAlerts: ProximityAlertItem[];
    closestAlert: ProximityAlertItem | null;
    isInsideDangerZone: boolean;
    dismissAlert: (hazardId: string) => void;
    resetAllAlerts: () => void;
  } {
    const userAccuracy = opts?.userAccuracy ?? null;
    const currentTime = opts?.currentTime ?? this.options.currentTime ?? Date.now();

    const result = evaluateHazardProximity(
      userLocation,
      userAccuracy,
      incidents,
      this.trackerState,
      {
        ...this.options,
        currentTime,
      }
    );

    this.trackerState = result.updatedTrackerState;
    this.latestActiveAlerts = result.activeAlerts;

    // Trigger onExit for exited hazards and remove from dismissed set
    for (const exitedId of result.exitedHazardIds) {
      this.dismissedHazardIds.delete(exitedId);
      this.onExitCallback?.(exitedId);
    }

    // Trigger onAlert for newly detected entries (if not dismissed)
    for (const newAlert of result.newAlerts) {
      const prevCount = this.alertCounts.get(newAlert.hazard.id) ?? 0;
      this.alertCounts.set(newAlert.hazard.id, prevCount + 1);
      if (!this.dismissedHazardIds.has(newAlert.hazard.id)) {
        this.onAlertCallback?.(newAlert);
      }
    }

    return this.getState();
  }

  public dismissAlert(hazardId: string): void {
    this.dismissedHazardIds.add(hazardId);
  }

  public resetAllAlerts(): void {
    this.trackerState.forEach((entry, id) => {
      if (entry.isInside) {
        this.onExitCallback?.(id);
      }
    });
    this.trackerState.clear();
    this.dismissedHazardIds.clear();
    this.alertCounts.clear();
    this.latestActiveAlerts = [];
  }

  public isDismissed(hazardId: string): boolean {
    return this.dismissedHazardIds.has(hazardId);
  }

  public getAlertCount(hazardId: string): number {
    return this.alertCounts.get(hazardId) ?? 0;
  }

  public getLastAlertTime(hazardId: string): number | undefined {
    return this.trackerState.get(hazardId)?.lastAlertTimestamp;
  }

  public getState(): {
    activeAlerts: ProximityAlertItem[];
    closestAlert: ProximityAlertItem | null;
    isInsideDangerZone: boolean;
    dismissAlert: (hazardId: string) => void;
    resetAllAlerts: () => void;
  } {
    const activeAlerts = this.latestActiveAlerts.filter(
      (a) => !this.dismissedHazardIds.has(a.hazard.id)
    );

    const closestAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;

    return {
      activeAlerts,
      closestAlert,
      isInsideDangerZone: activeAlerts.length > 0,
      dismissAlert: (id: string) => this.dismissAlert(id),
      resetAllAlerts: () => this.resetAllAlerts(),
    };
  }
}
