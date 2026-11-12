"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { showToast } from "@/store/useToastStore";
import type { SafeZoneItem, SafeZoneType } from "@repo/shared";
import { getSafeZonePresentation, normalizeSafeZoneType } from "@/lib/safeZoneMeta";
import {
  Shield,
  Hospital,
  Building2,
  Pill,
  MapPin,
  PlusCircle,
  Trash2,
  Search,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Crosshair,
  PhoneCall,
  Compass,
  ChevronRight,
  Copy,
  Check,
  Layers,
  Map as MapIcon,
  LayoutGrid,
  Sparkles,
  Phone,
  Clock,
  CheckCircle,
  Filter,
} from "lucide-react";

// Dynamically import Leaflet Map with ssr: false to avoid window reference errors during SSR
const SafeZonesMap = dynamic(
  () => import("@/components/safe-zones/SafeZonesMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading interactive safe shelters map...</span>
      </div>
    ),
  }
);

// City quick-jump preset coordinates
const CITY_PRESETS = [
  { nameEn: "All Bangladesh", nameBn: "সমগ্র বাংলাদেশ", bounds: { minLat: 20.5, maxLat: 27.0, minLng: 88.0, maxLng: 93.0 } },
  { nameEn: "Dhaka Metro", nameBn: "ঢাকা মহানগর", center: { lat: 23.7565, lng: 90.3888 }, radius: 15000 },
  { nameEn: "Chittagong", nameBn: "চট্টগ্রাম", center: { lat: 22.3592, lng: 91.8267 }, radius: 15000 },
  { nameEn: "Khulna", nameBn: "খুলনা", center: { lat: 22.8456, lng: 89.5403 }, radius: 15000 },
  { nameEn: "Rajshahi", nameBn: "রাজশাহী", center: { lat: 24.3707, lng: 88.5833 }, radius: 15000 },
  { nameEn: "Sylhet", nameBn: "সিলেট", center: { lat: 24.8998, lng: 91.8541 }, radius: 15000 },
];

export default function SafeZonesPage() {
  const router = useRouter();
  const { user, initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Data states
  const [safeZones, setSafeZones] = useState<SafeZoneItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<SafeZoneItem | null>(null);

  // User GPS Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<"ALL" | SafeZoneType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCityPreset, setActiveCityPreset] = useState("All Bangladesh");

  // View Layout Mode: "split" (Map + List side-by-side) | "grid" (Full Width Grid) | "map" (Full Width Map)
  const [viewMode, setViewMode] = useState<"split" | "grid" | "map">("split");

  // Proximity Mode & Radius
  const [proximityMode, setProximityMode] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState("15000");

  // Admin Drawer State
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<SafeZoneType>("HOSPITAL");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copy coordinate feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Request user GPS on mount silently ONLY if permission is already granted (prevents Android 12+ prompt blocks)
  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setUserLocation({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                });
              },
              () => {
                console.log("[SafeZones] Geolocation auto-check skipped");
              },
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  // Fetch Safe Havens from PostgreSQL backend
  const fetchSafeZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = "/safe-zones?";
      if (typeFilter !== "ALL") {
        query += `type=${typeFilter}&`;
      }

      if (proximityMode && userLocation) {
        query += `lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radiusMeters}`;
      } else {
        query += `minLat=20.5&maxLat=27.0&minLng=88.0&maxLng=93.0`;
      }

      const data = await apiFetch<SafeZoneItem[]>(query);
      setSafeZones(data || []);

      if (data && data.length > 0 && !selectedZone) {
        setSelectedZone(data[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load verified safe shelters");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, proximityMode, userLocation, radiusMeters, selectedZone]);

  useEffect(() => {
    fetchSafeZones();
  }, [fetchSafeZones]);

  // Locate User GPS and toggle Proximity Mode
  const handleLocateMe = () => {
    setIsLocatingUser(true);
    setGpsError(null);

    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser.");
      setIsLocatingUser(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setProximityMode(true);
        setActiveCityPreset("Nearest to GPS");
        setIsLocatingUser(false);
      },
      (err) => {
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (coarsePos) => {
              setUserLocation({
                lat: coarsePos.coords.latitude,
                lng: coarsePos.coords.longitude,
              });
              setProximityMode(true);
              setActiveCityPreset("Nearest to GPS");
              setIsLocatingUser(false);
            },
            () => {
              setIsLocatingUser(false);
              setGpsError(
                "Unable to access GPS location. Please allow Location access and close any floating screen overlays."
              );
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
          return;
        }
        setIsLocatingUser(false);
        setGpsError(
          "Unable to access GPS location. If Android says 'Try again', close any floating bubbles/overlays and enable Location in browser permissions."
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  };

  // City preset selection
  const handleSelectCityPreset = (preset: typeof CITY_PRESETS[0]) => {
    setActiveCityPreset(preset.nameEn);
    if (preset.center) {
      setUserLocation(preset.center);
      setProximityMode(true);
    } else {
      setProximityMode(false);
    }
  };

  // Admin: Create Safe Zone
  const handleCreateSafeZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setCreateSuccess(null);
    setCreateError(null);

    try {
      const created = await apiFetch<SafeZoneItem>("/safe-zones", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          latitude: parseFloat(newLat),
          longitude: parseFloat(newLng),
        }),
      });

      setSafeZones((prev) => [created, ...prev]);
      setSelectedZone(created);
      setCreateSuccess(`Safe shelter "${created.name}" created and verified in database!`);
      setNewName("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create safe shelter");
    } finally {
      setIsCreating(false);
    }
  };

  // Admin: Delete Safe Zone
  const handleDeleteSafeZone = async (id: string, name: string) => {
    if (!confirm(`Permanently remove verified safe shelter "${name}" from database?`)) return;

    try {
      await apiFetch(`/safe-zones/${id}`, { method: "DELETE" });
      setSafeZones((prev) => prev.filter((sz) => sz.id !== id));
      if (selectedZone?.id === id) {
        setSelectedZone(null);
      }
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, "error");
    }
  };

  // Navigate safely to this safe haven via Safe Route Pathfinding
  const handleNavigateSafePath = (zone: SafeZoneItem) => {
    const startLat = userLocation?.lat || 23.7570;
    const startLng = userLocation?.lng || 90.3905;
    router.push(
      `/routes?startLat=${startLat}&startLng=${startLng}&endLat=${zone.latitude}&endLng=${zone.longitude}&destName=${encodeURIComponent(
        zone.name
      )}`
    );
  };

  // Copy coordinates helper
  const handleCopyCoords = (zone: SafeZoneItem) => {
    navigator.clipboard.writeText(`${zone.latitude.toFixed(6)}, ${zone.longitude.toFixed(6)}`);
    setCopiedId(zone.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered & Searched Safe Zones
  const filteredSafeZones = useMemo(() => {
    return safeZones.filter((sz) => {
      // Type filter
      if (typeFilter !== "ALL" && sz.type !== typeFilter) return false;
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sz.name.toLowerCase().includes(q) ||
        sz.type.toLowerCase().includes(q)
      );
    });
  }, [safeZones, typeFilter, searchQuery]);

  // Aggregate Category Counts
  const counts = useMemo(() => {
    return {
      all: safeZones.length,
      hospital: safeZones.filter((z) => normalizeSafeZoneType(z.type) === "HOSPITAL").length,
      police: safeZones.filter((z) => normalizeSafeZoneType(z.type) === "POLICE_BOX").length,
      pharmacy: safeZones.filter((z) => normalizeSafeZoneType(z.type) === "PHARMACY").length,
    };
  }, [safeZones]);

  // Helper styles by Safe Zone Type
  const iconMap = {
    hospital: Hospital,
    police: Building2,
    pharmacy: Pill,
  } as const;

  const getTypeBadge = (type: SafeZoneItem["type"]) => {
    const meta = getSafeZonePresentation(type, language);
    return {
      ...meta,
      icon: iconMap[meta.iconKey],
    };
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Single Unified Premium Navbar (No top strip, bilingual toggle integrated) */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page Hero Header */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield className="w-3.5 h-3.5" />
                <span>{isBn ? "নাগরিক সুরক্ষা নেটওয়ার্ক" : "Civic Safety Sanctuary"}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="w-3 h-3" />
                <span>{counts.all} {isBn ? "যাচাইকৃত নিরাপদ আশ্রয়" : "Verified Safe Havens"}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isBn ? "যাচাইকৃত নিরাপদ আশ্রয়স্থল ডিরেক্টরি" : "Verified Safe Shelters Directory"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {isBn
                ? "জরুরি পরিস্থিতিতে নিকটস্থ সরকারি হাসপাতাল, পুলিশ বক্স এবং সার্বক্ষণিক ফার্মেসির অবস্থান ও নিরাপদ পথ।"
                : "Geocoded directory of government medical colleges, rapid police response outposts, and 24/7 pharmacies across Bangladesh."}
            </p>
          </div>

          {/* Action Hub: Locate Me & View Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleLocateMe}
              disabled={isLocatingUser}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                proximityMode
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isLocatingUser ? "animate-spin text-blue-600" : ""}`} />
              <span>
                {isLocatingUser
                  ? isBn ? "জিপিএস নির্ণয় হচ্ছে..." : "Acquiring GPS..."
                  : proximityMode
                  ? isBn ? "নিকটবর্তী কেন্দ্র সক্রিয়" : "Proximity GPS Active"
                  : isBn ? "আমার নিকটস্থ কেন্দ্র খুঁজুন" : "Find Havens Near Me"}
              </span>
            </button>

            {/* Layout Mode Switcher */}
            <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <button
                onClick={() => setViewMode("split")}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === "split"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Split Map + List"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">{isBn ? "বিভক্ত দৃশ্য" : "Split"}</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === "grid"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Grid Directory View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">{isBn ? "গ্রিড তালিকা" : "Grid"}</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === "map"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Full Interactive Map"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">{isBn ? "পূর্ণাঙ্গ ম্যাপ" : "Map"}</span>
              </button>
            </div>

            <button
              onClick={fetchSafeZones}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh Havens Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </section>

        {gpsError && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Toolbar: Category Chips, City Quick Jump & Search */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  isBn
                    ? "হাসপাতাল, পুলিশ বক্স বা এলাকার নাম দিয়ে খুঁজুন..."
                    : "Search shelters by name, area (e.g. Farmgate, Dhanmondi, Chittagong)..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* City Preset Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                {isBn ? "শহর:" : "City:"}
              </span>
              {CITY_PRESETS.map((p) => (
                <button
                  key={p.nameEn}
                  onClick={() => handleSelectCityPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                    activeCityPreset === p.nameEn
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {isBn ? p.nameBn : p.nameEn}
                </button>
              ))}
            </div>
          </div>

          {/* Shelter Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTypeFilter("ALL")}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                  typeFilter === "ALL"
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isBn ? "সব আশ্রয়স্থল" : "All Shelters"}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {counts.all}
                </span>
              </button>

              <button
                onClick={() => setTypeFilter("HOSPITAL")}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                  typeFilter === "HOSPITAL"
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Hospital className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? "হাসপাতাল" : "Hospitals"}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === "HOSPITAL" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                  {counts.hospital}
                </span>
              </button>

              <button
                onClick={() => setTypeFilter("POLICE_BOX")}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                  typeFilter === "POLICE_BOX"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isBn ? "পুলিশ ফাঁড়ি / বক্স" : "Police Stations"}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === "POLICE_BOX" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                  {counts.police}
                </span>
              </button>

              <button
                onClick={() => setTypeFilter("PHARMACY")}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                  typeFilter === "PHARMACY"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Pill className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isBn ? "২৪/৭ ফার্মেসি" : "24/7 Pharmacies"}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${typeFilter === "PHARMACY" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                  {counts.pharmacy}
                </span>
              </button>
            </div>

            {/* Proximity Radius Options */}
            {proximityMode && (
              <div className="flex items-center gap-2 text-xs text-slate-600 ml-auto">
                <span className="font-semibold">{isBn ? "ব্যাসার্ধ:" : "Radius:"}</span>
                <select
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="3000">3 km</option>
                  <option value="5000">5 km</option>
                  <option value="10000">10 km</option>
                  <option value="15000">15 km</option>
                  <option value="25000">25 km</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Admin Management Collapsible Drawer */}
        {user?.role === "ADMIN" && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all">
            <button
              onClick={() => setShowAdminDrawer(!showAdminDrawer)}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {isBn ? "নিরাপদ আশ্রয়স্থল সংযোজন (অ্যাডমিন প্যানেল)" : "Admin Safe Haven Management"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isBn
                      ? "পোস্টজিআইএস ডেটাবেজে নতুন অনুমোদিত আশ্রয়স্থল যুক্ত করুন (POST /api/v1/safe-zones)"
                      : "Add verified government shelters directly into PostGIS database"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  ADMIN AUTHORIZED
                </span>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showAdminDrawer ? "rotate-90" : ""}`} />
              </div>
            </button>

            {showAdminDrawer && (
              <div className="p-5 space-y-4">
                {createSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{createSuccess}</span>
                  </div>
                )}

                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateSafeZone} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? "আশ্রয়স্থলের নাম" : "Shelter Name"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Uttara Model Police Outpost"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? "ধরণ" : "Category"}
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-700"
                    >
                      <option value="HOSPITAL">{isBn ? "হাসপাতাল" : "Hospital"}</option>
                      <option value="POLICE_BOX">{isBn ? "পুলিশ বক্স" : "Police Box"}</option>
                      <option value="PHARMACY">{isBn ? "২৪/৭ ফার্মেসি" : "Pharmacy"}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? "অক্ষাংশ (Lat)" : "Latitude"}
                    </label>
                    <input
                      type="text"
                      placeholder="23.8103"
                      value={newLat}
                      onChange={(e) => setNewLat(e.target.value)}
                      required
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {isBn ? "দ্রাঘিমাংশ (Lng)" : "Longitude"}
                    </label>
                    <input
                      type="text"
                      placeholder="90.4125"
                      value={newLng}
                      onChange={(e) => setNewLng(e.target.value)}
                      required
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{isCreating ? (isBn ? "সংরক্ষণ..." : "Saving...") : (isBn ? "যুক্ত করুন" : "Add Shelter")}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {/* Main Content Layout based on ViewMode */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
            <RefreshCw className="w-9 h-9 text-blue-600 animate-spin mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">
              {isBn ? "নিরাপদ আশ্রয়স্থল লোড হচ্ছে..." : "Querying PostGIS Verified Safe Shelters..."}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isBn ? "বাংলাদেশ সরকারের তথ্যভাণ্ডার থেকে ডেটা আসছে" : "Connecting to PostgreSQL spatial repository"}
            </p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-800 shadow-xs">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
            <h3 className="text-base font-bold">{isBn ? "ডেটা লোড করতে ব্যর্থ" : "Failed to Load Safe Shelters"}</h3>
            <p className="text-xs text-rose-600 mt-1 mb-4">{error}</p>
            <button
              onClick={fetchSafeZones}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-2xs"
            >
              {isBn ? "পুনরায় চেষ্টা করুন" : "Retry Connection"}
            </button>
          </div>
        ) : filteredSafeZones.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 shadow-xs">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              {isBn ? "কোনো আশ্রয়স্থল পাওয়া যায়নি" : "No verified safe shelters found"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isBn
                ? "আপনার ফিল্টারের সাথে মিলে এমন কোনো আশ্রয়স্থল নেই। ফিল্টার পরিবর্তন করে দেখুন।"
                : "No shelters match your current search and filter criteria. Try expanding your radius or selecting another city."}
            </p>
            <button
              onClick={() => {
                setTypeFilter("ALL");
                setSearchQuery("");
                setActiveCityPreset("All Bangladesh");
                setProximityMode(false);
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
            >
              {isBn ? "সব ফিল্টার রিসেট করুন" : "Reset Filters"}
            </button>
          </div>
        ) : (
          <div>
            {/* VIEW MODE 1: SPLIT VIEW (Map + List Side by Side) */}
            {viewMode === "split" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Interactive Leaflet Map (7 cols) */}
                <div className="lg:col-span-7 lg:sticky lg:top-24">
                  <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between px-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {isBn ? "লাইভ রেডার ও ম্যাপ অবস্থান" : "Interactive Live Haven Map"}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {filteredSafeZones.length} {isBn ? "টি কেন্দ্র প্রদর্শিত" : "Pins Loaded"}
                      </span>
                    </div>

                    <SafeZonesMap
                      safeZones={filteredSafeZones}
                      selectedZone={selectedZone}
                      onSelectZone={(z) => setSelectedZone(z)}
                      userLocation={userLocation}
                      language={language}
                      onNavigateSafeRoute={handleNavigateSafePath}
                      className="w-full h-[300px] sm:h-[380px] lg:h-[520px]"
                    />
                  </div>
                </div>

                {/* Right: Shelters List (5 cols) */}
                <div className="lg:col-span-5 space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-1">
                  {filteredSafeZones.map((sz) => {
                    const badge = getTypeBadge(sz.type);
                    const Icon = badge.icon;
                    const isSelected = selectedZone?.id === sz.id;

                    return (
                      <div
                        key={sz.id}
                        onClick={() => setSelectedZone(sz)}
                        className={`bg-white border rounded-2xl p-4 sm:p-4.5 transition-all cursor-pointer relative ${
                          isSelected
                            ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
                            : "border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        {/* Header: Type Badge & Verified Tag */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.badgeClass}`}>
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{badge.label}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {sz.distanceMeters && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                <span>
                                  {Number(sz.distanceMeters) >= 1000
                                    ? `${(Number(sz.distanceMeters) / 1000).toFixed(1)} km`
                                    : `${Math.round(Number(sz.distanceMeters))} m`}
                                </span>
                              </span>
                            )}

                            {user?.role === "ADMIN" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSafeZone(sz.id, sz.name);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                title="Delete Shelter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                          {sz.name}
                        </h3>

                        {/* Coordinates & Copy */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mb-3 pt-1">
                          <div className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {sz.latitude.toFixed(4)}, {sz.longitude.toFixed(4)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCoords(sz);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                            title="Copy Coordinates"
                          >
                            {copiedId === sz.id ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">{isBn ? "কপি হয়েছে" : "Copied"}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" />
                                <span>{isBn ? "কপি" : "Copy"}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigateSafePath(sz);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-95 min-h-[38px]"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>{isBn ? "নিরাপদ পথ দেখুন" : "Safe Path Navigation"}</span>
                          </button>

                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${sz.latitude},${sz.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center min-w-[38px] min-h-[38px]"
                            title="Open Google Maps Directions"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW MODE 2: GRID DIRECTORY (Responsive 3 Columns) */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSafeZones.map((sz) => {
                  const badge = getTypeBadge(sz.type);
                  const Icon = badge.icon;
                  const isSelected = selectedZone?.id === sz.id;

                  return (
                    <div
                      key={sz.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                        isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.badgeClass}`}>
                            <Icon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {sz.distanceMeters && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                <span>
                                  {Number(sz.distanceMeters) >= 1000
                                    ? `${(Number(sz.distanceMeters) / 1000).toFixed(1)} km`
                                    : `${Math.round(Number(sz.distanceMeters))} m`}
                                </span>
                              </span>
                            )}

                            {user?.role === "ADMIN" && (
                              <button
                                onClick={() => handleDeleteSafeZone(sz.id, sz.name)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Delete Shelter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-snug mb-2">
                          {sz.name}
                        </h3>

                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {sz.latitude.toFixed(4)}, {sz.longitude.toFixed(4)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyCoords(sz)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded"
                          >
                            {copiedId === sz.id ? (
                              <span className="text-emerald-700 font-bold">{isBn ? "কপি হয়েছে" : "Copied"}</span>
                            ) : (
                              <span>{isBn ? "কপি" : "Copy"}</span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={() => handleNavigateSafePath(sz)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>{isBn ? "নিরাপদ পথ খুঁজুন" : "Safe Navigation"}</span>
                        </button>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${sz.latitude},${sz.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Google Maps"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 3: FULL INTERACTIVE MAP FOCUS */}
            {viewMode === "map" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
                <SafeZonesMap
                  safeZones={filteredSafeZones}
                  selectedZone={selectedZone}
                  onSelectZone={(z) => setSelectedZone(z)}
                  userLocation={userLocation}
                  language={language}
                  onNavigateSafeRoute={handleNavigateSafePath}
                  className="w-full h-[620px]"
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
