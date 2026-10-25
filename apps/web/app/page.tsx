"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import DynamicMap from "@/components/map/DynamicMap";
import IncidentFeed from "@/components/incidents/IncidentFeed";
import ReportIncidentModal from "@/components/incidents/ReportIncidentModal";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { Layers, ListFilter, MapPin } from "lucide-react";

export default function Home() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const mapMode = useMapStore((state) => state.mode);
  const setMapMode = useMapStore((state) => state.setMode);
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);

  // Quick reset to whole Bangladesh view
  const handleResetView = () => {
    setCenter({ lat: 23.685, lng: 90.3563 });
    setZoom(7);
  };

  return (
    <main className="flex h-screen flex-col bg-surface-subtle overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        totalIncidents={incidents.length}
        onOpenReportModal={() => setReportModalOpen(true)}
      />

      {/* Main Workspace Area: Sidebar Feed + Interactive Map */}
      <div className="flex flex-1 w-full relative overflow-hidden min-h-0">
        {/* Responsive Feed Sidebar */}
        <div
          className={`${
            sidebarOpen ? "flex" : "hidden"
          } absolute md:relative inset-y-0 left-0 z-20 w-full sm:w-80 md:w-96 shadow-overlay md:shadow-none transition-all`}
        >
          <IncidentFeed />
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full h-full relative min-h-0">
          {/* Floating Map Controls overlay */}
          <div className="absolute top-4 left-4 z-[400] flex flex-wrap gap-2">
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-white hover:bg-surface-muted text-content-primary text-xs font-semibold px-3 py-1.5 rounded-md border border-surface-border shadow-card flex items-center gap-1.5 transition-colors"
              title="Toggle Alert Feed"
            >
              <ListFilter className="w-3.5 h-3.5 text-danger-critical" />
              <span>{sidebarOpen ? (language === "en" ? "Hide Feed" : "ফিড লুকান") : (language === "en" ? "Show Feed" : "ফিড দেখুন")}</span>
            </button>

            {/* Reset to BD Whole view */}
            <button
              onClick={handleResetView}
              className="bg-white hover:bg-surface-muted text-content-primary text-xs font-semibold px-3 py-1.5 rounded-md border border-surface-border shadow-card flex items-center gap-1.5 transition-colors"
              title="Fit to Bangladesh"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-primary" />
              <span>{language === "en" ? "All BD" : "সমগ্র বাংলাদেশ"}</span>
            </button>

            {/* Map Mode Buttons */}
            <div className="bg-white border border-surface-border rounded-md shadow-card p-0.5 flex gap-1">
              <button
                onClick={() => setMapMode("basic")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  mapMode === "basic"
                    ? "bg-content-primary text-white"
                    : "text-content-secondary hover:bg-surface-muted"
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setMapMode("heatmap")}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  mapMode === "heatmap"
                    ? "bg-danger-critical text-white"
                    : "text-content-secondary hover:bg-surface-muted"
                }`}
              >
                Risk Zones
              </button>
            </div>
          </div>

          {/* Dynamic Leaflet Map Component */}
          <DynamicMap />
        </div>
      </div>

      {/* Report Incident Modal */}
      <ReportIncidentModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </main>
  );
}
