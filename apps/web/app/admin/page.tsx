"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { apiFetch } from "@/lib/api";
import {
  ShieldAlert,
  ArrowLeft,
  Trash2,
  UserX,
  UserCheck,
  RefreshCw,
  FileText,
  AlertTriangle,
  Lock,
  Globe,
  Radio,
  CheckCircle2,
  Keyboard,
  BarChart3,
  TrendingUp,
  Moon,
  Clock,
  Shield,
  Activity,
  PhoneCall,
  ExternalLink,
  ChevronRight,
  Sparkles,
  KeyRound,
  X,
  Check,
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";

export default function AdminPage() {
  const { user, loginAdminWithPassword, logout, initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Login Gate State
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<
    "reports" | "users" | "verifications" | "logs" | "analytics"
  >("reports");
  const [reports, setReports] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [trends, setTrends] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // Action Inputs
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);

  // Purge Modal State
  const [purgeTarget, setPurgeTarget] = useState<any | null>(null);
  const [purgeReason, setPurgeReason] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  // Reject Modal State
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const fetchTrends = useCallback(async () => {
    setIsLoadingTrends(true);
    try {
      const data = await apiFetch<any>("/admin/analytics/trends");
      setTrends(data);
    } catch (err: any) {
      console.warn("[Admin Trends Fetch] Notice:", err.message);
    } finally {
      setIsLoadingTrends(false);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Fetch live reports
      const reportsData = await apiFetch<any[]>(
        "/reports?minLat=20&maxLat=27&minLng=88&maxLng=93"
      );
      setReports(reportsData || []);

      // 2. Fetch moderation audit logs
      const logsData = await apiFetch<{ logs: any[] }>("/admin/logs?page=1&limit=30");
      setLogs(logsData?.logs || []);

      // 3. Fetch pending KYC verifications
      const verificationsData = await apiFetch<any[]>("/admin/verifications");
      setVerifications(verificationsData || []);

      // 4. Fetch 30-day hazard analytics and trends
      const trendsData = await apiFetch<any>("/admin/analytics/trends");
      setTrends(trendsData || null);
    } catch (err: any) {
      console.warn("[Admin Data Fetch] Notice:", err.message);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Load Dashboard Data once authenticated as ADMIN
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  // Purge Report Execution
  const executePurge = async () => {
    if (!purgeTarget) return;
    const reason = purgeReason.trim() || (isBn ? "ভুয়া বা ক্ষতিকর রিপোর্ট" : "False hazard submission");
    setIsPurging(true);
    try {
      await apiFetch(`/admin/reports/${purgeTarget.id}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setPurgeTarget(null);
      setPurgeReason("");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to purge report.");
    } finally {
      setIsPurging(false);
    }
  };

  // Reject Verification Execution
  const executeReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim() || (isBn ? "নথিপত্র অসম্পূর্ণ বা অস্পষ্ট" : "Incomplete or unverifiable documents");
    setIsRejecting(true);
    try {
      await apiFetch(`/admin/verifications/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setRejectTarget(null);
      setRejectReason("");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to reject verification.");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleApproveVerification = useCallback(
    async (verifId: string) => {
      const msg = isBn
        ? "আপনি কি নিশ্চিত যে এই নাগরিকের কেওয়াইসি অনুমোদন করে রেসপন্ডার পদে উন্নীত করবেন?"
        : "Approve this citizen's KYC verification and promote role to VERIFIED_RESPONDER?";
      if (!window.confirm(msg)) return;
      try {
        await apiFetch(`/admin/verifications/${verifId}/approve`, {
          method: "POST",
        });
        fetchAdminData();
      } catch (err: any) {
        alert(err.message || "Failed to approve verification.");
      }
    },
    [fetchAdminData, isBn]
  );

  // Keyboard Shortcuts: [P], [B], [A], [R]
  useEffect(() => {
    if (user?.role !== "ADMIN") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") {
        return;
      }

      const key = e.key.toUpperCase();

      if (key === "P") {
        if (reports.length > 0) {
          e.preventDefault();
          setPurgeTarget(reports[0]);
        }
      } else if (key === "B") {
        e.preventDefault();
        setActiveTab("users");
        const input = document.getElementById("admin-ban-user-id");
        if (input) input.focus();
      } else if (key === "A") {
        if (verifications.length > 0) {
          e.preventDefault();
          handleApproveVerification(verifications[0].id);
        }
      } else if (key === "R") {
        if (verifications.length > 0) {
          e.preventDefault();
          setRejectTarget(verifications[0]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, reports, verifications, handleApproveVerification]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      await loginAdminWithPassword(adminEmail.trim(), adminPassword);
    } catch (err: any) {
      setAuthError(
        err.message ||
          (isBn
            ? "প্রশাসনিক অ্যাকাউন্টে প্রমাণীকরণ ব্যর্থ হয়েছে।"
            : "Failed to authenticate administrator account.")
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBanUser = async (action: "ban" | "unban") => {
    if (!banUserId.trim()) {
      alert(isBn ? "অনুগ্রহ করে টার্গেট ইউজার আইডি প্রদান করুন।" : "Please provide target user ID.");
      return;
    }
    const reason =
      banReason.trim() ||
      (action === "ban"
        ? isBn ? "ভুয়া বা ক্ষতিকর রিপোর্ট দাখিল" : "Abusive spam reports"
        : isBn ? "অ্যাকাউন্ট পুনরুদ্ধার" : "Restored account");

    try {
      await apiFetch(`/admin/users/${banUserId.trim()}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      alert(
        action === "ban"
          ? isBn ? "ইউজার সফলভাবে স্থগিত / নিষিদ্ধ করা হয়েছে।" : "User suspended successfully."
          : isBn ? "ইউজার অ্যাকাউন্ট সফলভাবে পুনরুদ্ধার করা হয়েছে।" : "User restored successfully."
      );
      setBanUserId("");
      setBanReason("");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} user.`);
    }
  };

  const handleTriggerNewsCrawl = async () => {
    setIsCrawling(true);
    setCrawlStatus(
      isBn
        ? "বাংলাদেশি সংবাদমাধ্যম (গুগল নিউজ ও দ্য ডেইলি স্টার) ক্রল করা হচ্ছে..."
        : "Crawling Bangladesh news feeds (Google News & Daily Star)..."
    );
    try {
      const res = await apiFetch<any>("/admin/news/crawl", { method: "POST" });
      setCrawlStatus(
        isBn
          ? `সফল: ${res?.totalIngested ?? 0} টি রিপোর্ট যুক্ত হয়েছে, ${res?.totalVerifiedMatches ?? 0} টি ক্রস-ভেরিফাই হয়েছে!`
          : `Finished: ${res?.totalIngested ?? 0} incidents added, ${res?.totalVerifiedMatches ?? 0} cross-verified!`
      );
      fetchAdminData();
    } catch (err: any) {
      setCrawlStatus(isBn ? `ত্রুটি: ${err.message}` : `Error: ${err.message}`);
    } finally {
      setIsCrawling(false);
    }
  };

  // -------------------------------------------------------------
  // Unauthenticated Admin Gate (Shows Navbar + Login Card)
  // -------------------------------------------------------------
  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-purple-500 selection:text-white">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center">
          {/* National Emergency Hotline Banner */}
          <div className="w-full max-w-md mb-6">
            <section className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-2xl p-4 text-white shadow-md shadow-red-500/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                  <PhoneCall className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
                    {isBn ? "জরুরি হেল্পলাইন" : "Emergency Crisis"}
                  </span>
                  <p className="text-xs font-bold text-white/95 mt-0.5">
                    {isBn ? "তাৎক্ষণিক পুলিশ বা ফায়ারের জন্য ৯৯৯ কল করুন" : "Dial 999 for immediate police or fire rescue"}
                  </p>
                </div>
              </div>
              <a
                href="tel:999"
                className="px-3 py-1.5 rounded-xl bg-white text-red-600 font-extrabold text-xs hover:bg-red-50 transition-all shrink-0"
              >
                999
              </a>
            </section>
          </div>

          {/* Admin Login Gateway Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-600/25 ring-1 ring-purple-400/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  {isBn ? "অ্যাডমিনিস্ট্রেটর সিকিউরিটি গেটওয়ে" : "Administrator Security Gateway"}
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isBn
                    ? "বাংলাদেশ পাবলিক সেফটি নেটওয়ার্ক মডারেশন পোর্টাল"
                    : "Bangladesh Public Safety Network Moderation Portal"}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-2xl text-xs text-purple-900 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isBn
                  ? "এই প্যানেলে প্রবেশাধিকার শুধুমাত্র অনুমোদিত নিরাপত্তা মডারেটর এবং সিস্টেম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত।"
                  : "Access is restricted to authorized emergency moderators and system administrators. All actions are cryptographically logged."}
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? "অ্যাডমিন ইমেইল *" : "Admin Email *"}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-colors"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? "পাসওয়ার্ড *" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-700/20 disabled:opacity-50 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isBn ? "যাচাই করা হচ্ছে..." : "Verifying Credentials..."}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{isBn ? "অ্যাডমিন হিসেবে লগইন করুন" : "Authenticate as Administrator"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-xs">
              <Link
                href="/"
                className="text-slate-500 hover:text-slate-900 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{isBn ? "লাইভ ম্যাপে ফিরুন" : "Return to Live Map"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Admin Operations Console
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-purple-500 selection:text-white">
      {/* Single Unified Navbar with integrated EN/বাংলা toggle */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Admin Command Header Strip */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-600/25 ring-1 ring-purple-400/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {isBn
                    ? "পাবলিক সেফটি সিকিউরিটি মডারেশন কনসোল"
                    : "Public Safety Security Moderation Console"}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                  ROOT ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isBn ? "অ্যাডমিন আইডি: " : "Admin ID: "}
                <span className="font-mono text-purple-700 font-bold">{user.id.slice(0, 8)}...</span>
                {user.email && (
                  <>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="text-slate-600">{user.email}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={fetchAdminData}
              disabled={isLoadingData}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin text-purple-600" : ""}`} />
              <span>{isBn ? "রিফ্রেশ" : "Refresh"}</span>
            </button>

            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBn ? "লাইভ ম্যাপ" : "Live Map"}</span>
            </Link>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              {isBn ? "সাইন আউট" : "Sign Out"}
            </button>
          </div>
        </div>

        {/* Tactical Cheatsheet & News Crawler Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Tactical Keyboard Shortcuts HUD (5 cols on lg) */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-600 rounded-xl shrink-0 shadow-2xs">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                {isBn ? "কিবোর্ড শর্টকাট হাব" : "Tactical Admin Shortcuts"}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-purple-700 font-semibold">
                  <strong className="text-slate-900">[P]</strong> {isBn ? "শীর্ষ রিপোর্ট মুছুন" : "Purge Top"}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-purple-700 font-semibold">
                  <strong className="text-slate-900">[B]</strong> {isBn ? "ইউজার ব্যান" : "Ban User"}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  <strong className="text-slate-900">[A]</strong> {isBn ? "কেওয়াইসি অনুমোদন" : "Approve KYC"}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                  <strong className="text-slate-900">[R]</strong> {isBn ? "কেওয়াইসি প্রত্যাখ্যান" : "Reject KYC"}
                </span>
              </div>
            </div>
          </div>

          {/* Automated News Portal Ingestion (7 cols on lg) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0 shadow-2xs">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                  {isBn
                    ? "স্বয়ংক্রিয় সংবাদ পোর্টাল ইনজেশন (Google News BD + Daily Star)"
                    : "Automated News Portal Ingestion (Google News + Daily Star)"}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isBn
                    ? "লাইভ আরএসএস ফিড ক্রল করে মানচিত্রে দুর্ঘটনা যাচাই করুন।"
                    : "Live RSS news crawler cross-verifies citizen reports with national press."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {crawlStatus && (
                <span className="text-xs text-slate-700 font-semibold bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                  {crawlStatus}
                </span>
              )}
              <button
                onClick={handleTriggerNewsCrawl}
                disabled={isCrawling}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? "animate-spin" : ""}`} />
                <span>{isBn ? "ক্রল শুরু করুন" : "Trigger Crawl"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Dashboard Tabs */}
        <div className="flex border-b border-slate-200 gap-2 sm:gap-6 overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "reports"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "সক্রিয় রিপোর্ট" : "Active Incidents"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-mono">
              {reports.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "users"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "ইউজার ব্যান ও নিয়ন্ত্রণ" : "User Defense & Ban"}</span>
          </button>

          <button
            onClick={() => setActiveTab("verifications")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "verifications"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "অপেক্ষমান কেওয়াইসি" : "Pending Verifications"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-mono">
              {verifications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "logs"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "অপরিবর্তনীয় অডিট লগ" : "Audit Trail"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-mono">
              {logs.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("analytics");
              fetchTrends();
            }}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "analytics"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "এনালিটিক্স ও ট্রেন্ডস (৩০ দিন)" : "Analytics & Trends (30 Days)"}</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: Report Moderation */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "reports" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>{isBn ? "লাইভ পোস্টজিআইএস ম্যাপ রিপোর্টসমূহ" : "Live Map Incidents (PostGIS Feed)"}</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {isBn ? "কিবোর্ডে [P] চেপে শীর্ষ রিপোর্ট সরাসরি মুছুন" : "Press [P] to purge top report"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">{isBn ? "বিভাগ" : "Category"}</th>
                    <th className="p-3.5">{isBn ? "তীব্রতা" : "Severity"}</th>
                    <th className="p-3.5">{isBn ? "বিবরণ" : "Description"}</th>
                    <th className="p-3.5">{isBn ? "ভোট সংখ্যা" : "Votes"}</th>
                    <th className="p-3.5">{isBn ? "সময়" : "Logged"}</th>
                    <th className="p-3.5 text-right">{isBn ? "পদক্ষেপ" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {isBn ? "কোনো সক্রিয় রিপোর্ট পাওয়া যায়নি।" : "No active reports found in PostGIS database."}
                      </td>
                    </tr>
                  ) : (
                    reports.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          {idx === 0 && (
                            <span className="mr-2 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 border border-purple-200 text-purple-700 font-mono font-bold">
                              [P] TARGET
                            </span>
                          )}
                          {r.category}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              r.severity === "HIGH"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : r.severity === "MEDIUM"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-xs truncate text-slate-800" title={r.description}>
                          {r.description || "—"}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">
                          👍 {r.upvotes} / 👎 {r.downvotes}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setPurgeTarget(r)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95"
                            title="Purge false report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isBn ? "মুছুন" : "Purge"}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: User Ban & Suspension */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "users" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 max-w-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-600" />
                <span>{isBn ? "অ্যাকাউন্ট সাসপেনশন ও প্রতিরোধ ব্যবস্থা" : "Account Suspension & Protection"}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isBn
                  ? "নিষিদ্ধ ব্যবহারকারীরা নতুন রিপোর্ট দাখিল বা ভোট দেওয়া থেকে চিরতরে অবরুদ্ধ থাকবে। প্রতিটি পদক্ষেপ অডিট লগে অপরিবর্তনীয়ভাবে সংরক্ষিত হয়।"
                  : "Suspended citizens are blocked from submitting hazard pins, casting votes, or contributing updates. Every action is recorded in the immutable audit trail."}
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? "টার্গেট ইউজার ইউইউআইডি (User UUID) *" : "Target User UUID *"}
                </label>
                <input
                  id="admin-ban-user-id"
                  type="text"
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="e.g. 1960138d-8dd4-4a06-b403-19a76966fc64"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? "স্থগিতের কারণ / কেস রেফারেন্স *" : "Reason / Case Reference *"}
                </label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={isBn ? "ধানমন্ডিতে বারবার মিথ্যা ছিনতাইয়ের রিপোর্ট" : "Repeated false mugging reports"}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleBanUser("ban")}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>{isBn ? "ইউজার স্থগিত / ব্যান করুন" : "Suspend / Ban User"}</span>
                </button>

                <button
                  onClick={() => handleBanUser("unban")}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isBn ? "অ্যাকাউন্ট পুনরুদ্ধার করুন" : "Unban Account"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: Verifications */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "verifications" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <span>{isBn ? "অপেক্ষমান নাগরিক কেওয়াইসি অনুরোধসমূহ" : "Pending KYC & Citizen Verification Requests"}</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {isBn ? "শর্টকাট: [A] অনুমোদন • [R] প্রত্যাখ্যান" : "Shortcuts: [A] Approve Top • [R] Reject Top"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">{isBn ? "ইউজার আইডি" : "User ID"}</th>
                    <th className="p-3.5">{isBn ? "ভেরিফিকেশন টাইপ" : "Type"}</th>
                    <th className="p-3.5">{isBn ? "নথি / যোগাযোগ" : "Document / Phone"}</th>
                    <th className="p-3.5">{isBn ? "দাখিলের সময়" : "Submitted"}</th>
                    <th className="p-3.5 text-right">{isBn ? "পদক্ষেপ" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {verifications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {isBn ? "কোনো অপেক্ষমান ভেরিফিকেশন অনুরোধ নেই।" : "No pending citizen verification requests."}
                      </td>
                    </tr>
                  ) : (
                    verifications.map((v, idx) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-mono text-slate-700">
                          {idx === 0 && (
                            <span className="mr-2 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 border border-purple-200 text-purple-700 font-mono font-bold">
                              [A/R] TARGET
                            </span>
                          )}
                          {v.userId.slice(0, 8)}...
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">{v.type || "NID / Phone"}</td>
                        <td className="p-3.5 font-mono text-slate-600 truncate max-w-xs">
                          {v.type === "PHONE_OTP" || !v.documentUrl ? (
                            <span>{v.phoneNumber || v.user?.phoneNumber || "—"}</span>
                          ) : (
                            <a
                              href={v.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span>{v.documentUrl.slice(0, 30)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(v.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleApproveVerification(v.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isBn ? "অনুমোদন [A]" : "Approve [A]"}</span>
                          </button>
                          <button
                            onClick={() => setRejectTarget(v)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isBn ? "প্রত্যাখ্যান [R]" : "Reject [R]"}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: Audit Logs */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "logs" && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {isBn ? "অপরিবর্তনীয় অডিট ট্রেইল ও কমপ্লায়েন্স লগ" : "Immutable Moderation Log (Compliance Trail)"}
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {isBn ? "স্বয়ংক্রিয়ভাবে সংরক্ষিত" : "Cryptographically logged"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">{isBn ? "সময়কাল" : "Timestamp"}</th>
                    <th className="p-3.5">{isBn ? "অ্যাকশন" : "Action"}</th>
                    <th className="p-3.5">{isBn ? "অ্যাডমিন আইডি" : "Admin ID"}</th>
                    <th className="p-3.5">{isBn ? "টার্গেট রেফারেন্স" : "Target Reference"}</th>
                    <th className="p-3.5">{isBn ? "কারণ" : "Reason"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {isBn ? "কোনো অডিট রেকর্ড পাওয়া যায়নি।" : "No moderation actions recorded yet."}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 border border-purple-200 text-purple-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{log.adminId.slice(0, 8)}...</td>
                        <td className="p-3.5 font-mono text-slate-600">
                          {log.targetReportId
                            ? `Report: ${log.targetReportId.slice(0, 8)}...`
                            : log.targetUserId
                            ? `User: ${log.targetUserId.slice(0, 8)}...`
                            : "—"}
                        </td>
                        <td className="p-3.5 text-slate-800 font-semibold">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: Analytics & Trends */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Top Aggregate Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {isBn ? "৩০ দিনে মোট বিপদ" : "30-Day Total Hazards"}
                  </span>
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{trends?.totalReports ?? 0}</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isBn ? "বাংলাদেশ জুড়ে নথিভুক্ত" : "Live recorded across Bangladesh"}
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {isBn ? "রাত্রিকালীন বিপদের হার" : "Night Hazard Ratio"}
                  </span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                    <Moon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-700">
                  {trends?.nightReportPercentage ?? 0}%
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  {trends?.nightReportsCount ?? 0} {isBn ? "টি রাতের ঘটনা" : "incidents occurred at night"}
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {isBn ? "উচ্চমাত্রার সশস্ত্র হুমকি" : "High Severity Threats"}
                  </span>
                  <div className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-200">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-red-600">
                  {trends?.breakdown?.bySeverity?.HIGH ?? 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isBn ? "সশস্ত্র বা চরম ঝুঁকিপূর্ণ পিন" : "Armed or imminent danger pins"}
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {isBn ? "নিষ্পত্তিকৃত ঘটনা" : "Resolved Incidents"}
                  </span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {trends?.breakdown?.byStatus?.RESOLVED ?? 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isBn ? "উদ্ধার বা নিরাপদ ঘোষিত" : "Neutralized or safe status"}
                </p>
              </div>
            </div>

            {/* Breakdown Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {isBn ? "বিপদের ধরন অনুযায়ী বিভাজন" : "Hazard Category Distribution"}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {isBn ? "বিগত ৩০ দিন" : "Last 30 Days"}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {[
                    { key: "MUGGING", label: isBn ? "ছিনতাই ও ডাকাতি" : "Mugging & Robbery", color: "bg-red-500" },
                    { key: "THEFT", label: isBn ? "চুরি ও সিঁধেল চুরি" : "Theft & Burglary", color: "bg-amber-500" },
                    { key: "UNLIT_ROAD", label: isBn ? "অন্ধকার বা ঝুঁকিপূর্ণ সড়ক" : "Unlit / Broken Road", color: "bg-yellow-500" },
                    { key: "EXTORTION", label: isBn ? "চাঁদাবাজি ও গ্যাং তৎপরতা" : "Extortion & Gangs", color: "bg-purple-500" },
                    { key: "DRUG_ACTIVITY", label: isBn ? "মাদক কেনাবেচা" : "Narcotics Activity", color: "bg-rose-500" },
                  ].map((cat) => {
                    const count = trends?.breakdown?.byCategory?.[cat.key] ?? 0;
                    const total = trends?.totalReports || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={cat.key} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{cat.label}</span>
                          <span className="font-mono text-slate-900 font-bold">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Severity & Status Breakdown */}
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {isBn ? "হুমকির তীব্রতা অনুপাত" : "Threat Severity Breakdown"}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                      <span className="text-[11px] font-bold text-red-700 block uppercase">HIGH</span>
                      <span className="text-xl font-black text-red-700 font-mono">
                        {trends?.breakdown?.bySeverity?.HIGH ?? 0}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[11px] font-bold text-amber-700 block uppercase">MEDIUM</span>
                      <span className="text-xl font-black text-amber-700 font-mono">
                        {trends?.breakdown?.bySeverity?.MEDIUM ?? 0}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 block uppercase">LOW</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">
                        {trends?.breakdown?.bySeverity?.LOW ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {isBn ? "ঘটনা নিষ্পত্তি পাইপলাইন" : "Incident Resolution Pipeline"}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[11px] font-bold text-blue-700 block uppercase">ACTIVE</span>
                      <span className="text-xl font-black text-blue-700 font-mono">
                        {trends?.breakdown?.byStatus?.ACTIVE ?? 0}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 block uppercase">RESOLVED</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">
                        {trends?.breakdown?.byStatus?.RESOLVED ?? 0}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 block uppercase">PURGED</span>
                      <span className="text-xl font-black text-slate-700 font-mono">
                        {trends?.breakdown?.byStatus?.PURGED ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Timeline Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {isBn ? "দৈনিক ঘটনার টাইমলাইন" : "Daily Incident Timeline (PostGIS Aggregated Days)"}
                  </h3>
                </div>
                <button
                  onClick={fetchTrends}
                  disabled={isLoadingTrends}
                  className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrends ? "animate-spin" : ""}`} />
                  <span>{isBn ? "ট্রেন্ডস রিফ্রেশ" : "Refresh Trends"}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">{isBn ? "তারিখ (UTC)" : "Date (UTC)"}</th>
                      <th className="p-3.5">{isBn ? "দাখিলকৃত রিপোর্ট" : "Incidents Logged"}</th>
                      <th className="p-3.5">{isBn ? "প্রাকৃতিক বণ্টন" : "Proportional Distribution"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {!trends?.timeline || trends.timeline.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500">
                          {isBn ? "বিগত ৩০ দিনে কোনো রেকর্ড পাওয়া যায়নি।" : "No timeline records found in the last 30 days."}
                        </td>
                      </tr>
                    ) : (
                      trends.timeline.map((row: { date: string; count: number }) => {
                        const maxCount = Math.max(...trends.timeline.map((r: any) => r.count), 1);
                        const barWidth = Math.round((row.count / maxCount) * 100);
                        return (
                          <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-slate-900">{row.date}</td>
                            <td className="p-3.5 font-mono font-black text-purple-700">
                              {row.count} {isBn ? "টি রিপোর্ট" : "reports"}
                            </td>
                            <td className="p-3.5 w-1/2">
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="bg-purple-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.max(barWidth, 6)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Purge Modal Dialog */}
      {/* ------------------------------------------------------------- */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? "রিপোর্ট বাতিল ও অপসারণ" : "Purge Hazard Incident"}</span>
              </div>
              <button
                onClick={() => setPurgeTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600">
                {isBn
                  ? "এই রিপোর্টটি মানচিত্র এবং লাইভ ফিড থেকে স্থায়ীভাবে অপসারণ করা হবে। অনুগ্রহ করে অডিট ট্রেইলে সংরক্ষণের জন্য কারণ উল্লেখ করুন:"
                  : "This report will be permanently purged from the live map and public feed. Please specify a mandatory reason for the audit trail:"}
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800">
                <span className="font-bold">ID:</span> {purgeTarget.id}
                <br />
                <span className="font-bold">Category:</span> {purgeTarget.category}
              </div>
              <textarea
                value={purgeReason}
                onChange={(e) => setPurgeReason(e.target.value)}
                placeholder={isBn ? "যেমন: এলাকা পরিদর্শনে কোনো অগ্নিকাণ্ড পাওয়া যায়নি" : "e.g., False alarm confirmed by local field patrol"}
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPurgeTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={executePurge}
                disabled={isPurging}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isBn ? "অপসারণ হচ্ছে..." : "Purging..."}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "স্থায়ীভাবে মুছুন" : "Confirm Purge"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Reject Verification Modal Dialog */}
      {/* ------------------------------------------------------------- */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <UserX className="w-4 h-4" />
                <span>{isBn ? "কেওয়াইসি অনুরোধ প্রত্যাখ্যান" : "Reject KYC Verification"}</span>
              </div>
              <button
                onClick={() => setRejectTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600">
                {isBn
                  ? "নাগরিকের ভেরিফিকেশন নথি প্রত্যাখ্যান করা হচ্ছে। প্রত্যাখ্যানের সুনির্দিষ্ট কারণ উল্লেখ করুন:"
                  : "Specify the reason for rejecting this verification request (recorded in audit log):"}
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800">
                <span className="font-bold">User:</span> {rejectTarget.userId}
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={isBn ? "যেমন: স্মার্ট এনআইডি কার্ডের ছবি অস্পষ্ট" : "e.g., Document illegible or blurred"}
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={executeReject}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                {isRejecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isBn ? "প্রত্যাখ্যান হচ্ছে..." : "Rejecting..."}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm Rejection"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
