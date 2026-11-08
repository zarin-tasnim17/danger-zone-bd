"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  selectedCategories?: IncidentCategory[];
  onToggleCategory?: (category: IncidentCategory) => void;
  onClearCategories?: () => void;
  // Backward compatibility with single-category mode if needed
  selectedCategory?: IncidentCategory | "all";
  onSelectCategory?: (category: IncidentCategory | "all") => void;
  categoryCounts?: Record<string, number>;
  isBn: boolean;
}

export default function CategoryFilterPopover({
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  isBn,
}: CategoryFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  // Normalize multi-select active list from props
  const activeCategories: IncidentCategory[] = useMemo(() => {
    if (selectedCategories && Array.isArray(selectedCategories)) {
      return selectedCategories;
    }
    if (selectedCategory && selectedCategory !== "all") {
      return [selectedCategory];
    }
    return [];
  }, [selectedCategories, selectedCategory]);

  const handleToggle = (catId: IncidentCategory) => {
    if (onToggleCategory) {
      onToggleCategory(catId);
    } else if (onSelectCategory) {
      const isSelected = activeCategories.includes(catId);
      onSelectCategory(isSelected ? "all" : catId);
    }
  };

  const handleClear = () => {
    if (onClearCategories) {
      onClearCategories();
    } else if (onSelectCategory) {
      onSelectCategory("all");
    }
  };

  // Compute trigger button viewport bounding rect
  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const popoverWidth = isMobile ? window.innerWidth - 24 : 480;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 12) left = 12;

    setCoords({
      top: rect.bottom + 8,
      left,
      width: popoverWidth,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    updateCoords();
  }, [updateCoords]);

  // Re-calculate coordinates on open, window resize, or scroll
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleReposition = () => updateCoords();
      window.addEventListener("resize", handleReposition);
      window.addEventListener("scroll", handleReposition, true);
      return () => {
        window.removeEventListener("resize", handleReposition);
        window.removeEventListener("scroll", handleReposition, true);
      };
    }
  }, [isOpen, updateCoords]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const totalCategoriesCount = useMemo(() => {
    return FILTER_GROUPS.reduce((acc, g) => acc + g.options.length, 0);
  }, []);

  const activeOptions = useMemo(() => {
    if (activeCategories.length === 0) return [];
    const list: (typeof FILTER_GROUPS)[0]["options"][0][] = [];
    for (const group of FILTER_GROUPS) {
      for (const opt of group.options) {
        if (activeCategories.includes(opt.id as IncidentCategory)) {
          list.push(opt);
        }
      }
    }
    return list;
  }, [activeCategories]);

  return (
    <div className="relative inline-block text-left shrink-0">
      {/* Trigger Button: Responsive compact sizing for mobile screens (e.g. 375px iPhone) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updateCoords();
          setIsOpen(!isOpen);
        }}
        className={`text-xs px-2 sm:px-2.5 py-1.5 rounded-xl font-bold border flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-2xs select-none shrink-0 ${
          activeCategories.length > 0
            ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
            : isOpen
            ? "bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-blue-500/20"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Filter
          className={`w-3.5 h-3.5 shrink-0 ${
            activeCategories.length > 0 ? "text-white" : "text-slate-500"
          }`}
        />

        {activeOptions.length > 0 ? (
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate max-w-[85px] sm:max-w-[130px] text-xs">
              {activeOptions.length === 1
                ? isBn
                  ? activeOptions[0].labelBn
                  : activeOptions[0].labelEn
                : `${isBn ? activeOptions[0].labelBn : activeOptions[0].labelEn} +${
                    activeOptions.length - 1
                  }`}
            </span>
            {activeOptions.length > 1 && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-white/20 text-white shrink-0 hidden sm:inline">
                {activeOptions.length}
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className="p-0.5 rounded-full hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer shrink-0 ml-0.5"
              title={isBn ? "সব ফিল্টার মুছুন" : "Clear filters"}
            >
              <X className="w-3 h-3" />
            </span>
          </div>
        ) : (
          <>
            <span className="whitespace-nowrap">
              <span className="hidden sm:inline">
                {isBn ? "ক্যাটাগরি ফিল্টার" : "Category Filter"}
              </span>
              <span className="sm:hidden">
                {isBn ? "ক্যাটাগরি" : "Category"}
              </span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
              {totalCategoriesCount}
            </span>
          </>
        )}

        <ChevronDown
          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${activeCategories.length > 0 ? "text-white" : "text-slate-400"}`}
        />
      </button>

      {/* Floating Popover Menu via React Portal: Escapes ANY parent overflow clipping */}
      {isOpen &&
        mounted &&
        createPortal(
          <>
            {/* Backdrop for click dismissal */}
            <div
              className="fixed inset-0 z-[9998] bg-black/30 sm:bg-black/10 backdrop-blur-xs"
              onClick={() => setIsOpen(false)}
            />

            {/* Floating Dropdown / Mobile Sheet */}
            <div
              ref={popoverRef}
              style={
                coords && typeof window !== "undefined" && window.innerWidth >= 640
                  ? {
                      position: "fixed",
                      top: `${coords.top}px`,
                      left: `${coords.left}px`,
                      width: `${coords.width}px`,
                    }
                  : undefined
              }
              className={`z-[9999] bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col ${
                // Mobile: centered bottom sheet; Desktop: fixed dropdown below button
                "fixed inset-x-3 bottom-4 sm:bottom-auto sm:inset-x-auto max-h-[84vh] sm:max-h-[78vh]"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 px-1 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {isBn ? "ঘটনার বিভাগ ফিল্টার (মাল্টি-সিলেক্ট)" : "Filter by Incident Category"}
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {isBn
                        ? "এক বা একাধিক ক্যাটাগরি একসাথে নির্বাচন করুন"
                        : "Select one or multiple categories simultaneously"}
                    </p>
                  </div>
                </div>

                {activeCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {isBn ? `সব মুছুন (${activeCategories.length})` : `Clear (${activeCategories.length})`}
                  </button>
                )}
              </div>

              {/* Scrollable Semantic Groups */}
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                {FILTER_GROUPS.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <span>{group.icon}</span>
                      <span>{isBn ? group.groupBn : group.groupEn}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.options.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = activeCategories.includes(opt.id as IncidentCategory);
                        const count = categoryCounts[opt.id] ?? 0;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggle(opt.id as IncidentCategory)}
                            className={`w-full p-2 rounded-xl text-left border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-50/90 border-blue-500 ring-1 ring-blue-500/20 shadow-xs"
                                : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 " + opt.color
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

                            <div className="flex items-center gap-2 shrink-0">
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
                              ) : null}

                              {/* Multi-Select Checkbox Indicator */}
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "bg-blue-600 text-white shadow-2xs"
                                    : "border-2 border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action / Summary Bar */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div className="text-[11px] text-slate-600 font-medium truncate">
                  {activeCategories.length === 0
                    ? isBn
                      ? "সব ক্যাটাগরি প্রদর্শিত হচ্ছে"
                      : "Showing all categories"
                    : isBn
                    ? `${activeCategories.length}টি ক্যাটাগরি ফিল্টার সক্রিয়`
                    : `${activeCategories.length} categories active`}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0 cursor-pointer"
                >
                  {isBn ? "প্রয়োগ করুন" : "Apply Filter"}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
