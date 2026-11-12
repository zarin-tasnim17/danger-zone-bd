"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { showToast } from "@/store/useToastStore";
import { BypassedHazardItem } from "@/components/routes/RoutePathMap";
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
  PhoneCall,
  Check,
  Sparkles,
  Info,
} from "lucide-react";

// Dynamically import Leaflet Map with ssr: false
import LocationSearchBar, { GeocodedLocation } from "@/components/map/LocationSearchBar";
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

interface SafeRouteOutput {
  origin: [number, number];
  destination: [number, number];
  directDistanceMeters: number;
  safeDistanceMeters: number;
  safetyRating: "CLEAR" | "HIGH_SAFETY" | "MODERATE_RISK";
  bypassedHazardsCount: number;
  bypassedHazards: BypassedHazardItem[];
  waypoints: [number, number][]; // [lat, lng] array
}

const ROUTE_PRESETS = [
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
    nameEn: "Uttara Sector 3 → Airport Road",
    nameBn: "উত্তরা সেক্টর ৩ → বিমানবন্দর মহাসড়ক",
    start: { lat: 23.8683, lng: 90.3995 },
    end: { lat: 23.8433, lng: 90.4049 },
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

  // Map Click Picking Mode
  const [clickMode, setClickMode] = useState<"START" | "END" | "NONE">("NONE");

  // Route State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SafeRouteOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    initAuth();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qStartLat = params.get("startLat");
      const qStartLng = params.get("startLng");
      const qEndLat = params.get("endLat");
      const qEndLng = params.get("endLng");
      const qDestName = params.get("destName") || params.get("name");

      if (qStartLat) setStartLat(qStartLat);
      if (qStartLng) setStartLng(qStartLng);
      if (qEndLat) setEndLat(qEndLat);
      if (qEndLng) setEndLng(qEndLng);
      if (qDestName) setDestinationLabel(decodeURIComponent(qDestName));

      // If all 4 coordinates are present in URL, auto-calculate route
      if (qStartLat && qStartLng && qEndLat && qEndLng) {
        calculateSafePath(
          parseFloat(qStartLat),
          parseFloat(qStartLng),
          parseFloat(qEndLat),
          parseFloat(qEndLng)
        );
      }
    }
  }, [initAuth]);

  // Core Safe Path calculation
  const calculateSafePath = async (
    sLat: number,
    sLng: number,
    eLat: number,
    eLng: number
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
        }),
      });

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to calculate safe route");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    calculateSafePath(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng)
    );
  };

  const handleApplyPreset = (preset: typeof ROUTE_PRESETS[0]) => {
    setStartLat(preset.start.lat.toString());
    setStartLng(preset.start.lng.toString());
    setEndLat(preset.end.lat.toString());
    setEndLng(preset.end.lng.toString());
    setDestinationLabel(null);
    calculateSafePath(
      preset.start.lat,
      preset.start.lng,
      preset.end.lat,
      preset.end.lng
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
      (err) => {
        setIsLocatingUser(false);
        showToast("Failed to retrieve GPS location. Please allow browser location access.", "error");
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
    const url = `${window.location.origin}/routes?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const isDiverted = (result?.bypassedHazardsCount || 0) > 0;
  const detourOverheadMeters = result
    ? Math.max(0, result.safeDistanceMeters - result.directDistanceMeters)
    : 0;
  const detourOverheadPercent =
    result && result.directDistanceMeters > 0
      ? ((detourOverheadMeters / result.directDistanceMeters) * 100).toFixed(1)
      : "0";

  // Estimated Travel Times
  const walkingTimeMinutes = result
    ? Math.round(result.safeDistanceMeters / 80) // ~4.8 km/h walking speed
    : 0;
  const drivingTimeMinutes = result
    ? Math.round(result.safeDistanceMeters / 400) // ~24 km/h urban Dhaka traffic
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Single Unified Navbar (No top telemetry bar, integrated bilingual toggle) */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page Hero Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Navigation className="w-3.5 h-3.5" />
                <span>{isBn ? "পোস্টজিআইএস এআই অ্যালগরিদম" : "PostGIS Hazard Avoidance Engine"}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>{isBn ? "সক্রিয় বিপদ মুক্ত রুট" : "Zero High-Risk Exposure"}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isBn ? "নিরাপদ পথ নেভিগেশন ইঞ্জিন" : "Safe Route Pathfinding Engine"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {isBn
                ? "সক্রিয় অপরাধ, অন্ধকার রাস্তা ও বিপদের এলাকা বাইপাস করে পথচারী ও যাত্রীদের জন্য স্বয়ংক্রিয় নিরাপদ রুট তৈরি করে।"
                : "Dynamic pathfinding algorithm that routes pedestrians and commuters around active red zones, mugging hotspots, and unlit corridors."}
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

        {/* High Crime Corridor Presets */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isBn ? "সাধারণ ঝুঁকিপূর্ণ করিডোরসমূহ" : "High-Risk Corridor Presets"}</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isBn ? "এক ক্লিকে রুট পরীক্ষা করুন" : "1-Click Real PostGIS Corridor Test"}
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

        {/* Main 2-Column Split: Form (Left) vs Interactive Route Map & Analytics (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Route Parameters Form (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
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
                        ? isBn ? "ম্যাপে ক্লিক করুন" : "Cancel"
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
                      ? isBn ? "ম্যাপে ক্লিক করুন" : "Cancel"
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
                    <span>{isBn ? "পোস্টজিআইএস নিরাপদ পথ গণনা হচ্ছে..." : "Calculating Safe Path (POST /safe-path)..."}</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    <span>{isBn ? "নিরাপদ পথ ক্যালকুলেট করুন" : "Calculate Safe Path (POST /safe-path)"}</span>
                  </>
                )}
              </button>
            </form>

            {/* Safety Methodology Explainer Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? "সুরক্ষা প্রযুক্তি" : "Safety Algorithm Logic"}</span>
              </div>
              <p className="leading-relaxed">
                {isBn
                  ? "সরাসরি যাত্রাপথের ২৫০ মিটারের মধ্যে কোনো সক্রিয় ছিনতাই বা বিপদ থাকলে অ্যালগরিদমটি বিপরীত পাশে নিরাপদ দূরত্ব রেখে স্বয়ংক্রিয় নোড তৈরি করে।"
                  : "If an active crime or hazard intersects within 250m of direct trajectory, the orthogonal vector steers the polyline away with a 150m buffer."}
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Map & Detailed Analytics (7 cols) */}
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
                    {isBn ? "লাইভ রুট ম্যাপ ও বিপদ বাইপাস ভিজ্যুয়ালাইজার" : "Live Route Map & Hazard Visualizer"}
                  </h3>
                </div>
                {result && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isDiverted
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {isDiverted
                      ? isBn ? `বিপদ এড়িয়ে ঘুরানো হয়েছে (${result.bypassedHazardsCount}টি)` : `Hazard Detour (${result.bypassedHazardsCount} avoided)`
                      : isBn ? "সরাসরি রুট নিরাপদ" : "Direct Path Clear"}
                  </span>
                )}
              </div>

              <RoutePathMap
                startLat={parseFloat(startLat)}
                startLng={parseFloat(startLng)}
                endLat={parseFloat(endLat)}
                endLng={parseFloat(endLng)}
                waypoints={result?.waypoints || []}
                bypassedHazards={result?.bypassedHazards || []}
                isDiverted={isDiverted}
                onMapClick={handleMapClick}
                clickMode={clickMode}
                language={language}
                className="w-full h-[400px] sm:h-[460px]"
              />
            </div>

            {/* Route Results Analytics */}
            {result ? (
              <div className="space-y-4">
                {/* Safety Status Banner */}
                <div
                  className={`border rounded-2xl p-4.5 shadow-2xs ${
                    isDiverted
                      ? "bg-amber-50/80 border-amber-200 text-amber-950"
                      : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {isDiverted ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    <span>
                      {isDiverted
                        ? isBn
                          ? `সতর্কতা: ${result.bypassedHazardsCount}টি সক্রিয় বিপদের এলাকা এড়িয়ে নিরাপদ ঘুরতি পথ তৈরি করা হয়েছে`
                          : `Safety Detour Active: Successfully steered around ${result.bypassedHazardsCount} active crime hazards`
                        : isBn
                        ? "সরাসরি পথ নিরাপদ: যাত্রাপথের করিডোরে কোনো সক্রিয় বিপদ নেই"
                        : "Direct Route Clear: No active violent crime or dark road hazards detected along trajectory"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {isDiverted
                      ? isBn
                        ? `যাত্রাপথে ছিনতাই বা আলোকস্বল্পতার ঝুঁকি শনাক্ত হওয়ায় ${detourOverheadMeters} মিটার অতিরিক্ত ঘুরতি পথে নিরাপদ করা হয়েছে।`
                        : `Active hazards were detected near the direct trajectory. The algorithm added +${detourOverheadMeters}m safe clearance (+${detourOverheadPercent}% overhead) for complete safety.`
                      : isBn
                      ? "সম্পূর্ণ যাত্রাপথটি বর্তমান নাগরিক সুরক্ষা ডেটাবেজের সাথে মিলিয়ে নিরাপদ পাওয়া গেছে।"
                      : "The corridor has zero active hazard overlap within the safety exclusion perimeter."}
                  </p>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {isBn ? "মোট দূরত্ব" : "Safe Distance"}
                    </span>
                    <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                      {(result.safeDistanceMeters / 1000).toFixed(2)} km
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {result.safeDistanceMeters.toLocaleString()} m
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {isBn ? "এড়ানো বিপদ" : "Hazards Avoided"}
                    </span>
                    <p
                      className={`text-base sm:text-lg font-black mt-0.5 ${
                        result.bypassedHazardsCount > 0 ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {result.bypassedHazardsCount} {isBn ? "টি" : "Zones"}
                    </p>
                    <span className="text-[10px] text-slate-500">250m Buffer</span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-400">
                      <Footprints className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? "হাঁটার সময়" : "Walking Time"}</span>
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                      ~{walkingTimeMinutes} {isBn ? "মি." : "mins"}
                    </p>
                    <span className="text-[10px] text-slate-500">@ 4.8 km/h</span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-400">
                      <Car className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? "গাড়ির সময়" : "Driving Time"}</span>
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                      ~{drivingTimeMinutes} {isBn ? "মি." : "mins"}
                    </p>
                    <span className="text-[10px] text-slate-500">{isBn ? "ঢাকা ট্রাফিক" : "Urban Speed"}</span>
                  </div>
                </div>

                {/* Bypassed Hazards Detail List */}
                {result.bypassedHazards && result.bypassedHazards.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>{isBn ? "যাত্রাপথ থেকে বাইপাসকৃত বিপদসমূহ" : "Active Hazards Successfully Bypassed"}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {result.bypassedHazards.map((hazard) => (
                        <div
                          key={hazard.id}
                          className="p-3 rounded-xl bg-red-50/60 border border-red-200/80 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-red-900 uppercase">
                              {hazard.category.replace("_", " ")}
                            </span>
                            <p className="text-[11px] text-red-700">
                              {isBn
                                ? `করিডোর থেকে ${hazard.distanceFromRouteMeters} মিটার দূরে`
                                : `${hazard.distanceFromRouteMeters}m from direct path`}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 uppercase">
                            {hazard.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waypoints Sequence List */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Route className="w-4 h-4 text-blue-600" />
                      <span>{isBn ? "নেভিগেশন নোড ও টার্নিং পয়েন্ট" : "Navigation Nodes & Waypoints"}</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      {result.waypoints.length} {isBn ? "টি নোড" : "Nodes"}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-52 scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">{isBn ? "ভূমিকা" : "Node Role"}</th>
                          <th className="py-2 px-3 font-mono">Latitude</th>
                          <th className="py-2 px-3 font-mono">Longitude</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.waypoints.map((wp, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-700">#{idx + 1}</td>
                            <td className="py-2 px-3">
                              {idx === 0 ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>{isBn ? "যাত্রা শুরু" : "Start Origin"}</span>
                                </span>
                              ) : idx === result.waypoints.length - 1 ? (
                                <span className="text-red-700 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  <span>{isBn ? "গন্তব্য" : "Destination"}</span>
                                </span>
                              ) : (
                                <span className="text-blue-600 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  <span>{isBn ? "নিরাপদ বাইপাস নোড" : "Detour Clearance Node"}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{wp[0].toFixed(5)}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{wp[1].toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* External Maps Action */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}`}
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
                    : "Select a high-risk corridor preset above or enter origin and destination coordinates to generate your hazard-free path."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
