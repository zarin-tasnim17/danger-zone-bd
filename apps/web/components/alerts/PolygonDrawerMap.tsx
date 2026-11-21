"use client";

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapStore, MAP_LAYERS } from "@/store/useMapStore";
import MapLayerSwitcher from "@/components/map/MapLayerSwitcher";
import { LocateFixed } from "lucide-react";
import { createDangerMarkerIcon } from "@/lib/mapMarkerUtils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface ZoneIncidentMarkerItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  severity: string;
  coordinates: { lat: number; lng: number };
  zoneName?: string;
}

export interface AlertZoneItem {
  id: string;
  name: string;
  userId?: string;
  area?: {
    type: string;
    coordinates: [number, number][][];
  };
  coordinates?: [number, number][];
  createdAt?: string;
}

interface PolygonDrawerMapProps {
  activeCoords: [number, number][]; // [lng, lat]
  onAddPoint: (point: [number, number]) => void;
  savedZones?: AlertZoneItem[];
  selectedZoneId?: string | null;
  onSelectZone?: (zone: AlertZoneItem) => void;
  flyToCenter?: [number, number] | null;
  userLocationMarker?: [number, number] | null;
  onLocateMe?: () => void;
  isLocating?: boolean;
  zoneIncidents?: ZoneIncidentMarkerItem[];
}

// Custom Leaflet DivIcons for daylight map
const createVertexIcon = (index: number, isFirst: boolean, isClosed: boolean) => {
  if (isFirst && !isClosed) {
    return L.divIcon({
      className: "custom-vertex-start",
      html: `
        <div style="
          width: 28px;
          height: 28px;
          background: #059669;
          color: #ffffff;
          border-radius: 9999px;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 10px rgba(5,150,105,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          animation: pulse 1.8s infinite;
        ">
          1
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  return L.divIcon({
    className: "custom-vertex-node",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: #2563EB;
        color: #ffffff;
        border-radius: 9999px;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(37,99,235,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 10px;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

// Map click handler to place vertices
function MapClickHandler({ onAddPoint }: { onAddPoint: (point: [number, number]) => void }) {
  useMapEvents({
    click: (e) => {
      onAddPoint([
        parseFloat(e.latlng.lng.toFixed(5)),
        parseFloat(e.latlng.lat.toFixed(5)),
      ]);
    },
  });
  return null;
}

// Center controller for pan / zoom
function MapPanController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom || 15, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function PolygonDrawerMap({
  activeCoords,
  onAddPoint,
  savedZones = [],
  selectedZoneId,
  onSelectZone,
  flyToCenter,
  userLocationMarker,
  onLocateMe,
  isLocating = false,
  zoneIncidents = [],
}: PolygonDrawerMapProps) {
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const currentTileConfig = MAP_LAYERS[activeTileLayer] || MAP_LAYERS.google_streets;
  // Convert [lng, lat] GeoJSON coordinates to Leaflet [lat, lng]
  const leafletActivePositions: [number, number][] = activeCoords.map(([lng, lat]) => [
    lat,
    lng,
  ]);

  const isClosed =
    activeCoords.length >= 4 &&
    activeCoords[0][0] === activeCoords[activeCoords.length - 1][0] &&
    activeCoords[0][1] === activeCoords[activeCoords.length - 1][1];

  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  // Extract polygon coordinates safely for saved zones
  const parsedSavedZones = savedZones.map((zone) => {
    let rawCoords: [number, number][] = [];
    if (zone.area?.coordinates?.[0]) {
      rawCoords = zone.area.coordinates[0];
    } else if (zone.coordinates) {
      rawCoords = zone.coordinates;
    }
    const positions: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);
    return {
      ...zone,
      positions,
    };
  });

  return (
    <div className="w-full h-[340px] sm:h-[400px] lg:h-[440px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm relative z-0 bg-slate-50">
      <MapContainer
        center={[23.7925, 90.4078]} // Dhaka center
        zoom={13}
        minZoom={7}
        maxZoom={18}
        attributionControl={false}
        className="w-full h-full"
        style={{ height: "100%", width: "100%" }}
      >
        {/* Active High-Detail Tile Layer (Google Streets / Satellite Hybrid / OSM) */}
        <TileLayer
          key={activeTileLayer}
          url={currentTileConfig.url}
          attribution={currentTileConfig.attribution}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['0', '1', '2', '3']}
        />

        <MapClickHandler onAddPoint={onAddPoint} />
        <MapPanController center={flyToCenter || flyTarget} />

        {/* User GPS Pinpoint Indicator */}
        {userLocationMarker && Number.isFinite(userLocationMarker[0]) && Number.isFinite(userLocationMarker[1]) && (
          <>
            <CircleMarker
              center={userLocationMarker}
              radius={22}
              pathOptions={{
                color: "#3B82F6",
                fillColor: "#3B82F6",
                fillOpacity: 0.18,
                weight: 1.5,
              }}
            />
            <CircleMarker
              center={userLocationMarker}
              radius={7}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: "#2563EB",
                fillOpacity: 1,
                weight: 2.5,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="text-[11px] font-bold text-blue-900">
                  Your Location (GPS)
                </span>
              </Tooltip>
            </CircleMarker>
          </>
        )}

        {/* Existing Saved Alert Zones (Translucent Green/Teal) */}
        {parsedSavedZones.map((zone) => {
          if (zone.positions.length < 3) return null;
          const isSelected = selectedZoneId === zone.id;

          return (
            <Polygon
              key={zone.id}
              positions={zone.positions}
              pathOptions={{
                color: isSelected ? "#059669" : "#0D9488",
                fillColor: isSelected ? "#10B981" : "#14B8A6",
                fillOpacity: isSelected ? 0.35 : 0.15,
                weight: isSelected ? 3 : 2,
                dashArray: isSelected ? undefined : "4, 4",
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectZone?.(zone);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div className="text-xs font-semibold px-1 py-0.5 text-slate-800">
                  <div className="font-bold text-teal-800">{zone.name}</div>
                  <div className="text-[10px] text-slate-500">Active Geofence Perimeter</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Active Threats inside Monitored Geofences */}
        {zoneIncidents &&
          zoneIncidents.map((incident) => {
            if (
              !incident.coordinates ||
              typeof incident.coordinates.lat !== "number" ||
              typeof incident.coordinates.lng !== "number"
            ) {
              return null;
            }

            return (
              <Marker
                key={`zone-incident-${incident.id}`}
                position={[incident.coordinates.lat, incident.coordinates.lng]}
                icon={createDangerMarkerIcon(
                  incident.category,
                  (incident.severity || "HIGH") as any,
                  14
                )}
              >
                <Popup className="tactical-marker-popup">
                  <div className="p-1 min-w-[200px] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-red-100 text-red-800">
                        {incident.severity}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {incident.category}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {incident.title}
                    </h4>
                    {incident.description && incident.description !== incident.title && (
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {incident.description}
                      </p>
                    )}
                    {incident.zoneName && (
                      <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span>Zone: {incident.zoneName}</span>
                      </div>
                    )}
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -12]}>
                  <div className="text-xs font-semibold text-slate-900">
                    <span className="font-bold text-red-600">
                      {incident.severity}:
                    </span>{" "}
                    {incident.title}
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

        {/* Currently Drawing Active Polygon or Polyline */}
        {leafletActivePositions.length >= 3 && isClosed && (
          <Polygon
            positions={leafletActivePositions}
            pathOptions={{
              color: "#2563EB",
              fillColor: "#3B82F6",
              fillOpacity: 0.28,
              weight: 3,
            }}
          >
            <Tooltip permanent={false} direction="center">
              <span className="text-xs font-bold text-blue-800 bg-white/90 px-2 py-0.5 rounded shadow">
                Drawing Active Perimeter
              </span>
            </Tooltip>
          </Polygon>
        )}

        {/* Unclosed Polyline guide */}
        {leafletActivePositions.length >= 2 && !isClosed && (
          <Polyline
            positions={leafletActivePositions}
            pathOptions={{
              color: "#2563EB",
              weight: 3,
              dashArray: "6, 6",
            }}
          />
        )}

        {/* Closing guide dashed line from last point to first point */}
        {leafletActivePositions.length >= 3 && !isClosed && (
          <Polyline
            positions={[
              leafletActivePositions[leafletActivePositions.length - 1],
              leafletActivePositions[0],
            ]}
            pathOptions={{
              color: "#059669",
              weight: 2,
              dashArray: "4, 4",
              opacity: 0.7,
            }}
          />
        )}

        {/* Active Polygon Vertices with Order Badges */}
        {leafletActivePositions.map((pos, idx) => {
          // If closed, don't duplicate the marker for the final duplicate vertex
          if (isClosed && idx === leafletActivePositions.length - 1) return null;
          const isFirst = idx === 0;

          return (
            <Marker
              key={idx}
              position={pos}
              icon={createVertexIcon(idx, isFirst, isClosed)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  // Clicking the first vertex when 3+ points placed closes the ring
                  if (isFirst && leafletActivePositions.length >= 3 && !isClosed) {
                    onAddPoint([activeCoords[0][0], activeCoords[0][1]]);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <span className="text-[11px] font-medium text-slate-700">
                  {isFirst && !isClosed
                    ? "Click to Close Polygon Ring"
                    : `Vertex ${idx + 1}: ${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`}
                </span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend Badge (Kept clean at bottom-left without obstructing zoom controls) */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-md text-[10px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
          <span>Active Drawing</span>
        </div>
        <span className="text-slate-300">•</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
          <span>Start Point (Click to Close)</span>
        </div>
        {userLocationMarker && (
          <>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white ring-1 ring-blue-400" />
              <span>My GPS</span>
            </div>
          </>
        )}
        {savedZones.length > 0 && (
          <>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 border border-white" />
              <span>Saved Zones ({savedZones.length})</span>
            </div>
          </>
        )}
      </div>

      {/* Floating GPS Locate Button on Map (Bottom-Right) */}
      {onLocateMe && (
        <div className="absolute bottom-3 right-3 z-[1000]">
          <button
            type="button"
            onClick={onLocateMe}
            disabled={isLocating}
            className="w-9 h-9 rounded-xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 shadow-md flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md hover:text-blue-600 disabled:opacity-60"
            title="Snap to My GPS Location"
            aria-label="My GPS"
          >
            <LocateFixed className={`w-4 h-4 text-blue-600 ${isLocating ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}
    </div>
  );
}
