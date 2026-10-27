"use client";

import React from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

interface PolygonDrawerMapProps {
  coordinates: [number, number][]; // [lng, lat]
  onAddPoint: (point: [number, number]) => void;
}

function MapClickHandler({ onAddPoint }: { onAddPoint: (point: [number, number]) => void }) {
  useMapEvents({
    click: (e) => {
      // e.latlng contains lat and lng
      onAddPoint([
        parseFloat(e.latlng.lng.toFixed(5)),
        parseFloat(e.latlng.lat.toFixed(5)),
      ]);
    },
  });
  return null;
}

export default function PolygonDrawerMap({
  coordinates,
  onAddPoint,
}: PolygonDrawerMapProps) {
  // Leaflet uses [lat, lng], whereas GeoJSON uses [lng, lat]
  const leafletPositions: [number, number][] = coordinates.map(([lng, lat]) => [lat, lng]);

  return (
    <div className="w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-slate-700 relative z-0">
      <MapContainer
        center={[23.7925, 90.4078]} // Dhaka center default
        zoom={13}
        minZoom={8}
        maxZoom={18}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CartoDB'
        />

        <MapClickHandler onAddPoint={onAddPoint} />

        {/* Drawn Polygon */}
        {leafletPositions.length >= 3 && (
          <Polygon
            positions={leafletPositions}
            pathOptions={{
              color: "#6366F1",
              fillColor: "#6366F1",
              fillOpacity: 0.25,
              weight: 2,
            }}
          />
        )}

        {/* Vertex Markers */}
        {leafletPositions.map((pos, idx) => (
          <CircleMarker
            key={idx}
            center={pos}
            radius={5}
            pathOptions={{
              color: "#FFFFFF",
              fillColor: idx === 0 ? "#10B981" : "#6366F1",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
