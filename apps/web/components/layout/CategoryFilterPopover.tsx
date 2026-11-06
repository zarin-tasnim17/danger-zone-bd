"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Filter,
  ChevronDown,
  X,
  Siren,
  Swords,
  ShieldAlert,
  Lock,
  Users,
  AlertOctagon,
  Pill,
  LightbulbOff,
  Car,
  Check,
  Sparkles,
} from "lucide-react";
import { IncidentCategory } from "@repo/shared";

interface FilterOption {
  id: IncidentCategory;
  labelEn: string;
  labelBn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeClass: string;
}

interface FilterGroup {
  groupEn: string;
  groupBn: string;
  icon: string;
  options: FilterOption[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    groupEn: "Violent & Armed Threats",
    groupBn: "সহিংস ও সশস্ত্র অপরাধ",
    icon: "🚨",
    options: [
      {
        id: "SNATCHING",
        labelEn: "Snatching",
        labelBn: "ছিনতাই",
        icon: Siren,
        color: "text-orange-600",
        badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
      },
      {
        id: "ARMED_ASSAULT",
        labelEn: "Armed Assault",
        labelBn: "অস্ত্রসহ হামলা",
        icon: Swords,
        color: "text-rose-600",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      },
      {
        id: "SNATCHING_ARMED_ASSAULT",
        labelEn: "Snatching & Armed Assault",
        labelBn: "ছিনতাই ও অস্ত্রসহ হামলা",
        icon: ShieldAlert,
        color: "text-red-700",
        badgeClass: "bg-red-50 text-red-800 border-red-300 font-bold",
      },
      {
        id: "ROBBERY",
        labelEn: "Robbery",
        labelBn: "ডাকাতি",
        icon: ShieldAlert,
        color: "text-red-600",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
      },
    ],
  },
  {
    groupEn: "Property & Gang Crime",
    groupBn: "সম্পত্তি ও সামাজিক অপরাধ",
    icon: "🛡️",
    options: [
      {
        id: "THEFT",
        labelEn: "Theft",
        labelBn: "চুরি",
        icon: Lock,
        color: "text-amber-600",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      },
      {
        id: "THEFT_ROBBERY",
        labelEn: "Theft & Robbery",
        labelBn: "চুরি ডাকাতি",
        icon: ShieldAlert,
        color: "text-red-800",
        badgeClass: "bg-red-50 text-red-800 border-red-300 font-bold",
      },
      {
        id: "EXTORTION",
        labelEn: "Extortion",
        labelBn: "চাঁদাবাজি",
        icon: AlertOctagon,
        color: "text-purple-600",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      },
      {
        id: "YOUTH_GANG_ACTIVITY",
        labelEn: "Youth Gang Activity",
        labelBn: "কিশোর গ্যাং",
        icon: Users,
        color: "text-violet-600",
        badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
      },
      {
        id: "DRUG_RELATED_CRIME",
        labelEn: "Drug-Related Crime",
        labelBn: "মাদক সংক্রান্ত অপরাধ",
        icon: Pill,
        color: "text-blue-600",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      },
    ],
  },
  {
    groupEn: "Civic & Road Safety",
    groupBn: "ট্রাফিক ও নাগরিক পরিকাঠামো",
    icon: "🚦",
    options: [
      {
        id: "ROAD_ACCIDENT",
        labelEn: "Road Accident",
        labelBn: "সড়ক দুর্ঘটনা / এক্সিডেন্ট",
        icon: Car,
        color: "text-emerald-600",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      {
        id: "UNLIT_ROAD",
        labelEn: "Unlit Road",
        labelBn: "অন্ধকার রাস্তা",
        icon: LightbulbOff,
        color: "text-slate-600",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      },
    ],
  },
];

interface CategoryFilterPopoverProps {
  selectedCategory: IncidentCategory | "all";
  onSelectCategory: (category: IncidentCategory | "all") => void;
  categoryCounts?: Record<string, number>;
  isBn: boolean;
}

export default function CategoryFilterPopover({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  isBn,
}: CategoryFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Find currently active option definition if any
  const activeOption = useMemo(() => {
    if (selectedCategory === "all") return null;
    for (const group of FILTER_GROUPS) {
      const match = group.options.find((opt) => opt.id === selectedCategory);
      if (match) return match;
    }
    return null;
  }, [selectedCategory]);

  const totalCategoriesCount = useMemo(() => {
    return FILTER_GROUPS.reduce((acc, g) => acc + g.options.length, 0);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block text-left shrink-0">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs px-3 py-1.5 rounded-xl font-bold border flex items-center gap-2 transition-all cursor-pointer shadow-2xs select-none ${
          selectedCategory !== "all"
            ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
            : isOpen
            ? "bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-blue-500/20"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Filter className={`w-3.5 h-3.5 ${selectedCategory !== "all" ? "text-white" : "text-slate-500"}`} />
        <span>
          {isBn ? "ক্যাটাগরি ফিল্টার" : "Category Filter"}
        </span>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
            selectedCategory !== "all"
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {totalCategoriesCount}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${selectedCategory !== "all" ? "text-white" : "text-slate-400"}`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <>
          {/* Mobile Backdrop for small screens */}
          <div
            className="md:hidden fixed inset-0 z-[1200] bg-black/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`z-[1300] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 ${
              // Mobile: centered bottom sheet or fixed drawer; Desktop: absolute dropdown
              "fixed inset-x-3 bottom-4 md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-[480px] max-h-[82vh] overflow-y-auto"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 px-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? "ঘটনার বিভাগ অনুযায়ী ফিল্টার" : "Filter Map by Incident Category"}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {isBn
                      ? "একটি ক্যাটাগরি বেছে নিয়ে ম্যাপে শুধুমাত্র সেই ঘটনাগুলো দেখুন"
                      : "Choose a category to isolate matching live alerts on the map"}
                  </p>
                </div>
              </div>

              {selectedCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory("all");
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {isBn ? "রিসেট করুন" : "Clear Filter"}
                </button>
              )}
            </div>

            {/* Semantic Groups */}
            <div className="space-y-3.5">
              {FILTER_GROUPS.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{group.icon}</span>
                    <span>{isBn ? group.groupBn : group.groupEn}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.options.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedCategory === opt.id;
                      const count = categoryCounts[opt.id] ?? 0;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onSelectCategory(isSelected ? "all" : opt.id);
                            setIsOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/90 border-blue-500 ring-1 ring-blue-500/20 shadow-xs"
                              : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`p-1.5 rounded-lg shrink-0 ${
                                isSelected ? "bg-blue-600 text-white" : "bg-slate-100 " + opt.color
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0">
                              <span
                                className={`text-xs block font-bold truncate leading-tight ${
                                  isSelected ? "text-blue-900" : "text-slate-800"
                                }`}
                              >
                                {isBn ? opt.labelBn : opt.labelEn}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate leading-tight">
                                {isBn ? opt.labelEn : opt.labelBn}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {count > 0 ? (
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full border ${
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-300">0</span>
                            )}

                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Close Button */}
            <div className="md:hidden pt-3 mt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2 bg-slate-100 text-slate-800 font-bold text-xs rounded-xl"
              >
                {isBn ? "বন্ধ করুন" : "Close"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
