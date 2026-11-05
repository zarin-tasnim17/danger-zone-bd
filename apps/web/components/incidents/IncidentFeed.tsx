"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useFilterStore } from "@/store/useFilterStore";
import { getTranslation } from "@/lib/translations";
import { DangerIncident } from "@repo/shared";
import {
  AlertCircle,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Crosshair,
  ArrowUpRight,
  Send,
  Clock,
  Radio,
  Search,
  RotateCcw,
  PlusCircle,
  Loader2,
  ShieldAlert,
  PhoneCall,
  Flame,
} from "lucide-react";

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

export default function IncidentFeed({ onIncidentSelect }: { onIncidentSelect?: () => void }) {
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const isLoading = useIncidentStore((state) => state.isLoading);
  const isUpdatingBounds = useIncidentStore((state) => state.isUpdatingBounds);
  const error = useIncidentStore((state) => state.error);
  const activeBounds = useIncidentStore((state) => state.activeBounds);
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const addContextUpdate = useIncidentStore((state) => state.addContextUpdate);
  const { selectedSeverity, setSeverity, selectedCategory, searchQuery, resetFilters } = useFilterStore();
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const t = getTranslation(language);
  const isBn = language === "bn";

  const [activeCommentIncidentId, setActiveCommentIncidentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<"all" | "critical" | "verified">("all");

  const filtered = useMemo(() => {
    return incidents.filter((item) => {
      // Feed-specific tab filter
      if (feedTab === "critical") {
        const isCrit = item.severity.toUpperCase() === "HIGH" || item.severity.toLowerCase() === "critical";
        if (!isCrit) return false;
      } else if (feedTab === "verified") {
        if (!item.sourceUrl) return false;
      }

      // Global store filters
      if (selectedSeverity !== "all" && item.severity.toUpperCase() !== selectedSeverity.toUpperCase()) {
        return false;
      }
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesTitle =
          item.title.toLowerCase().includes(q) ||
          (item.titleBn && item.titleBn.toLowerCase().includes(q));
        const matchesLoc =
          item.locationName.toLowerCase().includes(q) ||
          (item.locationNameBn && item.locationNameBn.toLowerCase().includes(q));
        if (!matchesTitle && !matchesLoc) return false;
      }
      return true;
    });
  }, [incidents, feedTab, selectedSeverity, selectedCategory, searchQuery]);

  const hasActiveFilters =
    selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "" || feedTab !== "all";

  const handleFocusIncident = (incident: DangerIncident) => {
    setSelectedIncidentId(incident.id);
    setCenter(incident.coordinates);
    setZoom(16);
    if (onIncidentSelect) {
      onIncidentSelect();
    }
  };

  const handlePostUpdate = async (incidentId: string) => {
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addContextUpdate(incidentId, commentText.trim());
      setCommentText("");
      setActiveCommentIncidentId(null);
    } catch (err: any) {
      alert(err.message || "Failed to post update");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <aside className="w-full bg-white text-slate-800 flex flex-col h-full z-10 shadow-sm select-text border-r border-slate-200">
      {/* Feed Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/90 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100/80 border border-red-200 flex items-center justify-center text-red-600 shadow-2xs">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                {isBn ? "সরাসরি বিপদ সংকেতসমূহ" : "Live Threat Feed"}
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">
                {isBn ? "পোস্টজিআইএস সরাসরি উপাত্ত" : "PostGIS Real-Time Stream"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isUpdatingBounds && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="hidden sm:inline">
                  {isBn ? "সিঙ্ক হচ্ছে..." : "Syncing..."}
                </span>
              </span>
            )}
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              {filtered.length} {isBn ? "টি" : "reports"}
            </span>
          </div>
        </div>

        {/* Quick Segmented Filter Tabs */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/60 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFeedTab("all")}
            className={`py-1 rounded-lg text-center transition-all ${
              feedTab === "all"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isBn ? "সকল রিপোর্ট" : "All Threats"}
          </button>
          <button
            onClick={() => setFeedTab("critical")}
            className={`py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
              feedTab === "critical"
                ? "bg-red-600 text-white shadow-2xs font-bold"
                : "text-red-700 hover:text-red-800"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>{isBn ? "উচ্চ ঝুঁকি" : "Critical"}</span>
          </button>
          <button
            onClick={() => setFeedTab("verified")}
            className={`py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
              feedTab === "verified"
                ? "bg-blue-600 text-white shadow-2xs font-bold"
                : "text-blue-700 hover:text-blue-800"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{isBn ? "যাচাইকৃত" : "Verified"}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Incident Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
        {isLoading && incidents.length === 0 ? (
          <div className="space-y-3 py-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-slate-200 rounded-full" />
                  <div className="h-3 w-14 bg-slate-200 rounded" />
                </div>
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-2/3 bg-slate-100 rounded" />
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-5 w-16 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-red-50/80 border border-red-200 text-center space-y-3 my-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-red-900">
                {isBn ? "নেটওয়ার্ক সংযোগ সতর্কতা" : "Safety Network Notice"}
              </h4>
              <p className="text-[11px] text-red-700 mt-1 max-w-[240px] mx-auto leading-relaxed">
                {error}
              </p>
            </div>
            <button
              onClick={() => {
                if (activeBounds) {
                  fetchIncidentsInBounds(activeBounds);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? "পুনরায় চেষ্টা করুন" : "Retry Connection"}</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs my-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
              <Crosshair className="w-6 h-6 animate-pulse text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {hasActiveFilters
                  ? isBn
                    ? "ফিল্টারে কোনো সক্রিয় বিপদ পাওয়া যায়নি"
                    : "No active hazards match your filter"
                  : isBn
                  ? "এই এলাকা নিরাপদ — কোনো বিপদ নেই"
                  : "Sector All Clear — 0 Local Threats"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                {hasActiveFilters
                  ? isBn
                    ? "ফিল্টার রিসেট করুন অথবা অন্যান্য জেলার তথ্য দেখতে মানচিত্রটি সরান।"
                    : "Try resetting filters or pan the map to scan other districts."
                  : isBn
                  ? "আপনার তাৎক্ষণিক এলাকায় কোনো রিপোর্ট নেই। সারা দেশের ম্যাপ দেখতে জুম আউট করুন।"
                  : "No incidents reported in your immediate vicinity. Pan or zoom to inspect nationwide zones."}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={() => {
                  resetFilters();
                  setFeedTab("all");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? "ফিল্টার রিসেট করুন" : "Reset All Filters"}</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2 pt-1 items-center">
                <button
                  onClick={() => {
                    setCenter({ lat: 23.685, lng: 90.3563 });
                    setZoom(7);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isBn ? "সারা দেশের ম্যাপ দেখুন" : "View All Bangladesh Threats"}</span>
                </button>
                <Link
                  href="/report"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-all active:scale-95 shadow-2xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>{isBn ? "নতুন রিপোর্ট করুন" : "Report Threat in Area"}</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          filtered.map((item) => {
            const isCritical =
              item.severity.toUpperCase() === "HIGH" || item.severity.toLowerCase() === "critical";
            const isMedium = item.severity.toUpperCase() === "MEDIUM";
            const isSelected = selectedIncidentId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all duration-150 relative group cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/60 border-blue-500 shadow-md ring-2 ring-blue-500/20"
                    : isCritical
                    ? "bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-red-300 border-l-[5px] border-l-red-600 shadow-2xs"
                    : isMedium
                    ? "bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-amber-300 border-l-[5px] border-l-amber-500 shadow-2xs"
                    : "bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-yellow-300 border-l-[5px] border-l-yellow-400 shadow-2xs"
                }`}
                onClick={() => handleFocusIncident(item)}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isCritical
                          ? "bg-red-50 text-red-700 border-red-200 font-black"
                          : isMedium
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-yellow-50 text-yellow-800 border-yellow-200"
                      }`}
                    >
                      {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                      {(t.severity as any)[item.severity.toLowerCase()] || item.severity}
                    </span>

                    {item.sourceUrl && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        <ShieldCheck className="w-3 h-3 text-sky-600" />
                        <span>{isBn ? "প্রেস রিপোর্ট" : "Press"}</span>
                      </span>
                    )}

                    <span className="text-[10px] font-medium text-slate-500 font-mono">
                      {(t.categories as any)[item.category.toLowerCase()] || item.category}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatRelativeTime(item.timestamp, language as any)}</span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 leading-snug mb-1 transition-colors">
                  {isBn && item.titleBn ? item.titleBn : item.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                  {isBn && item.descriptionBn ? item.descriptionBn : item.description}
                </p>

                {/* Location and Category */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 mb-2.5">
                  <span className="flex items-center gap-1 truncate max-w-[200px] text-slate-700 font-medium">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{item.locationName}</span>
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.reportedBy}
                  </span>
                </div>

                {/* Interactive Action Strip */}
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                  {/* Upvote & Downvote */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, 1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold transition active:scale-95 cursor-pointer"
                      title="Upvote / Corroborate"
                    >
                      <ThumbsUp className="w-3 h-3 text-emerald-600" />
                      <span>{item.upvotes}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, -1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition active:scale-95 cursor-pointer"
                      title="Downvote / Dispute"
                    >
                      <ThumbsDown className="w-3 h-3 text-rose-600" />
                      <span>{item.downvotes}</span>
                    </button>

                    {/* Inline Comment Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCommentIncidentId(
                          activeCommentIncidentId === item.id ? null : item.id
                        );
                      }}
                      className={`p-1 rounded-lg border transition cursor-pointer ${
                        activeCommentIncidentId === item.id
                          ? "bg-blue-50 text-blue-600 border-blue-200"
                          : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-transparent"
                      }`}
                      title="Add status update"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Deep-Dive Links: War Room & Focus */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFocusIncident(item);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Center Map on Incident"
                    >
                      <Crosshair className="w-3 h-3 text-blue-600" />
                      <span className="hidden sm:inline">{isBn ? "ম্যাপে দেখুন" : "Center"}</span>
                    </button>

                    <Link
                      href={`/reports/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 !text-white text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      title="Open Incident War Room & Details"
                      style={{ color: "#ffffff", textDecoration: "none" }}
                    >
                      <span className="!text-white font-bold" style={{ color: "#ffffff" }}>
                        {isBn ? "ওয়ার রুম" : "War Room"}
                      </span>
                      <ArrowUpRight className="w-3 h-3 !text-white shrink-0" style={{ color: "#ffffff" }} />
                    </Link>
                  </div>
                </div>

                {/* Inline Comment Composer Drawer */}
                {activeCommentIncidentId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 pt-2 border-t border-slate-200 flex gap-1.5 animate-in fade-in duration-150"
                  >
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        isBn
                          ? "পরিস্থিতি আপডেট লিখুন (যেমন: পুলিশ এসেছে)..."
                          : "Status update (e.g. Police arrived)..."
                      }
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                    <button
                      disabled={isSubmittingComment || !commentText.trim()}
                      onClick={() => handlePostUpdate(item.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Emergency Notice & 999 Speed Dial Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-slate-600 flex items-center justify-between px-3.5 shrink-0">
        <a
          href="tel:999"
          className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition-colors"
          title="National Emergency Dispatch Hotline"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>{isBn ? "জরুরি প্রয়োজনে ৯৯৯ এ কল করুন" : "Dial 999 for Emergency"}</span>
        </a>
        <span className="font-mono text-[10px] text-slate-400 shrink-0">BD-OSM v2.1</span>
      </div>
    </aside>
  );
}
