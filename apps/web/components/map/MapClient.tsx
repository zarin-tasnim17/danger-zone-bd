"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
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
  const colorMap: Record<string, { bg: string; border: string; label: string; glow: string }> = {
    HIGH: { bg: "#EF4444", border: "#B91C1C", label: "!", glow: "rgba(239, 68, 68, 0.6)" },
    CRITICAL: { bg: "#EF4444", border: "#B91C1C", label: "!", glow: "rgba(239, 68, 68, 0.6)" },
    MEDIUM: { bg: "#F97316", border: "#C2410C", label: "▲", glow: "rgba(249, 115, 22, 0.5)" },
    LOW: { bg: "#EAB308", border: "#A16207", label: "●", glow: "rgba(234, 179, 8, 0.4)" },
  };

  const config = colorMap[normalized] || colorMap.MEDIUM;

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
          border: 2px solid #FFFFFF;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 4px 14px ${config.glow}, 0 2px 4px rgba(0, 0, 0, 0.7);
          cursor: pointer;
          transition: transform 0.15s ease;
        ">
          ${config.label}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// Verified Safe Zone icon (Police / Hospital)
function createSafeZoneIcon(type: string) {
  const isPolice = type === "POLICE_STATION";
  return L.divIcon({
    className: "custom-safe-pin",
    html: `
      <div style="
        background-color: ${isPolice ? "#2563EB" : "#059669"};
        border: 2px solid #FFFFFF;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        font-weight: 800;
        font-size: 14px;
        box-shadow: 0 4px 12px ${isPolice ? "rgba(37, 99, 235, 0.5)" : "rgba(5, 150, 105, 0.5)"}, 0 2px 4px rgba(0,0,0,0.6);
        cursor: pointer;
      ">
        ${isPolice ? "👮" : "🏥"}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

// Map events handler to update store on user movement and trigger viewport incident loading
function MapEventsHandler() {
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);

  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
      const b = map.getBounds();
      fetchIncidentsInBounds({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    },
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  return null;
}

// Map center updater when store center updates externally
function MapViewUpdater({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom, { duration: 1.2 });
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
  const [tileTheme, setTileTheme] = useState<"dark" | "osm">("dark");
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
            box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950">
      {/* Floating Tactical Command HUD Dock (Top-Right) */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2 pointer-events-none">
        {/* Layer & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 bg-slate-950/85 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
          {/* Locate Me (GPS) */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              userLocation
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                : "text-slate-300 hover:text-white hover:bg-slate-800/80"
            }`}
            title="Locate Me (Current GPS)"
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-blue-400" />
            )}
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "My Location" : "আমার অবস্থান"}
            </span>
          </button>

          {/* Safe Havens Toggle */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSafeZones
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            }`}
            title="Toggle Safe Havens (Police & Hospitals)"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "Safe Havens" : "আশ্রয়স্থল"}
            </span>
          </button>

          {/* Danger Perimeter Toggle (150m Red Zone Radius) */}
          <button
            onClick={() => setShowDangerCircles(!showDangerCircles)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showDangerCircles
                ? "bg-red-950 text-red-300 border border-red-800/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            }`}
            title="Toggle 150m Hazard Danger Perimeters"
          >
            {showDangerCircles ? (
              <Eye className="w-4 h-4 text-red-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-500" />
            )}
            <span className="hidden sm:inline text-xs">
              {language === "en" ? "Perimeters" : "ঝুঁকি বলয়"}
            </span>
          </button>

          {/* Dark / Street Map Switcher */}
          <button
            onClick={() => setTileTheme(tileTheme === "dark" ? "osm" : "dark")}
            className="p-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center gap-1.5"
            title={tileTheme === "dark" ? "Switch to Street View" : "Switch to Dark Tactical View"}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline text-xs">
              {tileTheme === "dark" ? "Dark Grid" : "Street"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Leaflet Map Container */}
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

        {/* Tactical Tile Provider (Zero API Key, Zero Watermarks) */}
        <TileLayer
          className={tileTheme === "dark" ? "tactical-dark-tiles" : ""}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* User GPS Pin (if enabled) */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon}>
            <Popup>
              <div className="p-2 text-slate-100 text-xs">
                <span className="font-bold text-blue-400">📍 You Are Here</span>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
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
                <div className="p-3 max-w-[260px] text-slate-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {zone.type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">✓ Verified Haven</span>
                  </div>
                  <h4 className="font-bold text-sm text-white mt-1">{zone.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Designated 24/7 sanctuary point during emergencies.
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <Link
                      href="/safe-zones"
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
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
                    color: "#EF4444",
                    fillColor: "#EF4444",
                    fillOpacity: 0.16,
                    weight: 1.5,
                    dashArray: "4, 4",
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
                  <div className="p-3.5 max-w-[290px] text-slate-100 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isHigh
                            ? "bg-red-950 text-red-300 border-red-800"
                            : isMed
                            ? "bg-orange-950 text-orange-300 border-orange-800"
                            : "bg-yellow-950 text-yellow-300 border-yellow-800"
                        }`}
                      >
                        {isHigh && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
                        {(t.severity as any)[incident.severity.toLowerCase()] || incident.severity}
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {(t.categories as any)[incident.category.toLowerCase()] || incident.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-sm leading-snug text-white">
                      {language === "bn" && incident.titleBn ? incident.titleBn : incident.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {language === "bn" && incident.descriptionBn
                        ? incident.descriptionBn
                        : incident.description}
                    </p>

                    {/* Landmark / Source */}
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="truncate flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="truncate">{incident.locationName}</span>
                      </span>
                      <span className="text-[10px] text-blue-400 font-medium shrink-0 ml-1">
                        {incident.reportedBy}
                      </span>
                    </div>

                    {/* Community Voting Controls & Deep-Dive Link */}
                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            voteIncident(incident.id, 1).catch((err) => alert(err.message));
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-semibold border border-emerald-800 transition"
                          title="Confirm / Upvote"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>{incident.upvotes}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            voteIncident(incident.id, -1).catch((err) => alert(err.message));
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-semibold border border-rose-800 transition"
                          title="Dispute / Downvote"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>{incident.downvotes}</span>
                        </button>
                      </div>

                      <Link
                        href={`/reports/${incident.id}`}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-md transition"
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
