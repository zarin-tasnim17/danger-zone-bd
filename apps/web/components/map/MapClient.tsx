"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapStore, MAP_LAYERS, LocationSource } from "@/store/useMapStore";
import { createDangerMarkerIcon, createSafeZoneIcon } from "@/lib/mapMarkerUtils";
import MapLayerSwitcher from "./MapLayerSwitcher";
import LocationSearchBar, { GeocodedLocation } from "./LocationSearchBar";
import LocationCalibrationModal from "./LocationCalibrationModal";
import LocationAccuracyBanner from "./LocationAccuracyBanner";
import { useFilterStore } from "@/store/useFilterStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { showToast } from "@/store/useToastStore";
import {
  DangerIncident,
  IncidentSeverity,
  isWithinBangladesh,
  computeAccuracyCircleRadius,
  isFreshPosition,
  sanitizeAccuracy,
  formatCoordinate,
} from "@repo/shared";
import { getTranslation, geoTranslations } from "@/lib/translations";
import {
  cleanIncidentTitle,
  formatCategoryLabel,
  getCategoryIcon,
  getCategoryBadgeClass,
} from "@/lib/incidentUtils";
import { isIncidentCategoryMatch } from "@/lib/filterUtils";
import { getSafeZonePresentation } from "@/lib/safeZoneMeta";
import L from "leaflet";
import {
  Crosshair,
  Compass,
  Layers,
  Shield,
  Eye,
  EyeOff,
  ArrowUpRight,
  ThumbsUp,
  ThumbsDown,
  Navigation,
  Loader2,
  X,
  RotateCcw,
  Sparkles,
  MapPin,
  Radio,
} from "lucide-react";
import { isMobileDevice } from "@/lib/deviceUtils";
export { isMobileDevice };
import { useHazardProximityAlert, type ProximityAlertItem } from "@/hooks/useHazardProximityAlert";
import HazardProximityBanner from "./HazardProximityBanner";
import {
  unlockAudioContext,
  playDangerAlertSound,
  isAudioMuted,
  setAudioMuted,
} from "@/lib/audioAlert";
import { triggerDangerVibration } from "@/lib/vibrationAlert";
import {
  showDangerSystemNotification,
  requestNotificationPermission,
} from "@/lib/systemNotification";

// Map events handler: fetches viewport incidents on pan/zoom without triggering reactive setState feedback loops
function MapEventsHandler({ onUserDragStart }: { onUserDragStart?: () => void }) {
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const map = useMapEvents({
    dragstart: () => {
      onUserDragStart?.();
    },
    zoomend: () => {
      const currentZoom = Math.round(map.getZoom());
      const storeZoom = useMapStore.getState().zoom;
      if (Math.abs(currentZoom - storeZoom) >= 1) {
        useMapStore.setState({ zoom: currentZoom });
      }
    },
    moveend: () => {
      // Debounce viewport bounds query to prevent re-fetching on continuous zoom or pan
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        const b = map.getBounds();
        fetchIncidentsInBounds({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
        });
      }, 350);
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Initial bounds load on map readiness
  useEffect(() => {
    if (map) {
      const b = map.getBounds();
      fetchIncidentsInBounds({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    }
  }, [map, fetchIncidentsInBounds]);

  return null;
}

// Map center updater: listens strictly to discrete programmatic target commands
function MapViewUpdater() {
  const map = useMap();
  const targetCommand = useMapStore((state) => state.targetCommand);
  const lastExecutedId = useRef<number>(0);
  const activeFlightTargetRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  useEffect(() => {
    const handleFlightEnd = () => {
      activeFlightTargetRef.current = null;
    };
    map.on("moveend", handleFlightEnd);
    map.on("dragstart", handleFlightEnd);
    return () => {
      map.off("moveend", handleFlightEnd);
      map.off("dragstart", handleFlightEnd);
    };
  }, [map]);

  useEffect(() => {
    if (!targetCommand || targetCommand.id === lastExecutedId.current) return;
    lastExecutedId.current = targetCommand.id;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetZoom = targetCommand.zoom ?? currentZoom;

    // Check if map is already actively flying to this identical destination
    if (
      activeFlightTargetRef.current &&
      Math.abs(activeFlightTargetRef.current.lat - targetCommand.lat) < 0.00001 &&
      Math.abs(activeFlightTargetRef.current.lng - targetCommand.lng) < 0.00001 &&
      Math.abs(activeFlightTargetRef.current.zoom - targetZoom) < 0.05
    ) {
      return;
    }

    const distLat = Math.abs(currentCenter.lat - targetCommand.lat);
    const distLng = Math.abs(currentCenter.lng - targetCommand.lng);
    const distZoom = Math.abs(currentZoom - targetZoom);

    // Only initiate flight if programmatic target actually differs from current camera
    if (distLat > 0.00001 || distLng > 0.00001 || distZoom > 0.05) {
      activeFlightTargetRef.current = { lat: targetCommand.lat, lng: targetCommand.lng, zoom: targetZoom };
      try {
        map.flyTo([targetCommand.lat, targetCommand.lng], targetZoom, {
          animate: true,
          duration: 1.0,
        });
      } catch {
        map.setView([targetCommand.lat, targetCommand.lng], targetZoom);
        activeFlightTargetRef.current = null;
      }
    }
  }, [targetCommand, map]);

  return null;
}

// Child component that captures the active Leaflet Map instance into parent mapRef
function MapInstanceRegistrar({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  return null;
}

// Automatically invalidates Leaflet map size safely when structural containers change (e.g. sidebar toggle)
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    let resizeTimer: NodeJS.Timeout | null = null;
    let prevWidth = container.clientWidth;
    let prevHeight = container.clientHeight;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Require meaningful resize (>= 15px) to prevent micro subpixel fluctuations from triggering invalidateSize loops
        if (Math.abs(width - prevWidth) >= 15 || Math.abs(height - prevHeight) >= 15) {
          prevWidth = width;
          prevHeight = height;

          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            map.invalidateSize({ pan: false });
          }, 150);
        }
      }
    });

    observer.observe(container);

    // Initial layout alignment on mount for mobile dynamic viewport heights
    const initialTimer = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 150);

    const handleWindowResize = () => {
      map.invalidateSize({ pan: false });
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
      if (initialTimer) clearTimeout(initialTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [map]);

  return null;
}

export default function MapClient() {
  const mapRef = useRef<L.Map | null>(null);
  const onMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const flyTo = useMapStore((state) => state.flyTo);
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  const userLocation = useMapStore((state) => state.userLocation);
  const userAccuracy = useMapStore((state) => state.userAccuracy);
  const locationSource = useMapStore((state) => state.locationSource);
  const locationLabel = useMapStore((state) => state.locationLabel);
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const calibrateUserLocation = useMapStore((state) => state.calibrateUserLocation);
  const resetToBrowserGps = useMapStore((state) => state.resetToBrowserGps);
  const loadSavedLocation = useMapStore((state) => state.loadSavedLocation);
  const openCalibrationModal = useMapStore((state) => state.openCalibrationModal);
  const setIsLowAccuracy = useMapStore((state) => state.setIsLowAccuracy);
  const isLocating = useMapStore((state) => state.isLocating);
  const setIsLocating = useMapStore((state) => state.setIsLocating);
  const acquisitionStage = useMapStore((state) => state.acquisitionStage);
  const setAcquisitionStage = useMapStore((state) => state.setAcquisitionStage);
  const activeRequestId = useMapStore((state) => state.activeRequestId);
  const incrementRequestId = useMapStore((state) => state.incrementRequestId);
  const setActiveWatchId = useMapStore((state) => state.setActiveWatchId);
  const isLiveTracking = useMapStore((state) => state.isLiveTracking);
  const trackingStatus = useMapStore((state) => state.trackingStatus);
  const isFollowingUser = useMapStore((state) => state.isFollowingUser);
  const startLiveTracking = useMapStore((state) => state.startLiveTracking);
  const stopLiveTracking = useMapStore((state) => state.stopLiveTracking);
  const recenterOnUser = useMapStore((state) => state.recenterOnUser);

  const incidents = useIncidentStore((state) => state.incidents);
  const safeZones = useIncidentStore((state) => state.safeZones);
  const fetchAllIncidents = useIncidentStore((state) => state.fetchAllIncidents);
  const fetchSafeZones = useIncidentStore((state) => state.fetchSafeZones);
  const initSocketListeners = useIncidentStore((state) => state.initSocketListeners);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const { selectedSeverity, selectedCategories, searchQuery } = useFilterStore();
  const { language } = useLanguageStore();
  const t = getTranslation(language);
  const isBn = language === "bn";

  // Tactical Layer States
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showDangerCircles, setShowDangerCircles] = useState(true);
  const hasAutoLocatedRef = useRef(false);
  const geoPermissionStateRef = useRef<PermissionState | null>(null);
  const hasInitialAutoZoomedRef = useRef(false);
  const hasUserPannedMapRef = useRef(false);

  // Proximity Danger Notification Controls & States
  const [isAudioAlertMuted, setIsAudioAlertMuted] = useState(isAudioMuted);

  const handleToggleAudioMute = useCallback(() => {
    const next = !isAudioAlertMuted;
    setIsAudioAlertMuted(next);
    setAudioMuted(next);
  }, [isAudioAlertMuted]);

  // AudioContext unlock on initial user gesture (click, touchstart, keydown) to comply with browser autoplay
  useEffect(() => {
    const handleGestureUnlock = () => {
      unlockAudioContext();
    };
    window.addEventListener("click", handleGestureUnlock, { passive: true });
    window.addEventListener("touchstart", handleGestureUnlock, { passive: true });
    window.addEventListener("keydown", handleGestureUnlock, { passive: true });
    return () => {
      window.removeEventListener("click", handleGestureUnlock);
      window.removeEventListener("touchstart", handleGestureUnlock);
      window.removeEventListener("keydown", handleGestureUnlock);
    };
  }, []);

  // Proximity Alert Detection Engine Integration
  const {
    activeAlerts,
    closestAlert,
    dismissAlert,
  } = useHazardProximityAlert({
    enabled: isLiveTracking || !!userLocation,
    onAlert: useCallback((item: ProximityAlertItem) => {
      // 1. Web Audio API synthesizer dual-pulse 800 Hz chime
      playDangerAlertSound({ isMuted: isAudioMuted() });
      // 2. Mobile haptic vibration pattern [300, 150, 300]
      triggerDangerVibration();
      // 3. Browser system notification
      showDangerSystemNotification(item.hazard, item.distanceMeters);
    }, []),
  });

  // Mount: fetch nationwide incidents across Bangladesh, verified safe zones, and start socket listeners
  useEffect(() => {
    fetchAllIncidents();
    fetchSafeZones();
    initSocketListeners();
  }, [fetchAllIncidents, fetchSafeZones, initSocketListeners]);

  // Filter incidents based on active global filter states
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident: DangerIncident) => {
      // Strictly enforce active threat status: exclude resolved, historical, ambiguous, or review items from map
      if (incident.threatStatus && incident.threatStatus !== "ACTIVE") {
        return false;
      }
      if (incident.locationPrecision === "AMBIGUOUS") {
        return false;
      }
      if (incident.status === "resolved") {
        return false;
      }
      if (incident.expiresAt && new Date(incident.expiresAt).getTime() <= Date.now()) {
        return false;
      }
      if (
        selectedSeverity !== "all" &&
        incident.severity.toUpperCase() !== selectedSeverity.toUpperCase()
      ) {
        return false;
      }
      if (!isIncidentCategoryMatch(incident.category, selectedCategories)) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesTitle =
          incident.title.toLowerCase().includes(q) ||
          (incident.titleBn && incident.titleBn.toLowerCase().includes(q));
        const matchesLoc =
          incident.locationName.toLowerCase().includes(q) ||
          (incident.locationNameBn && incident.locationNameBn.toLowerCase().includes(q));
        if (!matchesTitle && !matchesLoc) return false;
      }
      return true;
    });
  }, [incidents, selectedSeverity, selectedCategories, searchQuery]);

  // Deduplicate and cluster coincident danger perimeter circles to avoid dense multi-ring red blobs
  const dangerPerimeterCircles = useMemo(() => {
    if (!showDangerCircles) return [];
    const circles: { id: string; center: [number, number]; radius: number }[] = [];

    const getDistM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = (lat2 - lat1) * 111320;
      const dLng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };

    for (const inc of filteredIncidents) {
      const isHigh =
        inc.severity.toUpperCase() === 'HIGH' || inc.severity.toLowerCase() === 'critical';
      if (!isHigh) continue;

      const incRadius = inc.fuzzedRadiusMeters || 150;
      // Merge circles within 250m into a single clean hotspot perimeter
      const existing = circles.find(
        (c) => getDistM(c.center[0], c.center[1], inc.coordinates.lat, inc.coordinates.lng) < 250
      );

      if (existing) {
        existing.radius = Math.max(existing.radius, incRadius);
      } else {
        circles.push({
          id: `circle-${inc.id}`,
          center: [inc.coordinates.lat, inc.coordinates.lng],
          radius: incRadius,
        });
      }
    }
    return circles;
  }, [filteredIncidents, showDangerCircles]);


  const adjustCameraForAccuracy = useCallback(
    (coords: { lat: number; lng: number }, acc: number | null) => {
      // Determine appropriate zoom level based on GPS accuracy:
      // High accuracy (<= 30m): zoom 17 (close street / building level)
      // Moderate accuracy (<= 100m, e.g. 30-80m): zoom 16 (neighborhood / road level)
      // Coarse / low accuracy (> 100m): zoom 15 (general vicinity level)
      const targetZoom = acc !== null && acc <= 30 ? 17 : acc !== null && acc <= 100 ? 16 : 15;
      flyTo(coords, targetZoom);
    },
    [flyTo]
  );

  const activeWatchIdRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bestAccuracyRef = useRef<number>(Infinity);

  const stopActiveAcquisition = useCallback(() => {
    if (activeWatchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(activeWatchIdRef.current);
      } catch {
        // ignore
      }
      activeWatchIdRef.current = null;
    }
    setActiveWatchId(null);
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, [setActiveWatchId]);

  // Immediate watch cancellation when manual calibration occurs
  useEffect(() => {
    if (locationSource === 'calibrated') {
      stopActiveAcquisition();
      setIsLocating(false);
    }
  }, [locationSource, stopActiveAcquisition, setIsLocating]);

  // Cleanup active geolocation on component unmount
  useEffect(() => {
    return () => {
      stopActiveAcquisition();
      useMapStore.getState().stopLiveTracking();
    };
  }, [stopActiveAcquisition]);

  const fallbackToSavedOrModal = useCallback(() => {
    const saved = loadSavedLocation();
    if (saved && isWithinBangladesh(saved.lat, saved.lng)) {
      stopActiveAcquisition();
      setIsLocating(false);
      setUserLocation(
        { lat: saved.lat, lng: saved.lng },
        saved.accuracy || 25,
        'calibrated',
        saved.label
      );
      flyTo({ lat: saved.lat, lng: saved.lng }, 17);
    } else {
      openCalibrationModal();
    }
  }, [loadSavedLocation, setUserLocation, flyTo, openCalibrationModal, stopActiveAcquisition, setIsLocating]);

  // Request browser geolocation (manual button click or auto-mount): High-accuracy with progressive GPS refinement loop
  const handleLocateMe = useCallback(
    (options?: { isAuto?: boolean }) => {
      const isAuto = options?.isAuto ?? false;

      // User requested location: reset manual pan camera suppression
      hasUserPannedMapRef.current = false;

      // 1. Invalidate previous in-flight callbacks and stop any existing watch/timer
      stopActiveAcquisition();
      const reqId = incrementRequestId();

      // If user already has a calibrated location pin, smoothly fly to it
      if (useMapStore.getState().locationSource === "calibrated") {
        const loc = useMapStore.getState().userLocation;
        if (loc && isWithinBangladesh(loc.lat, loc.lng)) {
          flyTo(loc, 17);
          return;
        }
      }

      // If user already has a valid position in store, smoothly fly to it immediately
      const hasExistingLocation = useMapStore.getState().centerOnUserLocation();
      if (hasExistingLocation) {
        // Position is already known and displayed. In the background, request fresh coordinates
        // without disruptive spinners or watchdog timeout warnings.
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (useMapStore.getState().activeRequestId !== reqId) return;
              if (useMapStore.getState().locationSource === "calibrated") return;
              if (!isFreshPosition(pos.timestamp)) return;

              const coords = {
                lat: formatCoordinate(pos.coords.latitude),
                lng: formatCoordinate(pos.coords.longitude),
              };
              const acc = sanitizeAccuracy(pos.coords.accuracy);
              if (!isWithinBangladesh(coords.lat, coords.lng)) return;

              setUserLocation(coords, acc, "gps", undefined, pos.timestamp || Date.now());
              if (!hasUserPannedMapRef.current) {
                adjustCameraForAccuracy(coords, acc);
              }
            },
            (err) => {
              console.info("[Geo] Background position refresh notice:", err.message);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
          );
        }
        return;
      }

      bestAccuracyRef.current = Infinity;

      // 2. Check for Secure Context on mobile (iOS/Android block geolocation on insecure HTTP)
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        if (!isAuto) {
          showToast(
            isBn
              ? geoTranslations.bn.status.insecureContext
              : geoTranslations.en.status.insecureContext,
            "warning",
            6000
          );
          openCalibrationModal();
        }
        return;
      }

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        if (!isAuto) {
          fallbackToSavedOrModal();
        }
        return;
      }

      setIsLocating(true);
      setAcquisitionStage("acquiring");

      // Coarse fallback helper (for Android indoor errors code 2/3 or watchdog cutoff without any fix)
      const triggerCoarseFallback = () => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          if (!isAuto) fallbackToSavedOrModal();
          return;
        }
        setIsLocating(true);
        setAcquisitionStage("refining");
        navigator.geolocation.getCurrentPosition(
          (coarsePos) => {
            if (useMapStore.getState().activeRequestId !== reqId) return;
            if (useMapStore.getState().locationSource === "calibrated") return;

            const coords = {
              lat: formatCoordinate(coarsePos.coords.latitude),
              lng: formatCoordinate(coarsePos.coords.longitude),
            };
            const acc = sanitizeAccuracy(coarsePos.coords.accuracy);

            if (!isWithinBangladesh(coords.lat, coords.lng)) {
              if (!isAuto) fallbackToSavedOrModal();
              return;
            }

            setUserLocation(coords, acc, "gps", undefined, coarsePos.timestamp || Date.now());
            if (!hasUserPannedMapRef.current || !hasInitialAutoZoomedRef.current) {
              adjustCameraForAccuracy(coords, acc);
              hasInitialAutoZoomedRef.current = true;
            }
            setIsLocating(false);
            setAcquisitionStage("timeout");
            setIsLowAccuracy(true);
            if (!isAuto) {
              showToast(
                (isBn ? geoTranslations.bn.status.weakGps : geoTranslations.en.status.weakGps).replace(
                  "{acc}",
                  acc ? Math.round(acc).toString() : "—"
                ),
                "warning",
                5000
              );
              openCalibrationModal();
            }
          },
          () => {
            stopActiveAcquisition();
            setIsLocating(false);
            setAcquisitionStage("error");
            if (!isAuto) {
              fallbackToSavedOrModal();
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      };

      // 3. Start Watchdog Timer (15s) to prevent runaway battery drain or infinite spinner
      watchdogTimerRef.current = setTimeout(() => {
        if (useMapStore.getState().activeRequestId === reqId) {
          stopActiveAcquisition();
          setIsLocating(false);
          const currentStage = useMapStore.getState().acquisitionStage;
          if (currentStage === "acquiring" || currentStage === "refining") {
            if (bestAccuracyRef.current === Infinity && !useMapStore.getState().userLocation) {
              triggerCoarseFallback();
            } else {
              setAcquisitionStage("timeout");
              const currentAcc = useMapStore.getState().userAccuracy;
              if (currentAcc !== null && currentAcc <= 50) {
                showToast(
                  (isBn ? geoTranslations.bn.status.goodAccuracy : geoTranslations.en.status.goodAccuracy).replace(
                    "{acc}",
                    Math.round(currentAcc).toString()
                  ),
                  "success",
                  3500
                );
              } else {
                if (!isAuto) {
                  showToast(
                    isBn ? geoTranslations.bn.status.timeout : geoTranslations.en.status.timeout,
                    "info",
                    4000
                  );
                }
              }
            }
          }
        }
      }, 15000);

      // 4. Position update handler with timestamp freshness, accuracy progression, and concurrency guards
      const onPositionUpdate = (pos: GeolocationPosition) => {
        // Concurrency check: discard obsolete callbacks
        if (useMapStore.getState().activeRequestId !== reqId) {
          return;
        }

        // If watch has been stopped or cleared, ignore trailing callback
        if (activeWatchIdRef.current === null) {
          return;
        }

        // Calibration check: in-flight GPS cannot overwrite user-calibrated location
        if (useMapStore.getState().locationSource === "calibrated") {
          stopActiveAcquisition();
          setIsLocating(false);
          return;
        }

        // Timestamp freshness check: reject readings older than 30 seconds or invalid non-positive timestamps
        if (!isFreshPosition(pos.timestamp)) {
          console.warn("[MapClient] Discarding stale position fix older than 30s or non-positive timestamp:", pos.timestamp);
          return;
        }

        geoPermissionStateRef.current = "granted";
        const coords = {
          lat: formatCoordinate(pos.coords.latitude),
          lng: formatCoordinate(pos.coords.longitude),
        };
        const acc = sanitizeAccuracy(pos.coords.accuracy);

        // Accuracy improvement check: only update active coordinate if this fix improves or confirms accuracy
        const candidateAcc = acc ?? 1000;
        if (candidateAcc > bestAccuracyRef.current) {
          // Degraded reading; preserve superior fix
          return;
        }

        bestAccuracyRef.current = candidateAcc;

        if (!isWithinBangladesh(coords.lat, coords.lng)) {
          stopActiveAcquisition();
          setIsLocating(false);
          setAcquisitionStage("error");
          if (!isAuto) {
            openCalibrationModal();
          } else {
            console.info("[Geo] Device is outside Bangladesh boundaries. Displaying national view.");
          }
          return;
        }

        // Commit to store
        setUserLocation(coords, acc, "gps", undefined, pos.timestamp || Date.now());

        // Adjust camera viewport dynamically:
        // Always auto-zoom on initial acquisition; suppress camera snatching if user has manually panned away
        if (!hasUserPannedMapRef.current || !hasInitialAutoZoomedRef.current) {
          adjustCameraForAccuracy(coords, acc);
          hasInitialAutoZoomedRef.current = true;
        }

        // Clean termination when target high accuracy (<= 15m) is achieved
        if (acc !== null && acc <= 15) {
          stopActiveAcquisition();
          setIsLocating(false);
          setAcquisitionStage("success");
          showToast(
            (isBn ? geoTranslations.bn.status.highAccuracy : geoTranslations.en.status.highAccuracy).replace(
              "{acc}",
              Math.round(acc).toString()
            ),
            "success",
            3000
          );
        } else {
          setAcquisitionStage("refining");
        }
      };

      const onPositionError = (err: GeolocationPositionError) => {
        if (useMapStore.getState().activeRequestId !== reqId) {
          return;
        }

        // If we already have an acceptable fix in this session, keep it rather than failing
        if (bestAccuracyRef.current < Infinity && useMapStore.getState().userLocation) {
          stopActiveAcquisition();
          setIsLocating(false);
          setAcquisitionStage("timeout");
          return;
        }

        // If Android error code 2 (POSITION_UNAVAILABLE) or code 3 (TIMEOUT), trigger coarse fallback!
        if (err.code === 2 || err.code === 3) {
          stopActiveAcquisition();
          triggerCoarseFallback();
          return;
        }

        stopActiveAcquisition();
        setIsLocating(false);
        setAcquisitionStage("error");

        if (err.code === 1) {
          // PERMISSION_DENIED
          geoPermissionStateRef.current = "denied";
          if (!isAuto) {
            showToast(
              isBn
                ? geoTranslations.bn.status.denied + "\n\n" + "আধুনিক অ্যান্ড্রয়েডে স্ক্রিনে কোনো ভাসমান বাবল/চ্যাট হেড চালু থাকলে বন্ধ করুন।"
                : geoTranslations.en.status.denied + "\n\n" + "On Android 12+, close any floating bubbles/overlays before granting permission.",
              "warning",
              8000
            );
            fallbackToSavedOrModal();
          } else {
            console.info("[Geo] Auto-location permission denied or dismissed.");
          }
        } else {
          if (!isAuto) {
            showToast(
              isBn ? geoTranslations.bn.status.weakGps.replace("{acc}", "—") : geoTranslations.en.status.weakGps.replace("{acc}", "—"),
              "warning",
              5000
            );
            fallbackToSavedOrModal();
          } else {
            console.info("[Geo] Auto-location position error:", err.message);
          }
        }
      };

      // Progressive refinement loop via watchPosition
      try {
        const watchId = navigator.geolocation.watchPosition(
          onPositionUpdate,
          onPositionError,
          { enableHighAccuracy: true, maximumAge: 0 }
        );
        activeWatchIdRef.current = watchId;
        setActiveWatchId(watchId);
      } catch (e) {
        console.warn("[MapClient] watchPosition error:", e);
        triggerCoarseFallback();
      }
    },
    [
      stopActiveAcquisition,
      setActiveWatchId,
      incrementRequestId,
      isBn,
      openCalibrationModal,
      fallbackToSavedOrModal,
      setIsLocating,
      setAcquisitionStage,
      setUserLocation,
      flyTo,
      adjustCameraForAccuracy,
      setIsLowAccuracy,
    ]
  );

  // Auto-detect location on mount:
  // - On mobile: immediately initiate location detection and auto-zoom to user position
  // - On desktop: initiate location detection if permission is already granted
  useEffect(() => {
    if (typeof window === "undefined" || hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;
    useMapStore.getState().setHasAutoLocated(true);

    // 1. Check if user previously calibrated their location in localStorage
    const saved = loadSavedLocation();
    const hasCalibrated = !!(saved && isWithinBangladesh(saved.lat, saved.lng));
    if (hasCalibrated && saved) {
      setUserLocation(
        { lat: saved.lat, lng: saved.lng },
        saved.accuracy || 25,
        'calibrated',
        saved.label
      );
      flyTo({ lat: saved.lat, lng: saved.lng }, 17);
      return;
    }

    const isMobile = isMobileDevice();

    const startAutoLocation = () => {
      handleLocateMe({ isAuto: true });
    };

    if (isMobile) {
      startAutoLocation();
      return;
    }

    // 2. Desktop: track permission state and auto-locate if permission is granted
    let permStatus: PermissionStatus | null = null;
    const handlePermChange = () => {
      if (permStatus) {
        geoPermissionStateRef.current = permStatus.state;
        if (permStatus.state === 'granted' && !useMapStore.getState().userLocation) {
          startAutoLocation();
        }
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permStatus = status;
          geoPermissionStateRef.current = status.state;
          status.addEventListener('change', handlePermChange);

          if (status.state === 'granted') {
            startAutoLocation();
          }
        })
        .catch(() => {
          // Permissions API unsupported on desktop
        });
    }

    return () => {
      if (permStatus) {
        permStatus.removeEventListener('change', handlePermChange);
      }
    };
  }, [flyTo, loadSavedLocation, setUserLocation, handleLocateMe]);

  // Re-query fresh browser GPS (clearing any saved calibration)
  const handleForceGpsRefresh = useCallback(() => {
    resetToBrowserGps();
    hasInitialAutoZoomedRef.current = false;
    hasUserPannedMapRef.current = false;
    handleLocateMe();
  }, [resetToBrowserGps, handleLocateMe]);

  // User GPS Pin icon (Dynamic icon: Green star badge for calibrated, emerald beacon for live tracking, blue for network GPS)
  const userGpsIcon = useMemo(() => {
    const isCalibrated = locationSource === 'calibrated';
    const isLive = isLiveTracking;
    const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const liveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/></svg>`;

    const pinColor = isCalibrated ? '#059669' : isLive ? (trackingStatus === 'paused' ? '#D97706' : '#059669') : '#2563EB';
    const sonarColor = isCalibrated ? '#10B981' : isLive ? (trackingStatus === 'paused' ? '#F59E0B' : '#10B981') : '#3B82F6';
    const shadowColor = isCalibrated ? 'rgba(5, 150, 105, 0.7)' : isLive ? (trackingStatus === 'paused' ? 'rgba(217, 119, 6, 0.7)' : 'rgba(5, 150, 105, 0.7)') : 'rgba(37, 99, 235, 0.7)';

    return L.divIcon({
      className: "user-gps-pulse",
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: transform 0.25s linear;">
          <span class="user-gps-sonar" style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: ${sonarColor};
            opacity: 0.65;
          "></span>
          <div style="
            position: relative;
            background-color: ${pinColor};
            border: 2.5px solid #FFFFFF;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            box-shadow: 0 0 14px ${shadowColor};
          ">
            ${isCalibrated ? starSvg : isLive ? liveSvg : pinSvg}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });
  }, [locationSource, isLiveTracking, trackingStatus]);

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-100">
      {/* Floating Tactical Command HUD Dock (Adaptive: Spans full width on mobile, top-right on desktop) */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 z-[400] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100%-1.5rem)] sm:max-w-md">
        {/* Quick Place Search on Live Map */}
        <div className="pointer-events-auto w-full sm:w-72 md:w-80 shadow-md">
          <LocationSearchBar
            onSelectLocation={(loc: GeocodedLocation) => {
              flyTo({ lat: loc.lat, lng: loc.lng }, 17);
            }}
          />
        </div>

        {/* Layer & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-md">
          {/* Map Layer Switcher (Google Streets / Hybrid / OSM) */}
          <MapLayerSwitcher />

          {/* Dedicated Continuous Live Tracking Mode Toggle */}
          <button
            type="button"
            onClick={async () => {
              // Unlock audio synthesizer and prompt system notification permission on user gesture
              unlockAudioContext();
              requestNotificationPermission().catch(() => {});

              if (isLiveTracking) {
                stopLiveTracking();
                showToast(
                  isBn ? "লাইভ জিপিএস ট্র্যাকিং বন্ধ করা হয়েছে।" : "Live GPS tracking stopped.",
                  "info",
                  3000
                );
              } else {
                const ok = await startLiveTracking();
                if (ok) {
                  hasUserPannedMapRef.current = false;
                  showToast(
                    isBn ? "লাইভ জিপিএস ট্র্যাকিং সক্রিয় হয়েছে।" : "Live GPS tracking active.",
                    "success",
                    3000
                  );
                } else {
                  showToast(
                    isBn
                      ? "লাইভ জিপিএস ট্র্যাকিং শুরু করা সম্ভব হয়নি। লোকেশন পারমিশন পরীক্ষা করুন।"
                      : "Could not start Live GPS tracking. Please check location permissions.",
                    "warning",
                    5000
                  );
                }
              }
            }}
            aria-label={
              isLiveTracking
                ? (isBn ? "লাইভ ট্র্যাকিং বন্ধ করুন" : "Stop Live Tracking")
                : (isBn ? "লাইভ জিপিএস ট্র্যাকিং চালু করুন" : "Start Live Tracking")
            }
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
              isLiveTracking
                ? trackingStatus === "active"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-400/50"
                  : trackingStatus === "paused"
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                  : "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title={
              isLiveTracking
                ? trackingStatus === "active"
                  ? isBn ? "লাইভ ট্র্যাকিং সক্রিয় (বন্ধ করতে ক্লিক করুন)" : "Live Tracking Active (Click to stop)"
                  : trackingStatus === "paused"
                  ? isBn ? "ট্র্যাকিং স্থগিত (পুনরায় কেন্দ্র করতে ক্লিক করুন)" : "Tracking Paused (Pan detected)"
                  : isBn ? "ট্র্যাকিং অনুপলব্ধ" : "Tracking Unavailable"
                : isBn ? "লাইভ জিপিএস ট্র্যাকিং শুরু করুন" : "Start Live GPS Tracking"
            }
          >
            <Radio className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiveTracking && trackingStatus === "active" ? "animate-pulse text-white" : ""}`} />
            <span className="hidden sm:inline text-xs">
              {isLiveTracking
                ? trackingStatus === "active"
                  ? (isBn ? "লাইভ" : "Live")
                  : trackingStatus === "paused"
                  ? (isBn ? "স্থগিত" : "Paused")
                  : (isBn ? "অনুপলব্ধ" : "Unavailable")
                : (isBn ? "লাইভ ট্র্যাক" : "Live Track")}
            </span>
          </button>

          {/* Follow Me / Recenter Button (visible during Live Tracking) */}
          {isLiveTracking && (
            <button
              type="button"
              onClick={() => {
                hasUserPannedMapRef.current = false;
                recenterOnUser();
                showToast(
                  isBn ? "ক্যামেরা আপনার অবস্থানে কেন্দ্রীভূত হয়েছে।" : "Camera re-centered on your location.",
                  "info",
                  2000
                );
              }}
              className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                isFollowingUser
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  : "bg-amber-50 text-amber-900 border border-amber-300 animate-pulse hover:bg-amber-100"
              }`}
              title={
                isFollowingUser
                  ? isBn ? "ক্যামেরা আপনাকে অনুসরণ করছে" : "Camera Following You"
                  : isBn ? "ক্যামেরা পুনরায় আপনার অবস্থানে কেন্দ্র করুন (ফলো মি)" : "Recenter Camera / Follow Me"
              }
            >
              <Navigation className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFollowingUser ? "text-emerald-600" : "text-amber-600"}`} />
              <span className="hidden sm:inline text-xs">
                {isFollowingUser
                  ? (isBn ? "ফলো" : "Following")
                  : (isBn ? "পুনরায় কেন্দ্র" : "Recenter")}
              </span>
            </button>
          )}

          {/* Locate Me (GPS / Calibrated Location) */}
          <button
            type="button"
            onClick={() => handleLocateMe()}
            aria-label={
              locationSource === 'calibrated'
                ? (isBn ? "সংরক্ষিত সঠিক অবস্থান" : "Saved Calibrated Location")
                : (isBn ? "আমার অবস্থান সনাক্ত করুন" : "Locate Me")
            }
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
              userLocation
                ? locationSource === 'calibrated'
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title={
              isLocating
                ? acquisitionStage === 'refining'
                  ? isBn
                    ? geoTranslations.bn.status.refining.replace('{acc}', userAccuracy ? Math.round(userAccuracy).toString() : '...')
                    : geoTranslations.en.status.refining.replace('{acc}', userAccuracy ? Math.round(userAccuracy).toString() : '...')
                  : isBn ? geoTranslations.bn.status.acquiring : geoTranslations.en.status.acquiring
                : locationSource === 'calibrated'
                  ? isBn ? "সংরক্ষিত সঠিক অবস্থান" : "Saved Calibrated Location"
                  : isBn ? "আমার অবস্থান সনাক্ত করুন" : "Locate Me (Current GPS)"
            }
          >
            {isLocating ? (
              <Loader2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin ${userLocation ? "text-white" : "text-blue-600"}`} />
            ) : locationSource === 'calibrated' ? (
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            ) : (
              <Crosshair className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${userLocation ? "text-white" : "text-blue-600"}`} />
            )}
            <span className="hidden sm:inline text-xs">
              {isLocating
                ? acquisitionStage === 'refining'
                  ? isBn ? "উন্নত হচ্ছে..." : "Refining..."
                  : isBn ? "সনাক্ত হচ্ছে..." : "Locating..."
                : locationSource === 'calibrated'
                  ? isBn ? "সঠিক অবস্থান" : "Calibrated"
                  : isBn ? "আমার অবস্থান" : "My Location"}
            </span>
          </button>

          {/* Calibrate / Pinpoint Exact Location Button */}
          <button
            type="button"
            onClick={openCalibrationModal}
            className="p-1.5 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
            title={isBn ? "সঠিক অবস্থান নির্ধারণ / পরিবর্তন" : "Calibrate / Pinpoint Real Location"}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </button>

          {userLocation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUserLocation(null);
              }}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              title={isBn ? "অবস্থান পিন মুছুন" : "Dismiss My Location"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Safe Havens Toggle */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
              showSafeZones
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Toggle Safe Havens (Police & Hospitals)"
          >
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            <span className="hidden sm:inline text-xs">
              {isBn ? "আশ্রয়স্থল" : "Safe Havens"}
            </span>
          </button>

          {/* Danger Perimeter Toggle (150m Red Zone Radius) */}
          <button
            onClick={() => setShowDangerCircles(!showDangerCircles)}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
              showDangerCircles
                ? "bg-red-50 text-red-800 border border-red-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Toggle 150m Hazard Danger Perimeters"
          >
            {showDangerCircles ? (
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            )}
            <span className="hidden sm:inline text-xs">
              {isBn ? "ঝুঁকি বলয়" : "Perimeters"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Leaflet Map Container */}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={5}
        maxZoom={20}
        attributionControl={false}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <MapInstanceRegistrar onMapReady={onMapReady} />
        <MapViewUpdater />
        <MapEventsHandler
          onUserDragStart={() => {
            hasUserPannedMapRef.current = true;
            if (useMapStore.getState().isLiveTracking) {
              useMapStore.getState().setIsFollowingUser(false);
              useMapStore.getState().setTrackingStatus("paused");
            }
          }}
        />
        <MapResizeHandler />

        {/* Zoom Control repositioned neatly at bottom-left */}
        <ZoomControl position="bottomleft" />

        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        {/* User GPS Pin & Accuracy Radar Circle */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={computeAccuracyCircleRadius(locationSource, userAccuracy)}
              pathOptions={{
                color: locationSource === 'calibrated' ? "#059669" : "#2563EB",
                fillColor: locationSource === 'calibrated' ? "#10B981" : "#3B82F6",
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: "4, 6",
              }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userGpsIcon}
              zIndexOffset={2000}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  if (marker) {
                    const newPos = marker.getLatLng();
                    if (isWithinBangladesh(newPos.lat, newPos.lng)) {
                      calibrateUserLocation(
                        { lat: newPos.lat, lng: newPos.lng },
                        isBn ? "টেনে নির্ধারিত অবস্থান" : "Calibrated Location Pin"
                      );
                      showToast(
                        isBn ? "সঠিক অবস্থান সংরক্ষিত হয়েছে।" : "Location calibrated and saved.",
                        "success",
                        3000
                      );
                    } else {
                      marker.setLatLng([userLocation.lat, userLocation.lng]);
                      showToast(
                        isBn
                          ? "নির্বাচিত অবস্থানটি বাংলাদেশের সীমানার বাইরে।"
                          : "Selected position is outside Bangladesh territory.",
                        "warning",
                        4000
                      );
                    }
                  }
                },
              }}
            >
              <Popup autoPanPadding={[24, 24]}>
                <div className="p-3 min-w-[240px] max-w-[280px] text-slate-800 text-xs space-y-2 font-sans">
                  {/* Status Header */}
                  <div className="flex items-center justify-between gap-1">
                    {isLiveTracking ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        trackingStatus === 'active'
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : trackingStatus === 'paused'
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}>
                        {trackingStatus === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />}
                        <span>
                          {trackingStatus === 'active'
                            ? (isBn ? "📡 লাইভ জিপিএস (সক্রিয়)" : "📡 Live GPS (Active)")
                            : trackingStatus === 'paused'
                            ? (isBn ? "⏸️ লাইভ জিপিএস (স্থগিত)" : "⏸️ Live GPS (Paused)")
                            : (isBn ? "⚠️ লাইভ জিপিএস (অনুপলব্ধ)" : "⚠️ Live GPS (Unavailable)")}
                        </span>
                      </span>
                    ) : locationSource === 'calibrated' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>{isBn ? "ক্যালিব্রেটেড (সংরক্ষিত)" : "Calibrated (Saved)"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        <span>📡 {isBn ? "ব্রাউজার নেটওয়ার্ক জিপিএস" : "Browser Network GPS"}</span>
                      </span>
                    )}

                    {userAccuracy !== null && userAccuracy >= 0 && locationSource !== 'calibrated' && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ±{Math.round(userAccuracy)}m
                      </span>
                    )}
                  </div>

                  {/* Coordinates & Landmark Label */}
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{locationLabel || (isBn ? "আপনার বর্তমান অবস্থান" : "Your Location")}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                    </p>
                  </div>

                  {/* Guidance Box */}
                  <div className={`p-2 rounded-xl text-[10.5px] leading-relaxed border ${
                    locationSource === 'calibrated'
                      ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-900"
                      : "bg-blue-50/80 border-blue-200/80 text-blue-900"
                  }`}>
                    {locationSource === 'calibrated' ? (
                      <span>
                        {isBn
                          ? "✓ আপনার সঠিক অবস্থান ব্রাউজারে সংরক্ষিত রয়েছে। রিলোড করলেও এটি মনে থাকবে।"
                          : "✓ Your calibrated location is saved permanently in this browser across refreshes."}
                      </span>
                    ) : (
                      <span>
                        {isBn
                          ? "💡 ব্রাউজার ওয়াইফাই/আইএসপির কারণে অবস্থান ভুল হলে পিনটি টেনে আপনার সঠিক স্থান বা রাস্তায় বসান।"
                          : "💡 Inaccurate due to ISP Wi-Fi? Drag this pin to your exact building or street to calibrate."}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-1 space-y-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={openCalibrationModal}
                      className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{isBn ? "সঠিক অবস্থান নির্বাচন / অনুসন্ধান" : "Calibrate / Search Real Spot"}</span>
                    </button>

                    {locationSource === 'calibrated' && (
                      <button
                        type="button"
                        onClick={handleForceGpsRefresh}
                        className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>{isBn ? "ব্রাউজার জিপিএসে ফিরুন" : "Reset to Browser GPS"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setUserLocation(null)}
                      className="w-full text-[11px] font-bold text-red-600 hover:bg-red-50 py-1 rounded-lg border border-red-200 transition-colors cursor-pointer"
                    >
                      {isBn ? "অবস্থান পিন সরান" : "Remove Location Pin"}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Render Verified Safe Zones */}
        {showSafeZones &&
          safeZones.map((zone) => {
            const zoneMeta = getSafeZonePresentation(zone.type, language);
            return (
              <Marker
                key={`safe-zone-${zone.id}`}
                position={[zone.latitude, zone.longitude]}
                icon={createSafeZoneIcon(zone.type)}
              >
                <Popup autoPanPadding={[24, 24]}>
                  <div className="p-3 max-w-[260px] text-slate-900">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${zoneMeta.badgeClass}`}>
                        {zoneMeta.label}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold">✓ Verified Haven</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">{zone.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Designated 24/7 sanctuary point during emergencies.
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <Link
                        href="/safe-zones"
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                      >
                        <span>All Safe Havens</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Render Deduplicated Danger Perimeter Circles (Clean cartographic perimeters without blob stacking) */}
        {dangerPerimeterCircles.map((circle) => (
          <Circle
            key={circle.id}
            center={circle.center}
            radius={circle.radius}
            pathOptions={{
              color: "#DC2626",
              fillColor: "#DC2626",
              fillOpacity: 0.11,
              weight: 1.5,
              dashArray: "4, 4",
            }}
          />
        ))}

        {/* Render Live Danger Incident Markers */}
        {filteredIncidents.map((incident: DangerIncident) => {
          const icon = createDangerMarkerIcon(incident.category, incident.severity, zoom);
          const isHigh =
            incident.severity.toUpperCase() === "HIGH" || incident.severity.toLowerCase() === "critical";
          const isMed = incident.severity.toUpperCase() === "MEDIUM";
          const tooltipOffset = zoom <= 11 ? 11 : zoom <= 14 ? 14 : 16;

          return (
            <Fragment key={incident.id}>
              <Marker
                position={[incident.coordinates.lat, incident.coordinates.lng]}
                icon={icon}
                zIndexOffset={isHigh ? 500 : isMed ? 200 : 50}
                eventHandlers={{
                  mouseover: (e) => {
                    e.target.setZIndexOffset(10000);
                  },
                  mouseout: (e) => {
                    e.target.setZIndexOffset(isHigh ? 500 : isMed ? 200 : 50);
                  },
                }}
              >
                {/* Tactical Quick-Glance Tooltip on Desktop */}
                <Tooltip
                  direction="top"
                  offset={[0, -tooltipOffset - 4]}
                  opacity={0.96}
                  className="tactical-marker-tooltip"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isHigh ? "bg-rose-500" : isMed ? "bg-orange-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="font-bold">
                      {formatCategoryLabel(incident.category, language)}
                    </span>
                    <span className="text-slate-400 font-normal">|</span>
                    <span className="text-slate-200 truncate max-w-[240px]">
                      {cleanIncidentTitle(isBn && incident.titleBn ? incident.titleBn : incident.title)}
                    </span>
                  </div>
                </Tooltip>

                <Popup autoPanPadding={[24, 24]}>
                  <div className="p-3.5 min-w-[280px] sm:min-w-[300px] max-w-[320px] text-slate-900 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 pr-6">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isHigh
                            ? "bg-red-50 text-red-700 border-red-200 font-black"
                            : isMed
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-yellow-50 text-yellow-800 border-yellow-200"
                        }`}
                      >
                        {isHigh && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                        {(t.severity as any)[incident.severity.toLowerCase()] || incident.severity}
                      </span>

                      {(() => {
                        const PopupCatIcon = getCategoryIcon(incident.category);
                        const catBadgeClass = getCategoryBadgeClass(incident.category);
                        return (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${catBadgeClass}`}
                          >
                            <PopupCatIcon className="w-3 h-3 shrink-0" />
                            <span>{formatCategoryLabel(incident.category, language)}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-sm leading-snug text-slate-900">
                      {cleanIncidentTitle(isBn && incident.titleBn ? incident.titleBn : incident.title)}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {cleanIncidentTitle(isBn && incident.descriptionBn
                        ? incident.descriptionBn
                        : incident.description)}
                    </p>

                    {/* Landmark / Source */}
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="truncate flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate font-medium text-slate-700">{incident.locationName}</span>
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold shrink-0 ml-1">
                        {incident.reportedBy}
                      </span>
                    </div>

                    {/* Community Voting Controls & Deep-Dive Link */}
                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            voteIncident(incident.id, 1).catch((err) => showToast(err.message, "error"));
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 transition cursor-pointer"
                          title="Confirm / Upvote"
                        >
                          <ThumbsUp className="w-3 h-3 text-emerald-600" />
                          <span>{incident.upvotes}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            voteIncident(incident.id, -1).catch((err) => showToast(err.message, "error"));
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 transition cursor-pointer"
                          title="Dispute / Downvote"
                        >
                          <ThumbsDown className="w-3 h-3 text-rose-600" />
                          <span>{incident.downvotes}</span>
                        </button>
                      </div>

                      <Link
                        href={`/reports/${incident.id}`}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 !text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        style={{ color: '#ffffff', textDecoration: 'none' }}
                      >
                        <span className="!text-white font-bold" style={{ color: '#ffffff' }}>
                          {isBn ? "ওয়ার রুম" : "War Room"}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 !text-white shrink-0" style={{ color: '#ffffff' }} />
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>



      {/* Proximity Warning Banner HUD */}
      {closestAlert && (
        <HazardProximityBanner
          alerts={activeAlerts}
          isMuted={isAudioAlertMuted}
          onToggleMute={handleToggleAudioMute}
          onDismiss={dismissAlert}
        />
      )}

      {/* Dynamic Low-Accuracy Warning Banner with 1-click calibration */}
      <LocationAccuracyBanner />

      {/* Guided Location Calibration Assistant Modal */}
      <LocationCalibrationModal />
    </div>
  );
}
