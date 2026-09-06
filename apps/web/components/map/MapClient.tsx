"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import { useMapStore } from "@/store/useMapStore";
import { useEffect } from "react";
import L from "leaflet";

// Fix default icon paths for Leaflet in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapClient() {
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const mapMode = useMapStore((state) => state.mode);

  useEffect(() => {
    // Mode changing logic would go here for future implementation
    console.log("Map Mode:", mapMode);
  }, [mapMode]);

  return (
    <div className="w-full h-full z-0 relative">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Future scope: Markers, Heatmap layers, Safe Zones go here */}
      </MapContainer>
    </div>
  );
}
