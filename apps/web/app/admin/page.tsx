"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import RouteTestNav from "@/components/layout/RouteTestNav";
import { useAuthStore } from "@/store/useAuthStore";
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
} from "lucide-react";

export default function AdminPage() {
  const { user, loginAdmin, logout, initAuth } = useAuthStore();
  const [adminAuthInput, setAdminAuthInput] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<"reports" | "users" | "verifications" | "logs">("reports");
  const [reports, setReports] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Action Inputs
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Load Dashboard Data once authenticated as ADMIN
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    setIsLoadingData(true);
    try {
      // 1. Fetch live reports
      const reportsData = await apiFetch<any[]>("/reports?minLat=20&maxLat=27&minLng=88&maxLng=93");
      setReports(reportsData || []);

      // 2. Fetch moderation audit logs
      const logsData = await apiFetch<{ logs: any[] }>("/admin/logs?page=1&limit=30");
      setLogs(logsData?.logs || []);

      // 3. Fetch pending KYC verifications
      const verificationsData = await apiFetch<any[]>("/admin/verifications");
      setVerifications(verificationsData || []);
    } catch (err: any) {
      console.warn("[Admin Data Fetch] Notice:", err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      await loginAdmin(adminAuthInput.trim(), adminEmail.trim() || undefined);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate administrator account.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePurgeReport = async (reportId: string) => {
    const reason = prompt("Enter moderation reason for purging this report (recorded in immutable audit log):");
    if (!reason || reason.trim().length < 3) return;

    try {
      await apiFetch(`/admin/reports/${reportId}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      alert("Report successfully purged and broadcasted to active map clients.");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to purge report.");
    }
  };

  const handleBanUser = async (action: "ban" | "unban") => {
    if (!banUserId.trim()) {
      alert("Please provide target user ID.");
      return;
    }
    const reason = banReason.trim() || (action === "ban" ? "Abusive spam reports" : "Restored account");

    try {
      await apiFetch(`/admin/users/${banUserId.trim()}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      alert(`User ${action === "ban" ? "suspended" : "restored"} successfully.`);
      setBanUserId("");
      setBanReason("");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} user.`);
    }
  };

  const handleTriggerNewsCrawl = async () => {
    setCrawlStatus("Crawling Bangladesh news feeds (Google News & Daily Star)...");
    try {
      const res = await apiFetch<any>("/admin/news/crawl", { method: "POST" });
      setCrawlStatus(
        `✅ Crawl finished: ${res?.totalIngested ?? 0} incidents added, ${res?.totalVerifiedMatches ?? 0} citizen reports cross-verified!`
      );
      fetchAdminData();
    } catch (err: any) {
      setCrawlStatus(`❌ Crawl error: ${err.message}`);
    }
  };

  // If not authenticated as Admin, show Admin Login Gateway
  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <RouteTestNav />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-purple-700 flex items-center justify-center text-white shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Administrator Console</h2>
              <p className="text-xs text-slate-500">Bangladesh Public Safety Map Moderation</p>
            </div>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-900 mb-5">
            🛡️ Access to this interface is restricted to authorized moderators and system administrators.
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Device / Anonymous ID *
              </label>
              <input
                type="text"
                required
                value={adminAuthInput}
                onChange={(e) => setAdminAuthInput(e.target.value)}
                placeholder="admin-master-device-id"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Email (Optional / Verification)
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@safety.bd"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {isAuthenticating ? "Verifying Credentials..." : "Authenticate as Administrator"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Safety Map</span>
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      <RouteTestNav />
      {/* Top Admin Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-purple-700 flex items-center justify-center text-white">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Public Safety Moderation Console</h1>
            <p className="text-xs text-purple-300">
              Authenticated Admin ID: <span className="font-mono">{user.id.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchAdminData}
            disabled={isLoadingData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
            <span>Refresh Data</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>View Live Map</span>
          </Link>

          <button
            onClick={logout}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* Quick Action Bar: Manual News Crawler Trigger */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Automated News Portal Ingestion (RSS + OSM)</h3>
              <p className="text-xs text-slate-500">
                Crawl Google News BD & The Daily Star to auto-ingest incidents and cross-verify citizen reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {crawlStatus && <span className="text-xs text-slate-600 font-medium">{crawlStatus}</span>}
            <button
              onClick={handleTriggerNewsCrawl}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
            >
              Trigger Manual Crawl Now
            </button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "reports"
                ? "border-purple-700 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Incident Reports ({reports.length})
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-purple-700 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            User Ban & Suspension
          </button>

          <button
            onClick={() => setActiveTab("verifications")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "verifications"
                ? "border-purple-700 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Pending Verifications ({verifications.length})
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "logs"
                ? "border-purple-700 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Immutable Audit Trail ({logs.length})
          </button>
        </div>

        {/* TAB 1: Report Moderation */}
        {activeTab === "reports" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Map Incidents (Live PostGIS Feed)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Votes</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No active reports found.
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold">{r.category}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.severity === "HIGH"
                                ? "bg-rose-100 text-rose-800"
                                : r.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate" title={r.description}>
                          {r.description || "—"}
                        </td>
                        <td className="p-3">
                          👍 {r.upvotes} / 👎 {r.downvotes}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handlePurgeReport(r.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold inline-flex items-center gap-1"
                            title="Purge this false report from the map"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Purge</span>
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

        {/* TAB 2: User Ban & Suspension */}
        {activeTab === "users" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 max-w-xl">
            <h2 className="text-sm font-bold text-slate-900 mb-2">Account Suspension Defense</h2>
            <p className="text-xs text-slate-500 mb-4">
              Banned users are permanently blocked from submitting reports, voting, or adding updates. Every ban action is logged in the immutable moderation audit trail.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target User UUID *</label>
                <input
                  type="text"
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="e.g. 1960138d-8dd4-4a06-b403-19a76966fc64"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Case Reference *</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Repeated false mugging reports in Dhanmondi"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleBanUser("ban")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-sm"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Suspend / Ban User</span>
                </button>

                <button
                  onClick={() => handleBanUser("unban")}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-sm"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Unban Account</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Verifications */}
        {activeTab === "verifications" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pending KYC & Citizen Verification Requests
              </h2>
            </div>
            <div className="p-6 text-center text-xs text-slate-500">
              {verifications.length === 0 ? "No pending verification requests." : JSON.stringify(verifications)}
            </div>
          </div>
        )}

        {/* TAB 4: Audit Logs */}
        {activeTab === "logs" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-700" />
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Immutable Moderation Log (Compliance Trail)
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">Auto-recorded for legal accountability</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Admin ID</th>
                    <th className="p-3">Target ID</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No moderation actions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{log.adminId.slice(0, 8)}...</td>
                        <td className="p-3 font-mono text-slate-600">
                          {log.targetReportId
                            ? `Report: ${log.targetReportId.slice(0, 8)}...`
                            : log.targetUserId
                            ? `User: ${log.targetUserId.slice(0, 8)}...`
                            : "—"}
                        </td>
                        <td className="p-3 text-slate-800 font-medium">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
