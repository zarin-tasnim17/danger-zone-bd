"use client";

import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Hospital,
  Shield,
  Pill,
  Navigation,
  ExternalLink,
  Crosshair,
  Maximize2,
  PhoneCall,
} from "lucide-react";

export interface SafeZoneItem {
  id: string;
  name: string;
  type: "HOSPITAL" | "POLICE_BOX" | "PHARMACY";
  latitude: number;
  longitude: number;
  createdAt?: string;
  distanceMeters?: number | string;
}

interface SafeZonesMapProps {
  safeZones: SafeZoneItem[];
  selectedZone: SafeZoneItem | null;
  onSelectZone: (zone: SafeZoneItem) => void;
  userLocation: { lat: number; lng: number } | null;
  language?: "en" | "bn";
  onNavigateSafeRoute?: (zone: SafeZoneItem) => void;
  className?: string;
}

// Map camera controller for smooth transitions
function MapController({
  selectedZone,
  userLocation,
  safeZones,
}: {
  selectedZone: SafeZoneItem | null;
  userLocation: { lat: number; lng: number } | null;
  safeZones: SafeZoneItem[];
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedZone) {
      map.flyTo([selectedZone.latitude, selectedZone.longitude], 15, {
        duration: 1.2,
      });
    }
  }, [selectedZone, map]);

  return null;
}

// Create custom pin icons for each safe haven type
function createSafeHavenIcon(type: "HOSPITAL" | "POLICE_BOX" | "PHARMACY", isSelected: boolean) {
  let bgColor = "#2563EB"; // Blue for hospital
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`;

  if (type === "POLICE_BOX") {
    bgColor = "#4F46E5"; // Indigo for police
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  } else if (type === "PHARMACY") {
    bgColor = "#059669"; // Emerald for pharmacy
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
  }

  const size = isSelected ? 40 : 32;
  const ringSize = isSelected ? 48 : 32;

  return L.divIcon({
    className: "safe-haven-marker",
    html: `
      <div style="
        position: relative;
        width: ${ringSize}px;
        height: ${ringSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${
          isSelected
            ? `<div style="
                position: absolute;
                inset: 0;
                border-radius: 9999px;
                background-color: ${bgColor}33;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>`
            : ""
        }
        <div style="
          background-color: ${bgColor};
          border: 2.5px solid #FFFFFF;
          width: ${size}px;
          height: ${size}px;
          border-radius: ${type === "POLICE_BOX" ? "12px" : "10px"};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          box-shadow: 0 4px 12px ${bgColor}55, 0 2px 5px rgba(15,23,42,0.15);
          cursor: pointer;
          transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
          transition: transform 0.2s ease;
        ">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
    popupAnchor: [0, -ringSize / 2],
  });
}

// User live location GPS marker
const userLocationIcon = L.divIcon({
  className: "user-live-gps-pin",
  html: `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 9999px;
        background: rgba(37, 99, 235, 0.25);
        animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: #2563EB;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 0 10px rgba(37, 99, 235, 0.6);
      "></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function SafeZonesMap({
  safeZones,
  selectedZone,
  onSelectZone,
  userLocation,
  language = "en",
  onNavigateSafeRoute,
  className = "w-full h-full min-h-[420px]",
}: SafeZonesMapProps) {
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  const isBn = language === "bn";

  // Center coordinate: selected zone > user location > default Dhaka center
  const defaultCenter: [number, number] = useMemo(() => {
    if (selectedZone) return [selectedZone.latitude, selectedZone.longitude];
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [23.7565, 90.3888]; // Dhaka center
  }, [selectedZone, userLocation]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 z-0 select-none ${className}`}>
      <div className="absolute top-3 right-3 z-[500]">
        <MapLayerSwitcher compact />
      </div>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        minZoom={6}
        maxZoom={20}
        attributionControl={false}
        className="w-full h-full"
      >
        <MapController
          selectedZone={selectedZone}
          userLocation={userLocation}
          safeZones={safeZones}
        />

        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        {/* User live position circle and marker */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={300}
              pathOptions={{
                color: "#2563EB",
                fillColor: "#3B82F6",
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: "4 4",
              }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userLocationIcon}
            >
              <Popup className="clean-white-popup">
                <div className="p-1 text-center font-sans">
                  <p className="text-[11px] font-bold text-blue-700">
                    {isBn ? "আপনার বর্তমান অবস্থান" : "Your Current Location"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Safe Haven Markers */}
        {safeZones.map((zone) => {
          const isSelected = selectedZone?.id === zone.id;
          const icon = createSafeHavenIcon(zone.type, isSelected);

          const typeLabel =
            zone.type === "HOSPITAL"
              ? isBn ? "জরুরি হাসপাতাল" : "Emergency Hospital"
              : zone.type === "POLICE_BOX"
              ? isBn ? "পুলিশ বক্স / ফাঁড়ি" : "Police Outpost / Box"
              : isBn ? "২৪/৭ ফার্মেসি" : "24/7 Pharmacy";

          return (
            <Marker
              key={zone.id}
              position={[zone.latitude, zone.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectZone(zone),
              }}
            >
              <Popup className="clean-white-popup">
                <div className="p-2 min-w-[220px] max-w-[280px] font-sans">
                  {/* Type badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        zone.type === "HOSPITAL"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : zone.type === "POLICE_BOX"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {typeLabel}
                    </span>

                    {zone.distanceMeters && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        {Number(zone.distanceMeters) >= 1000
                          ? `${(Number(zone.distanceMeters) / 1000).toFixed(1)} km`
                          : `${Math.round(Number(zone.distanceMeters))} m`}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1">
                    {zone.name}
                  </h4>

                  <p className="text-[10px] text-slate-500 font-mono mb-3">
                    {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                    {onNavigateSafeRoute && (
                      <button
                        onClick={() => onNavigateSafeRoute(zone)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 !text-white text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                        style={{ color: '#ffffff' }}
                      >
                        <Navigation className="w-3 h-3 !text-white" style={{ color: '#ffffff' }} />
                        <span className="!text-white font-bold" style={{ color: '#ffffff' }}>{isBn ? "নিরাপদ পথে চলুন" : "Navigate via Safe Path"}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${zone.latitude},${zone.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg transition-colors border border-slate-200"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>

                      <a
                        href="tel:999"
                        className="flex items-center justify-center gap-1 py-1 px-2 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg transition-colors border border-red-200 shrink-0"
                        title="Emergency 999"
                      >
                        <PhoneCall className="w-2.5 h-2.5" />
                        <span>999</span>
                      </a>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-3 py-2 shadow-md z-[1000] text-[10px] font-semibold text-slate-700 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span>{isBn ? "হাসপাতাল" : "Hospital"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
          <span>{isBn ? "পুলিশ বক্স" : "Police Box"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          <span>{isBn ? "ফার্মেসি" : "Pharmacy"}</span>
        </div>
      </div>
    </div>
  );
}
