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
  Sparkles,
  Lock,
  RotateCcw,
  CheckCheck,
} from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

export const SAFETY_TERMS_ACCEPTED_KEY = "bd_safety_agreement_accepted";
export const SAFETY_TERMS_CONSENTS_KEY = "bd_safety_terms_consents";

export interface TermConditionItem {
  id: string;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  category: "legal" | "privacy" | "community" | "alerts" | "navigation";
}

export const SAFETY_TERMS_LIST: TermConditionItem[] = [
  {
    id: "emergency_999",
    category: "legal",
    required: true,
    icon: AlertOctagon,
    titleEn: "Emergency 999 Service Disclaimer",
    titleBn: "জরুরি সেবা (৯৯৯) সম্পর্কিত নীতি",
    descEn:
      "This app is a community awareness platform and not a replacement for Emergency 999. In life-threatening emergencies, call 999 immediately.",
    descBn:
      "এই প্ল্যাটফর্মটি জনসচেতনতামূলক উদ্যোগ এবং জরুরি সরকারি সেবা ৯৯৯ এর বিকল্প নয়। প্রত্যক্ষ জীবননাশের আশঙ্কায় অবিলম্বে ৯৯৯ এ কল করুন।",
  },
  {
    id: "cyber_security_act",
    category: "legal",
    required: true,
    icon: Scale,
    titleEn: "Cyber Security & Truthful Reporting",
    titleBn: "সত্যনিষ্ঠ তথ্য ও সাইবার নিরাপত্তা আইন",
    descEn:
      "I agree not to submit fraudulent, fabricated, or panic-inducing hazard reports. Deliberate false reporting is punishable under Bangladesh law.",
    descBn:
      "কোনো মিথ্যা, বানোয়াট বা জনমনে বিভ্রান্তি সৃষ্টিকারী রিপোর্ট করব না। উদ্দেশ্যপ্রণোদিত অসত্য তথ্য প্রদান বাংলাদেশের সাইবার নিরাপত্তা আইনে দণ্ডনীয় অপরাধ।",
  },
  {
    id: "location_privacy_fuzzing",
    category: "privacy",
    required: true,
    icon: MapPin,
    titleEn: "Location Privacy & Pin Fuzzing",
    titleBn: "অবস্থান গোপনীয়তা ও ফাজিং সুরক্ষা",
    descEn:
      "Citizen identity is never published. Public hazard coordinates are cryptographically fuzzed by 40-80 meters to protect reporter anonymity.",
    descBn:
      "নাগরিকদের সুরক্ষার্থে ব্যক্তিগত নাম বা পরিচয় কখনো প্রকাশ করা হয় না। প্রতিটি রিপোর্টের পিন ৪০-৮০ মিটার ফাজিং অ্যালগরিদমে জনস্বার্থে প্রদর্শিত হয়।",
  },
  {
    id: "community_moderation",
    category: "community",
    required: true,
    icon: ThumbsUp,
    titleEn: "Community Trust & Proximity Verification",
    titleBn: "কমিউনিটি ট্রাস্ট ও জিপিএস নীতি",
    descEn:
      "Reports require physical proximity (<200m) to prevent spam. Hazards receiving 5 downvotes are automatically purged by the Trust Engine.",
    descBn:
      "ভুয়া রিপোর্ট ঠেকাতে ঘটনাস্থলের ২০০ মিটারের মধ্যে অবস্থান সাপেক্ষে রিপোর্ট গ্রাহ্য হবে। ৫টি ডাউনভোট পেলে ট্রাস্ট ইঞ্জিন স্বয়ংক্রিয়ভাবে রিপোর্ট মুছে দেয়।",
  },
  {
    id: "proximity_alerts",
    category: "alerts",
    required: false,
    icon: Bell,
    titleEn: "Real-Time Proximity Danger Alerts",
    titleBn: "নিকটবর্তী রিয়েল-টাইম বিপদ সতর্কতা",
    descEn:
      "Receive instant audio-visual push notifications and live map warnings when high-severity threats or accidents occur near your live coordinates.",
    descBn:
      "আমার বর্তমান অবস্থানের আশেপাশে কোনো সহিংস অপরাধ, ডাকাতি বা মারাত্মক সড়ক দুর্ঘটনা ঘটলে তাৎক্ষণিক রিয়েল-টাইম নোটিফিকেশন পেতে সম্মতি দিচ্ছি।",
  },
  {
    id: "safe_route_telemetry",
    category: "navigation",
    required: false,
    icon: Shield,
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
    // Default: All checked so user can review and uncheck optional ones, or click to choose
    const defaults: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      defaults[term.id] = true;
    });
    return defaults;
  });

  // Check storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const accepted = localStorage.getItem(SAFETY_TERMS_ACCEPTED_KEY);
    const savedConsents = localStorage.getItem(SAFETY_TERMS_CONSENTS_KEY);

    if (savedConsents) {
      try {
        const parsed = JSON.parse(savedConsents);
        setSelectedTerms((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Fallback to defaults
      }
    }

    if (accepted !== "true") {
      setIsOpen(true);
    }

    // Listener to re-open modal on demand from anywhere (e.g. Profile or Help)
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener("open-safety-terms-modal", handleOpenEvent);

    return () => {
      window.removeEventListener("open-safety-terms-modal", handleOpenEvent);
    };
  }, []);

  // Toggle individual term
  const handleToggleTerm = (termId: string) => {
    setSelectedTerms((prev) => ({
      ...prev,
      [termId]: !prev[termId],
    }));
  };

  // Check if all mandatory terms are accepted
  const mandatoryTerms = useMemo(
    () => SAFETY_TERMS_LIST.filter((term) => term.required),
    []
  );

  const allMandatoryAccepted = useMemo(() => {
    return mandatoryTerms.every((term) => !!selectedTerms[term.id]);
  }, [mandatoryTerms, selectedTerms]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedTerms).filter(Boolean).length;
  }, [selectedTerms]);

  // Select All vs Required Only quick toggles
  const handleSelectAll = () => {
    const updated: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      updated[term.id] = true;
    });
    setSelectedTerms(updated);
  };

  const handleResetToRequiredOnly = () => {
    const updated: Record<string, boolean> = {};
    SAFETY_TERMS_LIST.forEach((term) => {
      updated[term.id] = term.required;
    });
    setSelectedTerms(updated);
  };

  // Next / Save Action
  const handleNext = () => {
    if (!allMandatoryAccepted) return;

    if (typeof window !== "undefined") {
      // 1. Mark agreement accepted
      localStorage.setItem(SAFETY_TERMS_ACCEPTED_KEY, "true");

      // 2. Persist chosen terms and conditions
      const payload = {
        ...selectedTerms,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(SAFETY_TERMS_CONSENTS_KEY, JSON.stringify(payload));

      // 3. Dispatch event for real-time reactivity
      window.dispatchEvent(
        new CustomEvent("safety_terms_updated", { detail: payload })
      );
    }

    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/90 rounded-3xl max-w-xl w-full text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header (Sticky) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 shadow-2xs shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                  {isBn
                    ? "শর্তাবলী ও জননিরাপত্তা নীতিমালা"
                    : "Terms & Safety Conditions"}
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedCount} / {SAFETY_TERMS_LIST.length}{" "}
                  {isBn ? "নির্বাচিত" : "Selected"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                {isBn
                  ? "ড্যাঞ্জার জোন বিডি ব্যবহারের পূর্বে শর্তাবলী পর্যালোচনা করুন। আপনি যেসব শর্তে সম্মত তা বেছে নিয়ে 'পরবর্তী' বাটনে চাপুন।"
                  : "Review our public safety terms below. Tap to choose the terms and conditions you accept, then click 'Next' to set your preferences."}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Bulk Action Bar */}
        <div className="px-4 sm:px-5 py-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {isBn
                ? "শর্তাবলী বেছে নিয়ে সম্মতি দিন:"
                : "Select your agreed terms:"}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              <span>{isBn ? "সবগুলো নির্বাচন" : "Select All"}</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleResetToRequiredOnly}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer transition-colors"
            >
              <span>{isBn ? "শুধু বাধ্যতামূলক" : "Required Only"}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Single Pop-up Terms List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 pr-2 sm:pr-3">
          {SAFETY_TERMS_LIST.map((term) => {
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
                className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer select-none group ${
                  isChecked
                    ? "bg-blue-50/50 border-blue-400/80 shadow-xs ring-1 ring-blue-500/20"
                    : "bg-white border-slate-200 hover:bg-slate-50/90 hover:border-slate-300"
                }`}
              >
                {/* Interactive Checkbox Indicator */}
                <div className="pt-0.5 shrink-0">
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                      isChecked
                        ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                        : "bg-white border-slate-300 group-hover:border-slate-400"
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Term Details */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isChecked ? "text-blue-600" : "text-slate-400"
                        }`}
                      />
                      <h4
                        className={`text-xs sm:text-[13px] font-bold leading-tight ${
                          isChecked ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {isBn ? term.titleBn : term.titleEn}
                      </h4>
                    </div>

                    {/* Status Badge */}
                    {term.required ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                        {isBn ? "বাধ্যতামূলক" : "Required"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {isBn ? "ঐচ্ছিক" : "Optional"}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                    {isBn ? term.descBn : term.descEn}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Validation Notice if required terms are missing */}
          {!allMandatoryAccepted && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-xs font-semibold animate-in fade-in">
              <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isBn
                  ? "সামনে এগিয়ে যেতে অনুগ্রহ করে ৪টি বাধ্যতামূলক শর্তে (Required) টিক চিহ্ন দিয়ে সম্মতি দিন।"
                  : "Please check all 4 mandatory terms marked 'Required' to continue."}
              </span>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer (Sticky) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold text-slate-800 block">
              {allMandatoryAccepted ? (
                <span className="text-emerald-700 flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {isBn
                    ? "সকল প্রয়োজনীয় শর্তাবলী নির্বাচিত হয়েছে"
                    : "All required safety conditions satisfied"}
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {isBn
                    ? "বাধ্যতামূলক শর্তগুলোতে সম্মতি দেওয়া প্রয়োজন"
                    : "Mandatory conditions awaiting approval"}
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isBn
                ? "পরবর্তী বাটনে চাপলে আপনার নির্বাচিত শর্তাবলী ডিভাইসে সক্রিয় হবে।"
                : "Tapping Next will apply and save your chosen terms to this device."}
            </span>
          </div>

          {/* Primary Action Button: "Next" */}
          <button
            type="button"
            disabled={!allMandatoryAccepted}
            onClick={handleNext}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              allMandatoryAccepted
                ? "bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-blue-600/25"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            <span>
              {isBn
                ? "পরবর্তী (শর্তাবলী সংরক্ষণ করুন)"
                : "Next (Save Terms & Continue)"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyTutorialModal;
