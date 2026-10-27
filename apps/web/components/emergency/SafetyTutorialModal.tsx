"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  MapPin,
  ThumbsUp,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

const STORAGE_KEY = "bd_safety_agreement_accepted";

export function SafetyTutorialModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { language } = useLanguageStore();

  const isBn = language === "bn";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (accepted !== "true") {
        setIsOpen(true);
      }
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl shadow-cyan-950/40 space-y-5">
        {/* Step Indicators */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-100">
              {isBn
                ? "বিপদ সংকেত নির্দেশিকা ও আইনি নীতিমালা"
                : "Safety Guide & Legal Agreement"}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            {step} / 3
          </span>
        </div>

        {/* Step 1: Map & Fuzzing */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-red-300">
                  {isBn ? "১. ম্যাপ ও অবস্থান সুরক্ষা" : "1. Map & Location Privacy"}
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  {isBn
                    ? "নাগরিকদের সুরক্ষার জন্য রিপোর্টকৃত পিনগুলো ৪০-৮০ মিটার ফাজিং (Fuzzing) অ্যালগরিদম দিয়ে দেখানো হয়। কোনো রিপোর্টারের ব্যক্তিগত নাম বা পরিচয় প্রকাশ করা হয় না।"
                    : "To protect whistleblowers, public hazard pins are cryptographically fuzzed by 40-80 meters into a generalized danger zone. No reporter PII is ever exposed."}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-emerald-300">
                  {isBn ? "নিরাপদ আশ্রয়স্থল (Safe Zones)" : "Verified Safe Havens"}
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  {isBn
                    ? "সবুজ পিনগুলো নিকটস্থ থানা, পুলিশ ফাঁড়ি, হাসপাতাল ও ২৪/৭ ফার্মেসি নির্দেশ করে। বিপদে পড়লে সেখানে আশ্রয় নিন।"
                    : "Green markers indicate verified permanent havens (Police boxes, 24/7 pharmacies, and tertiary hospitals). Head there if you are in danger."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Moderation & Trust Engine */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-3">
              <ThumbsUp className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-blue-300">
                  {isBn ? "২. সত্যতা যাচাইকরণ" : "2. Community Moderation"}
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  {isBn
                    ? "ঘটনার সত্যতা থাকলে আপভোট (Upvote) দিন। ৫টি ডাউনভোট (Downvote) পেলে সিস্টেম স্বয়ংক্রিয়ভাবে মিথ্যা বা অপ্রাসঙ্গিক রিপোর্ট মুছে ফেলে।"
                    : "Upvote hazards you have personally verified. If a report receives 5 downvotes, the Trust Engine automatically purges it from the map."}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-amber-300">
                  {isBn ? "জিপিএস সান্নিধ্য পরীক্ষা" : "GPS Proximity Defense"}
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  {isBn
                    ? "ভুয়া রিপোর্ট প্রতিরোধে রিপোর্ট করার সময় আপনার ডিভাইসকে ঘটনাস্থলের সর্বোচ্চ ২০০ মিটারের মধ্যে থাকতে হবে।"
                    : "You must be physically within 200 meters of the reported hazard. Remote reports from other cities are rejected by our geospatial engine."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Legal Notice & Agreement */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 rounded-xl bg-red-900/30 border-2 border-red-500/60 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>
                  {isBn
                    ? "গুরুত্বপূর্ণ আইনি সতর্কতা (LEGAL NOTICE)"
                    : "MANDATORY LEGAL DISCLAIMER"}
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-white">
                    {isBn
                      ? "এটি জরুরি সেবা (৯৯৯) এর বিকল্প নয়:"
                      : "Not a Replacement for Emergency 999:"}{" "}
                  </strong>
                  {isBn
                    ? "জীবননাশের আশঙ্কা থাকলে অবিলম্বে ৯৯৯ এ ফোন করুন।"
                    : "If in immediate life-threatening danger, dial 999 immediately."}
                </li>
                <li>
                  <strong className="text-white">
                    {isBn
                      ? "সাইবার নিরাপত্তা আইন ও ভুয়া তথ্য:"
                      : "Cyber Security Act Compliance:"}{" "}
                  </strong>
                  {isBn
                    ? "ইচ্ছাকৃত মিথ্যা বা বিভ্রান্তিকর রিপোর্ট করা বাংলাদেশ আইন অনুযায়ী দণ্ডনীয় অপরাধ।"
                    : "Submitting deliberately fraudulent, misleading, or panic-inducing reports violates the Bangladesh Cyber Security Act."}
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{isBn ? "পূর্ববর্তী" : "Previous"}</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{isBn ? "পরবর্তী" : "Next"}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleAccept}
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isBn ? "আমি বুঝেছি ও সম্মত" : "I Understand & Accept"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SafetyTutorialModal;
