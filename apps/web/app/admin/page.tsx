"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { apiFetch } from "@/lib/api";
import { translations } from "@/lib/translations";
import { showToast } from "@/store/useToastStore";
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
  Search,
  Phone,
  Smartphone,
  Copy,
  SlidersHorizontal,
  ChevronLeft,
  Users,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  MUGGING: "SNATCHING",
  DACOITY: "ROBBERY",
  THEFT_DACOITY: "THEFT_ROBBERY",
  TEEN_GANG: "YOUTH_GANG_ACTIVITY",
  DRUG_ACTIVITY: "DRUG_RELATED_CRIME",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  SNATCHING: "bg-orange-500",
  ARMED_ASSAULT: "bg-rose-600",
  SNATCHING_ARMED_ASSAULT: "bg-red-600",
  ROBBERY: "bg-red-500",
  THEFT: "bg-amber-500",
  THEFT_ROBBERY: "bg-red-700",
  EXTORTION: "bg-purple-500",
  YOUTH_GANG_ACTIVITY: "bg-violet-500",
  DRUG_RELATED_CRIME: "bg-blue-500",
  UNLIT_ROAD: "bg-yellow-500",
  ROAD_ACCIDENT: "bg-emerald-500",
  TEEN_GANG_ARMED_ASSAULT: "bg-fuchsia-600",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // Users Directory & Moderation State
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(15);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("ALL");
  const [userSortBy, setUserSortBy] = useState<"createdAt" | "trustScore" | "lastReportAt">("createdAt");
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Modal State for Ban/Unban
  const [banTargetUser, setBanTargetUser] = useState<any | null>(null);
  const [banModalAction, setBanModalAction] = useState<"ban" | "unban">("ban");
  const [banModalReason, setBanModalReason] = useState("");
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // Manual Quick Action Inputs
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

  const fetchUsers = useCallback(
    async (
      search = userSearchQuery,
      role = userRoleFilter,
      status = userStatusFilter,
      page = usersPage,
      sortBy = userSortBy
    ) => {
      setIsLoadingUsers(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (role !== "ALL") params.set("role", role);
        if (status === "BANNED") params.set("isBanned", "true");
        if (status === "ACTIVE") params.set("isBanned", "false");
        if (status === "VERIFIED") params.set("isVerified", "true");
        params.set("page", String(page));
        params.set("limit", String(usersLimit));
        params.set("sortBy", sortBy);
        params.set("sortOrder", "desc");

        const data = await apiFetch<{ users: any[]; pagination: any }>(
          `/admin/users?${params.toString()}`
        );
        setUsers(data?.users || []);
        setUsersTotal(data?.pagination?.total || 0);
      } catch (err: any) {
        console.warn("[Admin Users Fetch] Error:", err.message);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [userSearchQuery, userRoleFilter, userStatusFilter, usersPage, usersLimit, userSortBy]
  );

  const fetchAdminData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      // 1. Fetch live reports with populated author metadata
      const adminReportsData = await apiFetch<{ reports: any[] }>("/admin/reports?limit=50").catch(() => null);
      if (adminReportsData && Array.isArray(adminReportsData.reports)) {
        setReports(adminReportsData.reports);
      } else {
        const reportsData = await apiFetch<any[]>("/reports?minLat=20&maxLat=27&minLng=88&maxLng=93");
        setReports(reportsData || []);
      }

      // 2. Fetch moderation audit logs
      const logsData = await apiFetch<{ logs: any[] }>("/admin/logs?page=1&limit=30");
      setLogs(logsData?.logs || []);

      // 3. Fetch pending KYC verifications
      const verificationsData = await apiFetch<any[]>("/admin/verifications");
      setVerifications(verificationsData || []);

      // 4. Fetch 30-day hazard analytics and trends
      const trendsData = await apiFetch<any>("/admin/analytics/trends");
      setTrends(trendsData || null);

      // 5. Fetch users directory
      fetchUsers();
    } catch (err: any) {
      const msg =
        err?.message ||
        (isBn ? "অ্যাডমিন ড্যাশবোর্ড ডেটা লোড করতে ব্যর্থ হয়েছে।" : "Failed to load admin dashboard data.");
      setDataError(msg);
      showToast(msg, "error");
    } finally {
      setIsLoadingData(false);
    }
  }, [isBn, fetchUsers]);

  // Debounced search trigger for user directory
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.role === "ADMIN") {
        fetchUsers(userSearchQuery, userRoleFilter, userStatusFilter, usersPage, userSortBy);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearchQuery, userRoleFilter, userStatusFilter, usersPage, userSortBy, user?.role, fetchUsers]);

  // Load Dashboard Data once authenticated as ADMIN
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  // Purge Report Execution
  const executePurge = async () => {
    if (!purgeTarget) return;
    if (purgeReason.trim().length < 3) {
      showToast(
        isBn
          ? "রিপোর্ট মুছে ফেলার কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Purge reason must be at least 3 characters.",
        "warning"
      );
      return;
    }
    const reason = purgeReason.trim();
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
      showToast(err.message || "Failed to purge report.", "error");
    } finally {
      setIsPurging(false);
    }
  };

  // Reject Verification Execution
  const executeReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      showToast(
        isBn
          ? "প্রত্যাখ্যানের কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Rejection reason must be at least 3 characters.",
        "warning"
      );
      return;
    }
    const reason = rejectReason.trim();
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
      showToast(err.message || "Failed to reject verification.", "error");
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
        showToast(err.message || "Failed to approve verification.", "error");
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

  const executeModalBanAction = async () => {
    if (!banTargetUser) return;
    if (banModalReason.trim().length < 3) {
      showToast(
        isBn
          ? "মডারেশনের কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Moderation reason must be at least 3 characters.",
        "warning"
      );
      return;
    }
    const reason = banModalReason.trim();
    setIsSubmittingBan(true);
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(banTargetUser.id)}/${banModalAction}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        banModalAction === "ban"
          ? isBn ? "নাগরিক অ্যাকাউন্ট সফলভাবে স্থগিত করা হয়েছে।" : "Citizen account suspended successfully."
          : isBn ? "নাগরিক অ্যাকাউন্ট সফলভাবে পুনরুদ্ধার করা হয়েছে।" : "Citizen account restored successfully.",
        "success"
      );
      setBanTargetUser(null);
      setBanModalReason("");
      fetchUsers();
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || `Failed to ${banModalAction} user.`, "error");
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleBanUser = async (action: "ban" | "unban") => {
    const trimmedIdentifier = banUserId.trim();
    if (!trimmedIdentifier) {
      showToast(
        isBn
          ? "অনুগ্রহ করে টার্গেট ইউজারের UUID, ইমেইল, মোবাইল বা ডিভাইস আইডি প্রদান করুন।"
          : "Please enter a target UUID, email, phone number, or device ID.",
        "warning"
      );
      return;
    }

    if (banReason.trim().length < 3) {
      showToast(
        isBn
          ? "মডারেশনের কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Moderation reason must be at least 3 characters.",
        "warning"
      );
      return;
    }
    const reason = banReason.trim();

    try {
      await apiFetch(`/admin/users/${encodeURIComponent(trimmedIdentifier)}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        action === "ban"
          ? isBn ? "ইউজার সফলভাবে স্থগিত / নিষিদ্ধ করা হয়েছে।" : "User suspended successfully."
          : isBn ? "ইউজার অ্যাকাউন্ট সফলভাবে পুনরুদ্ধার করা হয়েছে।" : "User restored successfully.",
        "success"
      );
      setBanUserId("");
      setBanReason("");
      fetchUsers();
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} user.`, "error");
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
        {dataError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-3.5 text-xs font-semibold flex items-center justify-between gap-3">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={fetchAdminData}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shrink-0 cursor-pointer"
            >
              {isBn ? "আবার চেষ্টা করুন" : "Retry"}
            </button>
          </div>
        )}
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
            onClick={() => {
              setActiveTab("users");
              fetchUsers();
            }}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "users"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{isBn ? "নাগরিক ডিরেক্টরি ও নিয়ন্ত্রণ" : "Citizens Directory & Moderation"}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-mono">
              {usersTotal || users.length}
            </span>
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
                    <th className="p-3.5">{isBn ? "রিপোর্টার" : "Reporter"}</th>
                    <th className="p-3.5">{isBn ? "বিবরণ" : "Description"}</th>
                    <th className="p-3.5">{isBn ? "ভোট" : "Votes"}</th>
                    <th className="p-3.5">{isBn ? "সময়" : "Logged"}</th>
                    <th className="p-3.5 text-right">{isBn ? "পদক্ষেপ" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
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
                        <td className="p-3.5">
                          {r.user ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 truncate max-w-[130px]" title={r.user.email || r.user.anonymousId}>
                                  {r.user.email ? r.user.email.split("@")[0] : r.user.anonymousId?.slice(0, 10)}
                                </span>
                                {r.user.isBanned && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                                    BANNED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                <span>Score: {r.user.trustScore ?? 0}</span>
                                <span>•</span>
                                <span className="capitalize">{r.user.role?.toLowerCase()}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {r.sourceName ? r.sourceName : "Anonymous"}
                            </span>
                          )}
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
                          <div className="flex items-center justify-end gap-1.5">
                            {r.user && r.user.id !== user?.id && r.user.role !== "ADMIN" && !r.user.isBanned && (
                              <button
                                onClick={() => {
                                  setBanTargetUser(r.user);
                                  setBanModalAction("ban");
                                  setBanModalReason(
                                    isBn
                                      ? `মিথ্যা/স্প্যাম রিপোর্ট দাখিল (#${r.id.slice(0, 8)}): ${r.description?.slice(0, 40) || ""}`
                                      : `Fraudulent/spam hazard pin (#${r.id.slice(0, 8)}): "${r.description?.slice(0, 40) || ""}"`
                                  );
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer active:scale-95 text-[11px]"
                                title={isBn ? "রিপোর্টারকে ব্যান করুন" : "Ban Reporter"}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{isBn ? "ব্যান" : "Ban"}</span>
                              </button>
                            )}
                            <button
                              onClick={() => setPurgeTarget(r)}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer active:scale-95 text-[11px]"
                              title="Purge false report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isBn ? "মুছুন" : "Purge"}</span>
                            </button>
                          </div>
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
        {/* TAB 2: Citizens Directory & Moderation */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* User Directory Toolbar: Search & Filters */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {isBn ? "নাগরিক ডিরেক্টরি ও সক্রিয় মডারেশন" : "Citizen Directory & Active Moderation"}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {isBn
                        ? "ইমেইল, ফোন নম্বর, অ্যানোনিমাস ডিভাইস আইডি বা ইউইউআইডি দিয়ে সহজেই খুঁজুন ও নিয়ন্ত্রণ করুন।"
                        : "Search and moderate accounts via email, phone number, device anonymous ID, or UUID."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchUsers()}
                    disabled={isLoadingUsers}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? "animate-spin" : ""}`} />
                    <span>{isBn ? "রিফ্রেশ" : "Refresh"}</span>
                  </button>
                </div>
              </div>

              {/* Search Bar + Filters */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {/* Search Input with Debounce */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setUsersPage(1);
                    }}
                    placeholder={
                      isBn
                        ? "ইমেইল, মোবাইল (+880...), ডিভাইস আইডি বা ইউইউআইডি খুঁজুন..."
                        : "Search by email, phone (+880...), device ID, or user UUID..."
                    }
                    className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearchQuery("");
                        setUsersPage(1);
                      }}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: "ALL", label: isBn ? "সব নাগরিক" : "All" },
                    { id: "ACTIVE", label: isBn ? "সক্রিয়" : "Active" },
                    { id: "BANNED", label: isBn ? "স্থগিত / ব্যান" : "Suspended" },
                    { id: "VERIFIED", label: isBn ? "যাচাইকৃত" : "Verified" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setUserStatusFilter(filter.id);
                        setUsersPage(1);
                      }}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        userStatusFilter === filter.id
                          ? "bg-purple-700 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Role Filter Select */}
                <div className="shrink-0">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => {
                      setUserRoleFilter(e.target.value);
                      setUsersPage(1);
                    }}
                    className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">{isBn ? "সকল ভূমিকা (Roles)" : "All Roles"}</option>
                    <option value="USER">{isBn ? "সাধারণ নাগরিক (USER)" : "Citizens (USER)"}</option>
                    <option value="VERIFIED_RESPONDER">{isBn ? "রেসপন্ডার (RESPONDER)" : "Verified Responders"}</option>
                    <option value="ADMIN">{isBn ? "প্রশাসক (ADMIN)" : "Admins (ADMIN)"}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Data Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">{isBn ? "নাগরিক পরিচয়" : "Citizen / Identity"}</th>
                      <th className="p-3.5">{isBn ? "যোগাযোগ ও ডিভাইস" : "Contact & Device"}</th>
                      <th className="p-3.5">{isBn ? "ভূমিকা ও স্তর" : "Role & Verification"}</th>
                      <th className="p-3.5">{isBn ? "ট্রাস্ট স্কোর ও রিপোর্ট" : "Trust & Reports"}</th>
                      <th className="p-3.5">{isBn ? "অবস্থা" : "Status"}</th>
                      <th className="p-3.5 text-right">{isBn ? "পদক্ষেপ" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {isLoadingUsers ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-200" />
                              <div className="space-y-1.5">
                                <div className="w-28 h-3 bg-slate-200 rounded" />
                                <div className="w-20 h-2.5 bg-slate-100 rounded" />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5"><div className="w-24 h-3 bg-slate-200 rounded" /></td>
                          <td className="p-3.5"><div className="w-16 h-4 bg-slate-200 rounded-full" /></td>
                          <td className="p-3.5"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                          <td className="p-3.5"><div className="w-14 h-4 bg-slate-200 rounded-full" /></td>
                          <td className="p-3.5 text-right"><div className="w-16 h-7 bg-slate-200 rounded-xl ml-auto" /></td>
                        </tr>
                      ))
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <div className="max-w-sm mx-auto space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mx-auto">
                              <UserX className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">
                              {isBn ? "কোনো নাগরিক পাওয়া যায়নি" : "No citizens found"}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {userSearchQuery
                                ? isBn
                                  ? `"${userSearchQuery}" এর সাথে মেলে এমন কোনো নাগরিক খুঁজে পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।`
                                  : `No accounts matching "${userSearchQuery}". Try adjusting your search query or filters.`
                                : isBn
                                ? "ডাটাবেজে বর্তমানে কোনো নাগরিক তথ্য নেই।"
                                : "No citizen records currently in database."}
                            </p>
                            {userSearchQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUserSearchQuery("");
                                  setUserRoleFilter("ALL");
                                  setUserStatusFilter("ALL");
                                }}
                                className="mt-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-colors cursor-pointer"
                              >
                                {isBn ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSelf = u.id === user?.id;
                        const isProtectedAdmin = u.role === "ADMIN";
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Identity */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-100 to-purple-50 border border-purple-200 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                                  {u.email ? u.email.charAt(0) : "A"}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate max-w-[200px]" title={u.email || u.anonymousId}>
                                    {u.email || u.anonymousId}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    {isBn ? "যুক্ত হয়েছেন: " : "Joined: "}
                                    {new Date(u.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contact & Device */}
                            <td className="p-3.5">
                              <div className="space-y-0.5">
                                {u.phoneNumber ? (
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800">
                                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{u.phoneNumber}</span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">
                                    {isBn ? "ফোন যাচাইহীন" : "No phone verified"}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                  <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[130px]" title={u.anonymousId}>
                                    {u.anonymousId}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(u.id);
                                      showToast(isBn ? "UUID কপি হয়েছে" : "UUID copied", "success");
                                    }}
                                    className="text-slate-400 hover:text-purple-600 p-0.5 rounded cursor-pointer"
                                    title={`Copy UUID: ${u.id}`}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Role & Verification */}
                            <td className="p-3.5">
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                                    u.role === "ADMIN"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : u.role === "VERIFIED_RESPONDER"
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {u.role === "ADMIN" ? "ROOT ADMIN" : u.role === "VERIFIED_RESPONDER" ? "RESPONDER" : "CITIZEN"}
                                </span>
                                {u.isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>{isBn ? "যাচাইকৃত" : "Verified"}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    {isBn ? "সাধারণ" : "Unverified"}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Trust Score & Reports */}
                            <td className="p-3.5">
                              <div className="space-y-1 max-w-[130px]">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">{isBn ? "স্কোর:" : "Trust:"}</span>
                                  <span className={`font-black font-mono ${
                                    u.trustScore >= 70 ? "text-emerald-700" : u.trustScore >= 40 ? "text-amber-700" : "text-rose-700"
                                  }`}>
                                    {u.trustScore}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      u.trustScore >= 70 ? "bg-emerald-500" : u.trustScore >= 40 ? "bg-amber-500" : "bg-rose-500"
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(5, u.trustScore))}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                  <span>{u._count?.reports ?? 0} {isBn ? "রিপোর্ট" : "reports"}</span>
                                  <span>•</span>
                                  <span>{u._count?.votes ?? 0} {isBn ? "ভোট" : "votes"}</span>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-3.5">
                              {u.isBanned ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                  <span>{isBn ? "স্থগিত / ব্যান" : "Suspended"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  <span>{isBn ? "সক্রিয়" : "Active"}</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              {isSelf ? (
                                <span className="px-2.5 py-1 text-[11px] font-bold text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                                  {isBn ? "আপনি নিজে" : "Your Account"}
                                </span>
                              ) : isProtectedAdmin ? (
                                <span className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 rounded-lg border border-purple-200">
                                  {isBn ? "সুরক্ষিত অ্যাডমিন" : "Protected Admin"}
                                </span>
                              ) : u.isBanned ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBanTargetUser(u);
                                    setBanModalAction("unban");
                                    setBanModalReason(isBn ? "নাগরিক অ্যাকাউন্টের নিষেধাজ্ঞা প্রত্যাহার" : "Account suspension lift post review");
                                  }}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95 text-xs"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>{isBn ? "পুনরুদ্ধার" : "Unban"}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBanTargetUser(u);
                                    setBanModalAction("ban");
                                    setBanModalReason(isBn ? "বারংবার স্প্যাম বা ভুয়া রিপোর্ট দাখিল" : "Repeated false incident reporting");
                                  }}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95 text-xs"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>{isBn ? "ব্যান করুন" : "Suspend"}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Pagination */}
              {usersTotal > 0 && (
                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
                  <div>
                    {isBn ? (
                      <>
                        মোট <strong className="text-slate-900 font-bold">{usersTotal}</strong> জন নাগরিকের মধ্যে{" "}
                        <strong className="text-slate-900 font-bold">{(usersPage - 1) * usersLimit + 1}</strong> থেকে{" "}
                        <strong className="text-slate-900 font-bold">{Math.min(usersPage * usersLimit, usersTotal)}</strong> দেখানো হচ্ছে
                      </>
                    ) : (
                      <>
                        Showing <strong className="text-slate-900 font-bold">{(usersPage - 1) * usersLimit + 1}</strong>-
                        <strong className="text-slate-900 font-bold">{Math.min(usersPage * usersLimit, usersTotal)}</strong> of{" "}
                        <strong className="text-slate-900 font-bold">{usersTotal}</strong> citizens
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={usersPage <= 1}
                      onClick={() => {
                        const prev = usersPage - 1;
                        setUsersPage(prev);
                        fetchUsers(userSearchQuery, userRoleFilter, userStatusFilter, prev, userSortBy);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{isBn ? "পূর্ববর্তী" : "Previous"}</span>
                    </button>
                    <span className="px-2 py-1 font-mono text-[11px] font-bold text-slate-700">
                      {usersPage} / {Math.ceil(usersTotal / usersLimit) || 1}
                    </span>
                    <button
                      type="button"
                      disabled={usersPage >= Math.ceil(usersTotal / usersLimit)}
                      onClick={() => {
                        const next = usersPage + 1;
                        setUsersPage(next);
                        fetchUsers(userSearchQuery, userRoleFilter, userStatusFilter, next, userSortBy);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isBn ? "পরবর্তী" : "Next"}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Box: Direct Identifier Manual Override */}
            <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldAlert className="w-4 h-4 text-purple-700" />
                <span>{isBn ? "সরাসরি আইডেন্টিফায়ার অ্যাকশন (ম্যানুয়াল ওভাররাইড)" : "Direct Identifier Action (Manual Override)"}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isBn
                  ? "ডিরেক্টরি ছাড়া কোনো নির্দিষ্ট ইমেইল, মোবাইল নম্বর, ডিভাইস অ্যানোনিমাস আইডি বা ইউইউআইডি দিয়ে তাত্ক্ষণিকভাবে অ্যাকাউন্ট নিয়ন্ত্রণ করুন:"
                  : "Quickly ban or unban an account by typing any target Email, Phone Number, Device Anonymous ID, or raw UUID:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "টার্গেট আইডেন্টিফায়ার (Email / Phone / Anon ID / UUID) *" : "Target Identifier (Email / Phone / Anon ID / UUID) *"}
                  </label>
                  <input
                    id="admin-ban-user-id"
                    type="text"
                    value={banUserId}
                    onChange={(e) => setBanUserId(e.target.value)}
                    placeholder="e.g. citizen@example.com or +88017... or UUID"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isBn ? "মডারেশন কারণ / রেফারেন্স *" : "Moderation Reason / Case Reference *"}
                  </label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder={isBn ? "ধানমন্ডিতে মিথ্যা রিপোর্টিং" : "Repeated false hazard reports"}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleBanUser("ban")}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>{isBn ? "স্থগিত / ব্যান করুন" : "Suspend Account"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBanUser("unban")}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isBn ? "অ্যাকাউন্ট পুনরুদ্ধার" : "Restore Account"}</span>
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
                  {(() => {
                    const rawCategories = (trends?.breakdown?.byCategory ?? {}) as Record<string, number>;
                    const aggregated = new Map<string, number>();

                    for (const [rawKey, rawCount] of Object.entries(rawCategories)) {
                      const count = Number(rawCount) || 0;
                      if (count <= 0) continue;
                      const canonicalKey = CATEGORY_ALIAS_MAP[rawKey] ?? rawKey;
                      aggregated.set(canonicalKey, (aggregated.get(canonicalKey) ?? 0) + count);
                    }

                    const entries = Array.from(aggregated.entries()).sort((a, b) => b[1] - a[1]);

                    if (entries.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          {isBn ? "বিগত ৩০ দিনে কোনো শ্রেণিবদ্ধ রিপোর্ট পাওয়া যায়নি।" : "No categorized reports recorded in the last 30 days."}
                        </p>
                      );
                    }

                    const total = trends?.totalReports || entries.reduce((sum, [, c]) => sum + c, 0) || 1;
                    const categoryLabels = translations[isBn ? "bn" : "en"].categories as Record<string, string>;

                    return entries.map(([key, count]) => {
                      const pct = Math.min(100, Math.round((count / total) * 100));
                      const label = categoryLabels[key] || key.replace(/_/g, " ");
                      const color = CATEGORY_BAR_COLORS[key] || "bg-slate-500";
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{label}</span>
                            <span className="font-mono text-slate-900 font-bold">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
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

      {/* ------------------------------------------------------------- */}
      {/* Ban / Unban User Modal Dialog */}
      {/* ------------------------------------------------------------- */}
      {banTargetUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBanTargetUser(null);
          }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    banModalAction === "ban" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {banModalAction === "ban" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {banModalAction === "ban"
                      ? isBn ? "নাগরিক অ্যাকাউন্ট স্থগিত ও ব্যান" : "Suspend Citizen Account"
                      : isBn ? "নাগরিক অ্যাকাউন্ট পুনরুদ্ধার" : "Restore Citizen Account"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {banModalAction === "ban"
                      ? isBn ? "স্থগিত নাগরিকরা কোনো নতুন রিপোর্ট বা ভোট দিতে পারবেন না" : "Suspended citizens cannot submit pins or cast votes"
                      : isBn ? "অ্যাকাউন্ট পুনরুদ্ধার করে পূর্ণ নাগরিক সুবিধা ফিরিয়ে দিন" : "Restore citizen rights to submit hazard reports"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBanTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Identity Summary Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isBn ? "নাগরিক পরিচয়:" : "Citizen Handle:"}</span>
                <span className="font-bold text-slate-900 font-mono">{banTargetUser.email || banTargetUser.anonymousId}</span>
              </div>
              {banTargetUser.phoneNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">{isBn ? "মোবাইল নম্বর:" : "Mobile:"}</span>
                  <span className="font-mono text-slate-700">{banTargetUser.phoneNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isBn ? "ইউজার আইডি (UUID):" : "User UUID:"}</span>
                <span className="font-mono text-[11px] text-slate-600">{banTargetUser.id}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                <span className="text-slate-500">{isBn ? "ট্রাস্ট স্কোর:" : "Trust Score:"}</span>
                <span className="font-bold text-purple-700">{banTargetUser.trustScore ?? 0} / 100</span>
              </div>
            </div>

            {/* Reason Presets */}
            {banModalAction === "ban" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  {isBn ? "দ্রুত কারণ নির্বাচন করুন (প্রিসেট):" : "Quick Reason Presets:"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    isBn ? "বারংবার মিথ্যা রিপোর্ট দাখিল" : "Repeated false hazard reports",
                    isBn ? "আপত্তিকর ভাষা ও অসদাচরণ" : "Abusive language / harassment",
                    isBn ? "জিপিএস স্পুফিং ও ভুয়া অবস্থান" : "GPS spoofing / fake location",
                    isBn ? "স্প্যামিং ও স্বয়ংক্রিয় বোট অ্যাক্টিভিটি" : "Automated spam / bot activity",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBanModalReason(preset)}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {banModalAction === "ban"
                  ? isBn ? "স্থগিতের সুনির্দিষ্ট কারণ (অডিট লগে সংরক্ষিত হবে) *" : "Reason for Suspension (Recorded in Audit Log) *"
                  : isBn ? "পুনরুদ্ধারের কারণ (অডিট লগে সংরক্ষিত হবে) *" : "Reason for Restoration (Recorded in Audit Log) *"}
              </label>
              <textarea
                value={banModalReason}
                onChange={(e) => setBanModalReason(e.target.value)}
                placeholder={
                  banModalAction === "ban"
                    ? isBn ? "স্থগিতের কারণ বিস্তারিত লিখুন (কমপক্ষে ৩ অক্ষর)..." : "Specify the reason for this account suspension (min 3 chars)..."
                    : isBn ? "অ্যাকাউন্ট ফিরিয়ে দেওয়ার কারণ লিখুন..." : "Specify the reason for restoring this citizen account..."
                }
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBanTargetUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={executeModalBanAction}
                disabled={isSubmittingBan || banModalReason.trim().length < 3}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  banModalAction === "ban" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isSubmittingBan ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isBn ? "প্রক্রিয়াধীন..." : "Processing..."}</span>
                  </>
                ) : banModalAction === "ban" ? (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>{isBn ? "স্থগিত নিশ্চিত করুন" : "Confirm Suspension"}</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{isBn ? "পুনরুদ্ধার নিশ্চিত করুন" : "Confirm Restoration"}</span>
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
