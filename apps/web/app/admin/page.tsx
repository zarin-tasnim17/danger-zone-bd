"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  CheckCircle2,
  Keyboard,
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

  const fetchAdminData = useCallback(async () => {
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
  }, []);

  // Load Dashboard Data once authenticated as ADMIN
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  const handlePurgeReport = useCallback(async (reportId: string) => {
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
  }, [fetchAdminData]);

  const handleApproveVerification = useCallback(async (verifId: string) => {
    if (!confirm("Approve this citizen's KYC verification and promote role to VERIFIED_RESPONDER?")) return;
    try {
      await apiFetch(`/admin/verifications/${verifId}/approve`, {
        method: "POST",
      });
      alert("Verification approved successfully!");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to approve verification.");
    }
  }, [fetchAdminData]);

  const handleRejectVerification = useCallback(async (verifId: string) => {
    const reason = prompt("Enter reason for rejecting this verification request:");
    if (!reason || reason.trim().length < 3) return;
    try {
      await apiFetch(`/admin/verifications/${verifId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      alert("Verification rejected and audit log recorded.");
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to reject verification.");
    }
  }, [fetchAdminData]);

  // Phase 12 Keyboard Shortcuts: [P], [B], [A], [R]
  useEffect(() => {
    if (user?.role !== "ADMIN") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing into an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") {
        return;
      }

      const key = e.key.toUpperCase();

      if (key === "P") {
        // [P] - Purge top report
        if (reports.length > 0) {
          e.preventDefault();
          handlePurgeReport(reports[0].id);
        } else {
          alert("No active reports available to purge.");
        }
      } else if (key === "B") {
        // [B] - Ban User
        e.preventDefault();
        setActiveTab("users");
        const input = document.getElementById("admin-ban-user-id");
        if (input) input.focus();
      } else if (key === "A") {
        // [A] - Approve first pending verification
        if (verifications.length > 0) {
          e.preventDefault();
          handleApproveVerification(verifications[0].id);
        } else {
          alert("No pending verifications to approve.");
        }
      } else if (key === "R") {
        // [R] - Reject first pending verification
        if (verifications.length > 0) {
          e.preventDefault();
          handleRejectVerification(verifications[0].id);
        } else {
          alert("No pending verifications to reject.");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, reports, verifications, handlePurgeReport, handleApproveVerification, handleRejectVerification]);

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
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
        <RouteTestNav />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-purple-700 flex items-center justify-center text-white shrink-0 shadow-lg">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Administrator Console</h2>
                <p className="text-xs text-slate-400">Bangladesh Public Safety Map Moderation</p>
              </div>
            </div>

            <div className="p-3 bg-purple-950/50 border border-purple-800/60 rounded-xl text-xs text-purple-300 mb-5">
              🛡️ Access to this interface is restricted to authorized moderators and system administrators.
            </div>

            {authError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Device / Anonymous ID *
                </label>
                <input
                  type="text"
                  required
                  value={adminAuthInput}
                  onChange={(e) => setAdminAuthInput(e.target.value)}
                  placeholder="admin-master-device-id"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Email (Optional / Verification)
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@safety.bd"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50"
              >
                {isAuthenticating ? "Verifying Credentials..." : "Authenticate as Administrator"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
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
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <RouteTestNav />
      {/* Top Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">Public Safety Moderation Console</h1>
            <p className="text-xs text-purple-400">
              Authenticated Admin ID: <span className="font-mono">{user.id.slice(0, 8)}...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchAdminData}
            disabled={isLoadingData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Live Map</span>
          </Link>

          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* Tactical Cheatsheet & News Crawler Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Tactical Keyboard Shortcuts HUD */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center gap-3">
            <div className="p-2.5 bg-purple-950/60 border border-purple-800/60 text-purple-400 rounded-xl shrink-0">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                Tactical Admin Shortcuts
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300">
                  <strong className="text-white">[P]</strong> Purge Top
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300">
                  <strong className="text-white">[B]</strong> Ban User
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300">
                  <strong className="text-white">[A]</strong> Approve KYC
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-rose-300">
                  <strong className="text-white">[R]</strong> Reject KYC
                </span>
              </div>
            </div>
          </div>

          {/* Automated News Portal Ingestion */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-950 text-sky-400 border border-sky-800/60 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Automated News Portal Ingestion (RSS + OSM)</h3>
                <p className="text-xs text-slate-400">
                  Crawl Google News BD & The Daily Star to auto-ingest incidents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {crawlStatus && <span className="text-xs text-slate-300 font-medium">{crawlStatus}</span>}
              <button
                onClick={handleTriggerNewsCrawl}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
              >
                Trigger Crawl Now
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "reports"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Active Incident Reports ({reports.length})
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            User Ban & Suspension
          </button>

          <button
            onClick={() => setActiveTab("verifications")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "verifications"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Pending Verifications ({verifications.length})
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "logs"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Immutable Audit Trail ({logs.length})
          </button>
        </div>

        {/* TAB 1: Report Moderation */}
        {activeTab === "reports" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Active Map Incidents (Live PostGIS Feed)
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">Press [P] to purge top report</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Votes</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No active reports found.
                      </td>
                    </tr>
                  ) : (
                    reports.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-white">
                          {idx === 0 && (
                            <span className="mr-1.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-950 border border-purple-800 text-purple-300 font-mono">
                              [P] Target
                            </span>
                          )}
                          {r.category}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.severity === "HIGH"
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : r.severity === "MEDIUM"
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-800"
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
                        <td className="p-3 text-slate-400 font-mono">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handlePurgeReport(r.id)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
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
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl p-6 max-w-xl">
            <h2 className="text-sm font-bold text-white mb-2">Account Suspension Defense</h2>
            <p className="text-xs text-slate-400 mb-4">
              Banned users are permanently blocked from submitting reports, voting, or adding updates. Every ban action is logged in the immutable moderation audit trail.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target User UUID *</label>
                <input
                  id="admin-ban-user-id"
                  type="text"
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="e.g. 1960138d-8dd4-4a06-b403-19a76966fc64"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Case Reference *</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Repeated false mugging reports in Dhanmondi"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleBanUser("ban")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Suspend / Ban User</span>
                </button>

                <button
                  onClick={() => handleBanUser("unban")}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
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
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pending KYC & Citizen Verification Requests
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">Shortcuts: [A] Approve Top • [R] Reject Top</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Details / Doc</th>
                    <th className="p-3">Submitted</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {verifications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        No pending citizen verification requests.
                      </td>
                    </tr>
                  ) : (
                    verifications.map((v, idx) => (
                      <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-slate-300">
                          {idx === 0 && (
                            <span className="mr-1.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-950 border border-purple-800 text-purple-300 font-mono">
                              [A/R] Target
                            </span>
                          )}
                          {v.userId.slice(0, 8)}...
                        </td>
                        <td className="p-3 font-semibold text-white">{v.type || "NID / Phone"}</td>
                        <td className="p-3 font-mono text-slate-400 truncate max-w-xs">{v.documentUrl || v.phoneNumber || "—"}</td>
                        <td className="p-3 text-slate-500 font-mono">{new Date(v.createdAt).toLocaleString()}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleApproveVerification(v.id)}
                            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve [A]</span>
                          </button>
                          <button
                            onClick={() => handleRejectVerification(v.id)}
                            className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Reject [R]</span>
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

        {/* TAB 4: Audit Logs */}
        {activeTab === "logs" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Immutable Moderation Log (Compliance Trail)
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">Auto-recorded for legal accountability</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Admin ID</th>
                    <th className="p-3">Target ID</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        No moderation actions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 border border-purple-800 text-purple-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{log.adminId.slice(0, 8)}...</td>
                        <td className="p-3 font-mono text-slate-400">
                          {log.targetReportId
                            ? `Report: ${log.targetReportId.slice(0, 8)}...`
                            : log.targetUserId
                            ? `User: ${log.targetUserId.slice(0, 8)}...`
                            : "—"}
                        </td>
                        <td className="p-3 text-slate-200 font-medium">{log.reason}</td>
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
