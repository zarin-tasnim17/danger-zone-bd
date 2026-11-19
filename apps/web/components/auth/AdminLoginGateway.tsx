"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { showToast } from "@/store/useToastStore";
import {
  ShieldAlert,
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  PhoneCall,
  ChevronRight,
  AlertTriangle,
  FileCheck,
  Server,
  Activity,
  ArrowRight,
} from "lucide-react";

interface AdminLoginGatewayProps {
  onSuccess?: () => void;
  showBackToMap?: boolean;
}

export default function AdminLoginGateway({
  onSuccess,
  showBackToMap = true,
}: AdminLoginGatewayProps) {
  const router = useRouter();
  const { loginAdminWithPassword, isLoading: storeLoading } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage(
        isBn
          ? "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড উভয়ই পূরণ করুন।"
          : "Please provide both administrator email and password."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await loginAdminWithPassword(trimmedEmail, password);
      showToast(
        isBn
          ? "প্রশাসনিক প্রমাণীকরণ সফল হয়েছে! কনসোলে স্বাগত।"
          : "Administrator authenticated successfully! Welcome to console.",
        "success"
      );
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      const msg =
        err.message ||
        (isBn
          ? "প্রমাণীকরণ ব্যর্থ হয়েছে। আপনার পরিচয়পত্র যাচাই করুন।"
          : "Authentication failed. Check your security credentials.");
      setErrorMessage(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || storeLoading;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Outer Tactical Command Frame */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_24px_56px_-12px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 transition-all">
        
        {/* Left Column: Tactical Security Mission Brief (5 cols on desktop, compact on mobile) */}
        <div className="lg:col-span-5 bg-slate-950 text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Subtle Ambient Radar / Grid Watermark */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-60" />
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Section */}
          <div className="relative z-10 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/70 border border-red-800/60 text-[10px] font-mono tracking-widest uppercase text-red-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>{isBn ? "নিয়ন্ত্রিত প্রবেশাধিকার" : "RESTRICTED ACCESS"}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                TIER-1 MOD
              </span>
            </div>

            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 ring-1 ring-red-400/40">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {isBn
                  ? "অ্যাডমিনিস্ট্রেটর সিকিউরিটি গেটওয়ে"
                  : "Administrator Security Gateway"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                {isBn
                  ? "বাংলাদেশ পাবলিক সেফটি নেটওয়ার্ক মডারেশন ও ক্রাইসিস কমান্ড সেন্টার। জরুরি রিপোর্ট যাচাই ও নিরাপদ পথ সমন্বয় পোর্টাল।"
                  : "Central crisis command & verification portal for the Bangladesh Public Safety Network."}
              </p>
            </div>

            {/* Cryptographic Telemetry Specs */}
            <div className="space-y-2.5 pt-2 sm:pt-4 border-t border-slate-800/80">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-red-400 shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {isBn ? "প্রটোকল" : "Encryption"}
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    TLS 1.3 • AES-256-GCM
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {isBn ? "লগিং" : "Audit Trail"}
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    {isBn ? "ক্রিপ্টোগ্রাফিক ইমিউটেবল অডিট" : "Immutable Action Ledger"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {isBn ? "অবস্থা" : "Telemetry"}
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    {isBn ? "লাইভ ইনসিডেন্ট মনিটরিং সক্রিয়" : "Live Geofence Active"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Integrated Emergency Crisis Hotline */}
          <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80">
            <div className="bg-red-950/50 border border-red-800/60 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-600/30 flex items-center justify-center text-red-400 shrink-0 border border-red-500/30">
                  <PhoneCall className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-red-300">
                    {isBn ? "জরুরি জাতীয় হেল্পলাইন" : "National Emergency Hotline"}
                  </div>
                  <div className="text-[11px] font-bold text-white truncate">
                    {isBn ? "তাৎক্ষণিক পুলিশ ও ফায়ার রেসকিউ" : "Instant Police & Fire Rescue"}
                  </div>
                </div>
              </div>
              <a
                href="tel:999"
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-mono font-black text-xs transition-colors shrink-0 shadow-sm"
                title="Dial 999"
              >
                999
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Terminal (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Header info - no eyebrow per craft-floor rules */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isBn ? "অ্যাডমিন পোর্টালে সাইন ইন" : "Sign In to Admin Portal"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                {isBn
                  ? "শুধুমাত্র অনুমোদিত নিরাপত্তা পর্যবেক্ষক এবং সিস্টেম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত।"
                  : "Authorized security personnel and moderators only. Please provide your institutional credentials."}
              </p>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-semibold leading-relaxed">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Security Warning Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px] sm:text-xs">
                {isBn
                  ? "অননুমোদিত প্রবেশাধিকার প্রচেষ্টা বাংলাদেশ সাইবার নিরাপত্তা আইন অনুসারে দণ্ডনীয় এবং আইপি সহ সমস্ত কার্যক্রম সংরক্ষণ করা হয়।"
                  : "All access events are strictly audited under the Public Safety Cyber Protocol. Unauthorized access attempts are monitored and logged."}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-bold text-slate-800 tracking-tight"
                >
                  {isBn ? "অ্যাডমিন ইমেইল *" : "Admin Email *"}
                </label>
                <div className="relative">
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@safetymap.bd"
                    disabled={isBusy}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-all shadow-2xs disabled:opacity-60"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-bold text-slate-800 tracking-tight"
                  >
                    {isBn ? "সিকিউরিটি পাসওয়ার্ড *" : "Security Password *"}
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isBn ? "ন্যূনতম ৬ অক্ষর" : "Min 6 chars"}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isBusy}
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-all shadow-2xs disabled:opacity-60 font-mono"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-950 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-slate-900/15 hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 border border-slate-800 disabled:opacity-50 mt-2"
              >
                {isBusy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                    <span>{isBn ? "প্রমাণীকরণ সম্পন্ন হচ্ছে..." : "Verifying Credentials..."}</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-red-500" />
                    <span>{isBn ? "অ্যাডমিন কনসোলে প্রবেশ করুন" : "Authenticate as Administrator"}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Navigation Links Footer */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <Link
              href="/profile"
              className="text-slate-600 hover:text-slate-900 font-semibold transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{isBn ? "নাগরিক পরিচয় ও ট্রাস্ট প্রোফাইল" : "Citizen Identity & Trust Profile"}</span>
            </Link>

            {showBackToMap && (
              <Link
                href="/"
                className="text-slate-500 hover:text-red-600 font-semibold transition-colors flex items-center gap-1"
              >
                <span>{isBn ? "লাইভ ম্যাপে ফিরে যান" : "Return to Live Map"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
