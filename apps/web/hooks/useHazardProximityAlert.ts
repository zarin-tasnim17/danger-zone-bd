'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { useIncidentStore } from '@/store/useIncidentStore';
import {
  evaluateHazardProximity,
  ProximityAlertItem,
  ProximityTrackerEntry,
  EvaluateHazardProximityOptions,
} from '@/lib/proximityEngine';

export type { ProximityAlertItem, ProximityTrackerEntry, EvaluateHazardProximityOptions };

export interface UseHazardProximityAlertOptions extends EvaluateHazardProximityOptions {
  /** Enables or disables real-time proximity evaluation. Defaults to true. */
  enabled?: boolean;
  /** Callback fired once when entering a hazard warning radius or after cooldown. */
  onAlert?: (item: ProximityAlertItem) => void;
  /** Callback fired when exiting a hazard radius (with hysteresis) or hazard resolved. */
  onExit?: (hazardId: string) => void;
}

export interface UseHazardProximityAlertReturn {
  /** Active non-dismissed alerts sorted ascending by distance (closest first). */
  activeAlerts: ProximityAlertItem[];
  /** The nearest active hazard alert, or null if none active. */
  closestAlert: ProximityAlertItem | null;
  /** True if the user is currently inside one or more danger zones. */
  isInsideDangerZone: boolean;
  /** Dismisses a specific hazard alert until the user exits its zone. */
  dismissAlert: (hazardId: string) => void;
  /** Clears all tracker states and dismissed alerts. */
  resetAllAlerts: () => void;
}

/**
 * Reusable React hook for real-time danger zone proximity detection.
 * Consumes coordinates from `useMapStore` and hazards from `useIncidentStore`,
 * delegating geospatial mathematics and state transitions to the pure proximity engine.
 */
export function useHazardProximityAlert(
  options: UseHazardProximityAlertOptions = {}
): UseHazardProximityAlertReturn {
  const {
    enabled = true,
    thresholdMeters,
    cooldownMs,
    hysteresisMeters,
    maxAccuracyMeters,
    checkBangladeshBounds,
    onAlert,
    onExit,
  } = options;

  // Selective store subscriptions to prevent unnecessary re-renders
  const userLocation = useMapStore((s) => s.userLocation);
  const userAccuracy = useMapStore((s) => s.userAccuracy);
  const incidents = useIncidentStore((s) => s.incidents);

  // Internal state tracking refs (mutations do not trigger component renders)
  const trackerRef = useRef<Map<string, ProximityTrackerEntry>>(new Map());
  const dismissedSetRef = useRef<Set<string>>(new Set());

  // Callback refs to shield effect from inline function recreation
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Reactive state for UI consumption
  const [activeAlerts, setActiveAlerts] = useState<ProximityAlertItem[]>([]);

  useEffect(() => {
    // If disabled or coordinates are not yet available, reset alerts
    if (!enabled || !userLocation) {
      if (trackerRef.current.size > 0 && !enabled) {
        // Notify exits on disable
        trackerRef.current.forEach((entry, id) => {
          if (entry.isInside) {
            onExitRef.current?.(id);
          }
        });
        trackerRef.current.clear();
      }
      setActiveAlerts((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    // Evaluate proximity via pure engine
    const result = evaluateHazardProximity(
      userLocation,
      userAccuracy,
      incidents,
      trackerRef.current,
      {
        enabled,
        thresholdMeters,
        cooldownMs,
        hysteresisMeters,
        maxAccuracyMeters,
        checkBangladeshBounds,
      }
    );

    // Commit updated tracker state
    trackerRef.current = result.updatedTrackerState;

    // Trigger onExit for exited or resolved hazards and purge dismissal
    for (const exitedId of result.exitedHazardIds) {
      dismissedSetRef.current.delete(exitedId);
      onExitRef.current?.(exitedId);
    }

    // Filter out manually dismissed alerts for reactive UI
    const filteredActive = result.activeAlerts.filter(
      (item) => !dismissedSetRef.current.has(item.hazard.id)
    );

    // Trigger onAlert for newly detected entries (if not dismissed)
    for (const newAlert of result.newAlerts) {
      if (!dismissedSetRef.current.has(newAlert.hazard.id)) {
        onAlertRef.current?.(newAlert);
      }
    }

    // Update activeAlerts with structural equality check to prevent render loops
    setActiveAlerts((prevAlerts) => {
      if (prevAlerts.length === 0 && filteredActive.length === 0) {
        return prevAlerts;
      }
      if (prevAlerts.length !== filteredActive.length) {
        return filteredActive;
      }
      const hasChanged = filteredActive.some((newItem, index) => {
        const prevItem = prevAlerts[index];
        return (
          !prevItem ||
          prevItem.hazard.id !== newItem.hazard.id ||
          prevItem.distanceMeters !== newItem.distanceMeters
        );
      });
      return hasChanged ? filteredActive : prevAlerts;
    });
  }, [
    enabled,
    userLocation,
    userAccuracy,
    incidents,
    thresholdMeters,
    cooldownMs,
    hysteresisMeters,
    maxAccuracyMeters,
    checkBangladeshBounds,
  ]);

  // Dismiss a specific hazard alert
  const dismissAlert = useCallback((hazardId: string) => {
    dismissedSetRef.current.add(hazardId);
    setActiveAlerts((prev) => prev.filter((a) => a.hazard.id !== hazardId));
  }, []);

  // Global reset of all alerts and tracking state
  const resetAllAlerts = useCallback(() => {
    trackerRef.current.forEach((entry, id) => {
      if (entry.isInside) {
        onExitRef.current?.(id);
      }
    });
    trackerRef.current.clear();
    dismissedSetRef.current.clear();
    setActiveAlerts((prev) => (prev.length > 0 ? [] : prev));
  }, []);

  // Nearest alert memoization
  const closestAlert = useMemo(
    () => (activeAlerts.length > 0 ? activeAlerts[0] : null),
    [activeAlerts]
  );

  return {
    activeAlerts,
    closestAlert,
    isInsideDangerZone: activeAlerts.length > 0,
    dismissAlert,
    resetAllAlerts,
  };
}
