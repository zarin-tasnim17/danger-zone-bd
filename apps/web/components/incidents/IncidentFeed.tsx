"use client";

import React, { useMemo } from "react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useFilterStore } from "@/store/useFilterStore";
import { getTranslation } from "@/lib/translations";
import { DangerIncident } from "@repo/shared";
import { AlertCircle, MapPin, ThumbsUp, ChevronRight } from "lucide-react";

export default function IncidentFeed() {
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const t = getTranslation(language);

  const filtered = useMemo(() => {
    return incidents.filter((item) => {
      if (selectedSeverity !== "all" && item.severity !== selectedSeverity) return false;
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesTitle =
          item.title.toLowerCase().includes(q) ||
          (item.titleBn && item.titleBn.toLowerCase().includes(q));
        const matchesLoc =
          item.locationName.toLowerCase().includes(q) ||
          (item.locationNameBn && item.locationNameBn.toLowerCase().includes(q));
        if (!matchesTitle && !matchesLoc) return false;
      }
      return true;
    });
  }, [incidents, selectedSeverity, selectedCategory, searchQuery]);

  const handleSelectIncident = (incident: DangerIncident) => {
    setCenter(incident.coordinates);
    setZoom(14);
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-surface-border flex flex-col h-full z-10">
      {/* Header bar */}
      <div className="p-3.5 border-b border-surface-border bg-surface-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger-critical" />
          <h2 className="font-semibold text-xs sm:text-sm text-content-primary">
            {language === "en" ? "Recent Danger Reports" : "সাম্প্রতিক বিপদ সংকেতসমূহ"}
          </h2>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface-muted text-content-secondary">
          {filtered.length}
        </span>
      </div>

      {/* Scrollable incidents list */}
      <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-content-muted text-xs">
            {language === "en"
              ? "No incidents matching the active filters."
              : "বর্তমান ফিল্টারে কোনো সতর্কবার্তা পাওয়া যায়নি।"}
          </div>
        ) : (
          filtered.map((item) => {
            const isCritical = item.severity === "critical";
            return (
              <div
                key={item.id}
                onClick={() => handleSelectIncident(item)}
                className="p-3.5 hover:bg-surface-subtle cursor-pointer transition-colors group relative"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      isCritical
                        ? "bg-danger-critical text-white border-danger-critical"
                        : item.severity === "high"
                        ? "bg-danger-warning text-white border-danger-warning"
                        : "bg-danger-caution text-white border-danger-caution"
                    }`}
                  >
                    {t.severity[item.severity]}
                  </span>

                  <span className="text-[11px] text-content-muted">
                    {t.categories[item.category] || item.category}
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-semibold text-content-primary group-hover:text-brand-primary leading-snug mb-1">
                  {language === "bn" && item.titleBn ? item.titleBn : item.title}
                </h3>

                <p className="text-xs text-content-secondary line-clamp-2 mb-2">
                  {language === "bn" && item.descriptionBn ? item.descriptionBn : item.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-content-muted pt-1">
                  <span className="flex items-center gap-1 truncate max-w-[190px]">
                    <MapPin className="w-3 h-3 text-content-muted shrink-0" />
                    <span className="truncate">
                      {language === "bn" && item.locationNameBn
                        ? item.locationNameBn
                        : item.locationName}
                    </span>
                  </span>

                  <span className="flex items-center gap-1 font-medium text-content-secondary shrink-0">
                    <ThumbsUp className="w-3 h-3 text-emerald-600" />
                    <span>{item.upvotes}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-content-muted ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Safety notice footer */}
      <div className="p-2.5 bg-surface-muted border-t border-surface-border text-[10px] text-content-muted text-center">
        {language === "en"
          ? "Always verify with local emergency services during active danger."
          : "জরুরি প্রয়োজনে সর্বদা জাতীয় জরুরি সেবা ৯৯৯ এ যোগাযোগ করুন।"}
      </div>
    </aside>
  );
}
