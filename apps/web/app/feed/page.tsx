"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useStatsStore } from "@/store/useStatsStore";
import { showToast } from "@/store/useToastStore";
import { getSocket } from "@/lib/socket";
import { formatCategoryLabel } from "@/lib/incidentUtils";
import { CATEGORY_VISUALS } from "@/lib/incidentCategoryVisuals";
import {
  SOCKET_EVENTS,
  getSocketReportId,
  ReportCategory,
  formatTimeTo12Hour,
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
  ChevronLeft,
  ChevronRight,
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
  activeTimeStart?: string | null;
  activeTimeEnd?: string | null;
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

/**
 * Converts "HH:mm" time string into total minutes of the day [0 - 1439]
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
}

/**
 * Checks whether minuteOfDay [0 - 1439] falls inside a window [start, end].
 * Handles overnight intervals crossing midnight cleanly (e.g. 18:00 to 06:00).
 */
function isMinuteInWindow(minuteOfDay: number, startStr: string, endStr: string): boolean {
  const s = parseTimeToMinutes(startStr);
  const e = parseTimeToMinutes(endStr);
  if (s <= e) {
    return minuteOfDay >= s && minuteOfDay <= e;
  }
  return minuteOfDay >= s || minuteOfDay <= e;
}

/**
 * Determines whether two 24-hour time windows overlap, properly handling midnight wraparound.
 */
function checkTimeWindowOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = parseTimeToMinutes(endB);

  const getIntervals = (s: number, e: number): [number, number][] => {
    if (s <= e) {
      return [[s, e]];
    }
    return [
      [s, 1439],
      [0, e],
    ];
  };

  const intervalsA = getIntervals(sA, eA);
  const intervalsB = getIntervals(sB, eB);

  for (const [a1, a2] of intervalsA) {
    for (const [b1, b2] of intervalsB) {
      if (Math.max(a1, b1) <= Math.min(a2, b2)) {
        return true;
      }
    }
  }
  return false;
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
  type UserTypeFilter = "ALL" | "CITIZEN" | "PRESS" | "VERIFIED_RESPONDER" | "MY_REPORTS";
  type TimeFilterMode = "ALL" | "NIGHT" | "DAY" | "CUSTOM";

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>("ALL");
  const [customStartTime, setCustomStartTime] = useState<string>("18:00");
  const [customEndTime, setCustomEndTime] = useState<string>("06:00");
  const [includeContinuous, setIncludeContinuous] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");

  // Filter System Dropdown state (Pushed to the right)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  const handleSelectCategory = (catId: string) => {
    setCategoryFilter(catId);
  };

  const applyTimePreset = (start: string, end: string, mode: TimeFilterMode) => {
    setCustomStartTime(start);
    setCustomEndTime(end);
    setTimeFilterMode(mode);
  };

  const hasActiveFilters =
    categoryFilter !== "ALL" ||
    userTypeFilter !== "ALL" ||
    severityFilter !== "ALL" ||
    timeFilterMode !== "ALL" ||
    searchQuery.trim().length > 0;

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== "ALL") count++;
    if (userTypeFilter !== "ALL") count++;
    if (severityFilter !== "ALL") count++;
    if (timeFilterMode !== "ALL") count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [categoryFilter, userTypeFilter, severityFilter, timeFilterMode, searchQuery]);

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setUserTypeFilter("ALL");
    setSeverityFilter("ALL");
    setTimeFilterMode("ALL");
    setCustomStartTime("18:00");
    setCustomEndTime("06:00");
    setIncludeContinuous(true);
    setSearchQuery("");
  };

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

      const data = await apiFetch<Incident[]>(query);
      setIncidents(data || []);
    } catch (err: any) {
      console.error("[FeedPage] Error fetching incidents:", err);
      setError(err.message || (isBn ? "তথ্য লোড করতে সমস্যা হয়েছে" : "Failed to load safety alerts."));
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, severityFilter, isBn]);

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

    const handleNewReport = (newReport: Incident & { threatStatus?: string; locationPrecision?: string; expiresAt?: string | Date }) => {
      if (newReport.status && newReport.status !== 'ACTIVE') return;
      if (newReport.threatStatus && newReport.threatStatus !== 'ACTIVE') return;
      if (newReport.locationPrecision === 'AMBIGUOUS') return;
      if (newReport.expiresAt && new Date(newReport.expiresAt).getTime() <= Date.now()) return;
      setIncidents((prev) => {
        if (prev.some((i) => i.id === newReport.id)) return prev;
        return [newReport, ...prev];
      });
      fetchStats();
    };

    const handleReportEnriched = (enriched: Incident & { threatStatus?: string; locationPrecision?: string; expiresAt?: string | Date }) => {
      const isInactive =
        enriched.status === 'RESOLVED' ||
        enriched.status === 'PURGED' ||
        (enriched.threatStatus && enriched.threatStatus !== 'ACTIVE') ||
        enriched.locationPrecision === 'AMBIGUOUS' ||
        (enriched.expiresAt && new Date(enriched.expiresAt).getTime() <= Date.now());

      setIncidents((prev) => {
        if (isInactive) {
          return prev.filter((item) => item.id !== enriched.id);
        }
        if (prev.some((item) => item.id === enriched.id)) {
          return prev.map((item) => (item.id === enriched.id ? { ...item, ...enriched } : item));
        }
        return [enriched, ...prev];
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
    socket.on(SOCKET_EVENTS.REPORT_ENRICHED, handleReportEnriched);
    socket.on(SOCKET_EVENTS.REPORT_VOTED, handleReportVoted);
    socket.on(SOCKET_EVENTS.REPORT_RESOLVED, handleReportResolved);
    socket.on(SOCKET_EVENTS.REPORT_PURGED, handleReportPurged);
    socket.on(SOCKET_EVENTS.REPORT_EXPIRED, handleReportExpired);
    socket.on(SOCKET_EVENTS.REPORT_VERIFIED, handleReportVerified);

    return () => {
      socket.off(SOCKET_EVENTS.NEW_REPORT, handleNewReport);
      socket.off(SOCKET_EVENTS.REPORT_ENRICHED, handleReportEnriched);
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
      showToast(err.message || (isBn ? "ভোট সম্পন্ন করা যায়নি" : "Failed to record vote."), "error");
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
      showToast(err.message || (isBn ? "আপডেট পোস্ট করা যায়নি" : "Failed to submit update."), "error");
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
      // User / Reporter Source Filter
      if (userTypeFilter === "PRESS") {
        if (!item.sourceUrl && !item.sourceName) return false;
      } else if (userTypeFilter === "CITIZEN") {
        if (item.sourceUrl || item.sourceName) return false;
      } else if (userTypeFilter === "VERIFIED_RESPONDER") {
        const isResponder =
          item.isGpsVerified ||
          (item as any).verificationStage === "COMMUNITY_CONFIRMED" ||
          (item as any).verificationStage === "ADMIN_VERIFIED";
        if (!isResponder) return false;
      } else if (userTypeFilter === "MY_REPORTS") {
        const currentUserId = user?.id;
        const currentAnonId = (user as any)?.anonymousId;
        if (!currentUserId && !currentAnonId) return false;
        const isOwner =
          (currentUserId && (item as any).userId === currentUserId) ||
          (currentAnonId && (item as any).anonymousId === currentAnonId);
        if (!isOwner) return false;
      }

      // Time Window & Hazard Schedule Filter
      if (timeFilterMode !== "ALL") {
        const filterStart = customStartTime;
        const filterEnd = customEndTime;

        // Incident has an explicit danger schedule (e.g. 18:00 - 06:00, or 14:00 - 18:00)
        if (item.activeTimeStart && item.activeTimeEnd) {
          const overlaps = checkTimeWindowOverlap(
            item.activeTimeStart,
            item.activeTimeEnd,
            filterStart,
            filterEnd
          );
          if (!overlaps) return false;
        } else if (item.isNightReport) {
          // Night report with implicit 18:00 - 06:00 window
          const overlaps = checkTimeWindowOverlap("18:00", "06:00", filterStart, filterEnd);
          if (!overlaps) return false;
        } else {
          // Continuous 24/7 or unscheduled report
          if (!includeContinuous) {
            if (item.createdAt) {
              const d = new Date(item.createdAt);
              const bstMinutes = ((d.getUTCHours() + 6) % 24) * 60 + d.getUTCMinutes();
              if (!isMinuteInWindow(bstMinutes, filterStart, filterEnd)) {
                return false;
              }
            } else {
              return false;
            }
          }
        }
      }

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
  }, [incidents, userTypeFilter, user, searchQuery, sortBy, timeFilterMode, customStartTime, customEndTime, includeContinuous]);

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
    {
      id: "SNATCHING",
      labelEn: CATEGORY_VISUALS.SNATCHING.labelEn,
      labelBn: CATEGORY_VISUALS.SNATCHING.labelBn,
      icon: CATEGORY_VISUALS.SNATCHING.icon,
    },
    {
      id: "ARMED_ASSAULT",
      labelEn: CATEGORY_VISUALS.ARMED_ASSAULT.labelEn,
      labelBn: CATEGORY_VISUALS.ARMED_ASSAULT.labelBn,
      icon: CATEGORY_VISUALS.ARMED_ASSAULT.icon,
    },
    {
      id: "SNATCHING_ARMED_ASSAULT",
      labelEn: CATEGORY_VISUALS.SNATCHING_ARMED_ASSAULT.labelEn,
      labelBn: CATEGORY_VISUALS.SNATCHING_ARMED_ASSAULT.labelBn,
      icon: CATEGORY_VISUALS.SNATCHING_ARMED_ASSAULT.icon,
    },
    {
      id: "THEFT",
      labelEn: CATEGORY_VISUALS.THEFT.labelEn,
      labelBn: CATEGORY_VISUALS.THEFT.labelBn,
      icon: CATEGORY_VISUALS.THEFT.icon,
    },
    {
      id: "ROBBERY",
      labelEn: CATEGORY_VISUALS.ROBBERY.labelEn,
      labelBn: CATEGORY_VISUALS.ROBBERY.labelBn,
      icon: CATEGORY_VISUALS.ROBBERY.icon,
    },
    {
      id: "THEFT_ROBBERY",
      labelEn: CATEGORY_VISUALS.THEFT_ROBBERY.labelEn,
      labelBn: CATEGORY_VISUALS.THEFT_ROBBERY.labelBn,
      icon: CATEGORY_VISUALS.THEFT_ROBBERY.icon,
    },
    {
      id: "EXTORTION",
      labelEn: CATEGORY_VISUALS.EXTORTION.labelEn,
      labelBn: CATEGORY_VISUALS.EXTORTION.labelBn,
      icon: CATEGORY_VISUALS.EXTORTION.icon,
    },
    {
      id: "YOUTH_GANG_ACTIVITY",
      labelEn: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.labelEn,
      labelBn: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.labelBn,
      icon: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.icon,
    },
    {
      id: "DRUG_RELATED_CRIME",
      labelEn: CATEGORY_VISUALS.DRUG_RELATED_CRIME.labelEn,
      labelBn: CATEGORY_VISUALS.DRUG_RELATED_CRIME.labelBn,
      icon: CATEGORY_VISUALS.DRUG_RELATED_CRIME.icon,
    },
    {
      id: "ROAD_ACCIDENT",
      labelEn: CATEGORY_VISUALS.ROAD_ACCIDENT.labelEn,
      labelBn: CATEGORY_VISUALS.ROAD_ACCIDENT.labelBn,
      icon: CATEGORY_VISUALS.ROAD_ACCIDENT.icon,
    },
    {
      id: "UNLIT_ROAD",
      labelEn: CATEGORY_VISUALS.UNLIT_ROAD.labelEn,
      labelBn: CATEGORY_VISUALS.UNLIT_ROAD.labelBn,
      icon: CATEGORY_VISUALS.UNLIT_ROAD.icon,
    },
  ];

  const SEVERITY_OPTIONS = [
    {
      id: "ALL",
      labelEn: "All",
      labelBn: "সকল",
      activeClass: "bg-white text-slate-900 shadow-2xs ring-1 ring-slate-900/5",
      dotClass: null,
    },
    {
      id: "HIGH",
      labelEn: "High",
      labelBn: "উচ্চ",
      activeClass: "bg-red-600 text-white shadow-2xs",
      dotClass: "bg-red-500",
    },
    {
      id: "MEDIUM",
      labelEn: "Medium",
      labelBn: "মাঝারি",
      activeClass: "bg-amber-500 text-white shadow-2xs",
      dotClass: "bg-amber-500",
    },
    {
      id: "LOW",
      labelEn: "Low",
      labelBn: "স্বল্প",
      activeClass: "bg-emerald-600 text-white shadow-2xs",
      dotClass: "bg-emerald-500",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-red-500 selection:text-white overflow-x-hidden w-full">
      {/* World-Class Single Daylight Navbar (No auxiliary route test strip, integrated language switch) */}
      <Navbar
        totalIncidents={activeCount}
        showFilters={false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Active Reports */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider block truncate"
                  title={isBn ? "সক্রিয় সতর্কতা" : "Active Hazards"}
                >
                  {isBn ? "সক্রিয় সতর্কতা" : "Active Hazards"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono block">
                  {activeCount}
                </span>
              </div>
            </div>

            {/* Critical Red Zones */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 shrink-0">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider block truncate"
                  title={isBn ? "উচ্চ ঝুঁকি (Critical)" : "Critical Red Zones"}
                >
                  {isBn ? "উচ্চ ঝুঁকি" : "Critical Red Zones"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-red-600 font-mono block">
                  {criticalCount}
                </span>
              </div>
            </div>

            {/* Night Incidents */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
                <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider block truncate"
                  title={isBn ? "রাত্রিকালীন ঘটনা" : "Night Incidents"}
                >
                  {isBn ? "রাত্রিকালীন ঘটনা" : "Night Incidents"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-indigo-900 font-mono block">
                  {nightCount}
                </span>
              </div>
            </div>

            {/* Community Upvotes / Confirmations */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
                <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider block truncate"
                  title={isBn ? "নাগরিক সমর্থন" : "Confirmations"}
                >
                  {isBn ? "নাগরিক সমর্থন" : "Confirmations"}
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono block">
                  {totalVotes}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tactical Search & Filter Command Console */}
        <section className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 mb-6 shadow-xs space-y-3.5">
          {/* Main Command Bar: Search on Left, Filter Console Trigger & Actions Pushed to Right */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
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
                className="w-full h-10 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1 rounded-md"
                  aria-label={isBn ? "অনুসন্ধান মুছুন" : "Clear search"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right-Pushed Action Cluster */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Sort Dropdown (Desktop & Tablet) */}
              <div className="h-10 hidden sm:inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 transition-colors hover:bg-slate-100/60 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  aria-label={isBn ? "সাজানোর ক্রম" : "Sort order"}
                >
                  <option value="NEWEST">{isBn ? "সর্বশেষ প্রকাশিত" : "Newest First"}</option>
                  <option value="MOST_UPVOTED">{isBn ? "সর্বাধিক সমর্থিত" : "Most Upvoted"}</option>
                  <option value="SEVERITY_HIGH">{isBn ? "উচ্চ বিপদ আগে" : "High Severity"}</option>
                </select>
              </div>

              {/* Dedicated Filter Trigger Button (Pushed to the Right) */}
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                className={`h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all active:scale-95 shadow-2xs select-none ${
                  isFilterMenuOpen || activeFiltersCount > 0
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10"
                    : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300"
                }`}
                aria-expanded={isFilterMenuOpen}
                aria-label={isBn ? "ফিল্টার সিস্টেম খুলুন" : "Open filter system"}
              >
                <SlidersHorizontal className={`w-3.5 h-3.5 ${isFilterMenuOpen || activeFiltersCount > 0 ? "text-red-400" : "text-slate-600"}`} />
                <span className="whitespace-nowrap">{isBn ? "ফিল্টার" : "Filters"}</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isFilterMenuOpen ? "rotate-180 text-white" : "text-slate-400"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Active Filter Chips Bar (Visible when any filter or search is active) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none mr-0.5">
                {isBn ? "সক্রিয় ফিল্টার:" : "Active:"}
              </span>

              {categoryFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold text-xs shadow-2xs">
                  <Layers className="w-3 h-3 text-slate-300" />
                  <span>
                    {isBn
                      ? CATEGORY_TABS.find((c) => c.id === categoryFilter)?.labelBn || categoryFilter
                      : CATEGORY_TABS.find((c) => c.id === categoryFilter)?.labelEn || categoryFilter}
                  </span>
                  <button
                    onClick={() => handleSelectCategory("ALL")}
                    className="hover:text-red-300 ml-0.5 p-0.5"
                    aria-label={isBn ? "ক্যাটাগরি ফিল্টার মুছুন" : "Remove category filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {userTypeFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-700 text-white font-semibold text-xs shadow-2xs">
                  <Users className="w-3 h-3 text-blue-200" />
                  <span>
                    {userTypeFilter === "CITIZEN"
                      ? isBn ? "নাগরিক রিপোর্ট" : "Citizen Reports"
                      : userTypeFilter === "PRESS"
                        ? isBn ? "সংবাদ মাধ্যম" : "Press & News"
                        : userTypeFilter === "VERIFIED_RESPONDER"
                          ? isBn ? "যাচাইকৃত রেসপন্ডার" : "Verified Responders"
                          : isBn ? "আমার রিপোর্ট" : "My Reports"}
                  </span>
                  <button
                    onClick={() => setUserTypeFilter("ALL")}
                    className="hover:text-blue-200 ml-0.5 p-0.5"
                    aria-label={isBn ? "ব্যবহারকারী ফিল্টার মুছুন" : "Remove user filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {severityFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold text-xs shadow-2xs">
                  <span>
                    {isBn
                      ? SEVERITY_OPTIONS.find((s) => s.id === severityFilter)?.labelBn || severityFilter
                      : SEVERITY_OPTIONS.find((s) => s.id === severityFilter)?.labelEn || severityFilter}{" "}
                    {isBn ? "ঝুঁকি" : "Risk"}
                  </span>
                  <button
                    onClick={() => setSeverityFilter("ALL")}
                    className="hover:text-red-200 ml-0.5 p-0.5"
                    aria-label={isBn ? "তীব্রতা ফিল্টার মুছুন" : "Remove severity filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {timeFilterMode === "NIGHT" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-900 text-white font-semibold text-xs shadow-2xs">
                  <Moon className="w-3 h-3 text-amber-300 fill-amber-300/30" />
                  <span>{isBn ? "রাতের ঘটনা (৬টা-৬টা)" : "Night (6PM-6AM)"}</span>
                  <button
                    onClick={() => setTimeFilterMode("ALL")}
                    className="hover:text-amber-200 ml-0.5 p-0.5"
                    aria-label={isBn ? "রাতের ফিল্টার মুছুন" : "Remove night filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {timeFilterMode === "DAY" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold text-xs shadow-2xs">
                  <span>☀️ {isBn ? "দিনের বেলা (৬টা-৬টা)" : "Daytime (6AM-6PM)"}</span>
                  <button
                    onClick={() => setTimeFilterMode("ALL")}
                    className="hover:text-amber-200 ml-0.5 p-0.5"
                    aria-label={isBn ? "দিনের ফিল্টার মুছুন" : "Remove daytime filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {timeFilterMode === "CUSTOM" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-900 text-white font-semibold text-xs shadow-2xs">
                  <Clock className="w-3 h-3 text-amber-300" />
                  <span>
                    {isBn ? "সময়সীমা:" : "Time:"} {formatTimeTo12Hour(customStartTime)} – {formatTimeTo12Hour(customEndTime)}
                  </span>
                  <button
                    onClick={() => setTimeFilterMode("ALL")}
                    className="hover:text-amber-200 ml-0.5 p-0.5"
                    aria-label={isBn ? "সময় ফিল্টার মুছুন" : "Remove time filter"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 font-semibold text-xs shadow-2xs">
                  <Search className="w-3 h-3 text-slate-500" />
                  <span className="max-w-[120px] truncate">&ldquo;{searchQuery}&rdquo;</span>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:text-red-600 ml-0.5 p-0.5"
                    aria-label={isBn ? "অনুসন্ধান মুছুন" : "Remove search query"}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isBn ? "সব মুছুন" : "Clear All"}</span>
              </button>
            </div>
          )}

          {/* Expandable Filter System Console Dropdown */}
          {isFilterMenuOpen && (
            <div className="pt-3 border-t border-slate-100">
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-2xs">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {isBn ? "ফিল্টার সিস্টেম ও কাস্টমাইজেশন" : "Safety Telemetry Filter System"}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {isBn ? "নির্দিষ্ট ক্যাটাগরি, ব্যবহারকারী বা উৎস অনুযায়ী ফিল্টার করুন" : "Refine incidents by category, user source, severity, and schedule"}
                      </p>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isBn ? "রিসেট করুন" : "Reset All"}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Dropdown 1: Related User / Reporter Source ("select the related user I want to see") */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? "ব্যবহারকারী বা উৎস ফিল্টার" : "Related User / Reporter"}</span>
                    </label>
                    <div className="relative">
                      <select
                        value={userTypeFilter}
                        onChange={(e) => setUserTypeFilter(e.target.value as UserTypeFilter)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 cursor-pointer shadow-2xs appearance-none pr-8"
                        aria-label={isBn ? "ব্যবহারকারী বা উৎস ফিল্টার" : "Filter by user or source"}
                      >
                        <option value="ALL">{isBn ? "সকল ব্যবহারকারী ও উৎস" : "All Users & Sources"}</option>
                        <option value="CITIZEN">{isBn ? "নাগরিক রিপোর্ট (Citizen Submissions)" : "Citizen Reports"}</option>
                        <option value="PRESS">{isBn ? "সংবাদ মাধ্যম (Google News BD Verified)" : "Press & News Media"}</option>
                        <option value="VERIFIED_RESPONDER">{isBn ? "যাচাইকৃত রেসপন্ডার (Admin / GPS)" : "Verified Responders"}</option>
                        {user && (
                          <option value="MY_REPORTS">{isBn ? "আমার রিপোর্ট (My Incident Reports)" : "My Reports"}</option>
                        )}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Dropdown 2: Incident Category Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-700" />
                      <span>{isBn ? "বিপদের ধরন (ক্যাটাগরি)" : "Incident Category"}</span>
                    </label>
                    <div className="relative">
                      <select
                        value={categoryFilter}
                        onChange={(e) => handleSelectCategory(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 cursor-pointer shadow-2xs appearance-none pr-8"
                        aria-label={isBn ? "বিপদের ধরন ফিল্টার" : "Filter by incident category"}
                      >
                        {CATEGORY_TABS.map((tab) => (
                          <option key={tab.id} value={tab.id} data-category-id={tab.id}>
                            {isBn ? tab.labelBn : tab.labelEn}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Threat Severity Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      <span>{isBn ? "ঝুঁকির মাত্রা (Severity)" : "Threat Severity"}</span>
                    </label>
                    <div className="h-10 flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      {SEVERITY_OPTIONS.map((opt) => {
                        const isSelected = severityFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSeverityFilter(opt.id)}
                            className={`flex-1 h-8 text-xs rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-1 ${
                              isSelected
                                ? opt.activeClass
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            {opt.dotClass && <span className={`w-1.5 h-1.5 rounded-full ${opt.dotClass}`} />}
                            <span>{isBn ? opt.labelBn : opt.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Window Switcher & Custom Range Selector */}
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isBn ? "বিপদের সময়সীমা ও সক্রিয় সময় ফিল্টার" : "Danger Schedule & Active Hours Filter"}</span>
                      </label>
                      {timeFilterMode !== "ALL" && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          {timeFilterMode === "NIGHT"
                            ? isBn ? "রাত ৬:০০ PM — সকাল ৬:০০ AM" : "06:00 PM — 06:00 AM (BST)"
                            : timeFilterMode === "DAY"
                              ? isBn ? "সকাল ৬:০০ AM — সন্ধ্যা ৬:০০ PM" : "06:00 AM — 06:00 PM (BST)"
                              : `${formatTimeTo12Hour(customStartTime)} — ${formatTimeTo12Hour(customEndTime)} (BST)`}
                        </span>
                      )}
                    </div>

                    {/* Quick Mode Switches */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTimeFilterMode("ALL")}
                        className={`h-8 px-3 text-xs rounded-lg font-semibold transition-all ${
                          timeFilterMode === "ALL"
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        {isBn ? "সার্বক্ষণিক (২৪ ঘণ্টা)" : "24 Hours (All Day)"}
                      </button>

                      <button
                        type="button"
                        onClick={() => applyTimePreset("18:00", "06:00", "NIGHT")}
                        className={`h-8 px-3 text-xs rounded-lg font-semibold inline-flex items-center gap-1.5 transition-all ${
                          timeFilterMode === "NIGHT"
                            ? "bg-indigo-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        <Moon className={`w-3 h-3 ${timeFilterMode === "NIGHT" ? "text-amber-300 fill-amber-300/30" : "text-indigo-600"}`} />
                        <span>{isBn ? "রাত (৬টা - ৬টা)" : "Night (6PM - 6AM)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyTimePreset("06:00", "18:00", "DAY")}
                        className={`h-8 px-3 text-xs rounded-lg font-semibold inline-flex items-center gap-1.5 transition-all ${
                          timeFilterMode === "DAY"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        <span>☀️ {isBn ? "দিনের বেলা (৬টা - ৬টা)" : "Daytime (6AM - 6PM)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyTimePreset("18:00", "22:00", "CUSTOM")}
                        className={`h-8 px-2.5 text-xs rounded-lg font-semibold transition-all hidden sm:inline-flex items-center gap-1 ${
                          timeFilterMode === "CUSTOM" && customStartTime === "18:00" && customEndTime === "22:00"
                            ? "bg-indigo-700 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        <span>🌆 {isBn ? "সন্ধ্যা (৬টা - ১০টা)" : "Evening (6PM - 10PM)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyTimePreset("22:00", "04:00", "CUSTOM")}
                        className={`h-8 px-2.5 text-xs rounded-lg font-semibold transition-all hidden sm:inline-flex items-center gap-1 ${
                          timeFilterMode === "CUSTOM" && customStartTime === "22:00" && customEndTime === "04:00"
                            ? "bg-purple-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        <span>🌃 {isBn ? "গভীর রাত (১০টা - ৪টা)" : "Late Night (10PM - 4AM)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTimeFilterMode("CUSTOM")}
                        className={`h-8 px-3 text-xs rounded-lg font-semibold inline-flex items-center gap-1.5 transition-all ${
                          timeFilterMode === "CUSTOM"
                            ? "bg-slate-800 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                        }`}
                      >
                        <SlidersHorizontal className="w-3 h-3 text-slate-300" />
                        <span>{isBn ? "যেকোনো সময় (Custom Time)" : "Custom Time Window"}</span>
                      </button>
                    </div>

                    {/* Custom Time Pickers (Visible when Custom, Day, or Night is active) */}
                    {timeFilterMode !== "ALL" && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                          {/* Start Time Input */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                {isBn ? "শুরুর সময় (From Time)" : "Start Time (From)"}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {formatTimeTo12Hour(customStartTime)}
                              </span>
                            </div>
                            <input
                              type="time"
                              value={customStartTime}
                              onChange={(e) => {
                                setCustomStartTime(e.target.value);
                                setTimeFilterMode("CUSTOM");
                              }}
                              className="h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer shadow-2xs"
                              aria-label={isBn ? "শুরুর সময় নির্বাচন করুন" : "Select start time"}
                            />
                          </div>

                          {/* End Time Input */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                {isBn ? "শেষ সময় (To Time)" : "End Time (To)"}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {formatTimeTo12Hour(customEndTime)}
                              </span>
                            </div>
                            <input
                              type="time"
                              value={customEndTime}
                              onChange={(e) => {
                                setCustomEndTime(e.target.value);
                                setTimeFilterMode("CUSTOM");
                              }}
                              className="h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer shadow-2xs"
                              aria-label={isBn ? "শেষ সময় নির্বাচন করুন" : "Select end time"}
                            />
                          </div>
                        </div>

                        {/* Include 24/7 continuous hazards checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-900 pt-0.5">
                          <input
                            type="checkbox"
                            checked={includeContinuous}
                            onChange={(e) => setIncludeContinuous(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10 cursor-pointer"
                          />
                          <span>
                            {isBn
                              ? "সার্বক্ষণিক (২৪ ঘণ্টা) চলমান ঝুঁকিও অন্তর্ভুক্ত রাখুন"
                              : "Also include 24/7 continuous hazards (active around the clock)"}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Mobile Sort Option */}
                  <div className="space-y-1.5 sm:hidden">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                      <span>{isBn ? "সাজানোর ক্রম" : "Sort Order"}</span>
                    </label>
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 cursor-pointer shadow-2xs appearance-none pr-8"
                      >
                        <option value="NEWEST">{isBn ? "সর্বশেষ প্রকাশিত" : "Newest First"}</option>
                        <option value="MOST_UPVOTED">{isBn ? "সর্বাধিক সমর্থিত" : "Most Upvoted"}</option>
                        <option value="SEVERITY_HIGH">{isBn ? "উচ্চ বিপদ আগে" : "High Severity"}</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {isBn
                      ? `${filteredIncidents.length} টি ফলাফল পাওয়া গেছে`
                      : `${filteredIncidents.length} matching incident(s)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    {isBn ? "প্রয়োগ ও সম্পন্ন" : "Apply & Close"}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                onClick={handleResetFilters}
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
                        <span>{formatCategoryLabel(incident.category, language)}</span>
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
