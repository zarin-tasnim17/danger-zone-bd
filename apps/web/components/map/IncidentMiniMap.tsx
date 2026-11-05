"use client";

import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, ZoomControl } from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import L from "leaflet";
import Link from "next/link";
import { ExternalLink, Navigation } from "lucide-react";

interface IncidentMiniMapProps {
  latitude: number;
  longitude: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  radiusMeters?: number;
}

export default function IncidentMiniMap({
  latitude,
  longitude,
  severity,
  category,
  radiusMeters = 150,
}: IncidentMiniMapProps) {
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  const isHigh = severity === "HIGH";
  const isMedium = severity === "MEDIUM";

  const colorConfig = useMemo(() => {
    if (isHigh) {
      return {
        bg: "#DC2626",
        fill: "#EF4444",
        border: "#B91C1C",
      };
    }
    if (isMedium) {
      return {
        bg: "#EA580C",
        fill: "#F97316",
        border: "#C2410C",
      };
    }
    return {
      bg: "#CA8A04",
      fill: "#EAB308",
      border: "#A16207",
    };
  }, [isHigh, isMedium]);

  const customIcon = useMemo(() => {
    return L.divIcon({
      className: "incident-mini-pin",
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <span class="animate-ping" style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: ${colorConfig.fill};
            opacity: 0.6;
          "></span>
          <div style="
            position: relative;
            background-color: ${colorConfig.bg};
            border: 2px solid #FFFFFF;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, [colorConfig]);

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100 select-none">
      <div className="absolute top-3 right-3 z-[500]">
        <MapLayerSwitcher compact />
      </div>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains}
        />
        <Circle
          center={[latitude, longitude]}
          radius={radiusMeters}
          pathOptions={{
            color: colorConfig.border,
            fillColor: colorConfig.fill,
            fillOpacity: 0.18,
            weight: 2,
            dashArray: "4, 6",
          }}
        />

        <Marker position={[latitude, longitude]} icon={customIcon} />

        <ZoomControl position="bottomright" />
      </MapContainer>

      {/* Floating Tactical Overlay Pill */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xs text-[11px] font-semibold text-slate-700">
        <Navigation className="w-3.5 h-3.5 text-blue-600" />
        <span>150m Privacy Fuzzed Perimeter</span>
      </div>

      {/* Link to Full Radar Map */}
      <Link
        href={`/?lat=${latitude}&lng=${longitude}&zoom=16`}
        className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white backdrop-blur-md border border-slate-200/80 shadow-xs hover:shadow text-xs font-bold text-slate-800 hover:text-blue-600 transition-all active:scale-95"
      >
        <span>Open in Live Radar</span>
        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
      </Link>
    </div>
  );
}
