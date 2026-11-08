"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import {
  MapPin,
  Search,
  Crosshair,
  X,
  Loader2,
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
  // Khulna
  { city: "Khulna", nameEn: "Shishu Park", nameBn: "শিশু পার্ক", lat: 22.8185, lng: 89.5539 },
  { city: "Khulna", nameEn: "Shantidham", nameBn: "শান্তিধাম মোড়", lat: 22.8207, lng: 89.5542 },
  { city: "Khulna", nameEn: "Royal More", nameBn: "রয়্যাল মোড়", lat: 22.8146, lng: 89.5583 },
  { city: "Khulna", nameEn: "New Market", nameBn: "নিউ মার্কেট", lat: 22.8258, lng: 89.5512 },
  { city: "Khulna", nameEn: "Sonadanga", nameBn: "সোনাডাঙ্গা", lat: 22.8214, lng: 89.5398 },
  { city: "Khulna", nameEn: "Khulna University", nameBn: "খুলনা বিশ্ববিদ্যালয়", lat: 22.8021, lng: 89.5332 },
  // Dhaka
  { city: "Dhaka", nameEn: "Dhanmondi 32", nameBn: "ধানমন্ডি ৩২", lat: 23.7516, lng: 90.3776 },
  { city: "Dhaka", nameEn: "Mirpur 10", nameBn: "মিরপুর ১০", lat: 23.8069, lng: 90.3687 },
  { city: "Dhaka", nameEn: "Banani 11", nameBn: "বনানী ১১", lat: 23.7937, lng: 90.4049 },
  { city: "Dhaka", nameEn: "Shahbagh / DU", nameBn: "শাহবাগ / ঢাবি", lat: 23.738, lng: 90.3956 },
  { city: "Dhaka", nameEn: "Gulshan 1", nameBn: "গুলশান ১", lat: 23.7788, lng: 90.4172 },
  { city: "Dhaka", nameEn: "Uttara Sector 3", nameBn: "উত্তরা ৩", lat: 23.8683, lng: 90.3967 },
];

export default function LocationCalibrationModal() {
  const {
    isCalibrationModalOpen,
    closeCalibrationModal,
    calibrateUserLocation,
    center,
    setCenter,
    setZoom,
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
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={closeCalibrationModal}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3 border-b border-slate-100">
          <button
            onClick={closeCalibrationModal}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 id="calibration-title" className="text-base font-bold text-slate-900 tracking-tight">
                {isBn ? "অবস্থান নির্ধারণ করুন" : "Set Your Location"}
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {isBn
                  ? "ডেস্কটপে সঠিক সতর্কবার্তা পেতে আপনার এলাকা একবার সংরক্ষণ করুন।"
                  : "Pinpoint your area once for accurate desktop safety alerts."}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Search Input */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isBn
                    ? "এলাকা বা ল্যান্ডমার্ক খুঁজুন (উদা: শান্তিধাম, ধানমন্ডি)..."
                    : "Search area, road, or landmark..."
                }
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition shadow-2xs font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Autocomplete Suggestions */}
            {results.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {results.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    onClick={() => handleSelectLocation(item.lat, item.lng, item.name)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50/80 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-800 truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{item.formatted}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                      {isBn ? "বাছাই" : "Select"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action: Use Current Map Center */}
          <div>
            <button
              type="button"
              onClick={handleUseCurrentCenter}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 text-emerald-900 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-99"
            >
              <Crosshair className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {isBn
                  ? "ম্যাপের কেন্দ্রবিন্দু ব্যবহার করুন"
                  : "Use Current Map Center"}
              </span>
            </button>
          </div>

          {/* Quick Select Preset Landmarks */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {isBn ? "জনপ্রিয় এলাকা" : "Quick Select"}
              </span>

              {/* City Switcher */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedCity("Khulna")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                    selectedCity === "Khulna"
                      ? "bg-slate-200/90 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {isBn ? "খুলনা" : "Khulna"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCity("Dhaka")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                    selectedCity === "Dhaka"
                      ? "bg-slate-200/90 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {isBn ? "ঢাকা" : "Dhaka"}
                </button>
              </div>
            </div>

            {/* Compact Chips */}
            <div className="flex flex-wrap gap-1.5">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100/80 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200/60 hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{isBn ? preset.nameBn : preset.nameEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                locationSource === "calibrated" ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span className="text-[11px]">
              {locationSource === "calibrated"
                ? isBn
                  ? "অবস্থান সংরক্ষিত আছে"
                  : "Calibrated"
                : isBn
                  ? "ডিফল্ট ব্রাউজার জিপিএস"
                  : "Default browser GPS"}
            </span>
          </div>
          <button
            type="button"
            onClick={closeCalibrationModal}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer"
          >
            {isBn ? "বন্ধ করুন" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
