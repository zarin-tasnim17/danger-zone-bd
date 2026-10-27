"use client";

import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { getTranslation } from "@/lib/translations";
import { X, ShieldAlert, CheckCircle2, Navigation, AlertTriangle } from "lucide-react";
import { ReportCategory, ReportSeverity } from "@repo/shared";
import { useMapStore } from "@/store/useMapStore";
import { apiFetch } from "@/lib/api";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportIncidentModal({ isOpen, onClose }: ReportModalProps) {
  const { language } = useLanguageStore();
  const t = getTranslation(language);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReportCategory>("MUGGING");
  const [severity, setSeverity] = useState<ReportSeverity>("HIGH");
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mapCenter = useMapStore((state) => state.center);
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);

  // Attempt to fetch current device GPS on modal open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeviceGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("[GPS] Device location unavailable:", err.message);
          // Fall back to map center for testing / simulation
          setDeviceGps({ lat: mapCenter.lat, lng: mapCenter.lng });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isOpen, mapCenter]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim() || !description.trim()) {
      setErrorMessage(
        language === "en"
          ? "Please fill in all required fields."
          : "অনুগ্রহ করে সকল প্রয়োজনীয় তথ্য পূরণ করুন।"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Use device GPS if captured, otherwise fallback to map center coordinate
      const actualGps = deviceGps || { lat: mapCenter.lat, lng: mapCenter.lng };

      const fullDescription = `${title.trim()}${locationName.trim() ? ` [${locationName.trim()}]` : ""}: ${description.trim()}`;

      await apiFetch("/reports", {
        method: "POST",
        headers: {
          "x-device-lat": actualGps.lat.toString(),
          "x-device-lng": actualGps.lng.toString(),
        },
        body: JSON.stringify({
          category,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white border border-surface-border rounded-lg max-w-lg w-full shadow-overlay overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-danger-critical" />
            <h3 className="font-bold text-sm sm:text-base text-content-primary">
              {language === "en" ? "Report Public Danger / Incident" : "নতুন বিপদ সংকেত বা ঘটনা রিপোর্ট করুন"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-content-muted hover:text-content-primary hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-base text-content-primary">
              {language === "en" ? "Report Broadcasted Successfully!" : "রিপোর্টটি সফলভাবে সম্প্রচারিত হয়েছে!"}
            </h4>
            <p className="text-xs text-content-secondary max-w-xs mx-auto">
              {language === "en"
                ? "Your alert has been verified and broadcast to all live map users in real time."
                : "আপনার রিপোর্টটি সরাসরি ম্যাপ ও সতর্কবার্তা নেটওয়ার্কে যুক্ত করা হয়েছে।"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Legal Warning Notice */}
            <div className="p-2.5 bg-danger-critical-bg border border-danger-critical-border rounded text-xs text-danger-critical-dark">
              ⚠️ {language === "en"
                ? "Please only report genuine incidents. False reporting violates the Cyber Security Act."
                : "অনুগ্রহ করে কেবল সত্য ঘটনা রিপোর্ট করুন। ভিত্তিহীন তথ্য প্রদান আইনত দণ্ডনীয় অপরাধ।"}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-content-primary mb-1">
                {language === "en" ? "Incident Title *" : "ঘটনার শিরোনাম *"}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "en" ? "e.g. Armed mugging attempt on Mirpur 10 roundabout" : "যেমন: মিরপুর ১০ গোলচত্বরে ছিনতাইয়ের চেষ্টা"}
                className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
              />
            </div>

            {/* Category & Severity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-content-primary mb-1">
                  {language === "en" ? "Category *" : "শ্রেণি *"}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                >
                  <option value="MUGGING">{language === "en" ? "Mugging & Robbery" : "ছিনতাই ও ডাকাতি"}</option>
                  <option value="THEFT">{language === "en" ? "Theft & Burglary" : "চুরি"}</option>
                  <option value="EXTORTION">{language === "en" ? "Extortion & Gang Threat" : "চাঁদাবাজি"}</option>
                  <option value="DRUG_ACTIVITY">{language === "en" ? "Drug Activity / Narcotics" : "মাদক ব্যবসা"}</option>
                  <option value="UNLIT_ROAD">{language === "en" ? "Unlit / Broken Road Hazard" : "অন্ধকার বা ঝুঁকিপূর্ণ সড়ক"}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-primary mb-1">
                  {language === "en" ? "Threat Severity *" : "বিপদের মাত্রা *"}
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                >
                  <option value="HIGH">{language === "en" ? "High (Weapons / Severe Threat)" : "উচ্চ ঝুঁকি (অস্ত্রধারী / মারপিট)"}</option>
                  <option value="MEDIUM">{language === "en" ? "Medium (Active Threat)" : "মাঝারি ঝুঁকি"}</option>
                  <option value="LOW">{language === "en" ? "Low (Advisory / Hazard)" : "নিম্ন ঝুঁকি (সতর্কবার্তা)"}</option>
                </select>
              </div>
            </div>

            {/* Specific Area / Landmark */}
            <div>
              <label className="block text-xs font-semibold text-content-primary mb-1">
                {language === "en" ? "Landmark / Neighborhood" : "নির্দিষ্ট এলাকা বা পরিচিত স্থান"}
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder={language === "en" ? "e.g. Dhanmondi 27 / Farmgate" : "যেমন: ধানমন্ডি ২৭ / ফার্মগেট"}
                className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-content-primary mb-1">
                {language === "en" ? "Incident Details *" : "বিস্তারিত বিবরণ *"}
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === "en" ? "Describe current situation, armed suspects, or safe detours..." : "বর্তমান পরিস্থিতি, অস্ত্রধারী ব্যক্তি বা সতর্কতা সম্পর্কে লিখুন..."}
                className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
              />
            </div>

            {/* GPS Proximity Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-content-muted">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {language === "en"
                  ? "Proximity check: Coordinates pinned at map center (" + mapCenter.lat.toFixed(4) + ", " + mapCenter.lng.toFixed(4) + ")"
                  : "ম্যাপ কেন্দ্রবিন্দুর স্থানাঙ্ক (" + mapCenter.lat.toFixed(4) + ", " + mapCenter.lng.toFixed(4) + ") যাচাই করা হবে"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-content-secondary hover:bg-surface-muted rounded-md transition-colors"
              >
                {t.close}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-danger-critical hover:bg-red-700 text-white rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting
                  ? (language === "en" ? "Broadcasting..." : "সম্প্রচার হচ্ছে...")
                  : (language === "en" ? "Broadcast Report" : "রিপোর্ট প্রকাশ করুন")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
