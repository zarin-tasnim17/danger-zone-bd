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
import AdminVerificationsSection from "@/components/admin/AdminVerificationsSection";
import AdminUsersSection from "@/components/admin/AdminUsersSection";
import AdminLogsSection from "@/components/admin/AdminLogsSection";
import AdminPurgeModal from "@/components/admin/AdminPurgeModal";
import AdminRejectModal from "@/components/admin/AdminRejectModal";
import AdminShortcutsModal from "@/components/admin/AdminShortcutsModal";
import AdminBanModal from "@/components/admin/AdminBanModal";
import {
  AdminTab,
  AdminReport,
  AdminVerification,
  AdminLog,
  AdminTrends,
  AdminUser,
} from "@/components/admin/types";

export default function AdminPage() {
  const { user, logout, initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Dashboard Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Remote Data State
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [trends, setTrends] = useState<AdminTrends | null>(null);

  // Loading & Error States
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // News Crawler State
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);

  // Modal Dialog States
  const [purgeTarget, setPurgeTarget] = useState<AdminReport | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminVerification | null>(null);
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
      // 1. Fetch live reports with populated author metadata
      const adminReportsData = await apiFetch<{ reports: AdminReport[] }>(
        "/admin/reports?limit=50"
      ).catch(() => null);

      if (adminReportsData && Array.isArray(adminReportsData.reports)) {
        setReports(adminReportsData.reports);
      } else {
        const fallbackReports = await apiFetch<AdminReport[]>(
          "/reports?minLat=20&maxLat=27&minLng=88&maxLng=93"
        );
        setReports(fallbackReports || []);
      }

      // 2. Fetch moderation audit logs
      const logsData = await apiFetch<{ logs: AdminLog[] }>("/admin/logs?page=1&limit=30");
      setLogs(logsData?.logs || []);

      // 3. Fetch pending KYC verifications
      const verificationsData = await apiFetch<AdminVerification[]>("/admin/verifications");
      setVerifications(verificationsData || []);

      // 4. Fetch 30-day hazard analytics and trends
      const trendsData = await apiFetch<AdminTrends>("/admin/analytics/trends");
      setTrends(trendsData || null);
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
  }, [user, fetchAdminData]);

  // Purge Report Execution
  const executePurge = async (reason: string) => {
    if (!purgeTarget) return;
    try {
      await apiFetch(`/admin/reports/${purgeTarget.id}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        isBn ? "রিপোর্ট সফলভাবে অপসারণ করা হয়েছে।" : "Incident report purged successfully.",
        "success"
      );
      setPurgeTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to purge report.", "error");
    }
  };

  // Reject Verification Execution
  const executeReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await apiFetch(`/admin/verifications/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        isBn ? "কেওয়াইসি আবেদন প্রত্যাখ্যাত হয়েছে।" : "KYC application rejected.",
        "success"
      );
      setRejectTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to reject verification.", "error");
    }
  };

  // Approve Verification Execution
  const handleApproveVerification = useCallback(
    async (verifId: string) => {
      try {
        await apiFetch(`/admin/verifications/${verifId}/approve`, {
          method: "POST",
        });
        showToast(
          isBn ? "কেওয়াইসি সফলভাবে অনুমোদিত হয়েছে।" : "KYC verified and responder activated.",
          "success"
        );
        fetchAdminData();
      } catch (err: any) {
        showToast(err.message || "Failed to approve verification.", "error");
      }
    },
    [fetchAdminData, isBn]
  );

  // Ban / Unban User Execution (Multi-Identifier Supported)
  const handleBanUser = async (identifier: string, reason: string, action: "ban" | "unban") => {
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(identifier)}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        action === "ban"
          ? isBn
            ? "ইউজার সফলভাবে স্থগিত / নিষিদ্ধ করা হয়েছে।"
            : "User suspended successfully."
          : isBn
          ? "ইউজার অ্যাকাউন্ট সফলভাবে পুনরুদ্ধার করা হয়েছে।"
          : "User restored successfully.",
        "success"
      );
      setBanModalTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} user.`, "error");
      throw err;
    }
  };

  // Trigger News Crawler
  const handleTriggerNewsCrawl = async () => {
    setIsCrawling(true);
    setCrawlStatus(
      isBn
        ? "বাংলাদেশি সংবাদমাধ্যম (গুগল নিউজ ও দ্য ডেইলি স্টার) ক্রল করা হচ্ছে..."
        : "Crawling Bangladesh news feeds (Google News & Daily Star)..."
    );
    try {
      const res = await apiFetch<{
        message?: string;
        createdIncidents?: number;
        scannedFeeds?: number;
      }>("/cron/news-crawl", {
        method: "POST",
      });
      const count = res?.createdIncidents ?? 0;
      const feeds = res?.scannedFeeds ?? 22;
      const successMsg = isBn
        ? `নিউজ ক্রল সম্পন্ন! ${feeds}টি ফিড থেকে ${count}টি নতুন বিপদচিহ্ন যোগ হয়েছে।`
        : `News crawl finished! Added ${count} incidents from ${feeds} feeds.`;
      setCrawlStatus(successMsg);
      showToast(successMsg, "success");
      fetchAdminData();
    } catch (err: any) {
      const failMsg =
        err?.message ||
        (isBn ? "সংবাদ ক্রল প্রক্রিয়া ব্যর্থ হয়েছে।" : "News crawler execution failed.");
      setCrawlStatus(failMsg);
      showToast(failMsg, "error");
    } finally {
      setIsCrawling(false);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (user?.role !== "ADMIN") return;

      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toUpperCase();

      if (e.key === "Escape") {
        setPurgeTarget(null);
        setRejectTarget(null);
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
      } else if (key === "A") {
        if (verifications.length > 0) {
          e.preventDefault();
          handleApproveVerification(verifications[0].id);
        }
      } else if (key === "R") {
        if (verifications.length > 0) {
          e.preventDefault();
          setActiveTab("verifications");
          setRejectTarget(verifications[0]);
        }
      } else if (e.key === "?" || key === "K") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, reports, verifications, handleApproveVerification]);

  // -------------------------------------------------------------
  // Unauthenticated Admin Gate (Clean Minimal Portal)
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
  // Authenticated Admin Operations Console
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
          dataError={dataError}
          onDismissCrawlStatus={() => setCrawlStatus(null)}
        />

        {/* Tab Navigation Bar */}
        <AdminTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          reportsCount={reports.length}
          verificationsCount={verifications.length}
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

          {activeTab === "verifications" && (
            <AdminVerificationsSection
              verifications={verifications}
              isBn={isBn}
              onApprove={handleApproveVerification}
              onSelectReject={setRejectTarget}
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

      {rejectTarget && (
        <AdminRejectModal
          verification={rejectTarget}
          isBn={isBn}
          onClose={() => setRejectTarget(null)}
          onConfirm={executeReject}
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
