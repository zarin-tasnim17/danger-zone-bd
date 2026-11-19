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
import {
  AdminTab,
  AdminReport,
  AdminVerification,
  AdminLog,
  AdminTrends,
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
      // 1. Fetch live reports
      const reportsData = await apiFetch<AdminReport[]>(
        "/reports?minLat=20&maxLat=27&minLng=88&maxLng=93"
      );
      setReports(reportsData || []);

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
      throw err;
    }
  };

  // Reject KYC Verification Execution
  const executeReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await apiFetch(`/admin/verifications/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      showToast(
        isBn
          ? "কেওয়াইসি ভেরিফিকেশন সফলভাবে প্রত্যাখ্যান করা হয়েছে।"
          : "Verification rejected successfully.",
        "success"
      );
      setRejectTarget(null);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to reject verification.", "error");
      throw err;
    }
  };

  // Approve KYC Verification Execution
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

  // Ban / Unban User Execution
  const handleBanUser = async (userId: string, reason: string, action: "ban" | "unban") => {
    try {
      await apiFetch(`/admin/users/${userId}/${action}`, {
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

  // Keyboard Shortcuts: [P], [B], [A], [R], [Esc], [?]
  useEffect(() => {
    if (user?.role !== "ADMIN") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      const key = e.key.toUpperCase();

      if (e.key === "Escape") {
        setPurgeTarget(null);
        setRejectTarget(null);
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
        setTimeout(() => {
          const input = document.getElementById("admin-ban-user-id");
          if (input) input.focus();
        }, 50);
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
              onBanUser={handleBanUser}
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

      {shortcutsOpen && (
        <AdminShortcutsModal
          isBn={isBn}
          onClose={() => setShortcutsOpen(false)}
        />
      )}
    </div>
  );
}
