"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldAlert,
  AlertOctagon,
  Scale,
  MapPin,
  ThumbsUp,
  Bell,
  Shield,
  Check,
  ChevronRight,
  Lock,
  RotateCcw,
  CheckCheck,
} from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

export const SAFETY_TERMS_ACCEPTED_KEY = "bd_safety_agreement_accepted";
export const SAFETY_TERMS_CONSENTS_KEY = "bd_safety_terms_consents";

export interface TermConditionItem {
  id: string;
  article: string;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  category: "legal" | "privacy" | "community" | "alerts" | "navigation";
  badgeEn?: string;
  badgeBn?: string;
}

export const SAFETY_TERMS_LIST: TermConditionItem[] = [
  {
    id: "emergency_999",
    article: "ART. 01",
    category: "legal",
    required: true,
    icon: AlertOctagon,
    badgeEn: "Statutory Notice",
    badgeBn: "সংবিধিবদ্ধ সতর্কতা",
    titleEn: "Emergency 999 Service Disclaimer",
    titleBn: "জরুরি সেবা (৯৯৯) সম্পর্কিত নীতি",
    descEn:
      "This app is a community awareness platform and not a replacement for Emergency 999. In life-threatening emergencies, call 999 immediately.",
    descBn:
      "এই প্ল্যাটফর্মটি জনসচেতনতামূলক উদ্যোগ এবং জরুরি সরকারি সেবা ৯৯৯ এর বিকল্প নয়। প্রত্যক্ষ জীবননাশের আশঙ্কায় অবিলম্বে ৯৯৯ এ কল করুন।",
  },
  {
    id: "cyber_security_act",
    article: "ART. 02",
    category: "legal",
    required: true,
    icon: Scale,
    badgeEn: "Legal Compliance",
    badgeBn: "আইনি বাধ্যবাধকতা",
    titleEn: "Cyber Security & Truthful Reporting",
    titleBn: "সত্যনিষ্ঠ তথ্য ও সাইবার নিরাপত্তা আইন",
    descEn:
      "I agree not to submit fraudulent, fabricated, or panic-inducing hazard reports. Deliberate false reporting is punishable under Bangladesh law.",
    descBn:
      "কোনো মিথ্যা, বানোয়াট বা জনমনে বিভ্রান্তি সৃষ্টিকারী রিপোর্ট করব না। উদ্দেশ্যপ্রণোদিত অসত্য তথ্য প্রদান বাংলাদেশের সাইবার নিরাপত্তা আইনে দণ্ডনীয় অপরাধ।",
  },
  {
    id: "location_privacy_fuzzing",
    article: "ART. 03",
    category: "privacy",
    required: true,
    icon: MapPin,
    badgeEn: "Zero-Knowledge",
    badgeBn: "গোপনীয়তা নিশ্চিতকরণ",
    titleEn: "Location Privacy & Pin Fuzzing",
    titleBn: "অবস্থান গোপনীয়তা ও ফাজিং সুরক্ষা",
    descEn:
      "Citizen identity is never published. Public hazard coordinates are cryptographically fuzzed by 40-80 meters to protect reporter anonymity.",
    descBn:
      "নাগরিকদের সুরক্ষার্থে ব্যক্তিগত নাম বা পরিচয় কখনো প্রকাশ করা হয় না। প্রতিটি রিপোর্টের পিন ৪০-৮০ মিটার ফাজিং অ্যালগরিদমে জনস্বার্থে প্রদর্শিত হয়।",
  },
  {
    id: "community_moderation",
    article: "ART. 04",
    category: "community",
    required: true,
    icon: ThumbsUp,
    badgeEn: "Consensus Model",
    badgeBn: "কমিউনিটি যাচাই",
    titleEn: "Community Trust & Proximity Verification",
    titleBn: "কমিউনিটি ট্রাস্ট ও জিপিএস নীতি",
    descEn:
      "Reports require physical proximity (<200m) to prevent spam. Hazards receiving 5 downvotes are automatically purged by the Trust Engine.",
    descBn:
      "ভুয়া রিপোর্ট ঠেকাতে ঘটনাস্থলের ২০০ মিটারের মধ্যে অবস্থান সাপেক্ষে রিপোর্ট গ্রাহ্য হবে। ৫টি ডাউনভোট পেলে ট্রাস্ট ইঞ্জিন স্বয়ংক্রিয়ভাবে রিপোর্ট মুছে দেয়।",
  },
  {
    id: "proximity_alerts",
    article: "ART. 05",
    category: "alerts",
    required: false,
    icon: Bell,
    badgeEn: "User Controlled",
    badgeBn: "ব্যবহারকারী নিয়ন্ত্রিত",
    titleEn: "Real-Time Proximity Danger Alerts",
    titleBn: "নিকটবর্তী রিয়েল-টাইম বিপদ সতর্কতা",
    descEn:
      "Receive instant audio-visual push notifications and live map warnings when high-severity threats or accidents occur near your live coordinates.",
    descBn:
      "আমার বর্তমান অবস্থানের আশেপাশে কোনো সহিংস অপরাধ, ডাকাতি বা মারাত্মক সড়ক দুর্ঘটনা ঘটলে তাৎক্ষণিক রিয়েল-টাইম নোটিফিকেশন পেতে সম্মতি দিচ্ছি।",
  },
  {
    id: "safe_route_telemetry",
    article: "ART. 06",
    category: "navigation",
    required: false,
    icon: Shield,
    badgeEn: "Privacy-Preserving",
    badgeBn: "এনক্রিপ্ট করা বিশ্লেষণ",
    titleEn: "Anonymous Safe Route Telemetry",
    titleBn: "বেনামী নিরাপদ পথ বিশ্লেষণ সম্মতি",
    descEn:
      "Allow non-personal spatial hazard telemetry to help the AI engine compute safer pedestrian and commute corridors avoiding crime clusters.",
    descBn:
      "নাগরিকদের জন্য বিপদজনক এলাকা এড়িয়ে নিরাপদ রুট নির্ধারণের অ্যালগরিদম উন্নয়নে সম্পূর্ণ নামহীন ও এনক্রিপ্ট করা ডেটা বিশ্লেষণে সম্মতি দিচ্ছি।",
  },
];

export function SafetyTutorialModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // State mapping of termId -> boolean
  const [selectedTerms, setSelectedTerms] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      defaults[term.id] = true;
    });
    return defaults;
  });

  // Check storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const accepted = localStorage.getItem(SAFETY_TERMS_ACCEPTED_KEY);
      const savedConsents = localStorage.getItem(SAFETY_TERMS_CONSENTS_KEY);
      const legacyConsent = localStorage.getItem("danger_zone_terms_consent_v1");

      if (savedConsents) {
        try {
          const parsed = JSON.parse(savedConsents);
          setSelectedTerms((prev) => ({ ...prev, ...parsed }));
        } catch {
          // Fallback to defaults
        }
      }

      if (accepted !== "true") {
        if (legacyConsent) {
          localStorage.setItem(SAFETY_TERMS_ACCEPTED_KEY, "true");
        } else {
          setIsOpen(true);
        }
      }
    } catch {
      // localStorage disabled or restricted in private browsing
    }

    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener("open-safety-terms-modal", handleOpenEvent);

    return () => {
      window.removeEventListener("open-safety-terms-modal", handleOpenEvent);
    };
  }, []);

  // Toggle individual term
  const handleToggleTerm = useCallback((termId: string) => {
    setSelectedTerms((prev) => ({
      ...prev,
      [termId]: !prev[termId],
    }));
  }, []);

  const mandatoryTerms = useMemo(
    () => SAFETY_TERMS_LIST.filter((term) => term.required),
    []
  );

  const optionalTerms = useMemo(
    () => SAFETY_TERMS_LIST.filter((term) => !term.required),
    []
  );

  const allMandatoryAccepted = useMemo(() => {
    return mandatoryTerms.every((term) => !!selectedTerms[term.id]);
  }, [mandatoryTerms, selectedTerms]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedTerms).filter(Boolean).length;
  }, [selectedTerms]);

  const handleSelectAll = useCallback(() => {
    const updated: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      updated[term.id] = true;
    });
    setSelectedTerms(updated);
  }, []);

  const handleResetToRequiredOnly = useCallback(() => {
    const updated: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      updated[term.id] = term.required;
    });
    setSelectedTerms(updated);
  }, []);

  // Next / Save Action
  const handleNext = () => {
    if (!allMandatoryAccepted) return;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SAFETY_TERMS_ACCEPTED_KEY, "true");
        const payload = {
          ...selectedTerms,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(SAFETY_TERMS_CONSENTS_KEY, JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent("safety_terms_updated", { detail: payload })
        );
      } catch (err) {
        console.warn("[SafetyTutorial] Failed to persist consent:", err);
      }
    }

    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl max-w-2xl w-full text-slate-900 shadow-[0_24px_56px_-12px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.06)] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* Top Header Bar */}
        <header className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono tracking-wider font-semibold text-slate-700 uppercase">
                  <ShieldAlert className="w-3 h-3 text-slate-600" />
                  <span>{isBn ? "আইনি ও জননিরাপত্তা চুক্তি" : "Public Safety Charter"}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-600 font-medium">
                  {selectedCount} of {SAFETY_TERMS_LIST.length}{" "}
                  {isBn ? "স্বীকৃত" : "Accepted"}
                </span>
              </div>

              <h2
                id="terms-dialog-title"
                className="text-base sm:text-xl font-semibold text-slate-900 tracking-tight leading-snug"
              >
                {isBn
                  ? "শর্তাবলী ও জননিরাপত্তা নীতিমালা"
                  : "Terms of Service & Safety Conditions"}
              </h2>

              <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed max-w-xl">
                {isBn
                  ? "ড্যাঞ্জার জোন বিডি ব্যবহারের পূর্বে শর্তাবলী পর্যালোচনা করুন। আপনি যেসব শর্তে সম্মত তা বেছে নিয়ে 'পরবর্তী' বাটনে চাপুন।"
                  : "Review the civic public safety charter below. You must accept statutory terms to access live reporting; optional intelligence telemetry may be toggled at any time."}
              </p>
            </div>
          </div>

          {/* Quick Selection Filter Controls */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-600">
                {isBn ? "দ্রুত বাছাই:" : "Quick actions:"}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3 text-emerald-600" />
                <span>{isBn ? "সবগুলো নির্বাচন" : "Select All"}</span>
              </button>
              <button
                type="button"
                onClick={handleResetToRequiredOnly}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                <span>{isBn ? "শুধু বাধ্যতামূলক" : "Mandatory Only"}</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600">
              <Lock className="w-3 h-3 text-slate-600" />
              <span>{isBn ? "৪টি সংবিধিবদ্ধ শর্ত আবশ্যক" : "4 statutory terms required"}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Terms Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 divide-y divide-slate-100">
          {/* SECTION 1: Mandatory Legal & Civic Terms */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-600">
                  SECTION A
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {isBn ? "বাধ্যতামূলক আইনি ও নাগরিক সুরক্ষা নীতি" : "Statutory & Community Obligations"}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                {isBn ? "৪টি আবশ্যক" : "4 Required"}
              </span>
            </div>

            <div className="space-y-2.5">
              {mandatoryTerms.map((term) => {
                const Icon = term.icon;
                const isChecked = !!selectedTerms[term.id];

                return (
                  <div
                    key={term.id}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => handleToggleTerm(term.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleToggleTerm(term.id);
                      }
                    }}
                    className={`w-full p-3.5 sm:p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer select-none group ${
                      isChecked
                        ? "bg-slate-50/80 border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                        : "bg-white border-dashed border-rose-300 hover:border-rose-400 hover:bg-rose-50/30"
                    }`}
                  >
                    {/* Custom Precision Indicator */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          isChecked
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-rose-400 group-hover:border-rose-500"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-slate-600 font-medium">
                            {term.article}
                          </span>
                          <h3
                            className={`text-xs sm:text-sm font-semibold leading-tight ${
                              isChecked ? "text-slate-900" : "text-rose-950"
                            }`}
                          >
                            {isBn ? term.titleBn : term.titleEn}
                          </h3>
                        </div>

                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {isBn ? (term.badgeBn || "বাধ্যতামূলক") : (term.badgeEn || "Required")}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {isBn ? term.descBn : term.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 2: Optional Enhanced Intelligence & Telemetry */}
          <section className="space-y-3 pt-5">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-600">
                  SECTION B
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {isBn ? "ঐচ্ছিক বুদ্ধিমত্তা ও প্রক্সিমিটি সেবা" : "Optional Intelligence & Safe Route Services"}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {isBn ? "ব্যবহারকারী নিয়ন্ত্রিত" : "User Configurable"}
              </span>
            </div>

            <div className="space-y-2.5">
              {optionalTerms.map((term) => {
                const Icon = term.icon;
                const isChecked = !!selectedTerms[term.id];

                return (
                  <div
                    key={term.id}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => handleToggleTerm(term.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleToggleTerm(term.id);
                      }
                    }}
                    className={`w-full p-3.5 sm:p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer select-none group ${
                      isChecked
                        ? "bg-slate-50/70 border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Toggle Switch styling */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-out flex items-center ${
                          isChecked ? "bg-slate-900" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-out ${
                            isChecked ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-slate-600 font-medium">
                            {term.article}
                          </span>
                          <h3
                            className={`text-xs sm:text-sm font-semibold leading-tight ${
                              isChecked ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {isBn ? term.titleBn : term.titleEn}
                          </h3>
                        </div>

                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {isBn ? "ঐচ্ছিক" : "Optional"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {isBn ? term.descBn : term.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Validation Banner if missing mandatory items */}
          {!allMandatoryAccepted && (
            <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs font-medium">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">
                  {isBn ? "বাধ্যতামূলক শর্তাবলী অনুপস্থিত" : "Mandatory Terms Required"}
                </span>
                <p className="text-rose-700 leading-relaxed">
                  {isBn
                    ? "জননিরাপত্তা ও আইনি কারণে চিহ্নিত ৪টি সংবিধিবদ্ধ নীতিতে সম্মতি দেওয়া আবশ্যক।"
                    : "To access real-time civic hazard data, you must acknowledge all 4 statutory obligations under Section A."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky Footer */}
        <footer className="px-5 sm:px-7 py-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3.5 shrink-0">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                allMandatoryAccepted
                  ? "bg-emerald-500 ring-2 ring-emerald-200"
                  : "bg-rose-500 ring-2 ring-rose-200"
              }`}
            />
            <div className="text-left">
              <span className="text-xs font-semibold text-slate-900 block leading-tight">
                {allMandatoryAccepted
                  ? (isBn ? "সকল সংবিধিবদ্ধ শর্ত পূরণ হয়েছে" : "All statutory requirements satisfied")
                  : (isBn ? "বাধ্যতামূলক নীতিসমূহে সম্মতি প্রয়োজন" : "Mandatory protocols pending agreement")}
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {isBn
                  ? "সম্মতি ডিভাইসে এনক্রিপ্ট করে সংরক্ষিত হয় এবং প্রোফাইল থেকে পরিবর্তনযোগ্য।"
                  : "Consents are cryptographically stored locally and can be revised anytime in Profile."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={!allMandatoryAccepted}
              onClick={handleNext}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                allMandatoryAccepted
                  ? "bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white shadow-slate-900/10"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              <span>
                {isBn
                  ? "সম্মত হয়ে এগিয়ে যান"
                  : "Accept & Enter Map"}
              </span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SafetyTutorialModal;
