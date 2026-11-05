"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import {
  MapPin,
  Search,
  Crosshair,
  Compass,
  Check,
  X,
  Loader2,
  Sparkles,
  Building2,
  Navigation2,
} from "lucide-react";

interface GeocodedResult {
  name: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  formatted: string;
}

// Popular verified landmarks for fast 1-click calibration in Bangladesh
const PRESET_LANDMARKS = [
  // Khulna City Division
  {
    city: "Khulna",
    nameEn: "Jatishongho Shishu Park",
    nameBn: "জাতিসংঘ শিশু পার্ক",
    subEn: "Shantidham More, Khulna",
    subBn: "শান্তিধাম মোড়, খুলনা",
    lat: 22.8185,
    lng: 89.5539,
  },
  {
    city: "Khulna",
    nameEn: "Shantidham More",
    nameBn: "শান্তিধাম মোড়",
    subEn: "Khan Jahan Ali Rd, Khulna",
    subBn: "খান জাহান আলী রোড, খুলনা",
    lat: 22.8207,
    lng: 89.5542,
  },
  {
    city: "Khulna",
    nameEn: "Hotel Royal International More",
    nameBn: "হোটেল রয়্যাল মোড়",
    subEn: "KDA Avenue, Khulna",
    subBn: "কেডিএ এভিনিউ, খুলনা",
    lat: 22.8146,
    lng: 89.5583,
  },
  {
    city: "Khulna",
    nameEn: "Khulna New Market",
    nameBn: "খুলনা নিউ মার্কেট",
    subEn: "KDA Avenue, Khulna",
    subBn: "কেডিএ এভিনিউ, খুলনা",
    lat: 22.8258,
    lng: 89.5512,
  },
  {
    city: "Khulna",
    nameEn: "Sonadanga Bus Terminal",
    nameBn: "সোনাডাঙ্গা বাস টার্মিনাল",
    subEn: "Sonadanga, Khulna",
    subBn: "সোনাডাঙ্গা, খুলনা",
    lat: 22.8214,
    lng: 89.5398,
  },
  {
    city: "Khulna",
    nameEn: "Khulna University (KU)",
    nameBn: "খুলনা বিশ্ববিদ্যালয় (কু)",
    subEn: "Gollamari, Khulna",
    subBn: "গল্লামারী, খুলনা",
    lat: 22.8021,
    lng: 89.5332,
  },
  // Dhaka Division
  {
    city: "Dhaka",
    nameEn: "Dhanmondi 32",
    nameBn: "ধানমন্ডি ৩২",
    subEn: "Mirpur Road, Dhaka",
    subBn: "মিরপুর রোড, ঢাকা",
    lat: 23.7516,
    lng: 90.3776,
  },
  {
    city: "Dhaka",
    nameEn: "Mirpur 10 Circle",
    nameBn: "মিরপুর ১০ গোলচত্বর",
    subEn: "Mirpur, Dhaka",
    subBn: "মিরপুর, ঢাকা",
    lat: 23.8069,
    lng: 90.3687,
  },
  {
    city: "Dhaka",
    nameEn: "Banani 11",
    nameBn: "বনানী ১১",
    subEn: "Banani, Dhaka",
    subBn: "বনানী, ঢাকা",
    lat: 23.7937,
    lng: 90.4049,
  },
  {
    city: "Dhaka",
    nameEn: "Shahbagh / DU",
    nameBn: "শাহবাগ / ঢাবি",
    subEn: "Dhaka University Area",
    subBn: "ঢাকা বিশ্ববিদ্যালয় এলাকা",
    lat: 23.7380,
    lng: 90.3956,
  },
];

export default function LocationCalibrationModal() {
  const {
    isCalibrationModalOpen,
    closeCalibrationModal,
    calibrateUserLocation,
    center,
    setCenter,
    setZoom,
    userLocation,
    locationSource,
  } = useMapStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCity, setSelectedCity] = useState<"Khulna" | "Dhaka">("Khulna");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isCalibrationModalOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isCalibrationModalOpen]);

  // Debounced search via Photon API with Bangladesh biasing
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const biasLat = center?.lat || 22.8185;
        const biasLng = center?.lng || 89.5539;
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query.trim()
        )}&lat=${biasLat}&lon=${biasLng}&limit=6`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        if (data.features && Array.isArray(data.features)) {
          const mapped: GeocodedResult[] = data.features.map(
            (f: {
              geometry: { coordinates: [number, number] };
              properties: { name?: string; city?: string; state?: string; country?: string };
            }) => {
              const [lon, lat] = f.geometry.coordinates;
              const props = f.properties;
              const parts = [props.name, props.city, props.state]
                .filter(Boolean)
                .join(", ");
              return {
                name: props.name || parts,
                city: props.city,
                state: props.state,
                lat,
                lng: lon,
                formatted: parts || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
              };
            }
          );
          setResults(mapped);
        }
      } catch (err) {
        console.warn("[Calibration] Autocomplete search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, center]);

  if (!isCalibrationModalOpen) return null;

  const handleSelectLocation = (lat: number, lng: number, label: string) => {
    calibrateUserLocation({ lat, lng }, label);
    setCenter({ lat, lng });
    setZoom(17);
    closeCalibrationModal();
  };

  const handleUseCurrentCenter = () => {
    const lat = Number(center.lat.toFixed(6));
    const lng = Number(center.lng.toFixed(6));
    const label = isBn ? "ম্যাপ থেকে নির্ধারিত অবস্থান" : "Map Pinpointed Location";
    handleSelectLocation(lat, lng, label);
  };

  const filteredPresets = PRESET_LANDMARKS.filter((p) => p.city === selectedCity);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeCalibrationModal}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="relative px-5 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white">
          <button
            onClick={closeCalibrationModal}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 id="calibration-title" className="text-lg font-bold text-slate-900">
                {isBn ? "সঠিক অবস্থান নির্ধারণ করুন" : "Set Your Exact Location"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isBn
                  ? "ডেস্কটপ ও ল্যাপটপে স্যাটেলাইট জিপিএস না থাকায় সঠিক অবস্থান একবার সংরক্ষণ করুন"
                  : "Desktop browsers lack satellite GPS. Pinpoint your real spot once below."}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800">
          {/* Why This Happens Alert Card */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-950">
                {isBn ? "ইন্টারনেট প্রোভাইডারের ভুল অবস্থান প্রতিরোধ" : "Preventing ISP Gateway Mismatches"}
              </p>
              <p className="text-blue-800 leading-relaxed text-[11px]">
                {isBn
                  ? "ডেস্কটপ ব্রাউজার ওয়াইফাই/আইএসপি টাওয়ার (যেমন বাঘাল বা ক্যাসেল সালাম) সনাক্ত করে। নিচের যে কোনো অপশন ব্যবহার করে আপনার বাড়ি বা অফিসের সঠিক স্থান নির্ধারণ করলে 'My Location' বোতাম সবসময় সেখানেই যাবে।"
                  : "Computers use your internet tower (often 10–30 km away in Badhal or Castle Salam). Setting your verified spot below ensures 'My Location' always snaps straight to your real building."}
              </p>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? "এলাকা বা ল্যান্ডমার্ক অনুসন্ধান" : "Search Area or Landmark"}</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isBn
                    ? "যেমন: জাতিসংঘ শিশু পার্ক, শান্তিধাম, খুলনা..."
                    : "e.g., Jatishongho Shishu Park, Shantidham, Khulna..."
                }
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-2xs font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Search Suggestions Dropdown */}
            {results.length > 0 && (
              <div className="mt-1.5 border border-slate-200 rounded-2xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {results.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    onClick={() => handleSelectLocation(item.lat, item.lng, item.name)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{item.formatted}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white flex items-center gap-1 shadow-2xs group-hover:scale-105 transition-all">
                      <Check className="w-3 h-3" />
                      <span>{isBn ? "সেট করুন" : "Set"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 1-Click Popular Landmarks */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{isBn ? "১-ক্লিক জনপ্রিয় ল্যান্ডমার্ক" : "1-Click Popular Landmarks"}</span>
              </label>

              {/* City Switcher Pill */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedCity("Khulna")}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    selectedCity === "Khulna"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {isBn ? "খুলনা" : "Khulna"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCity("Dhaka")}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    selectedCity === "Dhaka"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {isBn ? "ঢাকা" : "Dhaka"}
                </button>
              </div>
            </div>

            {/* Landmarks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.nameEn}
                  type="button"
                  onClick={() =>
                    handleSelectLocation(
                      preset.lat,
                      preset.lng,
                      isBn ? preset.nameBn : preset.nameEn
                    )
                  }
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all group flex items-start gap-2 cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 truncate">
                      {isBn ? preset.nameBn : preset.nameEn}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {isBn ? preset.subBn : preset.subEn}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action: Use Current Map Center */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleUseCurrentCenter}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-2xs"
            >
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>
                {isBn
                  ? `ম্যাপের বর্তমান কেন্দ্রবিন্দু (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}) অবস্থান হিসেবে সংরক্ষণ করুন`
                  : `Save Current Map Center (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}) as My Location`}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              {isBn
                ? "💡 ম্যাপটি টেনে আপনার ভবনের ওপর আনুন, তারপর ওপরের বোতামটিতে ক্লিক করুন।"
                : "💡 Pan the map over your building, then click the button above to lock it."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Navigation2 className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {locationSource === "calibrated"
                ? isBn
                  ? "✓ অবস্থান পূর্বে সংরক্ষিত হয়েছে"
                  : "✓ Previously calibrated"
                : isBn
                  ? "অপ্রমাণিত জিপিএস সক্রিয়"
                  : "Raw network GPS active"}
            </span>
          </div>
          <button
            type="button"
            onClick={closeCalibrationModal}
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition font-semibold cursor-pointer"
          >
            {isBn ? "পরে করুন" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
