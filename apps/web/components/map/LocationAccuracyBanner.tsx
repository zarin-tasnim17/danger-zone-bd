"use client";

import React from "react";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { geoTranslations } from "@/lib/translations";
import { AlertCircle, Crosshair, X } from "lucide-react";

export default function LocationAccuracyBanner() {
  const {
    userLocation,
    userAccuracy,
    userAccuracyTier,
    locationSource,
    isLowAccuracy,
    dismissedCalibrationBanner,
    setDismissedCalibrationBanner,
    openCalibrationModal,
  } = useMapStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Only show if user has live GPS location, is not calibrated, accuracy is low (> 100m or tier LOW/VERY_LOW/EXTREMELY_POOR), and not dismissed
  const shouldShow =
    userLocation &&
    locationSource !== "calibrated" &&
    !dismissedCalibrationBanner &&
    (isLowAccuracy ||
      userAccuracyTier === "LOW" ||
      userAccuracyTier === "VERY_LOW" ||
      userAccuracyTier === "EXTREMELY_POOR");

  if (!shouldShow) {
    return null;
  }

  const accuracyMeters =
    typeof userAccuracy === "number" && Number.isFinite(userAccuracy) && userAccuracy >= 0
      ? Math.round(userAccuracy)
      : 850;
  const tGeo = isBn ? geoTranslations.bn : geoTranslations.en;
  const tierLabel = userAccuracyTier
    ? tGeo.tiers[userAccuracyTier].replace("{acc}", accuracyMeters.toString())
    : `±${accuracyMeters}m`;

  return (
    <div className="absolute top-20 sm:top-28 left-1/2 -translate-x-1/2 z-[410] w-[calc(100%-1.25rem)] max-w-lg pointer-events-auto animate-in slide-in-from-top-3 duration-200">
      <div className="bg-white/98 backdrop-blur-2xl border border-amber-300 rounded-2xl shadow-xl p-2.5 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-slate-800">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {isBn
                ? `আইএসপি আনুমানিক অবস্থান: ${tierLabel}`
                : `Approximate ISP Location: ${tierLabel}`}
            </p>
            <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
              {tGeo.status.weakGps.replace("{acc}", accuracyMeters.toString())}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={openCalibrationModal}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/25 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{isBn ? "সঠিক করুন" : "Set Exact Spot"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissedCalibrationBanner(true)}
            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title={isBn ? "বন্ধ করুন" : "Dismiss"}
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
