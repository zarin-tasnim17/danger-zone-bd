"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMapStore, MAP_LAYERS, MapTileLayer } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { Layers, Map, Satellite, Globe, Check } from "lucide-react";

interface MapLayerSwitcherProps {
  className?: string;
  compact?: boolean;
}

export default function MapLayerSwitcher({ className = "", compact = false }: MapLayerSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeTileLayer = useMapStore((state) => state.activeTileLayer);
  const setActiveTileLayer = useMapStore((state) => state.setActiveTileLayer);
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const layersList: { id: MapTileLayer; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "google_streets", icon: Map },
    { id: "google_hybrid", icon: Satellite },
    { id: "osm", icon: Globe },
  ];

  const currentLayerConfig = MAP_LAYERS[activeTileLayer];

  return (
    <div ref={dropdownRef} className={`relative z-[500] ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
        title={isBn ? "ম্যাপ লেয়ার পরিবর্তন করুন" : "Switch Map Layer"}
      >
        <Layers className="w-4 h-4 text-blue-600" />
        {!compact && (
          <span className="hidden sm:inline font-semibold">
            {isBn ? currentLayerConfig.nameBn : currentLayerConfig.nameEn}
          </span>
        )}
      </button>

      {/* Layer Selection Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-0 w-56 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>{isBn ? "ম্যাপ শৈলী নির্বাচন" : "Map Layer Style"}</span>
            <span className="text-blue-600 font-mono">HD Zoom 20+</span>
          </div>

          {layersList.map(({ id, icon: Icon }) => {
            const config = MAP_LAYERS[id];
            const isSelected = activeTileLayer === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTileLayer(id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs">{isBn ? config.nameBn : config.nameEn}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {id === "google_streets"
                        ? isBn ? "রাস্তা ও ভবন বিস্তারিত" : "Detailed roads & buildings"
                        : id === "google_hybrid"
                        ? isBn ? "উচ্চ রেজোলিউশন স্যাটেলাইট" : "High-res aerial imagery"
                        : isBn ? "ওপেন-সোর্স স্ট্যান্ডার্ড" : "Open-source baseline"}
                    </div>
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
