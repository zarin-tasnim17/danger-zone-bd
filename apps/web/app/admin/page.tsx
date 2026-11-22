"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import AdminLoginGateway from "@/components/auth/AdminLoginGateway";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { apiFetch } from "@/lib/api";
import { showToast } from "@/store/useToastStore";

// Modular Admin Components
import AdminHeader from "@/components/admin/AdminHeader";
import AdminTabsNav from "@/components/admin/AdminTabsNav";
import AdminAnalyticsSection from "@/components/admin/AdminAnalyticsSection";
import AdminReportsSection from "@/components/admin/AdminReportsSection";
import AdminUsersSection from "@/components/admin/AdminUsersSection";
import AdminLogsSection from "@/components/admin/AdminLogsSection";
import AdminPurgeModal from "@/components/admin/AdminPurgeModal";
import AdminShortcutsModal from "@/components/admin/AdminShortcutsModal";
import AdminBanModal from "@/components/admin/AdminBanModal";
import AdminLoadingScreen from "@/components/admin/AdminLoadingScreen";
import { RefreshCw } from "lucide-react";
import {
  AdminTab,
  AdminReport,
  AdminLog,
  AdminTrends,
  AdminUser,
} from "@/components/admin/types";

export default function AdminPage() {
  const { user, logout, initAuth, isLoading: isLoadingAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Dashboard Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Remote Data State
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [trends, setTrends] = useState<AdminTrends | null>(null);

  // Loading & Error States
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // News Crawler State
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [crawlError, setCrawlError] = useState<boolean>(false);
  const [isCrawling, setIsCrawling] = useState(false);

  // Modal Dialog States
  const [purgeTarget, setPurgeTarget] = useState<AdminReport | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Ban / Moderation Modal State
  const [banModalTarget, setBanModalTarget] = useState<{
    id: string;
    email?: string | null;
    anonymousId?: string;
    role?: string;
    trustScore?: number;
    isBanned?: boolean;
  } | null>(null);
  const [banModalAction, setBanModalAction] = useState<"ban" | "unban">("ban");

  // Initialize Auth
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Fetch Trends
  const fetchTrends = useCallback(async () => {
    setIsLoadingTrends(true);
    try {
      const data = await apiFetch<AdminTrends>("/admin/analytics/trends");
      setTrends(data);
    } catch (err: any) {
      console.warn("[Admin Trends Fetch] Notice:", err.message);
    } finally {
      setIsLoadingTrends(false);
    }
  }, []);

  // Fetch Full Admin Dashboard Dataset
  const fetchAdminData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      // Run independent admin queries concurrently for instant responsiveness
      const reportsPromise = (async () => {
        try {
          const adminReportsData = await apiFetch<{ reports: AdminReport[] }>(
            "/admin/reports?limit=50"
          );
          if (adminReportsData && Array.isArray(adminReportsData.reports)) {
            return adminReportsData.reports;
          }
        } catch {
          // Fallback to public reports query if admin reports endpoint has transient issue
        }
        try {
          const fallbackReports = await apiFetch<AdminReport[]>(
            "/reports?minLat=20&maxLat=27&minLng=88&maxLng=93"
          );
          return fallbackReports || [];
        } catch {
          return [];
        }
      })();

      const logsPromise = apiFetch<{ logs: AdminLog[] }>("/admin/logs?page=1&limit=30")
        .then((res) => res?.logs || [])
        .catch(() => [] as AdminLog[]);

      const trendsPromise = apiFetch<AdminTrends>("/admin/analytics/trends")
        .catch(() => null);

      const [reportsData, logsData, trendsData] = await Promise.all([
        reportsPromise,
        logsPromise,
        trendsPromise,
      ]);

      setReports(reportsData);
      setLogs(logsData);
      setTrends(trendsData);
      setHasLoadedOnce(true);
    } catch (err: any) {
      const msg =
        err?.message ||
        (isBn
          ? "অ্যাডমিন ড্যাশবোর্ড ডেটা লোড করতে ব্যর্থ হয়েছে।"
          : "Failed to load admin dashboard data.");
      setDataError(msg);
      showToast(msg, "error");
    } finally {
      setIsLoadingData(false);
    }
  }, [isBn]);

  // Load Dashboard Data once authenticated as ADMIN
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchAdminData();
    }
  }, [user?.role, fetchAdminData]);

  // News Crawler Dispatch
  const handleTriggerNewsCrawl = async () => {
    setIsCrawling(true);
    setCrawlError(false);
    setCrawlStatus(
      isBn
        ? "৬৪ জেলার জাতীয় ও আঞ্চলিক সংবাদপত্র থেকে তথ্য সংগ্রহ শুরু হয়েছে..."
        : "Crawling national and regional feeds across 64 districts..."
    );
    try {
      const res = await apiFetch<any>("/admin/news/crawl", {
        method: "POST",
      });
      const newArticles =
        res.totalIngested ?? res.crawledCount ?? res.articleCount ?? res.count ?? 0;
      const verifiedIncidents =
        res.totalVerifiedMatches ?? res.verifiedIncidentCount ?? res.incidentsCreated ?? 0;
      const feedsChecked = res.feedsChecked ?? res.feedsCount ?? 0;
      const statusMsg = isBn
        ? `নিউজ ক্রলিং সম্পন্ন! ${feedsChecked > 0 ? `${feedsChecked}টি ফিড থেকে ` : ""}${newArticles}টি সংবাদ এবং ${verifiedIncidents}টি নতুন বিপদ রিপোর্ট প্রসেস হয়েছে।`
        : `News crawl completed! Processed ${newArticles} articles, identified ${verifiedIncidents} active incidents${feedsChecked > 0 ? ` across ${feedsChecked} feeds` : ""}.`;
      setCrawlStatus(statusMsg);
      setCrawlError(false);
      showToast(statusMsg, "success");
      fetchAdminData();
    } catch (err: any) {
      const errorMsg =
        err.message || (isBn ? "নিউজ ক্রল করতে ব্যর্থ হয়েছে।" : "Failed to run news crawler.");
      setCrawlStatus(errorMsg);
      setCrawlError(true);
      showToast(errorMsg, "error");
    } finally {
      setIsCrawling(false);
    }
  };

  // Purge Report Execution
  const executePurge = async (reason: string) => {
    if (!purgeTarget) return;
    try {
      await apiFetch(`/admin/reports/${purgeTarget.id}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        isBn ? "রিপোর্টটি সফলভাবে ডাটাবেজ থেকে মোছা হয়েছে।" : "Report purged successfully.",
        "success"
      );
      setPurgeTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to purge report.", "error");
    }
  };

  // Ban / Unban User Execution (Multi-Identifier Supported)
  const handleBanUser = async (identifier: string, reason: string, action: "ban" | "unban") => {
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(identifier)}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        action === "ban"
          ? isBn ? "ইউজারকে সফলভাবে নিষিদ্ধ (Ban) করা হয়েছে।" : "User has been banned."
          : isBn ? "ইউজারের নিষেধাজ্ঞা প্রত্যাহার করা হয়েছে।" : "User unbanned successfully.",
        "success"
      );
      setBanModalTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} user.`, "error");
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (user?.role !== "ADMIN") return;

      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toUpperCase();

      if (e.key === "Escape") {
        setPurgeTarget(null);
        setBanModalTarget(null);
        setShortcutsOpen(false);
      } else if (key === "P") {
        if (reports.length > 0) {
          e.preventDefault();
          setActiveTab("reports");
          setPurgeTarget(reports[0]);
        }
      } else if (key === "B") {
        e.preventDefault();
        setActiveTab("users");
      } else if (e.key === "?" || key === "K") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, reports]);

  // -------------------------------------------------------------
  // 1. Initial Authentication Gate (Prevents Gateway flash during session hydration)
  // -------------------------------------------------------------
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-500 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col items-center justify-center">
          <AdminLoadingScreen
            isBn={isBn}
            message={isBn ? "প্রশাসক সেশন নিশ্চিত করা হচ্ছে..." : "Verifying Administrator Session..."}
            subMessage={
              isBn
                ? "এনক্রিপ্টেড প্রশাসনিক পরিচয় ও অনুমতি যাচাইকরণ চলছে..."
                : "Validating cryptographic credentials, device identity, and administrative permissions..."
            }
          />
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. Unauthenticated Admin Gate (Clean Minimal Portal)
  // -------------------------------------------------------------
  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-500 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col items-center justify-center">
          <AdminLoginGateway onSuccess={() => fetchAdminData()} />
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. Authenticated Admin Operations Console
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-500 selection:text-white">
      {/* Global Navbar */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* SaaS Admin Header */}
        <AdminHeader
          user={user}
          isBn={isBn}
          isLoadingData={isLoadingData}
          onRefresh={fetchAdminData}
          onLogout={logout}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onTriggerNewsCrawl={handleTriggerNewsCrawl}
          isCrawling={isCrawling}
          crawlStatus={crawlStatus}
          isCrawlError={crawlError}
          dataError={dataError}
          onDismissCrawlStatus={() => {
            setCrawlStatus(null);
            setCrawlError(false);
          }}
        />

        {/* Active Refresh Live Status Banner */}
        {isLoadingData && hasLoadedOnce && (
          <div className="bg-red-50/90 border border-red-200/90 text-red-800 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
              <span>
                {isBn
                  ? "অ্যাডমিন কনসোল রিফ্রেশ করা হচ্ছে... সর্বশেষ লাইভ তথ্য ফেচ হচ্ছে।"
                  : "Refreshing Security Console... Fetching latest live incident feeds and audit logs."}
              </span>
            </div>
            <span className="text-[10px] font-mono text-red-600 font-bold uppercase tracking-wider hidden sm:inline">
              {isBn ? "প্রক্রিয়াধীন" : "In Progress"}
            </span>
          </div>
        )}

        {/* Tab Navigation Bar */}
        <AdminTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          reportsCount={reports.length}
          logsCount={logs.length}
          isBn={isBn}
        />

        {/* Tab Content Panes */}
        <div className="transition-all duration-200">
          {activeTab === "overview" && (
            <AdminAnalyticsSection
              trends={trends}
              isBn={isBn}
              isLoadingTrends={isLoadingTrends}
              onRefreshTrends={fetchTrends}
            />
          )}

          {activeTab === "reports" && (
            <AdminReportsSection
              reports={reports}
              isBn={isBn}
              onSelectPurge={setPurgeTarget}
              onSelectBanUser={(u, action) => {
                setBanModalTarget(u);
                setBanModalAction(action);
              }}
            />
          )}

          {activeTab === "users" && (
            <AdminUsersSection
              logs={logs}
              isBn={isBn}
              onSelectBanUser={(u, action) => {
                setBanModalTarget(u);
                setBanModalAction(action);
              }}
              onDirectBanIdentifier={handleBanUser}
            />
          )}

          {activeTab === "logs" && (
            <AdminLogsSection
              logs={logs}
              isBn={isBn}
            />
          )}
        </div>
      </main>

      {/* Confirmation & Action Modals */}
      {purgeTarget && (
        <AdminPurgeModal
          report={purgeTarget}
          isBn={isBn}
          onClose={() => setPurgeTarget(null)}
          onConfirm={executePurge}
        />
      )}

      {banModalTarget && (
        <AdminBanModal
          user={banModalTarget}
          action={banModalAction}
          isBn={isBn}
          onClose={() => setBanModalTarget(null)}
          onConfirm={async (reason) => {
            await handleBanUser(banModalTarget.id, reason, banModalAction);
          }}
        />
      )}

      {shortcutsOpen && (
        <AdminShortcutsModal
          isBn={isBn}
          onClose={() => setShortcutsOpen(false)}
        />
      )}
    </div>
  );
}
