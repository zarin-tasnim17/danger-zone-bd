"use client";

import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createDangerMarkerIcon } from "@/lib/mapMarkerUtils";
import { formatCategoryLabel } from "@/lib/incidentUtils";
import { MapPin, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RouteAlternative, LocalizedHazard } from "@repo/shared";

export type BypassedHazardItem = LocalizedHazard;

export interface RoutePathMapProps {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  waypoints?: [number, number][]; // [lat, lng] array
  bypassedHazards?: BypassedHazardItem[];
  isDiverted?: boolean;
  routes?: RouteAlternative[];
  selectedRouteId?: string;
  onSelectRoute?: (routeId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  clickMode?: "START" | "END" | "NONE";
  language?: "en" | "bn";
  className?: string;
}

// Map Auto-Fit bounds controller
function BoundsController({
  startLat,
  startLng,
  endLat,
  endLng,
  activeGeometry,
}: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  activeGeometry: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (!isNaN(startLat) && !isNaN(startLng)) points.push([startLat, startLng]);
    if (!isNaN(endLat) && !isNaN(endLng)) points.push([endLat, endLng]);
    if (activeGeometry && activeGeometry.length > 0) {
      points.push(...activeGeometry);
    }

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [startLat, startLng, endLat, endLng, activeGeometry, map]);

  return null;
}

// Map click event listener to drop pins
function MapClickObserver({
  onClick,
  clickMode,
}: {
  onClick?: (lat: number, lng: number) => void;
  clickMode?: "START" | "END" | "NONE";
}) {
  useMapEvents({
    click: (e) => {
      if (onClick && clickMode && clickMode !== "NONE") {
        onClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    },
  });
  return null;
}

// Origin Start Pin (Emerald Green Badge)
const startIcon = L.divIcon({
  className: "origin-start-pin",
  html: `
    <div style="
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: rgba(16, 185, 129, 0.25);
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 12px;
        background: #10B981;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4), 0 2px 4px rgba(15,23,42,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

// Destination Pin (Rose/Red Target Pin)
const destinationIcon = L.divIcon({
  className: "destination-end-pin",
  html: `
    <div style="
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 12px;
        background: #DC2626;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(220, 38, 38, 0.4), 0 2px 4px rgba(15,23,42,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

export default function RoutePathMap({
  startLat,
  startLng,
  endLat,
  endLng,
  waypoints = [],
  bypassedHazards = [],
  isDiverted = false,
  routes = [],
  selectedRouteId,
  onSelectRoute,
  onMapClick,
  clickMode = "NONE",
  language = "en",
  className = "w-full h-full min-h-[460px]",
}: RoutePathMapProps) {
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  const isBn = language === "bn";

  const defaultCenter: [number, number] = useMemo(() => {
    if (!isNaN(startLat) && !isNaN(startLng)) return [startLat, startLng];
    return [23.7570, 90.3905]; // Dhaka center
  }, [startLat, startLng]);

  // Determine active route
  const activeRoute = useMemo(() => {
    if (routes && routes.length > 0) {
      if (selectedRouteId) {
        const found = routes.find((r) => r.id === selectedRouteId);
        if (found) return found;
      }
      const recommended = routes.find((r) => r.isRecommended);
      if (recommended) return recommended;
      return routes[0];
    }
    return null;
  }, [routes, selectedRouteId]);

  // Active geometry to frame in bounds
  const activeGeometry: [number, number][] = useMemo(() => {
    if (activeRoute && activeRoute.geometry && activeRoute.geometry.length > 0) {
      return activeRoute.geometry;
    }
    if (waypoints && waypoints.length > 0) {
      return waypoints;
    }
    return [];
  }, [activeRoute, waypoints]);

  // All detected corridor hazards across all alternatives and bypassed list
  const allCorridorHazards: BypassedHazardItem[] = useMemo(() => {
    const map = new Map<string, BypassedHazardItem>();
    if (routes && routes.length > 0) {
      for (const r of routes) {
        if (r.hazards) {
          for (const h of r.hazards) {
            map.set(h.id, h);
          }
        }
      }
    }
    if (bypassedHazards && bypassedHazards.length > 0) {
      for (const h of bypassedHazards) {
        map.set(h.id, h);
      }
    }
    return Array.from(map.values());
  }, [routes, bypassedHazards]);

  // Set of hazard IDs directly intercepted by the currently active route
  const activeRouteHazardIds = useMemo(() => {
    return new Set(activeRoute?.hazards?.map((h) => h.id) || []);
  }, [activeRoute]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 z-0 select-none ${className}`}>
      <div className="absolute top-3 right-3 z-[500]">
        <MapLayerSwitcher compact />
      </div>

      {/* Click Mode Notification Banner */}
      {clickMode !== "NONE" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 border border-slate-700 pointer-events-none animate-bounce">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {clickMode === "START"
              ? isBn ? "ম্যাপে ক্লিক করে যাত্রাস্থল নির্ধারণ করুন" : "Click anywhere on map to set Start Point (Origin)"
              : isBn ? "ম্যাপে ক্লিক করে গন্তব্য নির্ধারণ করুন" : "Click anywhere on map to set Destination"}
          </span>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        minZoom={6}
        maxZoom={18}
        attributionControl={false}
        className="w-full h-full"
      >
        <BoundsController
          startLat={startLat}
          startLng={startLng}
          endLat={endLat}
          endLng={endLng}
          activeGeometry={activeGeometry}
        />

        <MapClickObserver onClick={onMapClick} clickMode={clickMode} />

        {/* Active High-Detail Tile Layer */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        {/* Multi-Route Alternatives Rendering */}
        {routes && routes.length > 0 ? (
          <>
            {/* 1. Unselected routes rendered first (below selected route) */}
            {routes
              .filter((r) => r.id !== activeRoute?.id)
              .map((route, idx) => (
                <Polyline
                  key={`alt-route-${route.id}-${idx}`}
                  positions={route.geometry}
                  pathOptions={{
                    color: "#64748B",
                    weight: 4,
                    opacity: 0.6,
                    lineCap: "round",
                    lineJoin: "round",
                    dashArray: "6 6",
                  }}
                  eventHandlers={{
                    click: () => {
                      if (onSelectRoute) onSelectRoute(route.id);
                    },
                  }}
                />
              ))}

            {/* 2. Active Selected Route rendered on top */}
            {activeRoute && activeRoute.geometry.length > 1 && (
              <Polyline
                key={`active-route-${activeRoute.id}`}
                positions={activeRoute.geometry}
                pathOptions={{
                  color:
                    activeRoute.safetyRating === "LOW_HAZARD_EXPOSURE"
                      ? "#10B981" // Emerald green for safest/clean
                      : activeRoute.safetyRating === "MODERATE_HAZARD_EXPOSURE"
                      ? "#2563EB" // Vibrant blue
                      : "#F59E0B", // Amber warning
                  weight: 6,
                  opacity: 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            )}
          </>
        ) : (
          /* Legacy single waypoints path */
          waypoints.length > 1 && (
            <Polyline
              positions={waypoints}
              pathOptions={{
                color: isDiverted ? "#2563EB" : "#10B981",
                weight: 6,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )
        )}

        {/* Origin Pin */}
        {!isNaN(startLat) && !isNaN(startLng) && (
          <Marker position={[startLat, startLng]} icon={startIcon}>
            <Popup className="clean-white-popup">
              <div className="p-1 font-sans text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {isBn ? "যাত্রার শুরু (Origin)" : "Origin Point"}
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                  {startLat.toFixed(5)}, {startLng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Pin */}
        {!isNaN(endLat) && !isNaN(endLng) && (
          <Marker position={[endLat, endLng]} icon={destinationIcon}>
            <Popup className="clean-white-popup">
              <div className="p-1 font-sans text-center">
                <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {isBn ? "গন্তব্য (Destination)" : "Destination Point"}
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                  {endLat.toFixed(5)}, {endLng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Active Hazard Markers & Proximity Perimeter Exclusion Buffers */}
        {allCorridorHazards.map((hazard) => {
          const isInterceptedByActive = activeRouteHazardIds.has(hazard.id);
          const bufferRadius =
            hazard.severity === "HIGH" ? 250 : hazard.severity === "MEDIUM" ? 150 : 80;
          return (
            <React.Fragment key={hazard.id}>
              {/* PostGIS Street-Level Proximity Buffer Zone */}
              <Circle
                center={[hazard.latitude, hazard.longitude]}
                radius={bufferRadius}
                pathOptions={{
                  color: isInterceptedByActive
                    ? hazard.severity === "HIGH"
                      ? "#DC2626"
                      : hazard.severity === "MEDIUM"
                      ? "#EA580C"
                      : "#EAB308"
                    : "#94A3B8",
                  fillColor: isInterceptedByActive
                    ? hazard.severity === "HIGH"
                      ? "#EF4444"
                      : hazard.severity === "MEDIUM"
                      ? "#F97316"
                      : "#FACC15"
                    : "#CBD5E1",
                  fillOpacity: isInterceptedByActive ? 0.2 : 0.08,
                  weight: isInterceptedByActive ? 2 : 1,
                  dashArray: isInterceptedByActive ? "4 4" : "6 6",
                }}
              />
              <Marker
                position={[hazard.latitude, hazard.longitude]}
                icon={createDangerMarkerIcon(
                  hazard.category || "GENERAL",
                  (hazard.severity as any) || "HIGH",
                  14
                )}
              >
                <Popup className="clean-white-popup">
                  <div className="p-1.5 font-sans min-w-[200px]">
                    <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 ${
                          isInterceptedByActive ? "text-red-600" : "text-slate-500"
                        }`}
                      />
                      <span className={isInterceptedByActive ? "text-red-700" : "text-slate-700"}>
                        {isInterceptedByActive
                          ? isBn
                            ? "সক্রিয় বিপদ (রুটের মধ্যে)"
                            : "Active Street Hazard (On Route)"
                          : isBn
                          ? "বাইপাসকৃত বিপদ (এড়িয়ে যাওয়া হয়েছে)"
                          : "Bypassed Hazard (Safely Avoided)"}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase">
                      {formatCategoryLabel(hazard.category, language)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isInterceptedByActive
                        ? isBn
                          ? `যাত্রাপথ থেকে দূরত্ব: ${hazard.distanceFromRouteMeters} মিটার`
                          : `Distance from route: ${hazard.distanceFromRouteMeters}m`
                        : isBn
                        ? "নির্বাচিত রুট এই বিপদ সফলভাবে এড়িয়ে চলছে"
                        : "Selected route safely avoids this hazard zone"}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase ${
                          isInterceptedByActive
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {hazard.severity} Severity ({bufferRadius}m Buffer)
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3 py-2 shadow-md z-[1000] text-[10px] font-semibold text-slate-700 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>{isBn ? "শুরু" : "Origin"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
          <span>{isBn ? "গন্তব্য" : "Destination"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{isBn ? "নির্বাচিত রুট (সড়ক পথ)" : "Active Road Route"}</span>
        </div>
        {routes && routes.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 border-b-2 border-dashed border-slate-400"></span>
            <span>{isBn ? "বিকল্প রুট" : "Alternative Route"}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-red-500 bg-red-500/20"></span>
          <span>{isBn ? "বিপদ অঞ্চল (৮০-২৫০মি)" : "Hazard Buffer (80-250m)"}</span>
        </div>
      </div>
    </div>
  );
}
