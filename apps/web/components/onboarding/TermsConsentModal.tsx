"use client";

import React, { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import {
  ShieldCheck,
  Check,
  AlertTriangle,
  MapPin,
  PhoneCall,
  Lock,
  ArrowRight,
} from "lucide-react";

export const STORAGE_KEY_TERMS_CONSENT = "danger_zone_terms_consent_v1";

interface TermItem {
  id: string;
  required: boolean;
  icon: React.ComponentType<{ className?: string }>;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
}

const TERMS: TermItem[] = [
  {
    id: "truthful_reporting",
    required: true,
    icon: ShieldCheck,
    titleEn: "Genuine Hazard Reporting",
    titleBn: "সত্য ও দায়িত্বশীল রিপোর্ট",
    descEn: "I will only report real, observed public safety threats and will never submit hoaxes or fake alarms.",
    descBn: "আমি শুধুমাত্র স্বচক্ষে দেখা প্রকৃত বিপদের তথ্য প্রদান করব এবং কোনো অসত্য বা বিভ্রান্তিকর রিপোর্ট দাখিল করব না।",
  },
  {
    id: "location_access",
    required: true,
    icon: MapPin,
    titleEn: "Device GPS & Proximity Alerts",
    titleBn: "ডিভাইস জিপিএস ও নিরাপত্তা সতর্কতা",
    descEn: "I consent to Danger Zone accessing my device GPS to pinpoint danger perimeters and trigger real-time hazard alerts.",
    descBn: "নিকটস্থ বিপদ অঞ্চল ও লাইভ সতর্কতা প্রদর্শনের জন্য ডিভাইসের জিপিএস ব্যবহারের সম্মতি প্রদান করছি।",
  },
  {
    id: "emergency_hotline",
    required: true,
    icon: PhoneCall,
    titleEn: "National Emergency Protocol (999)",
    titleBn: "জাতীয় জরুরি প্রোটোকল (৯৯৯)",
    descEn: "I understand Danger Zone is a community situational tool and does not replace calling 999 during life-threatening crises.",
    descBn: "আমি অবগত যে এই অ্যাপটি সরকারি জরুরি সেবার বিকল্প নয়। তাৎক্ষণিক প্রয়োজনে আমি জাতীয় হটলাইন ৯৯৯-এ কল করব।",
  },
  {
    id: "privacy_respect",
    required: true,
    icon: Lock,
    titleEn: "Citizen Privacy & Ethics",
    titleBn: "নাগরিক গোপনীয়তা ও নৈতিকতা",
    descEn: "I will respect civilian privacy and adhere to community guidelines and respectful citizen conduct.",
    descBn: "অন্যান্য নাগরিকের ব্যক্তিগত গোপনীয়তা রক্ষা করব এবং কোনো বিদ্বেষমূলক বা অনৈতিক তথ্য ছড়াব না।",
  },
];

export default function TermsConsentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState<Record<string, boolean>>({
    truthful_reporting: true,
    location_access: true,
    emergency_hotline: true,
    privacy_respect: true,
  });

  const { language } = useLanguageStore();
  const isBn = language === "bn";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const consent = localStorage.getItem(STORAGE_KEY_TERMS_CONSENT);
      if (!consent) {
        setIsOpen(true);
      }
    } catch (e) {
      // localStorage disabled or private browsing
      setIsOpen(false);
    }
  }, []);

  if (!isOpen) return null;

  const toggleTerm = (id: string) => {
    setSelectedTerms((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allRequiredChecked = TERMS.filter((t) => t.required).every(
    (t) => selectedTerms[t.id]
  );

  const handleSelectAll = () => {
    const nextState: Record<string, boolean> = {};
    const areAllChecked = TERMS.every((t) => selectedTerms[t.id]);
    TERMS.forEach((t) => {
      nextState[t.id] = !areAllChecked;
    });
    setSelectedTerms(nextState);
  };

  const handleAcceptAndContinue = () => {
    if (!allRequiredChecked) return;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          STORAGE_KEY_TERMS_CONSENT,
          JSON.stringify({
            acceptedAt: new Date().toISOString(),
            terms: selectedTerms,
            version: "1.0",
          })
        );
      } catch (err) {
        console.warn("[TermsConsent] Failed to save consent:", err);
      }
    }

    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 flex items-start gap-3.5 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/25">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {isBn ? "নিরাপত্তা নীতিমালা ও সম্মতি" : "Safety Terms & Citizen Consent"}
            </h3>
            <p className="text-xs text-slate-500 leading-normal mt-0.5">
              {isBn
                ? "Danger Zone ব্যবহারের পূর্বে অনুগ্রহ করে নিচের শর্তাবলীতে সম্মতি প্রদান করুন:"
                : "Please review and select the safety terms before accessing the live alert map:"}
            </p>
          </div>
        </div>

        {/* Terms Checklist (Scrollable on small screens) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 scrollbar-thin">
          {/* Select All Quick Button */}
          <div className="flex items-center justify-between pb-1 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isBn ? "শর্তাবলীর তালিকা" : "Terms Checklist"}
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              {TERMS.every((t) => selectedTerms[t.id])
                ? isBn
                  ? "সবগুলো বাতিল করুন"
                  : "Deselect All"
                : isBn
                ? "সবগুলোতে টিক দিন"
                : "Select All"}
            </button>
          </div>

          {TERMS.map((term) => {
            const isChecked = !!selectedTerms[term.id];
            const Icon = term.icon;

            return (
              <div
                key={term.id}
                onClick={() => toggleTerm(term.id)}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none active:scale-[0.99] ${
                  isChecked
                    ? "bg-blue-50/70 border-blue-200 ring-1 ring-blue-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {/* Custom Checkbox */}
                <div
                  className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center shrink-0 transition-all ${
                    isChecked
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                      : "bg-white border-slate-300 text-transparent"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isChecked ? "text-blue-600" : "text-slate-400"}`} />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {isBn ? term.titleBn : term.titleEn}
                    </h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed mt-1">
                    {isBn ? term.descBn : term.descEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 text-center sm:text-left leading-tight">
            {isBn
              ? "শর্তাবলী মেনে চলতে এবং জাতীয় নিরাপত্তা নীতিকে শ্রদ্ধা জানাতে আমরা প্রতিশ্রুতিবদ্ধ।"
              : "By proceeding, your consent is recorded locally for this device."}
          </p>

          <button
            type="button"
            disabled={!allRequiredChecked}
            onClick={handleAcceptAndContinue}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0 ${
              allRequiredChecked
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25"
                : "bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
            }`}
          >
            <span>{isBn ? "সম্মত হয়ে শুরু করুন" : "Accept & Continue"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
