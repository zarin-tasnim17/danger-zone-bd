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
  const error = useIncidentStore((state) => state.error);
  const activeBounds = useIncidentStore((state) => state.activeBounds);
  const fetchIncidentsInBounds = useIncidentStore((state) => state.fetchIncidentsInBounds);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const addContextUpdate = useIncidentStore((state) => state.addContextUpdate);
  const { selectedSeverity, selectedCategory, searchQuery, resetFilters } = useFilterStore();
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const t = getTranslation(language);

  const [activeCommentIncidentId, setActiveCommentIncidentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return incidents.filter((item) => {
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
  }, [incidents, selectedSeverity, selectedCategory, searchQuery]);

  const hasActiveFilters =
    selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "";

  const handleFocusIncident = (incident: DangerIncident) => {
    setSelectedIncidentId(incident.id);
    setCenter(incident.coordinates);
    setZoom(15);
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
    <aside className="w-full bg-white text-slate-800 flex flex-col h-full z-10 shadow-sm select-text">
      {/* Feed Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 shadow-2xs">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <span>{language === "en" ? "Live Threat Feed" : "সরাসরি বিপদ সংকেতসমূহ"}</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono">
              {language === "en" ? "PostGIS Real-Time Stream" : "সরাসরি মানচিত্র উপাত্ত"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            {filtered.length} {language === "en" ? "reports" : "টি"}
          </span>
        </div>
      </div>

      {/* Scrollable Incident Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/40">
        {isLoading ? (
          <div className="space-y-3 py-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 animate-pulse"
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
                {language === "en" ? "Safety Network Notice" : "নেটওয়ার্ক সংযোগ সতর্কতা"}
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
              <span>{language === "en" ? "Retry Connection" : "পুনরায় চেষ্টা করুন"}</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-sm">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {hasActiveFilters
                  ? language === "en"
                    ? "No active hazards match your filter"
                    : "আপনার ফিল্টারে কোনো সক্রিয় বিপদ পাওয়া যায়নি"
                  : language === "en"
                  ? "No Active Hazards in Current Viewport"
                  : "বর্তমান মানচিত্র এলাকায় কোনো সক্রিয় বিপদ নেই"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[230px] mx-auto leading-relaxed">
                {hasActiveFilters
                  ? language === "en"
                    ? "Try resetting filters or pan the map to scan other districts."
                    : "ফিল্টার মুছে ফেলুন অথবা অন্যান্য জেলার তথ্য দেখতে মানচিত্রটি সরান।"
                  : language === "en"
                  ? "All clear in this sector. Pan the map to explore other districts, or report an incident to protect your community."
                    : "এই এলাকায় কোনো বিপদ সংকেত নেই। অন্যান্য জেলা দেখতে মানচিত্রটি সরান অথবা নতুন তথ্য জানান।"}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-semibold text-blue-600 transition-all border border-slate-200 shadow-2xs active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === "en" ? "Reset Filters" : "ফিল্টার রিসেট করুন"}</span>
              </button>
            ) : (
              <Link
                href="/report"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{language === "en" ? "Report Threat Here" : "নতুন রিপোর্ট করুন"}</span>
              </Link>
            )}
          </div>
        ) : (
          filtered.map((item) => {
            const isCritical =
              item.severity.toUpperCase() === "HIGH" || item.severity === "critical";
            const isMedium = item.severity.toUpperCase() === "MEDIUM";
            const isSelected = selectedIncidentId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all relative group cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/50 border-blue-500 shadow-md ring-1 ring-blue-500/20"
                    : isCritical
                    ? "bg-white hover:bg-slate-50/80 border-slate-200 hover:border-red-300 border-l-4 border-l-red-500 shadow-2xs"
                    : isMedium
                    ? "bg-white hover:bg-slate-50/80 border-slate-200 hover:border-amber-300 border-l-4 border-l-amber-500 shadow-2xs"
                    : "bg-white hover:bg-slate-50/80 border-slate-200 hover:border-yellow-300 border-l-4 border-l-yellow-400 shadow-2xs"
                }`}
                onClick={() => handleFocusIncident(item)}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isCritical
                          ? "bg-red-50 text-red-700 border-red-200"
                          : isMedium
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-yellow-50 text-yellow-800 border-yellow-200"
                      }`}
                    >
                      {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                      {(t.severity as any)[item.severity.toLowerCase()] || item.severity}
                    </span>

                    {item.sourceUrl && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        <ShieldCheck className="w-3 h-3 text-sky-600" />
                        <span>Press</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatRelativeTime(item.timestamp, language as any)}</span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 leading-snug mb-1 transition-colors">
                  {language === "bn" && item.titleBn ? item.titleBn : item.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                  {language === "bn" && item.descriptionBn ? item.descriptionBn : item.description}
                </p>

                {/* Location and Category */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 mb-2.5">
                  <span className="flex items-center gap-1 truncate max-w-[170px] text-slate-700 font-medium">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{item.locationName}</span>
                  </span>

                  <span className="text-[10px] font-medium text-slate-500 font-mono">
                    {(t.categories as any)[item.category.toLowerCase()] || item.category}
                  </span>
                </div>

                {/* Interactive Action Strip */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                  {/* Upvote & Downvote */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, 1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold transition active:scale-95"
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
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition active:scale-95"
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
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Add status update"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Deep-Dive Links: War Room & Focus */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFocusIncident(item);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition"
                      title="Center Map on Incident"
                    >
                      <Crosshair className="w-3 h-3 text-blue-600" />
                      <span className="hidden sm:inline">Center</span>
                    </button>

                    <Link
                      href={`/reports/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-0.5 transition shadow-2xs"
                      title="Open Incident War Room & Details"
                    >
                      <span>War Room</span>
                      <ArrowUpRight className="w-3 h-3" />
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
                        language === "en"
                          ? "Status update (e.g. Police arrived)..."
                          : "পরিস্থিতি আপডেট লিখুন..."
                      }
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      disabled={isSubmittingComment || !commentText.trim()}
                      onClick={() => handlePostUpdate(item.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition flex items-center gap-1 shadow-2xs"
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

      {/* Safety Notice Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between px-3.5 shrink-0">
        <span className="truncate">
          {language === "en"
            ? "⚠️ Dial 999 for emergency dispatch"
            : "⚠️ জরুরি প্রয়োজনে ৯৯৯ এ কল করুন"}
        </span>
        <span className="font-mono text-slate-400 shrink-0">BD-OSM v2.1</span>
      </div>
    </aside>
  );
}
