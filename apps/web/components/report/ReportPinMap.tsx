"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";

interface ReportPinMapProps {
  proximityRadius?: number;
  incidentLat: number;
  incidentLng: number;
  deviceLat?: number | null;
  deviceLng?: number | null;
  proximityDistance?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  onSnapToDevice?: () => void;
  onLocateMe?: () => void;
  isLocating?: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH";
  language?: "en" | "bn";
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onLocationChange(
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6))
      );
    },
  });
  return null;
}

export default function ReportPinMap({
  incidentLat,
  incidentLng,
  deviceLat,
  deviceLng,
  proximityDistance,
  proximityRadius = 200,
  onLocationChange,
  onSnapToDevice,
  onLocateMe,
  isLocating = false,
  severity,
  language = "en",
}: ReportPinMapProps) {
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  const isBn = language === "bn";
  const isWithinProximity =
    proximityDistance === null ||
    proximityDistance === undefined ||
    proximityDistance <= (proximityRadius || 200);

  const severityColor =
    severity === "HIGH"
      ? "#DC2626"
      : severity === "MEDIUM"
      ? "#F59E0B"
      : "#10B981";

  const hasDeviceGps =
    typeof deviceLat === "number" &&
    typeof deviceLng === "number" &&
    !isNaN(deviceLat) &&
    !isNaN(deviceLng);

  return (
    <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-xs z-0 select-none bg-slate-100">
      <div className="absolute top-3 right-3 z-[500]">
        <MapLayerSwitcher compact />
      </div>
      <MapContainer
        center={[incidentLat, incidentLng]}
        zoom={15}
        minZoom={6}
        maxZoom={20}
        attributionControl={false}
        className="w-full h-full"
      >
        <ChangeView center={[incidentLat, incidentLng]} />
        <MapClickHandler onLocationChange={onLocationChange} />

        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        {/* 200m Proximity Radar Zone around Citizen's Real Device GPS */}
        {hasDeviceGps && (
          <>
            <Circle
              center={[deviceLat!, deviceLng!]}
              radius={proximityRadius || 200}
              pathOptions={{
                color: isWithinProximity ? "#10B981" : "#EF4444",
                fillColor: isWithinProximity ? "#10B981" : "#EF4444",
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "5 5",
              }}
            />

            {/* Device Marker */}
            <CircleMarker
              center={[deviceLat!, deviceLng!]}
              radius={7}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: "#2563EB",
                fillOpacity: 1,
                weight: 2,
              }}
            />
          </>
        )}

        {/* Selected Incident Pin */}
        <CircleMarker
          center={[incidentLat, incidentLng]}
          radius={11}
          pathOptions={{
            color: "#FFFFFF",
            fillColor: severityColor,
            fillOpacity: 1,
            weight: 3,
          }}
        />
        <CircleMarker
          center={[incidentLat, incidentLng]}
          radius={22}
          pathOptions={{
            color: severityColor,
            fillColor: severityColor,
            fillOpacity: 0.2,
            weight: 1,
          }}
        />
      </MapContainer>

      {/* Floating Action Controls (Bottom-Right) */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2">
        {(onLocateMe || (hasDeviceGps && onSnapToDevice)) && (
          <button
            type="button"
            onClick={onLocateMe || onSnapToDevice}
            disabled={isLocating}
            className="w-9 h-9 rounded-xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 shadow-md flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md hover:text-blue-600 disabled:opacity-60"
            title={isBn ? "আমার বর্তমান জিপিএস স্থানে পিন বসান" : "Snap pin to current GPS location"}
            aria-label={isBn ? "আমার বর্তমান অবস্থান" : "Use current location"}
          >
            <Crosshair className={`w-4 h-4 text-blue-600 ${isLocating ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Help text at bottom-left */}
      <div className="absolute bottom-2 left-3 z-[1000] pointer-events-none hidden sm:block">
        <span className="text-[10px] font-medium text-slate-600 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
          {hasDeviceGps ? "Blue dot = Your Device • Colored circle = 200m Radar" : "Click anywhere on map to reposition hazard pin"}
        </span>
      </div>
    </div>
  );
}
