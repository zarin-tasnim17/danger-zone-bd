"use client";

import { useMemo, useEffect, Fragment } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { useMapStore } from "@/store/useMapStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { DangerIncident, IncidentSeverity } from "@repo/shared";
import { getTranslation } from "@/lib/translations";
import L from "leaflet";

// Create custom high-visibility solid marker icons without gradients
function createCustomIcon(severity: IncidentSeverity) {
  const colorMap: Record<IncidentSeverity, { bg: string; border: string; label: string }> = {
    critical: { bg: "#DC2626", border: "#991B1B", label: "!" },
    high: { bg: "#EA580C", border: "#C2410C", label: "▲" },
    medium: { bg: "#CA8A04", border: "#A16207", label: "●" },
    low: { bg: "#16A34A", border: "#15803D", label: "✓" },
  };

  const config = colorMap[severity] || colorMap.medium;

  return L.divIcon({
    className: "custom-danger-pin",
    html: `
      <div style="
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
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25);
        cursor: pointer;
      ">
        ${config.label}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
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

export default function MapClient() {
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const t = getTranslation(language);

  // Filter incidents based on active user filters
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (selectedSeverity !== "all" && item.severity !== selectedSeverity) {
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
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <MapViewUpdater center={center} zoom={zoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredIncidents.map((incident: DangerIncident) => {
          const icon = createCustomIcon(incident.severity);
          const isCritical = incident.severity === "critical";

          return (
            <Fragment key={incident.id}>
              {/* Radius overlay for high-severity danger perimeters */}
              {isCritical && (
                <Circle
                  center={[incident.coordinates.lat, incident.coordinates.lng]}
                  radius={700}
                  pathOptions={{
                    color: "#DC2626",
                    fillColor: "#DC2626",
                    fillOpacity: 0.12,
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
                  <div className="p-3 max-w-[280px] bg-white text-content-primary">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          incident.severity === "critical"
                            ? "bg-danger-critical text-white"
                            : incident.severity === "high"
                            ? "bg-danger-warning text-white"
                            : "bg-danger-caution text-white"
                        }`}
                      >
                        {t.severity[incident.severity] || incident.severity}
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
                      <span className="truncate">
                        📍 {language === "bn" && incident.locationNameBn ? incident.locationNameBn : incident.locationName}
                      </span>
                      <span className="font-medium text-brand-primary shrink-0">
                        {incident.upvotes} {language === "en" ? "Confirms" : "যাচাই"}
                      </span>
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
