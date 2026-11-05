"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, MapPin, Loader2, X, Navigation } from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

export interface GeocodedLocation {
  name: string;
  description: string;
  lat: number;
  lng: number;
  type?: string;
}

interface LocationSearchBarProps {
  onSelectLocation: (loc: GeocodedLocation) => void;
  placeholder?: string;
  className?: string;
  initialQuery?: string;
}

export default function LocationSearchBar({
  onSelectLocation,
  placeholder,
  className = "",
  initialQuery = "",
}: LocationSearchBarProps) {
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Primary fast geocoder: Photon API with Bangladesh coordinate centroid
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        trimmed
      )}&lat=23.8103&lon=90.4125&limit=6`;

      const res = await fetch(photonUrl);
      const data = await res.json();

      let mapped: GeocodedLocation[] = [];

      if (data?.features && Array.isArray(data.features) && data.features.length > 0) {
        mapped = data.features
          .filter((f: any) => {
            // Prioritize features inside or close to Bangladesh bounding box
            const [lng, lat] = f.geometry.coordinates;
            return lat >= 20.0 && lat <= 27.5 && lng >= 88.0 && lng <= 93.5;
          })
          .map((f: any) => {
            const p = f.properties || {};
            const city = p.city || p.county || p.district || p.state || "Bangladesh";
            return {
              name: p.name || trimmed,
              description: [p.street, city, p.country].filter(Boolean).join(", "),
              lat: Number(f.geometry.coordinates[1].toFixed(6)),
              lng: Number(f.geometry.coordinates[0].toFixed(6)),
              type: p.osm_value || p.type || "place",
            };
          });
      }

      // 2. Fallback to OpenStreetMap Nominatim BD if Photon returned no hits
      if (mapped.length === 0) {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          trimmed
        )}&countrycodes=bd&limit=5&addressdetails=1`;

        const nomRes = await fetch(nominatimUrl, {
          headers: { "Accept-Language": isBn ? "bn,en" : "en,bn" },
        });
        const nomData = await nomRes.json();

        if (Array.isArray(nomData)) {
          mapped = nomData.map((d: any) => ({
            name: d.name || d.display_name.split(",")[0],
            description: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            type: d.type || "place",
          }));
        }
      }

      setResults(mapped);
      setIsOpen(mapped.length > 0);
      setSelectedIndex(-1);
    } catch (err) {
      console.warn("[LocationSearchBar] Geocoding notice:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [isBn]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      searchPlaces(val);
    }, 280);
  };

  const handleSelect = (item: GeocodedLocation) => {
    setQuery(item.name);
    setIsOpen(false);
    setResults([]);
    onSelectLocation(item);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const defaultPlaceholder = isBn
    ? "স্থান, রাস্তা বা এলাকা খুঁজুন (যেমন: ধানমন্ডি ৩২, মিরপুর ১০, বনানী)..."
    : "Search road, place, or neighborhood (e.g. Mirpur 10, Banani 11)...";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-[600] p-1.5 rounded-2xl bg-white/98 backdrop-blur-xl border border-slate-200 shadow-2xl space-y-0.5 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
            <span>{isBn ? "বাংলাদেশ ভৌগোলিক অবস্থান" : "Matching Locations in Bangladesh"}</span>
            <span className="text-emerald-600 font-mono">Instant Map Snap</span>
          </div>

          {results.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={`${item.lat}-${item.lng}-${idx}`}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 border border-blue-200/80 text-blue-900"
                    : "hover:bg-slate-50 text-slate-800"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate flex items-center justify-between gap-1">
                    <span>{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
