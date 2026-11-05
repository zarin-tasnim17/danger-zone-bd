"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import DynamicMap from "@/components/map/DynamicMap";
import IncidentFeed from "@/components/incidents/IncidentFeed";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useStatsStore } from "@/store/useStatsStore";
import { useMapStore } from "@/store/useMapStore";
import {
  ListFilter,
  ShieldAlert,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  PhoneCall,
} from "lucide-react";

export default function Home() {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const openSosModal = useMapStore((state) => state.openSosModal);

  const { language } = useLanguageStore();
  const isBn = language === "bn";
  const incidents = useIncidentStore((state) => state.incidents);
  const safeZones = useIncidentStore((state) => state.safeZones);
  const fetchSafeZones = useIncidentStore((state) => state.fetchSafeZones);
  const initSocketListeners = useIncidentStore((state) => state.initSocketListeners);
  const initAuth = useAuthStore((state) => state.initAuth);
  const { selectedSeverity, setSeverity, resetFilters } = useFilterStore();

  const stats = useStatsStore((state) => state.stats);
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const initStatsListener = useStatsStore((state) => state.initStatsListener);

  // Initialize transparent device authentication, safe zones, and live DB stats on mount
  useEffect(() => {
    initAuth();
    fetchSafeZones();
    fetchStats();
    initSocketListeners();
    initStatsListener();
  }, [initAuth, fetchSafeZones, fetchStats, initSocketListeners, initStatsListener]);

  // Telemetry Metrics (Derived directly from PostgreSQL database via stats endpoint)
  const criticalCount = useMemo(() => {
    if (stats && typeof stats.criticalThreats === "number") {
      return stats.criticalThreats;
    }
    return incidents.filter(
      (i) => i.severity.toUpperCase() === "HIGH" || i.severity.toLowerCase() === "critical"
    ).length;
  }, [stats, incidents]);

  const activeCount = useMemo(() => {
    if (stats && typeof stats.activeReports === "number") {
      return stats.activeReports;
    }
    return incidents.length;
  }, [stats, incidents.length]);

  const safeCount = useMemo(() => {
    if (stats && typeof stats.safeHavens === "number") {
      return stats.safeHavens;
    }
    return safeZones.length;
  }, [stats, safeZones.length]);

  return (
    <main className="flex h-screen flex-col bg-slate-100 text-slate-900 overflow-hidden font-sans select-none">
      {/* Top Command Navigation Header with integrated Filters & Search */}
      <Navbar
        totalIncidents={activeCount}
        showFilters={true}
      />

      {/* Main Workspace Area: Responsive 2-Pane Command Layout */}
      <div className="flex flex-1 w-full relative overflow-hidden min-h-0 bg-slate-100">
        {/* Desktop Collapsible Left Sidebar */}
        <div
          className={`hidden md:flex flex-col h-full border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 ${
            desktopSidebarOpen ? "w-80 lg:w-[380px] xl:w-[420px]" : "w-0 overflow-hidden border-none"
          }`}
        >
          <IncidentFeed />
        </div>

        {/* Map Viewport Area */}
        <div className="flex-1 w-full h-full relative min-h-0 bg-slate-100">
          {/* Floating Situational Telemetry & Sidebar Toggle HUD (Top-Left, Desktop/Tablet only to avoid mobile overlap) */}
          <div className="hidden sm:flex absolute top-4 left-4 z-[400] flex-wrap items-center gap-2 pointer-events-none max-w-[calc(100%-80px)]">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className="pointer-events-auto hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              title={desktopSidebarOpen ? (isBn ? "ফিড লুকান" : "Collapse Feed") : (isBn ? "ফিড দেখুন" : "Expand Feed")}
            >
              <ListFilter className="w-3.5 h-3.5 text-red-600" />
              <span>
                {desktopSidebarOpen
                  ? isBn ? "ফিড লুকান" : "Hide Feed"
                  : isBn ? "ফিড দেখুন" : "Show Feed"}
              </span>
              {desktopSidebarOpen ? (
                <ChevronLeft className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
            </button>

            {/* Situational Telemetry Dock (Connected to Real Database Counts) */}
            <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-1 shadow-md">
              {/* Critical Red Zones Counter / Filter */}
              <button
                onClick={() =>
                  setSeverity(selectedSeverity === "HIGH" ? "all" : "HIGH")
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-50 text-red-700 border border-red-200 shadow-2xs"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title="Filter High Severity Threats"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span>{criticalCount}</span>
                <span className="hidden lg:inline text-[10px] text-red-700 uppercase font-mono">
                  {isBn ? "উচ্চ ঝুঁকি" : "Critical"}
                </span>
              </button>

              <span className="text-slate-300">|</span>

              {/* Total Active Threats */}
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="View All Incidents"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                <span>{activeCount}</span>
                <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">
                  {isBn ? "সক্রিয়" : "Active"}
                </span>
              </button>

              <span className="text-slate-300">|</span>

              {/* Safe Shelters Count */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-700"
                title="Verified Safe Havens in Bangladesh"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{safeCount}</span>
                <span className="hidden lg:inline text-[10px] text-emerald-700 font-mono">
                  {isBn ? "আশ্রয়স্থল" : "Safe Havens"}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Leaflet Map Component */}
          <DynamicMap />

          {/* Mobile Floating Bottom Action Dock: Unified Hazards Feed + SOS 999 Side-by-Side */}
          <div className="md:hidden fixed bottom-4 inset-x-3 z-[1000] flex items-center gap-2 pointer-events-none">
            {/* Hazards in View Trigger */}
            <button
              onClick={() => setMobileSheetOpen(true)}
              className="pointer-events-auto flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200 text-slate-800 text-xs font-bold shadow-xl active:scale-95 transition-all ring-1 ring-blue-500/20 cursor-pointer min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="truncate text-xs">
                  {isBn
                    ? `${incidents.length}টি সক্রিয় বিপদ`
                    : `${incidents.length} Hazards in View`}
                </span>
              </div>
              <span className="text-blue-600 flex items-center gap-0.5 font-bold shrink-0 ml-1.5 text-xs">
                <span>{isBn ? "ফিড" : "Feed"}</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Mobile Emergency SOS 999 Button */}
            <button
              onClick={openSosModal}
              className="pointer-events-auto shrink-0 flex items-center gap-1.5 bg-slate-900/95 hover:bg-slate-950 text-white font-semibold px-3.5 py-2.5 rounded-full shadow-xl border border-slate-700/60 backdrop-blur-md active:scale-95 transition-all cursor-pointer group hover:border-rose-500/50"
              title={isBn ? "জরুরি জাতীয় সহায়তা (৯৯৯)" : "Emergency SOS Help (999)"}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 group-hover:bg-rose-400" />
              <PhoneCall className="w-3.5 h-3.5 text-rose-400 group-hover:text-white transition-colors" />
              <span className="text-xs uppercase tracking-wider font-bold text-slate-200 group-hover:text-white whitespace-nowrap">
                {isBn ? "৯৯৯" : "SOS 999"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sliding Bottom Sheet Modal */}
      {mobileSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[1500] flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setMobileSheetOpen(false)}
            aria-hidden="true"
          />

          <div className="bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="p-3 pb-1.5 flex flex-col items-center border-b border-slate-100">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 mb-2" />
              <div className="w-full flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {isBn ? "সরাসরি বিপদ সংকেতসমূহ" : "Live Threat Feed"}
                </span>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close feed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Feed inside bottom sheet */}
            <div className="flex-1 overflow-y-auto">
              <IncidentFeed onIncidentSelect={() => setMobileSheetOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
