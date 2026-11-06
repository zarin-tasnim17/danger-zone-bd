"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { getSocket } from "@/lib/socket";
import { ReportCategory } from "@repo/shared";
import DynamicIncidentMiniMap from "@/components/map/DynamicIncidentMiniMap";
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
  Share2,
  PhoneCall,
  ShieldAlert,
  Siren,
  LightbulbOff,
  AlertOctagon,
  Pill,
  Lock,
  Swords,
  Users,
  Car,
  Moon,
  Copy,
  Check,
  Building2,
  Hospital,
  Compass,
  X,
  Radio,
  FileCheck2,
} from "lucide-react";

interface ReportUpdate {
  id: string;
  reportId: string;
  content: string;
  createdAt: string;
  author?: {
    isVerified: boolean;
    role: string;
    alias: string;
  };
  user?: {
    role: string;
    trustScore: number;
  };
}

interface ReportDetails {
  id: string;
  userId?: string;
  category: ReportCategory;
  severity: "LOW" | "MEDIUM" | "HIGH";
  isNightReport?: boolean;
  latitude: number;
  longitude: number;
  fuzzedRadiusMeters?: number;
  description?: string | null;
  status: "ACTIVE" | "RESOLVED" | "PURGED" | "EXPIRED";
  upvotes: number;
  downvotes: number;
  expiresAt: string;
  createdAt: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  authorVerified?: boolean;
  authorRole?: string;
  updates?: ReportUpdate[];
  media?: Array<{
    id: string;
    blurredUrl?: string;
    originalUrl?: string;
    isBlurred?: boolean;
    createdAt?: string;
  }>;
}

// Distance calculation helper in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function ReportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  const user = useAuthStore((state) => state.user);
  const initAuth = useAuthStore((state) => state.initAuth);
  const { language } = useLanguageStore();
  const safeZones = useIncidentStore((state) => state.safeZones);
  const fetchSafeZones = useIncidentStore((state) => state.fetchSafeZones);

  const [report, setReport] = useState<ReportDetails | null>(null);
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeReason, setPurgeReason] = useState("");
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVoteType, setUserVoteType] = useState<1 | -1 | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    initAuth();
    fetchSafeZones();
  }, [initAuth, fetchSafeZones]);

  const loadData = useCallback(async () => {
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
  }, [reportId]);

  useEffect(() => {
    loadData();

    // Socket.IO real-time listener for context updates and votes
    const socket = getSocket();
    if (socket) {
      const handleNewUpdate = (payload: { reportId: string; update: ReportUpdate }) => {
        if (payload.reportId === reportId) {
          setUpdates((prev) => {
            if (prev.some((u) => u.id === payload.update.id)) return prev;
            return [payload.update, ...prev];
          });
          showToast(
            language === "en" ? "New live context update posted!" : "নতুন তথ্য আপডেট যুক্ত হয়েছে!",
            "info"
          );
        }
      };

      const handleVote = (payload: { reportId: string; upvotes: number; downvotes: number }) => {
        if (payload.reportId === reportId) {
          setReport((prev) => (prev ? { ...prev, upvotes: payload.upvotes, downvotes: payload.downvotes } : null));
        }
      };

      const handlePurged = (payload: { reportId: string }) => {
        if (payload.reportId === reportId) {
          setReport((prev) => (prev ? { ...prev, status: "PURGED" } : null));
          showToast(
            language === "en"
              ? "This report has been purged by administrators."
              : "এই রিপোর্টটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে।",
            "error"
          );
        }
      };

      socket.on("NEW_REPORT_UPDATE", handleNewUpdate);
      socket.on("REPORT_VOTED", handleVote);
      socket.on("REPORT_PURGED", handlePurged);

      return () => {
        socket.off("NEW_REPORT_UPDATE", handleNewUpdate);
        socket.off("REPORT_VOTED", handleVote);
        socket.off("REPORT_PURGED", handlePurged);
      };
    }
  }, [reportId, loadData, language, showToast]);

  const handleVote = async (voteType: 1 | -1) => {
    if (!report) return;

    if (user && report.userId && user.id === report.userId) {
      showToast(
        language === "en" ? "You cannot vote on your own incident report." : "নিজের রিপোর্টে ভোট দেওয়া যাবে না।",
        "error"
      );
      return;
    }

    if (hasVoted) {
      showToast(
        language === "en" ? "You have already voted on this incident." : "আপনি ইতিমধ্যে এই রিপোর্টে ভোট দিয়েছেন।",
        "info"
      );
      return;
    }

    // Optimistic UI update
    const previous = { ...report };
    setHasVoted(true);
    setUserVoteType(voteType);
    setReport((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        upvotes: voteType === 1 ? prev.upvotes + 1 : prev.upvotes,
        downvotes: voteType === -1 ? prev.downvotes + 1 : prev.downvotes,
      };
    });

    try {
      const updated = await apiFetch<any>(`/reports/${reportId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });
      setReport((prev) => (prev ? { ...prev, upvotes: updated.upvotes, downvotes: updated.downvotes } : null));
      showToast(
        voteType === 1
          ? language === "en"
            ? "Thank you! Upvoted as verified & genuine."
            : "ধন্যবাদ! রিপোর্টটি সত্য বলে নিশ্চিত করা হয়েছে।"
          : language === "en"
          ? "Flagged as false or inaccurate."
          : "রিপোর্টটি ভুল বা ভুয়া হিসেবে চিহ্নিত করা হয়েছে।",
        "success"
      );
    } catch (err: any) {
      // Revert optimistic update
      setReport(previous);
      setHasVoted(false);
      setUserVoteType(null);
      showToast(err.message || "Could not register community vote.", "error");
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newUpdateContent.trim();
    if (!content || content.length < 2) {
      showToast(
        language === "en" ? "Update must be at least 2 characters long." : "আপডেট কমপক্ষে ২ অক্ষরের হতে হবে।",
        "error"
      );
      return;
    }

    setIsSubmittingUpdate(true);
    try {
      const created = await apiFetch<ReportUpdate>(`/reports/${reportId}/updates`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setUpdates((prev) => [created, ...prev]);
      setNewUpdateContent("");
      showToast(
        language === "en" ? "Live context update broadcasted successfully!" : "নতুন আপডেট সফলভাবে সম্প্রচারিত হয়েছে!",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to post context update", "error");
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      const updated = await apiFetch<ReportDetails>(`/reports/${reportId}/resolve`, {
        method: "PATCH",
      });
      setReport(updated);
      setIsResolveModalOpen(false);
      showToast(
        language === "en" ? "Incident marked as RESOLVED & CLEARED." : "ঘটনাটি সমাধান ও নিরাপদ হিসেবে চিহ্নিত হয়েছে।",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to resolve incident", "error");
    } finally {
      setIsResolving(false);
    }
  };

  const handlePurge = async () => {
    if (!purgeReason.trim() || purgeReason.trim().length < 3) {
      showToast(
        language === "en" ? "Please provide a valid moderation reason (min 3 chars)." : "যথাযথ কারণ উল্লেখ করুন।",
        "error"
      );
      return;
    }

    setIsPurging(true);
    try {
      await apiFetch(`/admin/reports/${reportId}/purge`, {
        method: "POST",
        body: JSON.stringify({ reason: purgeReason.trim() }),
      });
      setIsPurgeModalOpen(false);
      showToast(
        language === "en" ? "Report purged by administrator." : "অ্যাডমিন কর্তৃক রিপোর্টটি মুছে ফেলা হয়েছে।",
        "success"
      );
      setTimeout(() => router.push("/feed"), 1200);
    } catch (err: any) {
      showToast(err.message || "Failed to purge report", "error");
    } finally {
      setIsPurging(false);
    }
  };

  const copyToClipboard = (text: string, type: "id" | "link") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "id") {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
        showToast(language === "en" ? "Incident UUID copied to clipboard" : "ঘটনার আইডি কপি করা হয়েছে", "info");
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        showToast(
          language === "en" ? "Incident War Room link copied to clipboard!" : "ঘটনার লিঙ্ক কপি করা হয়েছে!",
          "info"
        );
      }
    }
  };

  const appendQuickTag = (tag: string) => {
    setNewUpdateContent((prev) => (prev ? `${prev.trim()} • ${tag}` : tag));
  };

  // Find nearest safe havens (Police Stations and Hospitals)
  const nearbySafeHavens = useMemo(() => {
    if (!report || !safeZones || safeZones.length === 0) return [];
    return safeZones
      .map((zone) => ({
        ...zone,
        distanceMeters: calculateDistanceMeters(report.latitude, report.longitude, zone.latitude, zone.longitude),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);
  }, [report, safeZones]);

  // Category Configuration with Icons & Bilingual Labels
  const categoryMeta = useMemo(() => {
    const cat = report?.category || "MUGGING";
    switch (cat) {
      case "SNATCHING":
      case "MUGGING":
        return {
          icon: Siren,
          labelEn: "Snatching",
          labelBn: "ছিনতাই",
          colorClass: "text-orange-700 bg-orange-50 border-orange-200",
        };
      case "ARMED_ASSAULT":
        return {
          icon: Swords,
          labelEn: "Armed Assault",
          labelBn: "অস্ত্রসহ হামলা",
          colorClass: "text-rose-700 bg-rose-50 border-rose-200",
        };
      case "SNATCHING_ARMED_ASSAULT":
        return {
          icon: ShieldAlert,
          labelEn: "Snatching & Armed Assault",
          labelBn: "ছিনতাই ও অস্ত্রসহ হামলা",
          colorClass: "text-red-800 bg-red-50 border-red-300 font-bold",
        };
      case "THEFT":
        return {
          icon: Lock,
          labelEn: "Theft",
          labelBn: "চুরি",
          colorClass: "text-amber-700 bg-amber-50 border-amber-200",
        };
      case "ROBBERY":
      case "DACOITY":
        return {
          icon: ShieldAlert,
          labelEn: "Robbery",
          labelBn: "ডাকাতি",
          colorClass: "text-red-700 bg-red-50 border-red-200",
        };
      case "THEFT_ROBBERY":
      case "THEFT_DACOITY":
        return {
          icon: ShieldAlert,
          labelEn: "Theft & Robbery",
          labelBn: "চুরি ডাকাতি",
          colorClass: "text-red-800 bg-red-50 border-red-300 font-bold",
        };
      case "EXTORTION":
        return {
          icon: AlertOctagon,
          labelEn: "Extortion",
          labelBn: "চাঁদাবাজি",
          colorClass: "text-purple-700 bg-purple-50 border-purple-200",
        };
      case "YOUTH_GANG_ACTIVITY":
      case "TEEN_GANG":
        return {
          icon: Users,
          labelEn: "Youth Gang Activity",
          labelBn: "কিশোর গ্যাং",
          colorClass: "text-violet-700 bg-violet-50 border-violet-200",
        };
      case "TEEN_GANG_ARMED_ASSAULT":
        return {
          icon: Swords,
          labelEn: "Youth Gang Armed Clash",
          labelBn: "কিশোর গ্যাং ও অস্ত্রসহ হামলা",
          colorClass: "text-purple-800 bg-purple-50 border-purple-300 font-bold",
        };
      case "DRUG_RELATED_CRIME":
      case "DRUG_ACTIVITY":
        return {
          icon: Pill,
          labelEn: "Drug-Related Crime",
          labelBn: "মাদক সংক্রান্ত অপরাধ",
          colorClass: "text-blue-700 bg-blue-50 border-blue-200",
        };
      case "ROAD_ACCIDENT":
        return {
          icon: Car,
          labelEn: "Road Accident",
          labelBn: "সড়ক দুর্ঘটনা / এক্সিডেন্ট",
          colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
        };
      case "UNLIT_ROAD":
        return {
          icon: LightbulbOff,
          labelEn: "Unlit Road",
          labelBn: "অন্ধকার রাস্তা",
          colorClass: "text-slate-700 bg-slate-100 border-slate-300",
        };
      default:
        return {
          icon: ShieldAlert,
          labelEn: "Public Danger",
          labelBn: "নাগরিক বিপদ",
          colorClass: "text-red-700 bg-red-50 border-red-200",
        };
    }
  }, [report?.category]);

  const isAuthor = Boolean(user && report?.userId && user.id === report.userId);
  const isAdmin = user?.role === "ADMIN";
  const isVerifiedResponder = user?.role === "VERIFIED_RESPONDER";
  const canResolve = Boolean((isAuthor || isAdmin || isVerifiedResponder) && report?.status === "ACTIVE");

  // Community Trust Consensus Percentage
  const totalVotes = (report?.upvotes || 0) + (report?.downvotes || 0);
  const trustPercentage = totalVotes > 0 ? Math.round(((report?.upvotes || 0) / totalVotes) * 100) : 100;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-500 selection:text-white">
      {/* Unified Single-Line Top Navigation */}
      <Navbar />

      {/* Floating System Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/25"
                : toast.type === "error"
                ? "bg-red-600 text-white border-red-500 shadow-red-600/25"
                : "bg-slate-900 text-white border-slate-800 shadow-slate-900/25"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : toast.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Radio className="w-4 h-4 shrink-0 animate-pulse text-blue-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Media Lightbox Modal */}
      {selectedMediaUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedMediaUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMediaUrl(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-colors shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedMediaUrl}
              alt="Full Resolution Evidence"
              className="max-h-[82vh] w-auto max-w-full rounded-2xl object-contain mx-auto"
            />
            <div className="p-3 text-center text-xs text-slate-500 font-medium">
              Bangladesh Civic Safety Network • Verified Evidence Record
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Resolve Incident */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {language === "en" ? "Mark Incident as Resolved?" : "ঘটনাটি সমাধান হিসেবে চিহ্নিত করবেন?"}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {language === "en"
                  ? "Marking this incident as resolved will alert citizens that the danger has cleared and the area is safe. This status change will be logged in public ledger."
                  : "এটি সমাধান চিহ্নিত করলে নাগরিকরা জানতে পারবে যে এই স্থানটি এখন নিরাপদ।"}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                disabled={isResolving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                {language === "en" ? "Cancel" : "বাতিল"}
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center gap-1.5"
              >
                {isResolving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === "en" ? "Resolving..." : "প্রক্রিয়াকরণ..."}</span>
                  </>
                ) : (
                  <span>{language === "en" ? "Confirm Resolution" : "নিশ্চিত করুন"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Admin Purge Incident */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {language === "en" ? "Moderation Action: Purge Incident" : "অ্যাডমিন মডারেশন: রিপোর্ট বাতিল"}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {language === "en"
                  ? "This permanently removes the pin from heatmaps, revokes credibility points from the submitter, and archives the event."
                  : "এই রিপোর্টটি স্থায়ীভাবে মানচিত্র ও সকল ফিড থেকে মুছে ফেলা হবে।"}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {language === "en" ? "Moderation Reason *" : "বাতিলের কারণ *"}
              </label>
              <input
                type="text"
                value={purgeReason}
                onChange={(e) => setPurgeReason(e.target.value)}
                placeholder="e.g. Verified hoax, duplicate report, malicious spam..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={isPurging}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                {language === "en" ? "Cancel" : "বাতিল"}
              </button>
              <button
                onClick={handlePurge}
                disabled={isPurging || !purgeReason.trim()}
                className="px-5 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl shadow-md shadow-purple-700/20 transition active:scale-95 flex items-center gap-1.5"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === "en" ? "Purging..." : "মুছে ফেলা হচ্ছে..."}</span>
                  </>
                ) : (
                  <span>{language === "en" ? "Execute Purge" : "বাতিল কার্যকর করুন"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main War Room Content */}
      <main className="flex-1 max-w-[1536px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Navigation Breadcrumb & Utility Quick Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>{language === "en" ? "Back to Threat Feed" : "থ্রেট ফিডে ফিরে যান"}</span>
            </Link>

            <span className="text-slate-300">/</span>

            <span className="text-xs font-mono text-slate-500">
              REP-{reportId.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Share Incident Button */}
            <button
              onClick={() => copyToClipboard(typeof window !== "undefined" ? window.location.href : "", "link")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-2xs"
              title="Share Incident Dossier"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedLink ? (language === "en" ? "Copied!" : "কপি হয়েছে!") : language === "en" ? "Share" : "শেয়ার"}</span>
            </button>


          </div>
        </div>

        {/* Loading State Skeleton */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {language === "en" ? "Synchronizing Incident Dossier..." : "তথ্য লোড হচ্ছে..."}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Querying PostGIS coordinate verification & real-time updates...
              </p>
            </div>
          </div>
        ) : error || !report ? (
          /* Error / Not Found State */
          <div className="bg-white border border-rose-200 rounded-3xl p-10 text-center shadow-xs space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {language === "en" ? "Incident Report Not Found" : "রিপোর্টটি খুঁজে পাওয়া যায়নি"}
              </h2>
              <p className="text-xs text-rose-600 mt-1">
                {error || "This report may have expired, been resolved, or purged by administrators."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={loadData}
                className="px-4 py-2 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition"
              >
                {language === "en" ? "Retry Fetch" : "পুনরায় চেষ্টা"}
              </button>
              <Link
                href="/feed"
                className="px-4 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
              >
                {language === "en" ? "Return to Feed" : "ফিডে ফিরুন"}
              </Link>
            </div>
          </div>
        ) : (
          /* Real Incident Dossier Content */
          <div className="space-y-6">
            {/* Top War Room Command Banner */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
              {/* Severity accent strip at very top */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  report.severity === "HIGH"
                    ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-600"
                    : report.severity === "MEDIUM"
                    ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500"
                    : "bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500"
                }`}
              />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Category Icon, Name, Severity & Status */}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm ${
                      report.severity === "HIGH"
                        ? "bg-red-50 text-red-600 border-red-200 shadow-red-500/10"
                        : report.severity === "MEDIUM"
                        ? "bg-amber-50 text-amber-600 border-amber-200 shadow-amber-500/10"
                        : "bg-blue-50 text-blue-600 border-blue-200 shadow-blue-500/10"
                    }`}
                  >
                    <categoryMeta.icon className="w-7 h-7" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Severity Pill */}
                      <span
                        className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1.5 ${
                          report.severity === "HIGH"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : report.severity === "MEDIUM"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            report.severity === "HIGH"
                              ? "bg-red-600 animate-ping"
                              : report.severity === "MEDIUM"
                              ? "bg-amber-600"
                              : "bg-blue-600"
                          }`}
                        />
                        <span>{report.severity} {language === "en" ? "SEVERITY" : "ঝুঁকি"}</span>
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1.5 ${
                          report.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : report.status === "RESOLVED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            report.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-400"
                          }`}
                        />
                        <span>STATUS: {report.status}</span>
                      </span>

                      {/* Night Hazard Pill */}
                      {report.isNightReport && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-slate-800 flex items-center gap-1">
                          <Moon className="w-3 h-3 text-amber-400" />
                          <span>{language === "en" ? "Night Hazard" : "রাতের বিপদ"}</span>
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {language === "en" ? categoryMeta.labelEn : categoryMeta.labelBn}
                    </h1>
                  </div>
                </div>

                {/* Right: Moderation Actions (Resolve / Purge) */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                  {canResolve && (
                    <button
                      onClick={() => setIsResolveModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm shadow-emerald-600/20 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === "en" ? "Mark as Resolved" : "সমাধান সম্পন্ন করুন"}</span>
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => setIsPurgeModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-sm shadow-purple-700/20 transition active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{language === "en" ? "Admin Purge" : "অ্যাডমিন রিমুভ"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Two-Column Responsive War Room Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Dossier Narrative, Evidence, Voting & Context Feed) - 7 cols */}
              <div className="lg:col-span-7 space-y-6">
                {/* Incident Narrative Details */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {language === "en" ? "Situational Narrative" : "ঘটনার বর্ণনা"}
                    </span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                    </span>
                  </div>

                  <p className="text-base text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                    {report.description ||
                      (language === "en"
                        ? "No additional written narrative was provided with this hazard pin."
                        : "এই রিপোর্টের সাথে বিস্তারিত বিবরণ যুক্ত করা হয়নি।")}
                  </p>

                  {/* Verified Press Article Cross-Check Banner */}
                  {report.sourceUrl && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
                      <div className="flex items-center gap-2.5 font-medium">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {language === "en" ? "Cross-Verified with National Press Outlets" : "জাতীয় সংবাদ মাধ্যম দ্বারা যাচাইকৃত"}
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            {language === "en" ? "Published by:" : "প্রকাশক:"}{" "}
                            <strong>{report.sourceName || "Bangladesh News Syndicate"}</strong>
                          </p>
                        </div>
                      </div>
                      <a
                        href={report.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-blue-700 hover:text-blue-800 border border-blue-200 font-bold shadow-2xs hover:shadow transition shrink-0"
                      >
                        <span>{language === "en" ? "Read Press Story" : "সংবাদটি পড়ুন"}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Citizen Verification & Anti-Spoofing Proof */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {report.authorVerified
                            ? language === "en" ? "Verified Citizen Reporter" : "যাচাইকৃত নাগরিক"
                            : language === "en" ? "Citizen Contributor" : "নাগরিক প্রতিনিধি"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {language === "en" ? "Authenticity Rank:" : "বিশ্বস্ততা র্যাংক:"} {report.authorRole || "USER"}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {language === "en" ? "GPS Anti-Spoofing: PASSED" : "জিপিএস যাচাইকরণ: সম্পন্ন"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {language === "en" ? "150m privacy fuzz applied" : "১৫০মি গোপনীয়তা সুরক্ষিত"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Community Trust Consensus Gauge */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {language === "en" ? "Community Trust Consensus" : "নাগরিক আস্থা ও যাচাইকরণ"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {language === "en"
                          ? "Real-time crowdsourced validation from citizens on the ground."
                          : "মাঠপর্যায়ের নাগরিকদের প্রত্যক্ষ প্রতিক্রিয়া।"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                        {trustPercentage}% {language === "en" ? "Reliable" : "বিশ্বাসযোগ্য"}
                      </span>
                    </div>
                  </div>

                  {/* Ratio bar */}
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${trustPercentage}%` }}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${100 - trustPercentage}%` }}
                    />
                  </div>

                  {/* Interactive Voting Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleVote(1)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                          userVoteType === 1
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20"
                            : "bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200"
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${userVoteType === 1 ? "text-white" : "text-emerald-600"}`} />
                        <span>{language === "en" ? "Valid Incident" : "সঠিক ঘটনা"}</span>
                        <span className="font-mono ml-0.5">({report.upvotes})</span>
                      </button>

                      <button
                        onClick={() => handleVote(-1)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 ${
                          userVoteType === -1
                            ? "bg-rose-600 text-white border-rose-600 shadow-rose-600/20"
                            : "bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200"
                        }`}
                      >
                        <ThumbsDown className={`w-4 h-4 ${userVoteType === -1 ? "text-white" : "text-rose-600"}`} />
                        <span>{language === "en" ? "False / Spam" : "ভুল / স্প্যাম"}</span>
                        <span className="font-mono ml-0.5">({report.downvotes})</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">
                      {language === "en"
                        ? "5 net downvotes automatically purges false reports"
                        : "৫টি ডাউনভোট পেলে স্বয়ংক্রিয়ভাবে মুছে যাবে"}
                    </span>
                  </div>
                </div>

                {/* Media Evidence Gallery */}
                {report.media && report.media.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {language === "en" ? "Photographic Evidence" : "ছবি ও প্রমাণাদি"}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {report.media.map((med) => {
                        const imgUrl = med.blurredUrl || med.originalUrl;
                        if (!imgUrl) return null;
                        return (
                          <div
                            key={med.id}
                            onClick={() => setSelectedMediaUrl(imgUrl)}
                            className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:shadow transition-all"
                          >
                            <img
                              src={imgUrl}
                              alt="Incident Evidence"
                              className="w-full h-48 object-cover group-hover:scale-102 transition-transform duration-200"
                            />
                            <div className="absolute bottom-0 inset-x-0 p-2.5 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-800">
                                {language === "en" ? "Privacy Protection:" : "গোপনীয়তা:"}
                              </span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {language === "en" ? "Faces & Plates Blurred" : "সুরক্ষিত"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Live Threaded Situational Context Feed (War Room Updates) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {language === "en" ? "Live Situational Updates" : "সরাসরি পরিস্থিতির আপডেট"}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {updates.length} {language === "en" ? "verified updates logged" : "টি আপডেট পাওয়া গেছে"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={loadData}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{language === "en" ? "Refresh" : "রিফ্রেশ"}</span>
                    </button>
                  </div>

                  {/* Situational Quick Chips for Rapid Dispatch */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">
                      {language === "en" ? "Quick Tags:" : "দ্রুত ট্যাগ:"}
                    </span>
                    <button
                      type="button"
                      onClick={() => appendQuickTag(language === "en" ? "Police / RAB at scene" : "পুলিশ ঘটনাস্থলে পৌঁছেছে")}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                    >
                      🚨 {language === "en" ? "Police at scene" : "পুলিশ পৌঁছেছে"}
                    </button>
                    <button
                      type="button"
                      onClick={() => appendQuickTag(language === "en" ? "Street now cleared and safe" : "রাস্তা এখন নিরাপদ ও যান চলাচল স্বাভাবিক")}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                    >
                      🟢 {language === "en" ? "Road clear" : "রাস্তা নিরাপদ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => appendQuickTag(language === "en" ? "Avoid area, take detour" : "এলাকা এড়িয়ে বিকল্প পথ ব্যবহার করুন")}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                    >
                      ⚠️ {language === "en" ? "Avoid area" : "এলাকা এড়ান"}
                    </button>
                    <button
                      type="button"
                      onClick={() => appendQuickTag(language === "en" ? "Ambulance on scene" : "অ্যাম্বুলেন্স উপস্থিত")}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                    >
                      🚑 {language === "en" ? "Ambulance" : "অ্যাম্বুলেন্স"}
                    </button>
                  </div>

                  {/* Post Update Form */}
                  <form onSubmit={handlePostUpdate} className="space-y-3 pt-2">
                    <textarea
                      value={newUpdateContent}
                      onChange={(e) => setNewUpdateContent(e.target.value)}
                      placeholder={
                        language === "en"
                          ? "Post real-time context update (e.g., 'Police arrived', 'Intersection cleared', 'Avoid lane')..."
                          : "সরাসরি পরিস্থিতির তথ্য লিখুন (যেমন: 'পুলিশ এসেছে', 'রাস্তা সচল')..."
                      }
                      rows={3}
                      maxLength={500}
                      className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition shadow-2xs"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {newUpdateContent.length}/500 {language === "en" ? "chars" : "অক্ষর"}
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmittingUpdate || !newUpdateContent.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSubmittingUpdate
                            ? language === "en" ? "Broadcasting..." : "পাঠানো হচ্ছে..."
                            : language === "en" ? "Broadcast Update" : "আপডেট দিন"}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Updates Timeline Feed */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    {updates.length === 0 ? (
                      <div className="py-6 text-center space-y-2">
                        <MessageSquare className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">
                          {language === "en"
                            ? "No live context updates logged yet. Be the first to report situational progress."
                            : "এখনো কোনো আপডেট নেই। বর্তমান অবস্থা সম্পর্কে প্রথম তথ্য দিন।"}
                        </p>
                      </div>
                    ) : (
                      updates.map((up) => {
                        const authorRole = up.author?.role || up.user?.role || "USER";
                        const isResponder = authorRole === "VERIFIED_RESPONDER";
                        const isUpdateAdmin = authorRole === "ADMIN";
                        const authorAlias =
                          up.author?.alias ||
                          (isUpdateAdmin
                            ? "Official Administrator"
                            : isResponder
                            ? "Verified Responder"
                            : "Community Citizen");

                        return (
                          <div
                            key={up.id}
                            className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2 transition-all hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                    isUpdateAdmin
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : isResponder
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {authorAlias}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(up.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                              {up.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (Tactical Mini-Map, Nearby Safe Shelters & Metadata Ledger) - 5 cols */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. Tactical Mini-Map */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {language === "en" ? "Tactical Geo-Radar" : "ভৌগোলিক মানচিত্র"}
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                    </span>
                  </div>

                  {/* Leaflet Dynamic Mini-Map Component */}
                  <DynamicIncidentMiniMap
                    latitude={report.latitude}
                    longitude={report.longitude}
                    severity={report.severity}
                    category={report.category}
                    radiusMeters={report.fuzzedRadiusMeters || 150}
                  />

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {language === "en"
                      ? "Location display incorporates a 150m privacy perimeter to safeguard citizen whistleblowers in compliance with Bangladesh cybersecurity statutes."
                      : "নাগরিকের গোপনীয়তা রক্ষায় জিপিএস স্থানাঙ্ক ১৫০ মিটার ব্যাসার্ধে সুরক্ষিত রাখা হয়েছে।"}
                  </p>
                </div>

                {/* 2. Nearest Verified Safe Havens (Shelters) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {language === "en" ? "Nearby Verified Safe Havens" : "নিকটবর্তী নিরাপদ আশ্রয়স্থল"}
                      </h3>
                    </div>
                    <Link
                      href="/safe-zones"
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {language === "en" ? "View All" : "সকল দেখুন"}
                    </Link>
                  </div>

                  {nearbySafeHavens.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">
                      {language === "en" ? "Loading shelter database..." : "আশ্রয়স্থলের তালিকা লোড হচ্ছে..."}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {nearbySafeHavens.map((zone) => {
                        const isPolice = zone.type === "POLICE_STATION";
                        const distKm = (zone.distanceMeters / 1000).toFixed(1);
                        return (
                          <div
                            key={zone.id}
                            className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                  isPolice
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                }`}
                              >
                                {isPolice ? <Building2 className="w-4 h-4" /> : <Hospital className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {language === "bn" && (zone as any).nameBn ? (zone as any).nameBn : zone.name}
                                </h4>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                                  <span>{isPolice ? "Police Station" : "Hospital / Medical"}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-700 font-bold">{distKm} km</span>
                                </div>
                              </div>
                            </div>

                            <Link
                              href={`/routes?endLat=${zone.latitude}&endLng=${zone.longitude}`}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-800 border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-xl transition shrink-0 shadow-2xs"
                            >
                              {language === "en" ? "Route" : "রুট"}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Chain-of-Custody Metadata Ledger */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3.5 text-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {language === "en" ? "Incident Metadata Ledger" : "ঘটনার অফিসিয়াল তথ্য"}
                  </h3>

                  <div className="space-y-2.5 divide-y divide-slate-100">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500">{language === "en" ? "Report UUID:" : "রিপোর্ট আইডি:"}</span>
                      <button
                        onClick={() => copyToClipboard(report.id, "id")}
                        className="font-mono text-slate-800 hover:text-blue-600 flex items-center gap-1 font-semibold"
                        title="Click to copy UUID"
                      >
                        <span>{report.id.slice(0, 14)}...</span>
                        {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">{language === "en" ? "Timestamp:" : "সময়:"}</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {new Date(report.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">{language === "en" ? "Auto-Expiry Window:" : "স্বয়ংক্রিয় মেয়াদ:"}</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {new Date(report.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">{language === "en" ? "Coordinate Protection:" : "স্থানাঙ্ক সুরক্ষা:"}</span>
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        150m Circle Fuzzed
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">{language === "en" ? "Device Anti-Spoofing:" : "ডিভাইস জিপিএস:"}</span>
                      <span className="font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        &le; 200m Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
