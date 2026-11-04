"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import DynamicMap from "@/components/map/DynamicMap";
import IncidentFeed from "@/components/incidents/IncidentFeed";
import ReportIncidentModal from "@/components/incidents/ReportIncidentModal";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useStatsStore } from "@/store/useStatsStore";
import {
  ListFilter,
  ShieldAlert,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
} from "lucide-react";

export default function Home() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const { language } = useLanguageStore();
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
      (i) => i.severity.toUpperCase() === "HIGH" || i.severity === "critical"
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
        onOpenReportModal={() => setReportModalOpen(true)}
        showFilters={true}
      />

      {/* Main Workspace Area: Responsive 2-Pane Command Layout */}
      <div className="flex flex-1 w-full relative overflow-hidden min-h-0 bg-slate-100">
        {/* Desktop Collapsible Left Sidebar */}
        <div
          className={`hidden md:flex flex-col h-full border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 ${
            desktopSidebarOpen ? "w-80 lg:w-96" : "w-0 overflow-hidden border-none"
          }`}
        >
          <IncidentFeed />
        </div>

        {/* Map Viewport Area */}
        <div className="flex-1 w-full h-full relative min-h-0 bg-slate-100">
          {/* Floating Situational Telemetry & Sidebar Toggle HUD (Top-Left) */}
          <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className="pointer-events-auto hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-md transition-all active:scale-95"
              title={desktopSidebarOpen ? "Collapse Feed" : "Expand Feed"}
            >
              <ListFilter className="w-3.5 h-3.5 text-red-600" />
              <span>
                {desktopSidebarOpen
                  ? language === "en"
                    ? "Hide Feed"
                    : "ফিড লুকান"
                  : language === "en"
                  ? "Show Feed"
                  : "ফিড দেখুন"}
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-50 text-red-700 border border-red-200 shadow-2xs"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title="Filter High Severity Threats"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
                <span>{criticalCount}</span>
                <span className="hidden lg:inline text-[10px] text-red-700 uppercase font-mono">
                  {language === "en" ? "Critical" : "উচ্চ ঝুঁকি"}
                </span>
              </button>

              <span className="text-slate-300">|</span>

              {/* Total Active Threats */}
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
                title="View All Incidents"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                <span>{activeCount}</span>
                <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">
                  {language === "en" ? "Active" : "সক্রিয়"}
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
                  {language === "en" ? "Safe Havens" : "আশ্রয়স্থল"}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Leaflet Map Component */}
          <DynamicMap />

          {/* Mobile Bottom Sheet Trigger Bar */}
          <div className="md:hidden absolute bottom-5 inset-x-4 z-[400] flex justify-center pointer-events-none">
            <button
              onClick={() => setMobileSheetOpen(true)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 backdrop-blur-2xl border border-slate-200 text-slate-800 text-xs font-bold shadow-xl active:scale-95 transition-all ring-1 ring-blue-500/20"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>
                {language === "en"
                  ? `${incidents.length} Hazards in View`
                  : `${incidents.length}টি সক্রিয় বিপদ`}
              </span>
              <span className="text-slate-300 font-normal">|</span>
              <span className="text-blue-600 flex items-center gap-0.5 font-bold">
                <span>{language === "en" ? "View Feed" : "ফিড দেখুন"}</span>
                <ChevronUp className="w-3.5 h-3.5" />
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

          <div className="bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="p-3 pb-1 flex flex-col items-center border-b border-slate-100">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 mb-2" />
              <div className="w-full flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {language === "en" ? "Live Danger Feed" : "সরাসরি বিপদ সংকেতসমূহ"}
                </span>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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

      {/* Report Incident Modal (Mounted with z-[2000] above all HUD elements) */}
      <ReportIncidentModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </main>
  );
}
