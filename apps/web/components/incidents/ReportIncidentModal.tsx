"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { getTranslation } from "@/lib/translations";
import {
  X,
  ShieldAlert,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  Crosshair,
  Lock,
  Swords,
  Users,
  AlertOctagon,
  Pill,
  LightbulbOff,
  Car,
  Siren,
  Sparkles,
} from "lucide-react";
import { ReportCategory, ReportSeverity } from "@repo/shared";
import { useMapStore } from "@/store/useMapStore";
import { apiFetch } from "@/lib/api";
import {
  HardwareGpsFix,
  evaluateHardwareGpsProximity,
  buildHardwareGpsHeaders,
} from "@/lib/gpsVerification";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Option A: Primary incident tags for reporting
interface IncidentTagDef {
  id: string;
  labelEn: string;
  labelBn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PRIMARY_TAGS: IncidentTagDef[] = [
  {
    id: "SNATCHING",
    labelEn: "Snatching",
    labelBn: "ছিনতাই",
    icon: Siren,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  {
    id: "ARMED_ASSAULT",
    labelEn: "Armed Assault",
    labelBn: "অস্ত্রসহ হামলা",
    icon: Swords,
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  {
    id: "THEFT",
    labelEn: "Theft",
    labelBn: "চুরি",
    icon: Lock,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    id: "ROBBERY",
    labelEn: "Robbery",
    labelBn: "ডাকাতি",
    icon: ShieldAlert,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  {
    id: "YOUTH_GANG_ACTIVITY",
    labelEn: "Youth Gang Activity",
    labelBn: "কিশোর গ্যাং",
    icon: Users,
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
  },
  {
    id: "EXTORTION",
    labelEn: "Extortion",
    labelBn: "চাঁদাবাজি",
    icon: AlertOctagon,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    id: "DRUG_RELATED_CRIME",
    labelEn: "Drug-Related Crime",
    labelBn: "মাদক সংক্রান্ত অপরাধ",
    icon: Pill,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    id: "ROAD_ACCIDENT",
    labelEn: "Road Accident",
    labelBn: "সড়ক দুর্ঘটনা",
    icon: Car,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  {
    id: "UNLIT_ROAD",
    labelEn: "Unlit Road",
    labelBn: "অন্ধকার রাস্তা",
    icon: LightbulbOff,
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
  },
];

export default function ReportIncidentModal({ isOpen, onClose }: ReportModalProps) {
  const { language } = useLanguageStore();
  const t = getTranslation(language);
  const isBn = language === "bn";

  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["SNATCHING"]);
  const [severity, setSeverity] = useState<ReportSeverity>("HIGH");
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mapCenter = useMapStore((state) => state.center);
  const setMapCenter = useMapStore((state) => state.setCenter);
  const [hardwareGps, setHardwareGps] = useState<HardwareGpsFix | null>(null);

  // Request live browser geolocation on modal open without fabricating fallback coordinates
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
          setHardwareGps({ ...coords, accuracy });
          setMapCenter(coords);
        },
        (err) => {
          console.warn("[GPS Proximity Radar] Geolocation unavailable:", err.message);
          setHardwareGps(null);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    } else {
      setHardwareGps(null);
    }
  }, [isOpen, setMapCenter]);

  const gpsEvaluation = useMemo(
    () => evaluateHardwareGpsProximity(hardwareGps, mapCenter.lat, mapCenter.lng),
    [hardwareGps, mapCenter]
  );

  // Auto-align map center with eligible hardware GPS
  const handleSyncToGps = () => {
    if (hardwareGps && gpsEvaluation.isEligibleHardwareGps) {
      setMapCenter({ lat: hardwareGps.lat, lng: hardwareGps.lng });
    }
  };

  // Option A: Smart Category Resolution
  const resolvedCategory = useMemo<ReportCategory>(() => {
    const hasTheft = selectedTags.includes("THEFT");
    const hasRobbery = selectedTags.includes("ROBBERY") || selectedTags.includes("DACOITY");
    const hasSnatching = selectedTags.includes("SNATCHING");
    const hasArmedAssault = selectedTags.includes("ARMED_ASSAULT");

    if (hasTheft && hasRobbery) return "THEFT_ROBBERY";
    if (hasSnatching && hasArmedAssault) return "SNATCHING_ARMED_ASSAULT";

    const lastTag = selectedTags[selectedTags.length - 1];
    if (lastTag) return lastTag as ReportCategory;
    return "SNATCHING";
  }, [selectedTags]);

  // Handle Tag Toggling with Smart Combination Pairing
  const handleToggleTag = (tagId: string) => {
    // If tag is already selected, unselect it (unless it's the last one)
    if (selectedTags.includes(tagId)) {
      if (selectedTags.length > 1) {
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      }
      return;
    }

    // Pair Combinations:
    // 1. THEFT + ROBBERY
    if (tagId === "THEFT") {
      if (selectedTags.includes("ROBBERY")) {
        setSelectedTags(["ROBBERY", "THEFT"]);
      } else {
        setSelectedTags(["THEFT"]);
      }
      return;
    }

    if (tagId === "ROBBERY") {
      if (selectedTags.includes("THEFT")) {
        setSelectedTags(["THEFT", "ROBBERY"]);
      } else {
        setSelectedTags(["ROBBERY"]);
      }
      return;
    }

    // 2. SNATCHING + ARMED_ASSAULT
    if (tagId === "SNATCHING") {
      if (selectedTags.includes("ARMED_ASSAULT")) {
        setSelectedTags(["ARMED_ASSAULT", "SNATCHING"]);
      } else {
        setSelectedTags(["SNATCHING"]);
      }
      return;
    }

    if (tagId === "ARMED_ASSAULT") {
      if (selectedTags.includes("SNATCHING")) {
        setSelectedTags(["SNATCHING", "ARMED_ASSAULT"]);
      } else {
        setSelectedTags(["ARMED_ASSAULT"]);
      }
      return;
    }

    // Independent tags: EXTORTION, YOUTH_GANG_ACTIVITY, DRUG_RELATED_CRIME, ROAD_ACCIDENT, UNLIT_ROAD
    setSelectedTags([tagId]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim() || !description.trim()) {
      setErrorMessage(
        language === "en"
          ? "Please enter both an incident title and description."
          : "অনুগ্রহ করে ঘটনার শিরোনাম এবং বিস্তারিত বিবরণ উভয়ই লিখুন।"
      );
      return;
    }

    const fullDescription = `${title.trim()}${locationName.trim() ? ` [${locationName.trim()}]` : ""}: ${description.trim()}`;
    if (fullDescription.length > 1000) {
      setErrorMessage(
        language === "en"
          ? "Combined report details cannot exceed 1000 characters."
          : "মোট রিপোর্টের বিবরণ ১০০০ অক্ষরের বেশি হতে পারবে না।"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const gpsHeaders = buildHardwareGpsHeaders(hardwareGps, gpsEvaluation);

      await apiFetch("/reports", {
        method: "POST",
        headers: gpsHeaders,
        body: JSON.stringify({
          category: resolvedCategory,
          severity,
          latitude: mapCenter.lat,
          longitude: mapCenter.lng,
          description: fullDescription,
        }),
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setTitle("");
        setLocationName("");
        setDescription("");
        setSelectedTags(["SNATCHING"]);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("[Report Submission] Error:", err.message);
      setErrorMessage(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              {language === "en" ? "Report Public Danger / Incident" : "নতুন বিপদ সংকেত বা ঘটনা রিপোর্ট করুন"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-900">
              {language === "en" ? "Report Broadcasted Successfully!" : "রিপোর্টটি সফলভাবে সম্প্রচারিত হয়েছে!"}
            </h4>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              {language === "en"
                ? "Your alert has been verified and broadcast to all live map users in real time."
                : "আপনার রিপোর্টটি সরাসরি ম্যাপ ও সতর্কবার্তা নেটওয়ার্কে যুক্ত করা হয়েছে।"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Legal Warning Notice */}
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              ⚠️ {language === "en"
                ? "Please only report genuine incidents. False reporting violates the Cyber Security Act."
                : "অনুগ্রহ করে কেবল সত্য ঘটনা রিপোর্ট করুন। ভিত্তিহীন তথ্য প্রদান আইনত দণ্ডনীয় অপরাধ।"}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === "en" ? "Incident Title *" : "ঘটনার শিরোনাম *"}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "en" ? "e.g. Armed mugging attempt near roundabout" : "যেমন: গোলচত্বরে ছিনতাইয়ের চেষ্টা"}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>

            {/* Option A: Smart Category Tag Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {language === "en" ? "Incident Category Tags *" : "ঘটনার ক্যাটাগরি ট্যাগ *"}
                </label>
                <span className="text-[11px] text-slate-500">
                  {isBn ? "প্রয়োজনে সমন্বিত ট্যাগ বাছাই করুন" : "Select tags (auto-combines)"}
                </span>
              </div>

              {/* Tag Chips Grid */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {PRIMARY_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  const Icon = tag.icon;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border flex items-center gap-1.5 transition-all select-none cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : tag.color}`} />
                      <span>{isBn ? tag.labelBn : tag.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reactive Resolved Category Status Badge */}
              <div className="mt-2 p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all bg-blue-50/80 border-blue-200 text-blue-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold">
                    {isBn ? "কার্যকর ক্যাটাগরি:" : "Resolved Category:"}{" "}
                    <span className="underline decoration-blue-500 underline-offset-2">
                      {isBn
                        ? t.categories[resolvedCategory] || resolvedCategory
                        : t.categories[resolvedCategory] || resolvedCategory}
                    </span>
                  </span>
                </div>
                {resolvedCategory.includes("_") && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                    {isBn ? "সমন্বিত টাইপ" : "Combined Alert"}
                  </span>
                )}
              </div>
            </div>

            {/* Severity Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === "en" ? "Threat Severity *" : "বিপদের মাত্রা *"}
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              >
                <option value="HIGH">{language === "en" ? "High (Weapons / Severe Threat)" : "উচ্চ ঝুঁকি (অস্ত্রধারী / মারপিট)"}</option>
                <option value="MEDIUM">{language === "en" ? "Medium (Active Threat)" : "মাঝারি ঝুঁকি"}</option>
                <option value="LOW">{language === "en" ? "Low (Advisory / Hazard)" : "নিম্ন ঝুঁকি (সতর্কবার্তা)"}</option>
              </select>
            </div>

            {/* Specific Area / Landmark */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === "en" ? "Landmark / Neighborhood" : "নির্দিষ্ট এলাকা বা পরিচিত স্থান"}
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder={language === "en" ? "e.g. Dhanmondi 27 / Farmgate" : "যেমন: ধানমন্ডি ২৭ / ফার্মগেট"}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === "en" ? "Incident Details *" : "বিস্তারিত বিবরণ *"}
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Provide key details: number of suspects, weapons seen, escape route..."
                    : "প্রয়োজনীয় বিবরণ দিন: অপরাধীদের সংখ্যা, ব্যবহৃত অস্ত্র, পালানোর দিক..."
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors resize-none"
              />
            </div>

            {/* Proximity GPS Radar Status Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Navigation className={`w-4 h-4 ${gpsEvaluation.isVerified ? "text-emerald-600" : "text-amber-600"}`} />
                <div>
                  <span className="font-semibold text-slate-800">
                    {language === "en" ? "Incident Pin Location" : "রিপোর্টের ম্যাপ পিন"}:
                  </span>{" "}
                  <span className="font-mono text-slate-600">
                    {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                  </span>
                  <span className={`block text-[11px] ${gpsEvaluation.isVerified ? "text-emerald-700" : "text-amber-700 font-semibold"}`}>
                    {gpsEvaluation.isVerified
                      ? language === "en"
                        ? `Hardware GPS Verified (${gpsEvaluation.distanceMeters}m ≤ 200m)`
                        : `হার্ডওয়্যার জিপিএস যাচাইকৃত (${gpsEvaluation.distanceMeters}মি ≤ ২০০মি)`
                      : gpsEvaluation.status === "OUT_OF_RANGE"
                        ? language === "en"
                          ? `Manual Pin / Unverified GPS (${gpsEvaluation.distanceMeters}m away > 200m)`
                          : `ম্যানুয়াল পিন / অযাচাইকৃত জিপিএস (${gpsEvaluation.distanceMeters}মি দূরে)`
                        : language === "en"
                          ? "Manual Pin / Unverified GPS"
                          : "ম্যানুয়াল পিন / অযাচাইকৃত জিপিএস"}
                  </span>
                </div>
              </div>

              {gpsEvaluation.isEligibleHardwareGps && (
                <button
                  type="button"
                  onClick={handleSyncToGps}
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors"
                  title="Snap pin to your device GPS"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{language === "en" ? "Sync GPS" : "জিপিএস সিঙ্ক"}</span>
                </button>
              )}
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {language === "en" ? "Cancel" : "বাতিল"}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-red-600/20 active:scale-95"
              >
                {isSubmitting
                  ? (language === "en" ? "Broadcasting..." : "সম্প্রচার হচ্ছে...")
                  : (language === "en" ? "Broadcast Alert ⚡" : "সতর্কবার্তা সম্প্রচার করুন ⚡")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
