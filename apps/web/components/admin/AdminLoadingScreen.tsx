"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Radio,
  CheckCircle2,
} from "lucide-react";

interface AdminLoadingScreenProps {
  isBn: boolean;
  message?: string;
  subMessage?: string;
  error?: string | null;
  onRetry?: () => void;
}

export default function AdminLoadingScreen({
  isBn,
  message,
  subMessage,
  error,
  onRetry,
}: AdminLoadingScreenProps) {
  // Step indicator progression simulation for smooth psychological feedback
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    if (error) return;
    const t1 = setTimeout(() => setActiveStep(2), 700);
    const t2 = setTimeout(() => setActiveStep(3), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [error]);

  return (
    <div className="w-full max-w-lg mx-auto py-12 px-4 flex flex-col items-center justify-center text-center">
      {/* Premium Glass Card Container */}
      <div className="w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        {/* Top Glowing Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse" />

        {error ? (
          /* Error / Retry State */
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-md shadow-red-500/10">
                <AlertTriangle className="w-8 h-8" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-red-100 text-red-800 border border-red-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              {isBn ? "সংযোগ বিঘ্নিত হয়েছে" : "Connection Disrupted"}
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {isBn ? "কনসোল ডেটা লোড করা যায়নি" : "Unable to Load Console"}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-sm leading-relaxed">
              {error}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wide transition-all shadow-md shadow-red-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isBn ? "পুনরায় চেষ্টা করুন" : "Retry Connection"}</span>
                </button>
              )}
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBn ? "লাইভ ম্যাপে ফিরুন" : "Back to Live Map"}</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Premium Loading State */
          <div className="flex flex-col items-center">
            {/* Animated Shield Emblem with Pulse Radar Rings */}
            <div className="relative mb-6">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-3xl bg-red-500/15 animate-ping opacity-75"></div>
              {/* Secondary soft ring */}
              <div className="absolute -inset-2 rounded-3xl bg-red-500/10 blur-xs animate-pulse"></div>

              {/* Central Badge */}
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-red-50 to-rose-100/70 border border-red-200/90 flex items-center justify-center text-red-600 shadow-lg shadow-red-500/10">
                <ShieldAlert className="w-10 h-10 animate-pulse text-red-600" />
                <div className="absolute bottom-1.5 right-1.5 bg-white p-1 rounded-full shadow-xs border border-red-100">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                </div>
              </div>
            </div>

            {/* Pill Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-red-50 text-red-700 border border-red-200/90 mb-3 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <span>{isBn ? "নিরাপত্তা ও মডারেশন কনসোল" : "Security & Moderation Console"}</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {message || (isBn ? "অ্যাডমিন কনসোল প্রস্তুত হচ্ছে..." : "Loading Security Console...")}
            </h2>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm leading-relaxed font-medium">
              {subMessage ||
                (isBn
                  ? "সরাসরি বিপদ সংকেত, মডারেশন তালিকা এবং নিরাপত্তা ডেটা ফেচ করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন..."
                  : "Fetching live threat intelligence, moderation queues, and security audit logs...")}
            </p>

            {/* Animated Streamline Progress Track */}
            <div className="w-full max-w-xs mt-6">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 relative">
                <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Sequential Sync Step Statuses */}
            <div className="w-full max-w-sm mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-left">
              {/* Step 1: Authentication */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <span>{isBn ? "প্রশাসক সেশন নিশ্চিতকৃত" : "Admin Session Verified"}</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                  {isBn ? "সম্পন্ন" : "Ready"}
                </span>
              </div>

              {/* Step 2: Telemetry & Incidents */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  {activeStep >= 2 ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                  )}
                  <span className={activeStep >= 2 ? "text-slate-700" : "text-red-700 font-bold"}>
                    {isBn ? "লাইভ বিপদ সংকেত ও কিউ সিঙ্ক" : "Syncing Live Incident Telemetry"}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    activeStep >= 2 ? "text-emerald-600" : "text-red-600 animate-pulse"
                  }`}
                >
                  {activeStep >= 2 ? (isBn ? "সম্পন্ন" : "OK") : isBn ? "সিঙ্ক হচ্ছে..." : "Syncing..."}
                </span>
              </div>

              {/* Step 3: Analytics Aggregation */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  {activeStep >= 3 ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px]">
                      <Radio className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <span className={activeStep >= 3 ? "text-slate-700" : "text-slate-500"}>
                    {isBn ? "৩০ দিনের অ্যানালিটিক্স কম্পাইল" : "Compiling 30-Day Threat Trends"}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    activeStep >= 3 ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {activeStep >= 3 ? (isBn ? "সম্পন্ন" : "OK") : isBn ? "অপেক্ষমান" : "Queued"}
                </span>
              </div>
            </div>

            {/* Sub-footer Security Protocol Note */}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>
                {isBn
                  ? "এনক্রিপ্টেড প্রশাসনিক সংযোগ • ঢাকা BST (UTC+6)"
                  : "End-to-End Encrypted Admin Feed • Dhaka BST (UTC+6)"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
