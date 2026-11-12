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
import { MapPin, Navigation, AlertTriangle, ShieldCheck, Flag } from "lucide-react";

export interface BypassedHazardItem {
  id: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
}

interface RoutePathMapProps {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  waypoints: [number, number][]; // [lat, lng] array
  bypassedHazards: BypassedHazardItem[];
  isDiverted: boolean;
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
  waypoints,
}: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  waypoints: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (!isNaN(startLat) && !isNaN(startLng)) points.push([startLat, startLng]);
    if (!isNaN(endLat) && !isNaN(endLng)) points.push([endLat, endLng]);
    if (waypoints && waypoints.length > 0) {
      points.push(...waypoints);
    }

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [startLat, startLng, endLat, endLng, waypoints, map]);

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

// Origin Start Pin (Emerald Green Circle with Pin Icon)
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

// Hazard exclusion pin (Red triangle)
const hazardIcon = L.divIcon({
  className: "hazard-bypass-pin",
  html: `
    <div style="
      width: 26px;
      height: 26px;
      border-radius: 9999px;
      background: #EF4444;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

// Safe Detour Waypoint Marker (Small blue diamond)
const waypointIcon = L.divIcon({
  className: "detour-node-pin",
  html: `
    <div style="
      width: 14px;
      height: 14px;
      border-radius: 4px;
      background: #2563EB;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 6px rgba(37, 99, 235, 0.5);
      transform: rotate(45deg);
    "></div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function RoutePathMap({
  startLat,
  startLng,
  endLat,
  endLng,
  waypoints = [],
  bypassedHazards = [],
  isDiverted = false,
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

  // Direct line segment between origin and destination
  const directLinePositions: [number, number][] = useMemo(() => {
    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) return [];
    return [
      [startLat, startLng],
      [endLat, endLng],
    ];
  }, [startLat, startLng, endLat, endLng]);

  // Safe calculated polyline path
  const safePolylinePositions: [number, number][] = useMemo(() => {
    if (waypoints && waypoints.length > 0) {
      return waypoints;
    }
    return directLinePositions;
  }, [waypoints, directLinePositions]);

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
          waypoints={waypoints}
        />

        <MapClickObserver onClick={onMapClick} clickMode={clickMode} />

        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        {/* If route is diverted, show direct red dashed line indicating the risky path */}
        {isDiverted && directLinePositions.length === 2 && (
          <Polyline
            positions={directLinePositions}
            pathOptions={{
              color: "#DC2626",
              weight: 2.5,
              dashArray: "6, 8",
              opacity: 0.55,
            }}
          />
        )}

        {/* Safe Calculated Polyline Path (Green/Emerald if clear or diverted) */}
        {safePolylinePositions.length > 1 && (
          <Polyline
            positions={safePolylinePositions}
            pathOptions={{
              color: isDiverted ? "#2563EB" : "#10B981",
              weight: 5,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
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

        {/* Intermediate Detour Waypoint Nodes */}
        {waypoints.length > 2 &&
          waypoints.slice(1, -1).map((wp, idx) => (
            <Marker key={idx} position={wp} icon={waypointIcon}>
              <Popup className="clean-white-popup">
                <div className="p-1 font-sans text-center">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {isBn ? `নিরাপদ নোড #${idx + 1}` : `Safe Node #${idx + 1}`}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    {wp[0].toFixed(5)}, {wp[1].toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Bypassed Hazard Red Buffer Circles & Markers */}
        {bypassedHazards.map((hazard) => (
          <React.Fragment key={hazard.id}>
            {/* Exclusion perimeter buffer zone (250m) */}
            <Circle
              center={[hazard.latitude, hazard.longitude]}
              radius={250}
              pathOptions={{
                color: "#DC2626",
                fillColor: "#EF4444",
                fillOpacity: 0.18,
                weight: 1.5,
                dashArray: "4 4",
              }}
            />
            <Marker
              position={[hazard.latitude, hazard.longitude]}
              icon={createDangerMarkerIcon(hazard.category || "GENERAL", (hazard.severity as any) || "HIGH", 14)}
            >
              <Popup className="clean-white-popup">
                <div className="p-1.5 font-sans min-w-[180px]">
                  <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{isBn ? "বাইপাসকৃত বিপদ" : "Avoided Hazard"}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 uppercase">
                    {formatCategoryLabel(hazard.category, language)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {isBn
                      ? `যাত্রাপথ থেকে দূরত্ব: ${hazard.distanceFromRouteMeters} মিটার`
                      : `Distance from direct trajectory: ${hazard.distanceFromRouteMeters}m`}
                  </p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
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
          <span className="w-3.5 h-1 rounded-full bg-blue-600"></span>
          <span>{isBn ? "নিরাপদ পথ" : "Safe Path"}</span>
        </div>
        {isDiverted && (
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 border-b-2 border-dashed border-red-500"></span>
            <span>{isBn ? "বিপজ্জনক সরলরেখা" : "Direct Trajectory (Risky)"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
