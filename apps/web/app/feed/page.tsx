"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useStatsStore } from "@/store/useStatsStore";
import { getSocket } from "@/lib/socket";
import {
  SOCKET_EVENTS,
  getSocketReportId,
  ReportCategory,
  type ReportVotedPayload,
  type ReportResolvedPayload,
  type ReportPurgedPayload,
  type ReportExpiredPayload,
  type ReportVerifiedPayload,
} from "@repo/shared";
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Clock,
  MapPin,
  AlertTriangle,
  Moon,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Map,
  ArrowUpRight,
  RotateCcw,
  MessageSquare,
  Send,
  Siren,
  LightbulbOff,
  AlertOctagon,
  Pill,
  Layers,
  Lock,
  Swords,
  Users,
  Car,
  ShieldAlert,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  X,
  Share2,
} from "lucide-react";

interface ReportMedia {
  id: string;
  blurredUrl: string;
  createdAt: string;
}

interface Incident {
  id: string;
  category: ReportCategory;
  severity: "LOW" | "MEDIUM" | "HIGH";
  isNightReport?: boolean;
  latitude: number;
  longitude: number;
  description?: string | null;
  upvotes: number;
  downvotes: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  media?: ReportMedia[];
  fuzzedRadiusMeters?: number;
  isGpsVerified?: boolean;
}

interface IncidentComment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
}

type SortOption = "NEWEST" | "MOST_UPVOTED" | "SEVERITY_HIGH";

function formatRelativeTime(dateString: string, lang: "en" | "bn"): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffMin < 1) {
      return lang === "bn" ? "এইমাত্র" : "Just now";
    }
    if (diffMin < 60) {
      return lang === "bn" ? `${diffMin} মিনিট আগে` : `${diffMin}m ago`;
    }
    if (diffHour < 24) {
      return lang === "bn" ? `${diffHour} ঘণ্টা আগে` : `${diffHour}h ago`;
    }
    const days = Math.floor(diffHour / 24);
    return lang === "bn" ? `${days} দিন আগে` : `${days}d ago`;
  } catch {
    return lang === "bn" ? "সাম্প্রতিক" : "Recent";
  }
}

function formatRemainingExpiry(expiresAtString: string, lang: "en" | "bn"): string {
  try {
    const remainingMs = new Date(expiresAtString).getTime() - Date.now();
    if (remainingMs <= 0) {
      return lang === "bn" ? "মেয়াদ উত্তীর্ণ" : "Expired";
    }
    const remainingMin = Math.floor(remainingMs / (1000 * 60));
    const remainingHours = Math.floor(remainingMin / 60);
    const remainingDays = Math.floor(remainingHours / 24);

    if (remainingDays >= 1) {
      return lang === "bn" ? `${remainingDays} দিন বাকি` : `${remainingDays}d left`;
    }
    if (remainingHours >= 1) {
      return lang === "bn" ? `${remainingHours} ঘণ্টা বাকি` : `${remainingHours}h left`;
    }
    return lang === "bn" ? `${remainingMin} মি. বাকি` : `${remainingMin}m left`;
  } catch {
    return "";
  }
}

function extractLocationName(incident: Incident): string {
  const desc = incident.description || "";
  if (desc.includes("সাভার") || desc.includes("আশুলিয়া")) return "Savar / Ashulia, Dhaka";
  if (desc.includes("যশোর") || desc.includes("অভয়নগর")) return "Abhaynagar, Jessore";
  if (desc.includes("মিরপুর")) return "Mirpur, Dhaka";
  if (desc.includes("নারায়ণগঞ্জ")) return "Link Road, Narayanganj";
  if (desc.includes("ধানমন্ডি")) return "Dhanmondi, Dhaka";
  if (desc.includes("গুলশান") || desc.includes("বনানী")) return "Gulshan-Banani, Dhaka";
  if (desc.includes("খুলনা") || desc.includes("সোনাডাঙ্গা")) return "Khulna Metropolitan";
  if (desc.includes("চট্টগ্রাম")) return "Chittagong Port City";
  if (desc.includes("সিলেট")) return "Sylhet Sadar";
  return `Sector (${incident.latitude.toFixed(2)}°N, ${incident.longitude.toFixed(2)}°E)`;
}

export default function FeedPage() {
  const { user, initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const stats = useStatsStore((state) => state.stats);
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const initStatsListener = useStatsStore((state) => state.initStatsListener);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [nightFilter, setNightFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");

  // Interaction States
  const [votingId, setVotingId] = useState<string | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, IncidentComment[]>>({});
  const [loadingCommentsId, setLoadingCommentsId] = useState<string | null>(null);
  const [commentInputText, setCommentInputText] = useState("");
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch all reports within Bangladesh territorial boundary
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = "/reports?minLat=20.0&maxLat=27.0&minLng=88.0&maxLng=93.0";
      if (categoryFilter !== "ALL") query += `&category=${categoryFilter}`;
      if (severityFilter !== "ALL") query += `&severity=${severityFilter}`;
      if (nightFilter) query += `&isNightReport=true`;

      const data = await apiFetch<Incident[]>(query);
      setIncidents(data || []);
    } catch (err: any) {
      console.error("[FeedPage] Error fetching incidents:", err);
      setError(err.message || (isBn ? "তথ্য লোড করতে সমস্যা হয়েছে" : "Failed to load safety alerts."));
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, severityFilter, nightFilter, isBn]);

  useEffect(() => {
    initAuth();
    fetchStats();
    initStatsListener();
    fetchIncidents();
  }, [initAuth, fetchStats, initStatsListener, fetchIncidents]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewReport = (newReport: Incident) => {
      setIncidents((prev) => {
        if (prev.some((i) => i.id === newReport.id)) return prev;
        return [newReport, ...prev];
      });
      fetchStats();
    };

    const handleReportVoted = (data: ReportVotedPayload) => {
      const targetId = getSocketReportId(data);
      if (!targetId) return;
      setIncidents((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? {
                ...item,
                upvotes: data.upvotes,
                downvotes: data.downvotes,
                status: data.status || item.status,
              }
            : item
        )
      );
    };

    const handleReportResolved = (data: ReportResolvedPayload) => {
      const targetId = getSocketReportId(data);
      if (!targetId) return;
      setIncidents((prev) => prev.filter((item) => item.id !== targetId));
      fetchStats();
    };

    const handleReportPurged = (data: ReportPurgedPayload) => {
      const targetId = getSocketReportId(data);
      if (!targetId) return;
      setIncidents((prev) => prev.filter((item) => item.id !== targetId));
      fetchStats();
    };

    const handleReportExpired = (data: ReportExpiredPayload) => {
      if (!data.reportIds?.length) return;
      setIncidents((prev) => prev.filter((item) => !data.reportIds.includes(item.id)));
      fetchStats();
    };

    const handleReportVerified = (data: ReportVerifiedPayload) => {
      const targetId = getSocketReportId(data);
      if (!targetId) return;
      const pressTag = `[Verified by Press: ${data.verifiedBy}]`;
      setIncidents((prev) =>
        prev.map((item) => {
          if (item.id !== targetId) return item;
          const currentDesc = item.description || "";
          const nextDesc = currentDesc.includes(pressTag)
            ? currentDesc
            : currentDesc
              ? `${currentDesc}\n\n${pressTag}`
              : pressTag;
          return {
            ...item,
            sourceName: data.verifiedBy,
            sourceUrl: data.sourceUrl ?? item.sourceUrl,
            description: nextDesc,
          };
        })
      );
    };

    socket.on(SOCKET_EVENTS.NEW_REPORT, handleNewReport);
    socket.on(SOCKET_EVENTS.REPORT_VOTED, handleReportVoted);
    socket.on(SOCKET_EVENTS.REPORT_RESOLVED, handleReportResolved);
    socket.on(SOCKET_EVENTS.REPORT_PURGED, handleReportPurged);
    socket.on(SOCKET_EVENTS.REPORT_EXPIRED, handleReportExpired);
    socket.on(SOCKET_EVENTS.REPORT_VERIFIED, handleReportVerified);

    return () => {
      socket.off(SOCKET_EVENTS.NEW_REPORT, handleNewReport);
      socket.off(SOCKET_EVENTS.REPORT_VOTED, handleReportVoted);
      socket.off(SOCKET_EVENTS.REPORT_RESOLVED, handleReportResolved);
      socket.off(SOCKET_EVENTS.REPORT_PURGED, handleReportPurged);
      socket.off(SOCKET_EVENTS.REPORT_EXPIRED, handleReportExpired);
      socket.off(SOCKET_EVENTS.REPORT_VERIFIED, handleReportVerified);
    };
  }, [fetchStats]);

  // Community Voting
  const handleVote = async (reportId: string, voteType: 1 | -1) => {
    if (votingId) return;
    setVotingId(reportId);

    const targetItem = incidents.find((item) => item.id === reportId);
    const previousCounts = targetItem
      ? { upvotes: targetItem.upvotes, downvotes: targetItem.downvotes }
      : null;

    // Optimistic UI update
    setIncidents((prev) =>
      prev.map((item) => {
        if (item.id === reportId) {
          return {
            ...item,
            upvotes: voteType === 1 ? item.upvotes + 1 : item.upvotes,
            downvotes: voteType === -1 ? item.downvotes + 1 : item.downvotes,
          };
        }
        return item;
      })
    );

    try {
      const updated = await apiFetch<any>(`/reports/${reportId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });

      if (updated?.status === "PURGED") {
        setIncidents((prev) => prev.filter((item) => item.id !== reportId));
      } else if (updated && typeof updated.upvotes === "number") {
        setIncidents((prev) =>
          prev.map((item) =>
            item.id === reportId
              ? { ...item, upvotes: updated.upvotes, downvotes: updated.downvotes }
              : item
          )
        );
      }
    } catch (err: any) {
      if (previousCounts) {
        setIncidents((prev) =>
          prev.map((item) =>
            item.id === reportId
              ? {
                  ...item,
                  upvotes: previousCounts.upvotes,
                  downvotes: previousCounts.downvotes,
                }
              : item
          )
        );
      }
      alert(err.message || (isBn ? "ভোট সম্পন্ন করা যায়নি" : "Failed to record vote."));
      fetchIncidents();
    } finally {
      setVotingId(null);
    }
  };

  // Fetch comments / updates for an incident
  const toggleComments = async (reportId: string) => {
    if (expandedCommentsId === reportId) {
      setExpandedCommentsId(null);
      return;
    }

    setExpandedCommentsId(reportId);
    if (!commentsMap[reportId]) {
      setLoadingCommentsId(reportId);
      try {
        const data = await apiFetch<IncidentComment[]>(`/reports/${reportId}/updates`);
        setCommentsMap((prev) => ({ ...prev, [reportId]: data || [] }));
      } catch (err) {
        console.warn("[FeedPage] Failed to fetch updates:", err);
      } finally {
        setLoadingCommentsId(null);
      }
    }
  };

  // Post a context update
  const handlePostComment = async (reportId: string) => {
    if (!commentInputText.trim() || submittingCommentId) return;
    setSubmittingCommentId(reportId);

    try {
      const newComment = await apiFetch<IncidentComment>(`/reports/${reportId}/updates`, {
        method: "POST",
        body: JSON.stringify({ content: commentInputText.trim() }),
      });

      setCommentsMap((prev) => ({
        ...prev,
        [reportId]: [newComment, ...(prev[reportId] || [])],
      }));
      setCommentInputText("");
    } catch (err: any) {
      alert(err.message || (isBn ? "আপডেট পোস্ট করা যায়নি" : "Failed to submit update."));
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handleShare = (incident: Incident) => {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/reports/${incident.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(incident.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filtered and Sorted Incidents
  const filteredIncidents = useMemo(() => {
    let result = incidents.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchesCategory = item.category.toLowerCase().includes(q);
      const matchesDescription = item.description && item.description.toLowerCase().includes(q);
      const matchesSource = item.sourceName && item.sourceName.toLowerCase().includes(q);
      const matchesLocation = extractLocationName(item).toLowerCase().includes(q);
      return matchesCategory || matchesDescription || matchesSource || matchesLocation;
    });

    if (sortBy === "NEWEST") {
      result = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "MOST_UPVOTED") {
      result = result.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sortBy === "SEVERITY_HIGH") {
      const score = (s: string) => (s === "HIGH" ? 3 : s === "MEDIUM" ? 2 : 1);
      result = result.sort((a, b) => score(b.severity) - score(a.severity));
    }

    return result;
  }, [incidents, searchQuery, sortBy]);

  // Derived Telemetry Counts
  const activeCount = incidents.length;
  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === "HIGH").length,
    [incidents]
  );
  const nightCount = useMemo(
    () => incidents.filter((i) => i.isNightReport).length,
    [incidents]
  );
  const totalVotes = useMemo(
    () => incidents.reduce((sum, i) => sum + i.upvotes, 0),
    [incidents]
  );

  const CATEGORY_TABS: {
    id: string;
    labelEn: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "ALL", labelEn: "All Reports", labelBn: "সকল বিপদ", icon: Layers },
    { id: "SNATCHING", labelEn: "Snatching", labelBn: "ছিনতাই", icon: Siren },
    { id: "ARMED_ASSAULT", labelEn: "Armed Assault", labelBn: "অস্ত্রসহ হামলা", icon: Swords },
    { id: "SNATCHING_ARMED_ASSAULT", labelEn: "Snatching & Armed Assault", labelBn: "ছিনতাই ও অস্ত্রসহ হামলা", icon: ShieldAlert },
    { id: "THEFT", labelEn: "Theft", labelBn: "চুরি", icon: Lock },
    { id: "ROBBERY", labelEn: "Robbery", labelBn: "ডাকাতি", icon: ShieldAlert },
    { id: "THEFT_ROBBERY", labelEn: "Theft & Robbery", labelBn: "চুরি ডাকাতি", icon: ShieldAlert },
    { id: "EXTORTION", labelEn: "Extortion", labelBn: "চাঁদাবাজি", icon: AlertOctagon },
    { id: "YOUTH_GANG_ACTIVITY", labelEn: "Youth Gang Activity", labelBn: "কিশোর গ্যাং", icon: Users },
    { id: "DRUG_RELATED_CRIME", labelEn: "Drug-Related Crime", labelBn: "মাদক সংক্রান্ত অপরাধ", icon: Pill },
    { id: "ROAD_ACCIDENT", labelEn: "Road Accident", labelBn: "সড়ক দুর্ঘটনা / এক্সিডেন্ট", icon: Car },
    { id: "UNLIT_ROAD", labelEn: "Unlit Road", labelBn: "অন্ধকার রাস্তা", icon: LightbulbOff },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-red-500 selection:text-white">
      {/* World-Class Single Daylight Navbar (No auxiliary route test strip, integrated language switch) */}
      <Navbar
        totalIncidents={activeCount}
        showFilters={false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Hero Banner */}
        <section className="mb-6 sm:mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
                  <Radio className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                  <span>{isBn ? "লাইভ ক্রাউডসোর্সড নেটওয়ার্ক" : "Live Crowdsourced Grid"}</span>
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400">
                  PostGIS • 64 Districts
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {isBn ? "নাগরিক নিরাপত্তা ও বিপদ সংকেত ফিড" : "Civic Safety Incident Explorer"}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {isBn
                  ? "বাংলাদেশজুড়ে সরাসরি যাচাইকৃত ছিনতাই, চুরি, অন্ধকার সড়ক ও জননিরাপত্তা ঝুঁকির রিয়েল-টাইম তথ্য এবং অবস্থান।"
                  : "Authoritative, community-corroborated, and press-verified safety telemetry protecting citizens in real time."}
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
              <button
                onClick={fetchIncidents}
                disabled={isLoading}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-2xs border border-slate-200"
                title={isBn ? "ফিড রিফ্রেশ করুন" : "Refresh Safety Feed"}
              >
                <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
                <span>{isBn ? "রিফ্রেশ" : "Refresh"}</span>
              </button>

              <Link
                href="/"
                className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-2xs"
              >
                <Map className="w-4 h-4 text-blue-600" />
                <span>{isBn ? "ম্যাপে দেখুন" : "View Map"}</span>
              </Link>

              <Link
                href="/report"
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-md shadow-red-600/20 ring-1 ring-red-500/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isBn ? "নতুন বিপদ রিপোর্ট" : "Report Hazard"}</span>
              </Link>
            </div>
          </div>

          {/* Dynamic Real-Data Telemetry Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Active Reports */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {isBn ? "সক্রিয় সতর্কতা" : "Active Hazards"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {activeCount}
                </span>
              </div>
            </div>

            {/* Critical Red Zones */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {isBn ? "উচ্চ ঝুঁকি (Critical)" : "Critical Red Zones"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-red-600 font-mono">
                  {criticalCount}
                </span>
              </div>
            </div>

            {/* Night Incidents */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {isBn ? "রাত্রিকালীন ঘটনা" : "Night Incidents"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-indigo-900 font-mono">
                  {nightCount}
                </span>
              </div>
            </div>

            {/* Community Upvotes */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
                <ThumbsUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {isBn ? "নাগরিক সমর্থন" : "Confirmations"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {totalVotes}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tactical Search & Filter Command Console */}
        <section className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 mb-6 shadow-xs space-y-4">
          {/* Top Row: Search input + Night Toggle + Sorting */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  isBn
                    ? "বিপদ শিরোনাম, এলাকা বা জেলা দিয়ে খুঁজুন..."
                    : "Search by keyword, district, landmark or press source..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Night Filter Button */}
            <button
              onClick={() => setNightFilter(!nightFilter)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all active:scale-95 shrink-0 ${
                nightFilter
                  ? "bg-indigo-900 text-white border-indigo-900 shadow-md shadow-indigo-950/20"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <Moon className={`w-4 h-4 ${nightFilter ? "text-amber-300" : "text-indigo-600"}`} />
              <span>{isBn ? "রাতের ঘটনা (৬টা - ৬টা)" : "Night Incidents (6PM - 6AM)"}</span>
            </button>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                {isBn ? "ক্রমবিন্যাস:" : "Sort:"}
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="NEWEST">{isBn ? "সর্বশেষ প্রকাশিত" : "Newest First"}</option>
                <option value="MOST_UPVOTED">{isBn ? "সর্বাধিক সমর্থিত" : "Most Upvoted"}</option>
                <option value="SEVERITY_HIGH">{isBn ? "উচ্চ বিপদ আগে" : "High Severity"}</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: Category Chips & Severity Switch */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              {CATEGORY_TABS.map((tab) => {
                const isSelected = categoryFilter === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all shrink-0 ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-500"}`} />
                    <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Severity Segmented Switch */}
            <div className="flex items-center gap-1 self-start lg:self-auto bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">
                {isBn ? "তীব্রতা:" : "Severity:"}
              </span>
              {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
                const isSelected = severityFilter === sev;
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`text-[11px] px-2.5 py-1 rounded-xl font-bold transition-all ${
                      isSelected
                        ? sev === "HIGH"
                          ? "bg-red-600 text-white shadow-2xs"
                          : sev === "MEDIUM"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : sev === "LOW"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {sev === "ALL" ? (isBn ? "সকল" : "All") : sev}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Content Viewport */}
        {isLoading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-3.5 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-24 bg-slate-200 rounded-full" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-100 rounded" />
                <div className="h-3.5 w-5/6 bg-slate-100 rounded" />
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-6 w-20 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-red-50 border border-red-200 rounded-3xl p-8 sm:p-12 text-center text-red-900 max-w-lg mx-auto shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-2xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-red-900">
              {isBn ? "তথ্য লোড করতে ত্রুটি হয়েছে" : "Unable to Load Incident Grid"}
            </h3>
            <p className="text-xs text-red-700 leading-relaxed max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchIncidents}
              className="mt-2 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? "পুনরায় চেষ্টা করুন" : "Retry Connection"}</span>
            </button>
          </div>
        ) : filteredIncidents.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-10 sm:p-16 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">
                {isBn ? "কোনো সক্রিয় বিপদ পাওয়া যায়নি" : "All Clear in Selected Sector"}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                {isBn
                  ? "নির্বাচিত ফিল্টার বা ক্যাটাগরিতে বর্তমানে কোনো বিপদ সংকেত নেই। আপনি নতুন কোনো ঘটনার মুখোমুখি হলে রিপোর্ট করতে পারেন।"
                  : "No active public safety incidents match your selected filters. You can reset filters or report an incident to protect fellow citizens."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  setCategoryFilter("ALL");
                  setSeverityFilter("ALL");
                  setNightFilter(false);
                  setSearchQuery("");
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 border border-slate-200"
              >
                {isBn ? "ফিল্টার মুছুন" : "Reset Filters"}
              </button>
              <Link
                href="/report"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition active:scale-95 shadow-md shadow-red-600/20"
              >
                {isBn ? "নতুন রিপোর্ট করুন" : "Submit Incident"}
              </Link>
            </div>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIncidents.map((incident) => {
              const isHigh = incident.severity === "HIGH";
              const isMedium = incident.severity === "MEDIUM";
              const locationStr = extractLocationName(incident);
              const remainingTime = formatRemainingExpiry(incident.expiresAt, language as any);
              const comments = commentsMap[incident.id] || [];
              const isCommentsOpen = expandedCommentsId === incident.id;

              return (
                <article
                  key={incident.id}
                  className={`bg-white border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                    isHigh
                      ? "border-slate-200 hover:border-red-300 ring-1 ring-red-500/10"
                      : isMedium
                      ? "border-slate-200 hover:border-amber-300"
                      : "border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Card Header: Severity Badge + Relative Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 tracking-wider ${
                            isHigh
                              ? "bg-red-50 text-red-700 border-red-200"
                              : isMedium
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {isHigh && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                            </span>
                          )}
                          <span>{incident.severity} SEVERITY</span>
                        </span>

                        {incident.isNightReport && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Moon className="w-3 h-3 text-indigo-500" />
                            <span>{isBn ? "রাত্রিকালীন" : "Night"}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatRelativeTime(incident.createdAt, language as any)}</span>
                      </div>
                    </div>

                    {/* Category Title & Landmark Tag */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                        <span>{incident.category.replace("_", " ")}</span>
                        {remainingTime && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            • {remainingTime}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {incident.description && incident.description.startsWith("[")
                          ? incident.description.split("] ")[1]?.split(" - ")[0] || incident.description
                          : incident.description || (isBn ? "বিপদ সংক্রান্ত তথ্য" : "Hazard Incident Pin")}
                      </h3>
                    </div>

                    {/* Location & Cryptographic Fuzzed Coordinates */}
                    <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-800 font-semibold truncate">
                        <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate">{locationStr}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>
                          {incident.latitude.toFixed(4)}°N, {incident.longitude.toFixed(4)}°E
                        </span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {incident.fuzzedRadiusMeters || 150}m fuzzed
                        </span>
                      </div>
                    </div>

                    {/* Verified Press Article Badge (if crawled or linked) */}
                    {incident.sourceUrl && (
                      <div className="px-3 py-2 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900">
                        <div className="flex items-center gap-1.5 truncate">
                          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate font-semibold">
                            {isBn ? "সংবাদ সূত্রে যাচাইকৃত:" : "Verified Source:"}{" "}
                            {incident.sourceName || "Press Wire"}
                          </span>
                        </div>
                        <a
                          href={incident.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 shrink-0 ml-1 p-1"
                          title="Open Press Article"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Voting, Field Updates Drawer, and War Room CTA */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {/* Upvote & Downvote */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleVote(incident.id, 1)}
                          disabled={votingId === incident.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition active:scale-95"
                          title={isBn ? "সত্যতা সমর্থন (Upvote)" : "Confirm hazard presence"}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{incident.upvotes}</span>
                        </button>

                        <button
                          onClick={() => handleVote(incident.id, -1)}
                          disabled={votingId === incident.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition active:scale-95"
                          title={isBn ? "ভুয়া বা সমাধানকৃত (Downvote)" : "Dispute as false or resolved"}
                        >
                          <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                          <span>{incident.downvotes}</span>
                        </button>

                        {/* Inline Comments Accordion Toggle */}
                        <button
                          onClick={() => toggleComments(incident.id)}
                          className={`p-2 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                            isCommentsOpen
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                          title={isBn ? "মন্তব্য ও আপডেট দেখুন" : "View context updates"}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* Share link button */}
                        <button
                          onClick={() => handleShare(incident)}
                          className="p-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition active:scale-95"
                          title={copiedId === incident.id ? "Link Copied!" : "Copy War Room Link"}
                        >
                          {copiedId === incident.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* War Room Deep Dive CTA */}
                      <Link
                        href={`/reports/${incident.id}`}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <span>{isBn ? "ওয়ার রুম" : "War Room"}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {/* Expandable Context Updates / Comments Feed */}
                    {isCommentsOpen && (
                      <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          {isBn ? "ফিল্ড আপডেট ও মন্তব্য:" : "Citizen Field Updates:"}
                        </span>

                        {loadingCommentsId === incident.id ? (
                          <div className="py-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>{isBn ? "আপডেট লোড হচ্ছে..." : "Loading updates..."}</span>
                          </div>
                        ) : comments.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">
                            {isBn ? "এখনো কোনো আপডেট নেই। প্রথম আপডেট জানান।" : "No field updates yet. Be the first to report situation."}
                          </p>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                            {comments.map((c) => (
                              <div
                                key={c.id}
                                className="bg-slate-50 border border-slate-200/70 rounded-xl p-2 text-xs space-y-0.5"
                              >
                                <p className="text-slate-800 leading-snug">{c.content}</p>
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  {formatRelativeTime(c.createdAt, language as any)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Update Input */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder={isBn ? "পরিস্থিতির আপডেট লিখুন..." : "Post live situation update..."}
                            value={commentInputText}
                            onChange={(e) => setCommentInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handlePostComment(incident.id);
                              }
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-500"
                          />
                          <button
                            onClick={() => handlePostComment(incident.id)}
                            disabled={!commentInputText.trim() || submittingCommentId === incident.id}
                            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition active:scale-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
