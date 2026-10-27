"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
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

// Bounding box covering all 64 districts of Bangladesh with comfortable padding
const BANGLADESH_BOUNDS: L.LatLngBoundsExpression = [
  [20.3, 87.8], // Southwest (Bay of Bengal / Sundarbans / St. Martin)
  [26.8, 92.9], // Northeast (Tetulia / Jaflong / Chittagong Hill Tracts)
];

// Custom high-visibility solid marker icons with animated radar pulse on high severity
function createCustomIcon(severity: IncidentSeverity) {
  const normalized = (severity || "").toUpperCase();
  const isHigh = normalized === "HIGH" || normalized === "CRITICAL";
  const colorMap: Record<string, { bg: string; border: string; label: string }> = {
    HIGH: { bg: "#DC2626", border: "#991B1B", label: "!" },
    CRITICAL: { bg: "#DC2626", border: "#991B1B", label: "!" },
    MEDIUM: { bg: "#EA580C", border: "#C2410C", label: "▲" },
    LOW: { bg: "#CA8A04", border: "#A16207", label: "●" },
  };

  const config = colorMap[normalized] || colorMap.MEDIUM;

  return L.divIcon({
    className: "custom-danger-pin",
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
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
          border: 2px solid ${config.border};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.4);
          cursor: pointer;
        ">
          ${config.label}
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Verified Safe Zone icon (Police / Hospital)
function createSafeZoneIcon(type: string) {
  const isPolice = type === "POLICE_STATION";
  return L.divIcon({
    className: "custom-safe-zone-pin",
    html: `
      <div style="
        background-color: ${isPolice ? "#2563EB" : "#059669"};
        border: 2px solid #ffffff;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 700;
        font-size: 13px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ${isPolice ? "🛡️" : "🏥"}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// Subcomponent to fly to selected coordinates when center changes
function MapViewUpdater({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [center, zoom, map]);
  return null;
}

// Subcomponent tracking viewport moves and fetching PostGIS incidents within bounds
function MapEventsHandler() {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      useIncidentStore.getState().fetchIncidentsInBounds({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      });
    },
  });

  useEffect(() => {
    // Initial fetch on mount
    const bounds = map.getBounds();
    useIncidentStore.getState().fetchIncidentsInBounds({
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
    });
  }, [map]);

  return null;
}

export default function MapClient() {
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const setCenter = useMapStore((state) => state.setCenter);
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const safeZones = useIncidentStore((state) => state.safeZones);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const fetchSafeZones = useIncidentStore((state) => state.fetchSafeZones);
  const initSocketListeners = useIncidentStore((state) => state.initSocketListeners);
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const t = getTranslation(language);

  // Tactical layer switcher state
  const [tileTheme, setTileTheme] = useState<"dark" | "street">("dark");

  // Initialize socket event listeners & safe zones once on mount
  useEffect(() => {
    initSocketListeners();
    fetchSafeZones();
  }, [initSocketListeners, fetchSafeZones]);

  // Filter incidents based on active user filters
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (selectedSeverity !== "all" && item.severity.toUpperCase() !== selectedSeverity.toUpperCase()) {
        return false;
      }
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesTitle =
          item.title.toLowerCase().includes(query) ||
          (item.titleBn && item.titleBn.toLowerCase().includes(query));
        const matchesLocation =
          item.locationName.toLowerCase().includes(query) ||
          (item.locationNameBn && item.locationNameBn.toLowerCase().includes(query)) ||
          (item.district && item.district.toLowerCase().includes(query));
        if (!matchesTitle && !matchesLocation) return false;
      }
      return true;
    });
  }, [incidents, selectedSeverity, selectedCategory, searchQuery]);

  return (
    <div className="w-full h-full relative z-0">
      {/* Tactical Layer Switcher HUD */}
      <div className="absolute top-4 right-4 z-[400] flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-2xl">
        <button
          onClick={() => setTileTheme("dark")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            tileTheme === "dark"
              ? "bg-slate-800 text-brand-primary shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Switch to CartoDB Tactical Dark Matter"
        >
          🛰️ Tactical Dark
        </button>
        <button
          onClick={() => setTileTheme("street")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            tileTheme === "street"
              ? "bg-slate-800 text-brand-primary shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Switch to OpenStreetMap Street View"
        >
          🗺️ Street
        </button>
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={6}
        maxZoom={18}
        maxBounds={BANGLADESH_BOUNDS}
        maxBoundsViscosity={1.0}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <MapViewUpdater center={center} zoom={zoom} />
        <MapEventsHandler />

        {tileTheme === "dark" ? (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        )}

        {/* Render Verified Safe Zones (Hospitals / Police) */}
        {safeZones.map((zone) => (
          <Marker
            key={`safe-zone-${zone.id}`}
            position={[zone.latitude, zone.longitude]}
            icon={createSafeZoneIcon(zone.type)}
          >
            <Popup>
              <div className="p-2 text-content-primary">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {zone.type.replace("_", " ")}
                </span>
                <h4 className="font-semibold text-xs mt-1">{zone.name}</h4>
                <p className="text-[10px] text-content-muted mt-0.5">Verified Safe Haven / Emergency Point</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render Live Danger Incidents */}
        {filteredIncidents.map((incident: DangerIncident) => {
          const icon = createCustomIcon(incident.severity);
          const isHigh = incident.severity.toUpperCase() === "HIGH" || incident.severity === "critical";

          return (
            <Fragment key={incident.id}>
              {/* Radius overlay for high-severity danger perimeters (150m fuzzed perimeter circle) */}
              {isHigh && (
                <Circle
                  center={[incident.coordinates.lat, incident.coordinates.lng]}
                  radius={incident.fuzzedRadiusMeters || 150}
                  pathOptions={{
                    color: "#DC2626",
                    fillColor: "#DC2626",
                    fillOpacity: 0.18,
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
                  <div className="p-3 max-w-[280px] bg-white text-content-primary rounded-lg shadow-lg">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isHigh
                            ? "bg-danger-critical text-white"
                            : incident.severity.toUpperCase() === "MEDIUM"
                            ? "bg-danger-warning text-white"
                            : "bg-danger-caution text-white"
                        }`}
                      >
                        {(t.severity as any)[incident.severity.toLowerCase()] || incident.severity}
                      </span>
                      <span className="text-[10px] text-content-muted">
                        {incident.district || "Bangladesh"}
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm leading-snug mb-1 text-content-primary">
                      {language === "bn" && incident.titleBn ? incident.titleBn : incident.title}
                    </h4>

                    <p className="text-xs text-content-secondary mb-2 line-clamp-3">
                      {language === "bn" && incident.descriptionBn
                        ? incident.descriptionBn
                        : incident.description}
                    </p>

                    <div className="pt-2 border-t border-surface-border text-[11px] text-content-muted flex items-center justify-between">
                      <span className="truncate">📍 {incident.locationName}</span>
                      <span className="font-medium text-brand-primary shrink-0">
                        {incident.reportedBy}
                      </span>
                    </div>

                    {/* Community Voting Controls */}
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-surface-border">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          voteIncident(incident.id, 1).catch((err) => alert(err.message));
                        }}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors border border-emerald-200"
                        title="Confirm / Upvote this hazard"
                      >
                        👍 <span>{incident.upvotes}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          voteIncident(incident.id, -1).catch((err) => alert(err.message));
                        }}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors border border-rose-200"
                        title="Downvote / Dispute this hazard (5 downvotes auto-purges fake reports)"
                      >
                        👎 <span>{incident.downvotes}</span>
                      </button>

                      {incident.sourceUrl && (
                        <a
                          href={incident.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[10px] text-brand-primary underline truncate max-w-[100px] font-medium"
                        >
                          Source ↗
                        </a>
                      )}
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
