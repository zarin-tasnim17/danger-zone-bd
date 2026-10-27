"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket } from "@/lib/socket";
import {
  ArrowLeft,
  Clock,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  AlertTriangle,
  Send,
  CheckCircle2,
  Trash2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";

interface ReportUpdate {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: {
    role: string;
    trustScore: number;
  };
}

interface ReportDetails {
  id: string;
  userId: string;
  category: "MUGGING" | "THEFT" | "UNLIT_ROAD" | "EXTORTION" | "DRUG_ACTIVITY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  latitude: number;
  longitude: number;
  description?: string | null;
  status: "ACTIVE" | "RESOLVED" | "PURGED" | "EXPIRED";
  upvotes: number;
  downvotes: number;
  expiresAt: string;
  createdAt: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  updates?: ReportUpdate[];
  media?: Array<{
    id: string;
    blurredUrl?: string;
    originalUrl?: string;
    isBlurred: boolean;
  }>;
}

export default function ReportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  const user = useAuthStore((state) => state.user);
  const initAuth = useAuthStore((state) => state.initAuth);

  const [report, setReport] = useState<ReportDetails | null>(null);
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const loadData = async () => {
    if (!reportId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [repData, upData] = await Promise.all([
        apiFetch<ReportDetails>(`/reports/${reportId}`),
        apiFetch<ReportUpdate[]>(`/reports/${reportId}/updates`).catch(() => []),
      ]);
      setReport(repData);
      setUpdates(upData || []);
    } catch (err: any) {
      setError(err.message || "Failed to load incident details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Socket.IO real-time listener for context updates and votes
    const socket = getSocket();
    if (socket) {
      const handleNewUpdate = (payload: { reportId: string; update: ReportUpdate }) => {
        if (payload.reportId === reportId) {
          setUpdates((prev) => [payload.update, ...prev]);
        }
      };

      const handleVote = (payload: { reportId: string; upvotes: number; downvotes: number }) => {
        if (payload.reportId === reportId) {
          setReport((prev) => (prev ? { ...prev, upvotes: payload.upvotes, downvotes: payload.downvotes } : null));
        }
      };

      socket.on("NEW_REPORT_UPDATE", handleNewUpdate);
      socket.on("REPORT_VOTED", handleVote);

      return () => {
        socket.off("NEW_REPORT_UPDATE", handleNewUpdate);
        socket.off("REPORT_VOTED", handleVote);
      };
    }
  }, [reportId]);

  const handleVote = async (voteType: 1 | -1) => {
    try {
      const updated = await apiFetch<any>(`/reports/${reportId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });
      setReport((prev) => (prev ? { ...prev, upvotes: updated.upvotes, downvotes: updated.downvotes } : null));
    } catch (err: any) {
      alert(`Vote error: ${err.message}`);
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpdateContent.trim() || newUpdateContent.length < 2) {
      alert("Update must be between 2 and 500 characters");
      return;
    }

    setIsSubmittingUpdate(true);
    try {
      const created = await apiFetch<ReportUpdate>(`/reports/${reportId}/updates`, {
        method: "POST",
        body: JSON.stringify({ content: newUpdateContent.trim() }),
      });
      setUpdates((prev) => [created, ...prev]);
      setNewUpdateContent("");
    } catch (err: any) {
      alert(`Failed to post update: ${err.message}`);
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleResolve = async () => {
    if (!confirm("Are you sure you want to mark this incident as RESOLVED?")) return;
    setIsResolving(true);
    try {
      const updated = await apiFetch<ReportDetails>(`/reports/${reportId}/resolve`, {
        method: "PATCH",
      });
      setReport(updated);
      alert("Incident marked as RESOLVED");
    } catch (err: any) {
      alert(`Failed to resolve incident: ${err.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  const handlePurge = async () => {
    const reason = prompt("Enter moderation reason to PURGE this report:");
    if (!reason || reason.trim().length < 3) return;

    setIsPurging(true);
    try {
      await apiFetch(`/admin/reports/${reportId}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      alert("Report successfully purged by administrator.");
      router.push("/feed");
    } catch (err: any) {
      alert(`Failed to purge report: ${err.message}`);
    } finally {
      setIsPurging(false);
    }
  };

  const isAuthor = user && report && user.id === report.userId;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Live Feed</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Loading incident record...</p>
          </div>
        ) : error || !report ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center text-rose-700">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <h2 className="text-base font-bold">Incident Not Found</h2>
            <p className="text-xs text-rose-600 mt-1">{error || "Could not retrieve report data."}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Incident Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider ${
                      report.severity === "HIGH"
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : report.severity === "MEDIUM"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {report.severity} SEVERITY
                  </span>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider ${
                      report.status === "ACTIVE"
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : report.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    STATUS: {report.status}
                  </span>
                </div>

                {/* Moderation Actions */}
                <div className="flex items-center gap-2">
                  {(isAuthor || isAdmin) && report.status === "ACTIVE" && (
                    <button
                      onClick={handleResolve}
                      disabled={isResolving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isResolving ? "Resolving..." : "Mark as Resolved"}</span>
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={handlePurge}
                      disabled={isPurging}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md shadow-sm transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isPurging ? "Purging..." : "Admin Purge"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {report.category.replace("_", " ")}
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">
                {report.description || "No detailed description was submitted with this hazard pin."}
              </p>

              {/* Verified Press Link */}
              {report.sourceUrl && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Cross-Verified against news portal: <strong>{report.sourceName || "Press Outlets"}</strong>
                    </span>
                  </div>
                  <a
                    href={report.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                  >
                    <span>Read Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Meta information row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>
                    Fuzzed GPS: {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Reported: {new Date(report.createdAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                  <span>UUID: {report.id.substring(0, 13)}...</span>
                </div>
              </div>

              {/* Interactive Community Voting */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">Community Trust Vote:</span>
                  <button
                    onClick={() => handleVote(1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-medium transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Valid ({report.upvotes})</span>
                  </button>

                  <button
                    onClick={() => handleVote(-1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-medium transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>False / Spam ({report.downvotes})</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  5 net downvotes auto-purges pins
                </span>
              </div>
            </div>

            {/* Media Evidence Gallery */}
            {report.media && report.media.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-4 h-4 text-slate-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Media Evidence & Privacy Blur Status
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {report.media.map((med) => (
                    <div key={med.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={med.blurredUrl || med.originalUrl || "/placeholder-evidence.jpg"}
                        alt="Incident Evidence"
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-2.5 text-xs text-slate-600 bg-white border-t border-slate-200 flex items-center justify-between">
                        <span>Privacy Blur:</span>
                        <span
                          className={`font-semibold ${
                            med.isBlurred ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {med.isBlurred ? "Applied (Faces/Plates)" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Threaded Context Updates Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    Live Threaded Context Updates ({updates.length})
                  </h2>
                </div>
                <button
                  onClick={loadData}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Refresh Updates
                </button>
              </div>

              {/* Submit Update Form */}
              <form onSubmit={handlePostUpdate} className="space-y-3">
                <textarea
                  value={newUpdateContent}
                  onChange={(e) => setNewUpdateContent(e.target.value)}
                  placeholder="Post live context update (e.g., 'Police arrived at scene', 'Road now clear', 'Avoid intersection')..."
                  rows={3}
                  maxLength={500}
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {newUpdateContent.length}/500 characters
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingUpdate || !newUpdateContent.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-sm transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingUpdate ? "Posting..." : "Post Live Update"}</span>
                  </button>
                </div>
              </form>

              {/* Updates List */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                {updates.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No context updates yet. Be the first to provide situational information.
                  </p>
                ) : (
                  updates.map((up) => (
                    <div
                      key={up.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {up.user?.role === "VERIFIED_RESPONDER" ? (
                              <span className="text-blue-600 font-bold">Verified Responder</span>
                            ) : up.user?.role === "ADMIN" ? (
                              <span className="text-purple-700 font-bold">Admin</span>
                            ) : (
                              "Citizen"
                            )}
                          </span>
                          <span>•</span>
                          <span>Trust Score: {up.user?.trustScore ?? 50}</span>
                        </div>
                        <span>{new Date(up.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">{up.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
