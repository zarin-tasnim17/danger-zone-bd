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
import { useFilterStore } from "@/store/useFilterStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { showToast } from "@/store/useToastStore";
import { DangerIncident, IncidentSeverity } from "@repo/shared";
import { getTranslation } from "@/lib/translations";
import { cleanIncidentTitle, formatCategoryLabel } from "@/lib/incidentUtils";
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
} from "lucide-react";

// Map events handler: fetches viewport incidents on pan/zoom without triggering reactive setState feedback loops
function MapEventsHandler() {
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const map = useMapEvents({
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

  useEffect(() => {
    if (!targetCommand || targetCommand.id === lastExecutedId.current) return;
    lastExecutedId.current = targetCommand.id;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetZoom = targetCommand.zoom ?? currentZoom;

    const distLat = Math.abs(currentCenter.lat - targetCommand.lat);
    const distLng = Math.abs(currentCenter.lng - targetCommand.lng);
    const distZoom = Math.abs(currentZoom - targetZoom);

    // Only initiate flight if programmatic target actually differs from current camera
    if (distLat > 0.0001 || distLng > 0.0001 || distZoom > 0.1) {
      map.flyTo([targetCommand.lat, targetCommand.lng], targetZoom, {
        animate: true,
        duration: 1.0,
      });
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

    const handleWindowResize = () => {
      map.invalidateSize({ pan: false });
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
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
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
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
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoLocatedRef = useRef(false);
  const geoPermissionStateRef = useRef<PermissionState | null>(null);

  // Mount: fetch nationwide incidents across Bangladesh, verified safe zones, and start socket listeners
  useEffect(() => {
    fetchAllIncidents();
    fetchSafeZones();
    initSocketListeners();
  }, [fetchAllIncidents, fetchSafeZones, initSocketListeners]);

  // Filter incidents based on active global filter states
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident: DangerIncident) => {
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

  // Boundary validator: ensure coordinates lie inside Bangladesh bounds
  const isWithinBangladesh = (lat: number, lng: number) => {
    return lat >= 20.3 && lat <= 26.8 && lng >= 87.8 && lng <= 92.9;
  };

  // Smart Location Initialization: Prioritize saved calibrated location; auto-locate silently ONLY if permission is already granted
  useEffect(() => {
    if (typeof window === "undefined" || hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;

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
      setCenter({ lat: saved.lat, lng: saved.lng });
      setZoom(16);
    }

    // 2. Track live browser geolocation permission state without popping an unprompted dialog
    // over SafetyTutorialModal (which causes modern Android 12-16 Chrome to suppress/block prompts)
    let permStatus: PermissionStatus | null = null;
    const handlePermChange = () => {
      if (permStatus) {
        geoPermissionStateRef.current = permStatus.state;
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permStatus = status;
          geoPermissionStateRef.current = status.state;
          status.addEventListener('change', handlePermChange);

          if (!hasCalibrated && status.state === 'granted' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const acc = pos.coords.accuracy || null;
                setUserLocation(coords, acc, 'gps');

                if (isWithinBangladesh(coords.lat, coords.lng)) {
                  setCenter(coords);
                  setZoom(16);
                  if (!acc || acc > 75) {
                    setIsLowAccuracy(true);
                  }
                } else {
                  console.info("[Geo] Device is outside Bangladesh boundaries. Displaying national view.");
                }
              },
              (err) => {
                console.info("[Geo] Auto-location skipped:", err.message);
              },
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
            );
          }
        })
        .catch(() => {
          // Permissions API unsupported
        });
    }

    return () => {
      if (permStatus) {
        permStatus.removeEventListener('change', handlePermChange);
      }
    };
  }, [setCenter, setZoom, loadSavedLocation, setUserLocation, setIsLowAccuracy]);

  // Request browser geolocation (manual button click): Modern Android 12-16+ safe permission + progressive GPS
  const handleLocateMe = () => {
    // Check for Secure Context on mobile (iOS/Android block geolocation on insecure HTTP)
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      showToast(
        isBn
          ? "মোবাইলে সরাসরি জিপিএস ব্যবহারের জন্য ব্রাউজারে সুরক্ষিত (HTTPS) সংযোগ প্রয়োজন।"
          : "Mobile GPS hardware requires a Secure Context (HTTPS or localhost).",
        "warning",
        6000
      );
      openCalibrationModal();
      return;
    }

    const fallbackToSavedOrModal = () => {
      const saved = loadSavedLocation();
      if (saved && isWithinBangladesh(saved.lat, saved.lng)) {
        setUserLocation(
          { lat: saved.lat, lng: saved.lng },
          saved.accuracy || 25,
          'calibrated',
          saved.label
        );
        setCenter({ lat: saved.lat, lng: saved.lng });
        setZoom(17);
        mapRef.current?.flyTo([saved.lat, saved.lng], 17, { animate: true, duration: 1.2 });
      } else {
        openCalibrationModal();
      }
    };

    if (!navigator.geolocation) {
      fallbackToSavedOrModal();
      return;
    }

    setIsLocating(true);
    let hasAppliedFastFix = false;

    const applyGpsCoordinates = (pos: GeolocationPosition, isRefined: boolean = false) => {
      geoPermissionStateRef.current = 'granted';
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const acc = pos.coords.accuracy || null;
      setUserLocation(coords, acc, 'gps');

      if (isWithinBangladesh(coords.lat, coords.lng)) {
        setCenter(coords);
        if (!isRefined) {
          setZoom(17);
          mapRef.current?.flyTo([coords.lat, coords.lng], 17, { animate: true, duration: 1.0 });
        }
        setIsLowAccuracy(!acc || acc > 150);
      } else {
        openCalibrationModal();
      }
    };

    const handleLocationFailure = (err: GeolocationPositionError) => {
      console.warn("[MapClient] Could not access live GPS:", err.message);
      setIsLocating(false);
      if (err.code === 1) {
        geoPermissionStateRef.current = 'denied';
        showToast(
          isBn
            ? "লোকেশন পারমিশন পাওয়া যায়নি। আধুনিক অ্যান্ড্রয়েডে: (১) স্ক্রিনে কোনো ভাসমান বাবল/চ্যাট হেড বা স্ক্রিন ওভারলে চালু থাকলে বন্ধ করুন (এটি 'Try again' ত্রুটি দেয়), (২) অ্যাড্রেস বারের বাম দিকের আইকন থেকে Location Allow করুন এবং Chrome সেটিংসে 'Precise location' চালু রাখুন।"
            : "Location permission was blocked or could not be confirmed.\n\nOn Android 12+, if tapping Allow says 'Try again':\n1. Close any floating bubbles/overlays (Messenger chat heads, Edge panel, blue-light filters, screen recorders) — Android blocks permission taps if overlays are active.\n2. Tap the Sliders/Lock icon next to the URL bar → Permissions → Location → Allow.\n3. Ensure 'Use precise location' is ON in Android App Settings for Chrome.",
          "warning",
          9000
        );
      }
      fallbackToSavedOrModal();
    };

    // CASE A: Permission is ALREADY granted -> safe to run fast 2-stage resolution
    if (geoPermissionStateRef.current === 'granted') {
      // Stage 1: Instant cached/A-GPS fix (<250ms)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          hasAppliedFastFix = true;
          applyGpsCoordinates(pos, false);
          setIsLocating(false);
        },
        () => {
          // Resolved by Stage 2
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
      );

      // Stage 2: High-accuracy live satellite refinement
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyGpsCoordinates(pos, hasAppliedFastFix);
          setIsLocating(false);
        },
        (err) => {
          if (!hasAppliedFastFix) {
            handleLocationFailure(err);
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
      return;
    }

    // CASE B: Permission is 'prompt', 'denied', or unknown -> issue ONE clean synchronous request
    // directly inside the click event so Android 12+ Precise/Approximate dialog doesn't collide.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyGpsCoordinates(pos, false);
        setIsLocating(false);
      },
      (err) => {
        // Fallback once to coarse/network fix if user granted "Approximate" instead of "Precise"
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (coarsePos) => {
              applyGpsCoordinates(coarsePos, false);
              setIsLocating(false);
            },
            (coarseErr) => {
              handleLocationFailure(coarseErr);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
          return;
        }
        handleLocationFailure(err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  };

  // Re-query fresh browser GPS (clearing any saved calibration)
  const handleForceGpsRefresh = () => {
    resetToBrowserGps();
    if (!navigator.geolocation) {
      openCalibrationModal();
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoPermissionStateRef.current = 'granted';
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const acc = pos.coords.accuracy || null;
        setUserLocation(coords, acc, 'gps');
        setCenter(coords);
        setZoom(16);
        if (!acc || acc > 75) {
          setIsLowAccuracy(true);
          openCalibrationModal();
        }
        setIsLocating(false);
      },
      (err) => {
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (coarsePos) => {
              const coords = { lat: coarsePos.coords.latitude, lng: coarsePos.coords.longitude };
              setUserLocation(coords, coarsePos.coords.accuracy || null, 'gps');
              setCenter(coords);
              setZoom(16);
              setIsLowAccuracy(true);
              setIsLocating(false);
            },
            () => {
              setIsLocating(false);
              openCalibrationModal();
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
          return;
        }
        setIsLocating(false);
        openCalibrationModal();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // User GPS Pin icon (Dynamic icon: Green star badge for calibrated, blue beacon for network GPS)
  const userGpsIcon = useMemo(() => {
    const isCalibrated = locationSource === 'calibrated';
    const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

    return L.divIcon({
      className: "user-gps-pulse",
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <span class="user-gps-sonar" style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: ${isCalibrated ? '#10B981' : '#3B82F6'};
            opacity: 0.65;
          "></span>
          <div style="
            position: relative;
            background-color: ${isCalibrated ? '#059669' : '#2563EB'};
            border: 2.5px solid #FFFFFF;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            box-shadow: 0 0 14px ${isCalibrated ? 'rgba(5, 150, 105, 0.7)' : 'rgba(37, 99, 235, 0.7)'};
          ">
            ${isCalibrated ? starSvg : pinSvg}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });
  }, [locationSource]);

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-100">
      {/* Floating Tactical Command HUD Dock (Adaptive: Spans full width on mobile, top-right on desktop) */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 z-[400] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100%-1.5rem)] sm:max-w-md">
        {/* Quick Place Search on Live Map */}
        <div className="pointer-events-auto w-full sm:w-72 md:w-80 shadow-md">
          <LocationSearchBar
            onSelectLocation={(loc: GeocodedLocation) => {
              setCenter({ lat: loc.lat, lng: loc.lng });
              setZoom(17);
              mapRef.current?.flyTo([loc.lat, loc.lng], 17, { animate: true, duration: 1.2 });
            }}
          />
        </div>

        {/* Layer & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-md">
          {/* Map Layer Switcher (Google Streets / Hybrid / OSM) */}
          <MapLayerSwitcher />

          {/* Locate Me (GPS / Calibrated Location) */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
              userLocation
                ? locationSource === 'calibrated'
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title={
              locationSource === 'calibrated'
                ? isBn ? "সংরক্ষিত সঠিক অবস্থান" : "Saved Calibrated Location"
                : isBn ? "আমার অবস্থান সনাক্ত করুন" : "Locate Me (Current GPS)"
            }
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-white" />
            ) : locationSource === 'calibrated' ? (
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            ) : (
              <Crosshair className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${userLocation ? "text-white" : "text-blue-600"}`} />
            )}
            <span className="hidden sm:inline text-xs">
              {locationSource === 'calibrated'
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
        <MapEventsHandler />
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
              radius={
                locationSource === 'calibrated'
                  ? 40
                  : userAccuracy
                  ? Math.min(Math.max(userAccuracy, 40), 500)
                  : 150
              }
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
              draggable={false}
            >
              <Popup autoPanPadding={[24, 24]}>
                <div className="p-3 min-w-[240px] max-w-[280px] text-slate-800 text-xs space-y-2 font-sans">
                  {/* Status Header */}
                  <div className="flex items-center justify-between gap-1">
                    {locationSource === 'calibrated' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>{isBn ? "ক্যালিব্রেটেড (সংরক্ষিত)" : "Calibrated (Saved)"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        <span>📡 {isBn ? "ব্রাউজার নেটওয়ার্ক জিপিএস" : "Browser Network GPS"}</span>
                      </span>
                    )}

                    {userAccuracy && locationSource !== 'calibrated' && (
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

                      <span className="text-[10px] text-slate-500 font-mono font-bold">
                        {formatCategoryLabel(incident.category, language)}
                      </span>
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



      {/* Guided Location Calibration Assistant Modal */}
      <LocationCalibrationModal />
    </div>
  );
}
