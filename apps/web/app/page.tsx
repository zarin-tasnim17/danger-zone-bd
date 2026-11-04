"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import RouteTestNav from "@/components/layout/RouteTestNav";
import DynamicMap from "@/components/map/DynamicMap";
import IncidentFeed from "@/components/incidents/IncidentFeed";
import ReportIncidentModal from "@/components/incidents/ReportIncidentModal";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  ListFilter,
  ShieldAlert,
  Shield,
  Radio,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const safeZones = useIncidentStore((state) => state.safeZones);
  const initAuth = useAuthStore((state) => state.initAuth);
  const { selectedSeverity, setSeverity, resetFilters } = useFilterStore();

  // Initialize transparent device authentication on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Telemetry Metrics
  const criticalCount = useMemo(() => {
    return incidents.filter(
      (i) => i.severity.toUpperCase() === "HIGH" || i.severity === "critical"
    ).length;
  }, [incidents]);

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Route Quick-Tester Strip (Defaults to collapsed for clean look) */}
      <RouteTestNav />

      {/* Top Command Navigation Header with integrated Filters and Search */}
      <Navbar
        totalIncidents={incidents.length}
        onOpenReportModal={() => setReportModalOpen(true)}
        showFilters={true}
      />

      {/* Main Workspace Area: Responsive 2-Pane Command Layout */}
      <div className="flex flex-1 w-full relative overflow-hidden min-h-0">
        {/* Desktop Collapsible Left Sidebar */}
        <div
          className={`hidden md:flex flex-col h-full border-r border-slate-800/80 transition-all duration-300 ease-in-out shrink-0 ${
            desktopSidebarOpen ? "w-80 lg:w-96" : "w-0 overflow-hidden border-none"
          }`}
        >
          <IncidentFeed />
        </div>

        {/* Map Viewport Area */}
        <div className="flex-1 w-full h-full relative min-h-0 bg-slate-950">
          {/* Floating Situational Telemetry & Sidebar Toggle HUD (Top-Left) */}
          <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className="pointer-events-auto hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold shadow-2xl transition-all active:scale-95"
              title={desktopSidebarOpen ? "Collapse Feed" : "Expand Feed"}
            >
              <ListFilter className="w-3.5 h-3.5 text-red-400" />
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
                <ChevronLeft className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
            </button>

            {/* Situational Telemetry Dock */}
            <div className="pointer-events-auto flex items-center gap-1 bg-slate-950/85 backdrop-blur-xl border border-slate-800 rounded-2xl p-1 shadow-2xl">
              {/* Critical Red Zones Counter / Filter */}
              <button
                onClick={() =>
                  setSeverity(selectedSeverity === "HIGH" ? "all" : "HIGH")
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-950 text-red-300 border border-red-800 shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
                title="Filter High Severity Threats"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span>{criticalCount}</span>
                <span className="hidden lg:inline text-[10px] text-red-400 uppercase font-mono">
                  {language === "en" ? "Critical" : "উচ্চ ঝুঁকি"}
                </span>
              </button>

              <span className="text-slate-700">|</span>

              {/* Total Active Threats */}
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition"
                title="View All Incidents"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                <span>{incidents.length}</span>
                <span className="hidden lg:inline text-[10px] text-slate-400 font-mono">
                  {language === "en" ? "Active" : "সক্রিয়"}
                </span>
              </button>

              <span className="text-slate-700">|</span>

              {/* Safe Shelters Count */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-300"
                title="Verified Safe Havens in Bangladesh"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{safeZones.length}</span>
                <span className="hidden lg:inline text-[10px] text-emerald-400 font-mono">
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
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-950/95 backdrop-blur-2xl border border-slate-700 text-white text-xs font-bold shadow-2xl active:scale-95 transition-all ring-1 ring-blue-500/40"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>
                {language === "en"
                  ? `⚡ ${incidents.length} Hazards in View`
                  : `⚡ ${incidents.length}টি সক্রিয় বিপদ`}
              </span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-blue-400 flex items-center gap-0.5">
                <span>{language === "en" ? "View Feed" : "ফিড দেখুন"}</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sliding Bottom Sheet Modal */}
      {mobileSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setMobileSheetOpen(false)}
            aria-hidden="true"
          />

          <div className="bg-slate-900 border-t border-slate-700 rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="p-3 pb-1 flex flex-col items-center border-b border-slate-800">
              <div className="w-12 h-1.5 rounded-full bg-slate-700 mb-2" />
              <div className="w-full flex items-center justify-between px-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {language === "en" ? "Live Danger Feed" : "সরাসরি বিপদ সংকেতসমূহ"}
                </span>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
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

      {/* Report Incident Modal */}
      <ReportIncidentModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </main>
  );
}
