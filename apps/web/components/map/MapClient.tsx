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
import { DangerIncident, IncidentSeverity } from "@repo/shared";
import { getTranslation } from "@/lib/translations";
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

// Map events handler to trigger viewport incident loading and sync zoom to map store
function MapEventsHandler() {
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const setZoom = useMapStore((state) => state.setZoom);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
    moveend: () => {
      setZoom(map.getZoom());
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

// Map center updater when store center updates externally (e.g. clicking incident card or locator)
function MapViewUpdater({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const latDiff = Math.abs(currentCenter.lat - center.lat);
    const lngDiff = Math.abs(currentCenter.lng - center.lng);
    const zoomDiff = Math.abs(currentZoom - zoom);

    // If map is already at this position within micro-threshold, prevent infinite animation loop
    if (latDiff < 0.0001 && lngDiff < 0.0001 && zoomDiff === 0) {
      return;
    }

    map.flyTo([center.lat, center.lng], zoom, { duration: 1.0 });
  }, [center.lat, center.lng, zoom, map]);

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

// Automatically invalidates Leaflet map size when the viewport or parent container (sidebar collapse/expand) changes
function MapResizeHandler() {
  const map = useMap();
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    let resizeTimer: NodeJS.Timeout | null = null;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize();
        const b = map.getBounds();
        fetchIncidentsInBounds({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
        });
      }, 350);
    });

    observer.observe(container);

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [map, fetchIncidentsInBounds]);

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
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const { language } = useLanguageStore();
  const t = getTranslation(language);
  const isBn = language === "bn";

  // Tactical Layer States
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showDangerCircles, setShowDangerCircles] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoLocatedRef = useRef(false);

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
      if (selectedCategory !== "all" && incident.category !== selectedCategory) {
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
  }, [incidents, selectedSeverity, selectedCategory, searchQuery]);

  // Boundary validator: ensure coordinates lie inside Bangladesh bounds
  const isWithinBangladesh = (lat: number, lng: number) => {
    return lat >= 20.3 && lat <= 26.8 && lng >= 87.8 && lng <= 92.9;
  };

  // Smart Location Initialization: Prioritize saved calibrated location, otherwise query browser geolocation
  useEffect(() => {
    if (typeof window === "undefined" || hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;

    // 1. Check if user previously calibrated their location in localStorage
    const saved = loadSavedLocation();
    if (saved && isWithinBangladesh(saved.lat, saved.lng)) {
      setUserLocation(
        { lat: saved.lat, lng: saved.lng },
        saved.accuracy || 25,
        'calibrated',
        saved.label
      );
      setCenter({ lat: saved.lat, lng: saved.lng });
      setZoom(16);
      setTimeout(() => {
        mapRef.current?.flyTo([saved.lat, saved.lng], 16, { animate: true, duration: 1.2 });
      }, 100);
      return;
    }

    // 2. Otherwise request browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const acc = pos.coords.accuracy || null;
          setUserLocation(coords, acc, 'gps');

          if (isWithinBangladesh(coords.lat, coords.lng)) {
            setCenter(coords);
            setZoom(16);
            setTimeout(() => {
              mapRef.current?.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.2 });
            }, 100);
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
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  }, [setCenter, setZoom, loadSavedLocation, setUserLocation, setIsLowAccuracy]);

  // Request browser geolocation (manual button click)
  const handleLocateMe = () => {
    // 1. If a saved calibrated location exists, fly straight to it!
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
      return;
    }

    // 2. If user already has an active location pin, fly directly to it immediately
    if (userLocation && isWithinBangladesh(userLocation.lat, userLocation.lng)) {
      setCenter(userLocation);
      setZoom(17);
      mapRef.current?.flyTo([userLocation.lat, userLocation.lng], 17, { animate: true, duration: 1.2 });
    }

    if (!navigator.geolocation) {
      openCalibrationModal();
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const acc = pos.coords.accuracy || null;
        setUserLocation(coords, acc, 'gps');

        if (isWithinBangladesh(coords.lat, coords.lng)) {
          setCenter(coords);
          setZoom(16);
          mapRef.current?.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.2 });
          // If accuracy is poor (typical of ISP triangulation > 75m), open the calibration assistant!
          if (!acc || acc > 75) {
            setIsLowAccuracy(true);
            openCalibrationModal();
          }
        } else {
          openCalibrationModal();
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn("[MapClient] Could not access location:", err.message);
        setIsLocating(false);
        openCalibrationModal();
      },
      { enableHighAccuracy: true, timeout: 8000 }
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
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const acc = pos.coords.accuracy || null;
        setUserLocation(coords, acc, 'gps');
        setCenter(coords);
        setZoom(16);
        mapRef.current?.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.2 });
        if (!acc || acc > 75) {
          setIsLowAccuracy(true);
          openCalibrationModal();
        }
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        openCalibrationModal();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
          <span class="animate-ping" style="
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
        <MapViewUpdater center={center} zoom={zoom} />
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
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const newPos = marker.getLatLng();
                  // Automatically calibrate and save to localStorage!
                  calibrateUserLocation(
                    { lat: newPos.lat, lng: newPos.lng },
                    isBn ? "ক্যালিব্রেটেড অবস্থান" : "Calibrated Pin Location"
                  );
                },
              }}
            >
              <Popup>
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
          safeZones.map((zone) => (
            <Marker
              key={`safe-zone-${zone.id}`}
              position={[zone.latitude, zone.longitude]}
              icon={createSafeZoneIcon(zone.type)}
            >
              <Popup>
                <div className="p-3 max-w-[260px] text-slate-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {zone.type.replace("_", " ")}
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
          ))}

        {/* Render Live Danger Incidents */}
        {filteredIncidents.map((incident: DangerIncident) => {
          const icon = createDangerMarkerIcon(incident.category, incident.severity, zoom);
          const isHigh =
            incident.severity.toUpperCase() === "HIGH" || incident.severity.toLowerCase() === "critical";
          const isMed = incident.severity.toUpperCase() === "MEDIUM";
          const tooltipOffset = zoom <= 11 ? 11 : zoom <= 14 ? 14 : 16;

          return (
            <Fragment key={incident.id}>
              {/* 150m Fuzzed Danger Perimeter Circle */}
              {showDangerCircles && isHigh && (
                <Circle
                  center={[incident.coordinates.lat, incident.coordinates.lng]}
                  radius={incident.fuzzedRadiusMeters || 150}
                  pathOptions={{
                    color: "#DC2626",
                    fillColor: "#DC2626",
                    fillOpacity: 0.12,
                    weight: 1.5,
                    dashArray: "4, 4",
                  }}
                />
              )}

              <Marker
                position={[incident.coordinates.lat, incident.coordinates.lng]}
                icon={icon}
                zIndexOffset={isHigh ? 500 : isMed ? 200 : 50}
                eventHandlers={{
                  click: () => {
                    setCenter(incident.coordinates);
                  },
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
                      {(t.categories as any)[incident.category.toLowerCase()] || incident.category}
                    </span>
                    <span className="text-slate-400 font-normal">|</span>
                    <span className="text-slate-200 truncate max-w-[200px]">
                      {isBn && incident.titleBn ? incident.titleBn : incident.title}
                    </span>
                  </div>
                </Tooltip>

                <Popup>
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

                      <span className="text-[10px] text-slate-500 font-mono">
                        {(t.categories as any)[incident.category.toLowerCase()] || incident.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-sm leading-snug text-slate-900">
                      {isBn && incident.titleBn ? incident.titleBn : incident.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {isBn && incident.descriptionBn
                        ? incident.descriptionBn
                        : incident.description}
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
                            voteIncident(incident.id, 1).catch((err) => alert(err.message));
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
                            voteIncident(incident.id, -1).catch((err) => alert(err.message));
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
