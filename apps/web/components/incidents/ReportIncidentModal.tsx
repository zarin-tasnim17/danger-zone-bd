"use client";

import React, { useState } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { getTranslation } from "@/lib/translations";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { IncidentCategory, IncidentSeverity } from "@repo/shared";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportIncidentModal({ isOpen, onClose }: ReportModalProps) {
  const { language } = useLanguageStore();
  const t = getTranslation(language);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("violence_riot");
  const [severity, setSeverity] = useState<IncidentSeverity>("critical");
  const [locationName, setLocationName] = useState("");
  const [district, setDistrict] = useState("Dhaka");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !locationName.trim() || !description.trim()) {
      alert(language === "en" ? "Please fill in all required fields." : "অনুগ্রহ করে সকল প্রয়োজনীয় তথ্য পূরণ করুন।");
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
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
              {language === "en" ? "Report Submitted Successfully!" : "রিপোর্টটি সফলভাবে জমা হয়েছে!"}
            </h4>
            <p className="text-xs text-content-secondary max-w-xs mx-auto">
              {language === "en"
                ? "Your alert has been broadcast to the local danger monitor network."
                : "আপনার রিপোর্টটি সরাসরি ম্যাপ ও সতর্কবার্তা নেটওয়ার্কে যুক্ত করা হয়েছে।"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Disclaimer */}
            <div className="p-2.5 bg-danger-critical-bg border border-danger-critical-border rounded text-xs text-danger-critical-dark">
              ⚠️ {language === "en"
                ? "Please only report genuine and verified threats. False reporting endangers emergency response."
                : "অনুগ্রহ করে কেবল সঠিক তথ্য প্রদান করুন। ভিত্তিহীন তথ্য প্রদান আইনত দণ্ডনীয় অপরাধ।"}
            </div>

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
                placeholder={language === "en" ? "e.g. Road blockade on Dhaka-Mymensingh highway" : "যেমন: ঢাকা-ময়মনসিংহ মহাসড়কে পথ অবরোধ"}
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
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                >
                  <option value="violence_riot">{t.categories.violence_riot}</option>
                  <option value="roadblock">{t.categories.roadblock}</option>
                  <option value="fire">{t.categories.fire}</option>
                  <option value="natural_hazard">{t.categories.natural_hazard}</option>
                  <option value="accident">{t.categories.accident}</option>
                  <option value="robbery_crime">{t.categories.robbery_crime}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-primary mb-1">
                  {language === "en" ? "Threat Severity *" : "বিপদের মাত্রা *"}
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                >
                  <option value="critical">{t.severity.critical} (Critical Danger)</option>
                  <option value="high">{t.severity.high} (High Alert)</option>
                  <option value="medium">{t.severity.medium} (Medium Attention)</option>
                  <option value="low">{t.severity.low} (Low / Advisory)</option>
                </select>
              </div>
            </div>

            {/* Location & District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-content-primary mb-1">
                  {language === "en" ? "Specific Area / Landmark *" : "নির্দিষ্ট এলাকা / মোড় *"}
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder={language === "en" ? "e.g. Farmgate Intersection" : "যেমন: ফার্মগেট মোড়"}
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-primary mb-1">
                  {language === "en" ? "District *" : "জেলা *"}
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Dhaka / Chittagong / Sylhet"
                  className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
                />
              </div>
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
                placeholder={language === "en" ? "Describe current situation, blocked lanes, or emergency guidelines..." : "বর্তমান পরিস্থিতি, অবরুদ্ধ রাস্তা বা বিকল্প পথ সম্পর্কে লিখুন..."}
                className="w-full px-3 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary focus:bg-white transition-colors"
              />
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
                className="px-4 py-2 text-xs font-semibold bg-danger-critical hover:bg-red-700 text-white rounded-md transition-colors shadow-sm"
              >
                {language === "en" ? "Broadcast Report" : "রিপোর্ট প্রকাশ করুন"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
