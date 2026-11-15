"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { formatCategoryLabel } from "@/lib/incidentUtils";
import { showToast } from "@/store/useToastStore";
import type {
  SafeRouteOutput,
  RouteAlternative,
  NavigationStep,
  TransportMode,
  RouteSafetyRating,
} from "@repo/shared";
import {
  Navigation,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Route,
  Activity,
  Compass,
  CheckCircle2,
  RefreshCw,
  Crosshair,
  ArrowDownUp,
  Share2,
  ExternalLink,
  Clock,
  Car,
  Footprints,
  Check,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";
import LocationSearchBar, { GeocodedLocation } from "@/components/map/LocationSearchBar";

// Dynamically import Leaflet Map with ssr: false
const RoutePathMap = dynamic(
  () => import("@/components/routes/RoutePathMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading interactive route map...</span>
      </div>
    ),
  }
);

const ROUTE_PRESETS = [
  {
    nameEn: "Khulna Royal Square → Station (Fix Road Network)",
    nameBn: "খুলনা রয়েল মোড় → স্টেশন (সড়ক নেটওয়ার্ক ফিক্স)",
    start: { lat: 22.8116, lng: 89.5611 },
    end: { lat: 22.802473, lng: 89.558654 },
  },
  {
    nameEn: "Farmgate → Banani (High Crime Corridor)",
    nameBn: "ফার্মগেট → বনানী (উচ্চ ছিনতাই প্রবণ করিডোর)",
    start: { lat: 23.7570, lng: 90.3905 },
    end: { lat: 23.7925, lng: 90.4078 },
  },
  {
    nameEn: "Mohakhali → Gulshan 2 (Night Corridor)",
    nameBn: "মহাখালী → গুলশান ২ (অন্ধকার সড়ক করিডোর)",
    start: { lat: 23.7776, lng: 90.4054 },
    end: { lat: 23.7979, lng: 90.4144 },
  },
  {
    nameEn: "Dhanmondi 27 → Shahbagh (Unlit Segments)",
    nameBn: "ধানমন্ডি ২৭ → শাহবাগ (আলোহীন রাস্তা)",
    start: { lat: 23.7533, lng: 90.3768 },
    end: { lat: 23.7388, lng: 90.3957 },
  },
  {
    nameEn: "GEC Circle → Agrabad, Chittagong",
    nameBn: "জিইসি মোড় → আগ্রাবাদ, চট্টগ্রাম",
    start: { lat: 22.3592, lng: 91.8217 },
    end: { lat: 22.3275, lng: 91.8122 },
  },
];

export default function RoutesPage() {
  const { initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Coordinates
  const [startLat, setStartLat] = useState("");
  const [startLng, setStartLng] = useState("");
  const [endLat, setEndLat] = useState("");
  const [endLng, setEndLng] = useState("");
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);

  // Transport Mode
  const [mode, setMode] = useState<TransportMode>("driving");

  // Map Click Picking Mode
  const [clickMode, setClickMode] = useState<"START" | "END" | "NONE">("NONE");

  // Route State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SafeRouteOutput | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("safest");
  const [showGuidanceSteps, setShowGuidanceSteps] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Core Safe Path calculation
  const calculateSafePath = useCallback(
    async (
      sLat: number,
      sLng: number,
      eLat: number,
      eLng: number,
      targetMode: TransportMode = mode
    ) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
          throw new Error("Please enter valid start and destination coordinates.");
        }

        const data = await apiFetch<SafeRouteOutput>("/routes/safe-path", {
          method: "POST",
          body: JSON.stringify({
            startLat: sLat,
            startLng: sLng,
            endLat: eLat,
            endLng: eLng,
            mode: targetMode,
          }),
        });

        setResult(data);
        // Default selected route to the recommended one
        const rec = data.routes?.find((r) => r.isRecommended);
        if (rec) {
          setSelectedRouteId(rec.id);
        } else if (data.routes && data.routes.length > 0) {
          setSelectedRouteId(data.routes[0].id);
        }
      } catch (err: any) {
        setError(err.message || "Failed to calculate safe route");
      } finally {
        setIsLoading(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    initAuth();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qStartLat = params.get("startLat");
      const qStartLng = params.get("startLng");
      const qEndLat = params.get("endLat");
      const qEndLng = params.get("endLng");
      const qMode = params.get("mode") as TransportMode;
      const qDestName = params.get("destName") || params.get("name");

      if (qStartLat) setStartLat(qStartLat);
      if (qStartLng) setStartLng(qStartLng);
      if (qEndLat) setEndLat(qEndLat);
      if (qEndLng) setEndLng(qEndLng);
      if (qMode === "walking" || qMode === "driving") setMode(qMode);
      if (qDestName) setDestinationLabel(decodeURIComponent(qDestName));

      if (qStartLat && qStartLng && qEndLat && qEndLng) {
        calculateSafePath(
          parseFloat(qStartLat),
          parseFloat(qStartLng),
          parseFloat(qEndLat),
          parseFloat(qEndLng),
          qMode || "driving"
        );
      }
    }
  }, [initAuth, calculateSafePath]);

  // Recalculate route on mode change if endpoints are populated
  const handleModeChange = (newMode: TransportMode) => {
    setMode(newMode);
    const sLat = parseFloat(startLat);
    const sLng = parseFloat(startLng);
    const eLat = parseFloat(endLat);
    const eLng = parseFloat(endLng);
    if (!isNaN(sLat) && !isNaN(sLng) && !isNaN(eLat) && !isNaN(eLng)) {
      calculateSafePath(sLat, sLng, eLat, eLng, newMode);
    }
  };

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    calculateSafePath(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng),
      mode
    );
  };

  const handleApplyPreset = (preset: (typeof ROUTE_PRESETS)[0]) => {
    setStartLat(preset.start.lat.toString());
    setStartLng(preset.start.lng.toString());
    setEndLat(preset.end.lat.toString());
    setEndLng(preset.end.lng.toString());
    setDestinationLabel(null);
    calculateSafePath(
      preset.start.lat,
      preset.start.lng,
      preset.end.lat,
      preset.end.lng,
      mode
    );
  };

  // Acquire Citizen's live GPS for Origin
  const handleUseMyLocation = () => {
    if (!("geolocation" in navigator)) {
      showToast("Geolocation is not supported by your browser.", "error");
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartLat(pos.coords.latitude.toFixed(6));
        setStartLng(pos.coords.longitude.toFixed(6));
        setIsLocatingUser(false);
      },
      () => {
        setIsLocatingUser(false);
        showToast(
          "Failed to retrieve GPS location. Please allow browser location access.",
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Swap Origin ⇄ Destination
  const handleSwapEndpoints = () => {
    const tempLat = startLat;
    const tempLng = startLng;
    setStartLat(endLat);
    setStartLng(endLng);
    setEndLat(tempLat);
    setEndLng(tempLng);
  };

  // Handle Map Pin Dropping
  const handleMapClick = (lat: number, lng: number) => {
    if (clickMode === "START") {
      setStartLat(lat.toFixed(6));
      setStartLng(lng.toFixed(6));
      setClickMode("NONE");
    } else if (clickMode === "END") {
      setEndLat(lat.toFixed(6));
      setEndLng(lng.toFixed(6));
      setDestinationLabel(null);
      setClickMode("NONE");
    }
  };

  // Share Route Link
  const handleShareRoute = () => {
    const url = `${window.location.origin}/routes?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}&mode=${mode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Currently selected active route alternative
  const activeRouteAlternative = useMemo(() => {
    if (result?.routes && result.routes.length > 0) {
      const match = result.routes.find((r) => r.id === selectedRouteId);
      return match || result.routes.find((r) => r.isRecommended) || result.routes[0];
    }
    return null;
  }, [result, selectedRouteId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Page Hero Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Navigation className="w-3.5 h-3.5" />
                <span>{isBn ? "ওএসআরএম রোড-নেটওয়ার্ক ইঞ্জিন" : "OSRM Road-Network Engine"}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>{isBn ? "পোস্টজিআইএস বাস্তব সড়ক করিডোর" : "PostGIS Street-Level Hazard Detection"}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isBn ? "নিরাপদ পথ নেভিগেশন ইঞ্জিন" : "Safe Route Pathfinding Engine"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {isBn
                ? "বাস্তব সড়ক নেটওয়ার্ক ও পোস্টজিআইএস করিডোর বিশ্লেষণের মাধ্যমে পথচারী ও চালকদের জন্য সক্রিয় বিপদমুক্ত নিরাপদ রুট তৈরি করে।"
                : "Genuine road-network navigation with PostGIS street-level hazard detection, multi-route alternatives, and explainable safety scoring."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={handleShareRoute}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Share Route Link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">{isBn ? "লিংক কপি হয়েছে" : "Link Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isBn ? "রুট শেয়ার করুন" : "Share Route"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        {/* High Risk Corridor Presets */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isBn ? "বাস্তব ভৌগোলিক করিডোর প্রিসেট" : "Real-World Geographic Corridors"}</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isBn ? "১-ক্লিকে সড়ক নেটওয়ার্ক পরীক্ষা করুন" : "1-Click Road Network Verification"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {ROUTE_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.nameEn}
                onClick={() => handleApplyPreset(preset)}
                className="text-left p-3 rounded-xl text-xs bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-slate-800 transition-all flex flex-col justify-between gap-2 group shadow-2xs"
              >
                <div className="flex items-start justify-between gap-1 w-full">
                  <span className="font-bold text-slate-900 group-hover:text-blue-700 line-clamp-2">
                    {isBn ? preset.nameBn : preset.nameEn}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {preset.start.lat.toFixed(3)}, {preset.start.lng.toFixed(3)} → {preset.end.lat.toFixed(3)}, {preset.end.lng.toFixed(3)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Main 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Route Parameters & Alternative Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-blue-600" />
                  <span>{isBn ? "যাত্রাপথ কনফিগারেশন" : "Route Parameters"}</span>
                </h2>
                <button
                  type="button"
                  onClick={handleSwapEndpoints}
                  className="p-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                  title="Swap Origin and Destination"
                >
                  <ArrowDownUp className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-[10px] font-semibold">{isBn ? "উলোটপালট" : "Swap"}</span>
                </button>
              </div>

              {/* Transport Mode Switcher */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {isBn ? "পরিবহন মাধ্যম (Mode)" : "Transport Mode"}
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleModeChange("driving")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      mode === "driving"
                        ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>{isBn ? "গাড়ি / ড্রাইভ" : "Driving"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("walking")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      mode === "walking"
                        ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>{isBn ? "হাঁটার পথ" : "Walking"}</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCalculateRoute} className="space-y-4">
                {/* Origin Start Point */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{isBn ? "যাত্রার শুরু (Origin)" : "Start Point (Origin)"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={isLocatingUser}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
                      >
                        <Crosshair className={`w-2.5 h-2.5 ${isLocatingUser ? "animate-spin" : ""}`} />
                        <span>{isBn ? "আমার লোকেশন" : "My GPS"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClickMode(clickMode === "START" ? "NONE" : "START")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                          clickMode === "START"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {clickMode === "START"
                          ? isBn ? "বাতিল" : "Cancel"
                          : isBn ? "ম্যাপ থেকে নিন" : "Pick Map"}
                      </button>
                    </div>
                  </div>

                  <LocationSearchBar
                    placeholder={isBn ? "যাত্রার শুরু অনুসন্ধান করুন (যেমন: ফার্মগেট)..." : "Search origin location (e.g. Farmgate)..."}
                    onSelectLocation={(loc: GeocodedLocation) => {
                      setStartLat(loc.lat.toString());
                      setStartLng(loc.lng.toString());
                    }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Latitude</label>
                      <input
                        type="text"
                        value={startLat}
                        onChange={(e) => setStartLat(e.target.value)}
                        placeholder="23.7570"
                        required
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Longitude</label>
                      <input
                        type="text"
                        value={startLng}
                        onChange={(e) => setStartLng(e.target.value)}
                        placeholder="90.3905"
                        required
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Destination Point */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                      <span>{isBn ? "গন্তব্য (Destination)" : "Destination Point"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setClickMode(clickMode === "END" ? "NONE" : "END")}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                        clickMode === "END"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {clickMode === "END"
                        ? isBn ? "বাতিল" : "Cancel"
                        : isBn ? "ম্যাপ থেকে নিন" : "Pick Map"}
                    </button>
                  </div>

                  {destinationLabel && (
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-semibold flex items-center justify-between">
                      <span className="truncate">{destinationLabel}</span>
                      <button
                        type="button"
                        onClick={() => setDestinationLabel(null)}
                        className="text-xs text-blue-500 hover:text-blue-800 ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <LocationSearchBar
                    placeholder={isBn ? "গন্তব্য অনুসন্ধান করুন (যেমন: বনানী ১১)..." : "Search destination (e.g. Banani 11)..."}
                    onSelectLocation={(loc: GeocodedLocation) => {
                      setEndLat(loc.lat.toString());
                      setEndLng(loc.lng.toString());
                      setDestinationLabel(loc.name);
                    }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Latitude</label>
                      <input
                        type="text"
                        value={endLat}
                        onChange={(e) => setEndLat(e.target.value)}
                        placeholder="23.7925"
                        required
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Longitude</label>
                      <input
                        type="text"
                        value={endLng}
                        onChange={(e) => setEndLng(e.target.value)}
                        placeholder="90.4078"
                        required
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isBn ? "সড়ক নেটওয়ার্ক পথ গণনা হচ্ছে..." : "Routing along road network..."}</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      <span>{isBn ? "নিরাপদ সড়ক পথ খুঁজুন" : "Calculate Road-Network Route"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Route Alternatives Selection Cards */}
            {result?.routes && result.routes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isBn ? "উপলব্ধ সড়ক রুট বিকল্পসমূহ" : "Available Route Alternatives"}</span>
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {result.routes.length} {isBn ? "টি রুট" : "options"}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {result.routes.map((route) => {
                    const isSelected = route.id === selectedRouteId;
                    const durationMins = Math.round(route.durationSeconds / 60);
                    const distanceKm = (route.distanceMeters / 1000).toFixed(2);

                    return (
                      <div
                        key={route.id}
                        onClick={() => setSelectedRouteId(route.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-slate-900">
                                {route.title}
                              </span>
                              {route.isRecommended && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                  <span>{isBn ? "প্রস্তাবিত নিরাপদ পথ" : "Recommended Safest"}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <strong className="text-slate-900">{durationMins}</strong> {isBn ? "মি." : "mins"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1">
                                <Route className="w-3.5 h-3.5 text-slate-400" />
                                <strong className="text-slate-900">{distanceKm}</strong> km
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1">
                                <AlertTriangle className={`w-3.5 h-3.5 ${route.hazardCount > 0 ? "text-amber-500" : "text-emerald-500"}`} />
                                <span>{route.hazardCount} {isBn ? "ঝুঁকি" : "hazards"}</span>
                              </span>
                            </div>
                          </div>

                          {/* Safety Score Pill */}
                          <div className="text-right shrink-0">
                            <div
                              className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black border ${
                                route.safetyScore >= 80
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : route.safetyScore >= 50
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              <span className="text-[10px] uppercase font-bold mr-1">Score</span>
                              <span className="text-sm font-black">{route.safetyScore}</span>
                              <span className="text-[9px] font-normal text-slate-400">/95</span>
                            </div>
                            <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                              {route.safetyRating === "LOW_HAZARD_EXPOSURE"
                                ? isBn ? "স্বল্প ঝুঁকি" : "Low Exposure"
                                : route.safetyRating === "MODERATE_HAZARD_EXPOSURE"
                                ? isBn ? "মধ্যম ঝুঁকি" : "Moderate Exposure"
                                : isBn ? "উচ্চ ঝুঁকি" : "High Exposure"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Map & Turn-by-Turn Guidance (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <p className="font-semibold">{error}</p>
              </div>
            )}

            {/* Interactive Leaflet Route Map */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {isBn ? "লাইভ সড়ক নেটওয়ার্ক ও বিপদ করিডোর" : "Live Road Network & Hazard Corridors"}
                  </h3>
                </div>
                {activeRouteAlternative && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      activeRouteAlternative.hazardCount > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {activeRouteAlternative.hazardCount > 0
                      ? isBn
                        ? `শনাক্ত বিপদ (${activeRouteAlternative.hazardCount}টি)`
                        : `Corridor Hazards (${activeRouteAlternative.hazardCount})`
                      : isBn
                      ? "করিডোর নিরাপদ"
                      : "Corridor Clear"}
                  </span>
                )}
              </div>

              <RoutePathMap
                startLat={parseFloat(startLat)}
                startLng={parseFloat(startLng)}
                endLat={parseFloat(endLat)}
                endLng={parseFloat(endLng)}
                routes={result?.routes || []}
                selectedRouteId={selectedRouteId}
                onSelectRoute={(id) => setSelectedRouteId(id)}
                onMapClick={handleMapClick}
                clickMode={clickMode}
                language={language}
                className="w-full h-[400px] sm:h-[460px]"
              />
            </div>

            {/* Results Analytics & Explainability */}
            {result ? (
              <div className="space-y-4">
                {/* Explainable Trade-Off Banner */}
                {result.tradeOffSummary && (
                  <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 shadow-2xs text-blue-950">
                    <div className="flex items-center gap-2 font-bold text-xs mb-1 text-blue-800">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{isBn ? "রুট ট্রেড-অফ ও সুরক্ষার ব্যাখ্যা" : "Route Recommendation & Trade-Off Analysis"}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-blue-900 font-medium">
                      {result.tradeOffSummary}
                    </p>
                  </div>
                )}

                {/* Key Metrics Grid for Active Route */}
                {activeRouteAlternative && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {isBn ? "প্রকৃত সড়ক দূরত্ব" : "Road Distance"}
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                        {(activeRouteAlternative.distanceMeters / 1000).toFixed(2)} km
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {activeRouteAlternative.distanceMeters.toLocaleString()} m
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {isBn ? "আনুমানিক সময়" : "Estimated Duration"}
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                        {Math.round(activeRouteAlternative.durationSeconds / 60)} {isBn ? "মি." : "mins"}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {mode === "walking" ? "@ 4.5 km/h" : isBn ? "শহুরে ট্রাফিক" : "Urban Profile"}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {isBn ? "সুরক্ষা স্কোর" : "Safety Score"}
                      </span>
                      <p
                        className={`text-base sm:text-lg font-black mt-0.5 ${
                          activeRouteAlternative.safetyScore >= 80
                            ? "text-emerald-600"
                            : activeRouteAlternative.safetyScore >= 50
                            ? "text-blue-600"
                            : "text-amber-600"
                        }`}
                      >
                        {activeRouteAlternative.safetyScore}
                        <span className="text-xs text-slate-400 font-normal"> / 95</span>
                      </p>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {activeRouteAlternative.safetyRating === "LOW_HAZARD_EXPOSURE"
                          ? isBn ? "স্বল্প ঝুঁকি" : "Low Risk"
                          : activeRouteAlternative.safetyRating === "MODERATE_HAZARD_EXPOSURE"
                          ? isBn ? "মধ্যম ঝুঁকি" : "Moderate Risk"
                          : isBn ? "উচ্চ ঝুঁকি" : "High Risk"}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {isBn ? "করিডোর বিপদ" : "Corridor Hazards"}
                      </span>
                      <p
                        className={`text-base sm:text-lg font-black mt-0.5 ${
                          activeRouteAlternative.hazardCount > 0 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        {activeRouteAlternative.hazardCount} {isBn ? "টি" : "Zones"}
                      </p>
                      <span className="text-[10px] text-slate-500">80m - 250m Buffer</span>
                    </div>
                  </div>
                )}

                {/* Turn-by-Turn Navigation Guidance Steps */}
                {activeRouteAlternative?.steps && activeRouteAlternative.steps.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <span>{isBn ? "ধাপে ধাপে নেভিগেশন ও ঝুঁকি সতর্কতা" : "Turn-by-Turn Navigation & Hazard Alerts"}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowGuidanceSteps(!showGuidanceSteps)}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <span className="text-[11px] font-bold font-mono">
                          {activeRouteAlternative.steps.length} {isBn ? "টি ধাপ" : "steps"}
                        </span>
                        {showGuidanceSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {showGuidanceSteps && (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {activeRouteAlternative.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs transition-colors ${
                              step.hazardWarning
                                ? "bg-amber-50/60 border-amber-200 text-amber-950"
                                : "bg-slate-50 border-slate-200/80 text-slate-800 hover:bg-slate-100/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-slate-900">{step.instruction}</p>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {step.distanceMeters}m • ~{Math.round(step.durationSeconds)}s • maneuver: {step.maneuverType}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Localized Hazard Warning Pill */}
                            {step.hazardWarning && (
                              <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>{step.hazardWarning}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* External Maps Action */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=${mode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-2xs"
                  >
                    <span>{isBn ? "গুগল ম্যাপে নেভিগেশন খুলুন" : "Open in Google Maps"}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 shadow-xs space-y-2">
                <Compass className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">
                  {isBn ? "কোনো রুট গণনা করা হয়নি" : "No Route Calculated Yet"}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {isBn
                    ? "উপরে করিডোর প্রিসেট সিলেক্ট করুন অথবা ম্যাপে ক্লিক করে যাত্রাস্থল ও গন্তব্য নির্ধারণ করুন।"
                    : "Select a high-risk corridor preset above or enter origin and destination coordinates to generate your genuine road-network safe path."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
