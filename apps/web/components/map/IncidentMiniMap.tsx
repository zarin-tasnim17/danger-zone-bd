"use client";

import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, ZoomControl } from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import { createDangerMarkerIcon, getSeverityColors } from "@/lib/mapMarkerUtils";
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
  const colors = useMemo(() => getSeverityColors(severity), [severity]);

  const customIcon = useMemo(
    () => createDangerMarkerIcon(category, severity, 16),
    [category, severity]
  );

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
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />
        <Circle
          center={[latitude, longitude]}
          radius={radiusMeters}
          pathOptions={{
            color: colors.bg,
            fillColor: colors.bg,
            fillOpacity: 0.16,
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
