"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapStore } from "@/store/useMapStore";
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
} from "lucide-react";

// Bounding box covering all 64 districts of Bangladesh with comfortable padding
const BANGLADESH_BOUNDS: L.LatLngBoundsExpression = [
  [20.3, 87.8], // Southwest (Bay of Bengal / Sundarbans / St. Martin)
  [26.8, 92.9], // Northeast (Tetulia / Jaflong / Chittagong Hill Tracts)
];

// Custom high-visibility solid marker icons with animated radar pulse on high severity
function createCustomIcon(severity: IncidentSeverity) {
  const normalized = (severity || "").toUpperCase();
  const isHigh = normalized === "HIGH" || normalized === "CRITICAL";
  const colorMap: Record<string, { bg: string; border: string; glow: string }> = {
    HIGH: { bg: "#DC2626", border: "#FFFFFF", glow: "rgba(220, 38, 38, 0.45)" },
    CRITICAL: { bg: "#DC2626", border: "#FFFFFF", glow: "rgba(220, 38, 38, 0.45)" },
    MEDIUM: { bg: "#EA580C", border: "#FFFFFF", glow: "rgba(234, 88, 12, 0.35)" },
    LOW: { bg: "#CA8A04", border: "#FFFFFF", glow: "rgba(202, 138, 4, 0.3)" },
  };

  const config = colorMap[normalized] || colorMap.MEDIUM;
  const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

  return L.divIcon({
    className: "custom-danger-pin",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        ${
          isHigh
            ? `<span class="animate-ping" style="
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background-color: #EF4444;
                opacity: 0.75;
              "></span>`
            : ""
        }
        <div style="
          position: relative;
          background-color: ${config.bg};
          border: 2.5px solid ${config.border};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          box-shadow: 0 4px 14px ${config.glow}, 0 2px 4px rgba(15, 23, 42, 0.25);
          cursor: pointer;
          transition: transform 0.15s ease;
        ">
          ${alertSvg}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// Verified Safe Zone icon (Police / Hospital) with crisp vector SVG
function createSafeZoneIcon(type: string) {
  const isPolice = type === "POLICE_STATION";
  const iconSvg = isPolice
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`;

  return L.divIcon({
    className: "custom-safe-pin",
    html: `
      <div style="
        background-color: ${isPolice ? "#2563EB" : "#059669"};
        border: 2.5px solid #FFFFFF;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        box-shadow: 0 4px 12px ${isPolice ? "rgba(37, 99, 235, 0.35)" : "rgba(5, 150, 105, 0.35)"}, 0 2px 4px rgba(15,23,42,0.15);
        cursor: pointer;
      ">
        ${iconSvg}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// Map events handler to trigger viewport incident loading on user pan or zoom
function MapEventsHandler() {
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const map = useMapEvents({
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

// Map center updater when store center updates externally (e.g. clicking incident card or locator)
function MapViewUpdater({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  const lastTargetRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

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

    // If already commanded to this exact target, do not re-fly
    if (
      lastTargetRef.current &&
      lastTargetRef.current.lat === center.lat &&
      lastTargetRef.current.lng === center.lng &&
      lastTargetRef.current.zoom === zoom
    ) {
      return;
    }

    lastTargetRef.current = { lat: center.lat, lng: center.lng, zoom };
    map.flyTo([center.lat, center.lng], zoom, { duration: 1.0 });
  }, [center.lat, center.lng, zoom, map]);

  return null;
}

export default function MapClient() {
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const incidents = useIncidentStore((state) => state.incidents);
  const safeZones = useIncidentStore((state) => state.safeZones);
  const fetchSafeZones = useIncidentStore((state) => state.fetchSafeZones);
  const initSocketListeners = useIncidentStore((state) => state.initSocketListeners);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const { language } = useLanguageStore();
  const t = getTranslation(language);

  // Tactical Layer States
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showDangerCircles, setShowDangerCircles] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Mount: fetch verified safe zones and start socket listeners
  useEffect(() => {
    fetchSafeZones();
    initSocketListeners();
  }, [fetchSafeZones, initSocketListeners]);

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

  // Request browser geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setCenter(coords);
        setZoom(16);
        setIsLocating(false);
      },
      (err) => {
        alert("Could not access your location: " + err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // User GPS Pin icon
  const userGpsIcon = useMemo(() => {
    return L.divIcon({
      className: "user-gps-pulse",
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <span class="animate-ping" style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: #3B82F6;
            opacity: 0.75;
          "></span>
          <div style="
            position: relative;
            background-color: #2563EB;
            border: 3px solid #FFFFFF;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            box-shadow: 0 0 12px rgba(37, 99, 235, 0.6);
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-100">
      {/* Floating Tactical Command HUD Dock (Top-Right) */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2 pointer-events-none">
        {/* Layer & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-md">
          {/* Locate Me (GPS) */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              userLocation
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Locate Me (Current GPS)"
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Crosshair className="w-4 h-4 text-blue-600" />
            )}
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "My Location" : "আমার অবস্থান"}
            </span>
          </button>

          {/* Safe Havens Toggle */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSafeZones
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Toggle Safe Havens (Police & Hospitals)"
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "Safe Havens" : "আশ্রয়স্থল"}
            </span>
          </button>

          {/* Danger Perimeter Toggle (150m Red Zone Radius) */}
          <button
            onClick={() => setShowDangerCircles(!showDangerCircles)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showDangerCircles
                ? "bg-red-50 text-red-800 border border-red-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Toggle 150m Hazard Danger Perimeters"
          >
            {showDangerCircles ? (
              <Eye className="w-4 h-4 text-red-600" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "Perimeters" : "ঝুঁকি বলয়"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Leaflet Map Container (Crisp Standard Daylight Street Map) */}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={6}
        maxZoom={18}
        maxBounds={BANGLADESH_BOUNDS}
        maxBoundsViscosity={1.0}
        attributionControl={false}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <MapViewUpdater center={center} zoom={zoom} />
        <MapEventsHandler />

        {/* Zoom Control repositioned neatly at bottom-left */}
        <ZoomControl position="bottomleft" />

        {/* Standard High-Resolution OpenStreetMap Tiles (Clean, Daylight, Zero Watermarks) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* User GPS Pin (if enabled) */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon}>
            <Popup>
              <div className="p-2 text-slate-800 text-xs">
                <span className="font-bold text-blue-600">📍 You Are Here</span>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                </p>
              </div>
            </Popup>
          </Marker>
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
          const icon = createCustomIcon(incident.severity);
          const isHigh =
            incident.severity.toUpperCase() === "HIGH" || incident.severity === "critical";
          const isMed = incident.severity.toUpperCase() === "MEDIUM";

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
                    fillOpacity: 0.14,
                    weight: 2,
                    dashArray: "5, 5",
                  }}
                />
              )}

              <Marker
                position={[incident.coordinates.lat, incident.coordinates.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    setCenter(incident.coordinates);
                  },
                }}
              >
                <Popup>
                  <div className="p-3.5 max-w-[290px] text-slate-900 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isHigh
                            ? "bg-red-50 text-red-700 border-red-200"
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
                      {language === "bn" && incident.titleBn ? incident.titleBn : incident.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {language === "bn" && incident.descriptionBn
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
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 transition"
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
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 transition"
                          title="Dispute / Downvote"
                        >
                          <ThumbsDown className="w-3 h-3 text-rose-600" />
                          <span>{incident.downvotes}</span>
                        </button>
                      </div>

                      <Link
                        href={`/reports/${incident.id}`}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition"
                      >
                        <span>War Room</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
