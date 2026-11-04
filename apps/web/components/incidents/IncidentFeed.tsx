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
    <aside className="w-full bg-slate-900/90 backdrop-blur-2xl border-r border-slate-800/80 text-slate-100 flex flex-col h-full z-10 shadow-2xl select-text">
      {/* Feed Header */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-950/80 border border-red-800/60 text-red-400 shadow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
              <span>{language === "en" ? "Live Threat Feed" : "সরাসরি বিপদ সংকেতসমূহ"}</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              {language === "en" ? "PostGIS Real-Time Stream" : "সরাসরি মানচিত্র উপাত্ত"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80 shadow-inner">
            {filtered.length} {language === "en" ? "reports" : "টি"}
          </span>
        </div>
      </div>

      {/* Scrollable Incident Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500 shadow-inner">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {language === "en"
                  ? "No active hazards match your filter"
                  : "আপনার ফিল্টারে কোনো সক্রিয় বিপদ পাওয়া যায়নি"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                {language === "en"
                  ? "Try resetting filters or pan the map to scan other districts."
                  : "ফিল্টার মুছে ফেলুন অথবা অন্যান্য জেলার তথ্য দেখতে মানচিত্রটি সরান।"}
              </p>
            </div>
            {(selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "") && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-blue-400 transition-all border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === "en" ? "Reset Filters" : "ফিল্টার রিসেট করুন"}</span>
              </button>
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
                className={`p-3.5 rounded-2xl border transition-all relative group cursor-pointer ${
                  isSelected
                    ? "bg-slate-800/95 border-blue-500/80 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/50"
                    : isCritical
                    ? "bg-slate-950/70 hover:bg-slate-850/90 border-slate-800/80 hover:border-red-900/60 border-l-4 border-l-red-500 shadow-sm"
                    : isMedium
                    ? "bg-slate-950/70 hover:bg-slate-850/90 border-slate-800/80 hover:border-amber-900/60 border-l-4 border-l-amber-500 shadow-sm"
                    : "bg-slate-950/70 hover:bg-slate-850/90 border-slate-800/80 hover:border-yellow-900/60 border-l-4 border-l-yellow-400 shadow-sm"
                }`}
                onClick={() => handleFocusIncident(item)}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isCritical
                          ? "bg-red-950/90 text-red-300 border-red-800"
                          : isMedium
                          ? "bg-orange-950/90 text-orange-300 border-orange-800"
                          : "bg-yellow-950/90 text-yellow-300 border-yellow-800"
                      }`}
                    >
                      {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
                      {(t.severity as any)[item.severity.toLowerCase()] || item.severity}
                    </span>

                    {item.sourceUrl && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                        <span>Press</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatRelativeTime(item.timestamp, language as any)}</span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 leading-snug mb-1 transition-colors">
                  {language === "bn" && item.titleBn ? item.titleBn : item.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                  {language === "bn" && item.descriptionBn ? item.descriptionBn : item.description}
                </p>

                {/* Location and Category */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 mb-2.5">
                  <span className="flex items-center gap-1 truncate max-w-[170px] text-slate-300 font-medium">
                    <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                    <span className="truncate">{item.locationName}</span>
                  </span>

                  <span className="text-[10px] font-medium text-slate-400 font-mono">
                    {(t.categories as any)[item.category.toLowerCase()] || item.category}
                  </span>
                </div>

                {/* Interactive Action Strip */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/50">
                  {/* Upvote & Downvote */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, 1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-semibold transition active:scale-95"
                      title="Upvote / Corroborate"
                    >
                      <ThumbsUp className="w-3 h-3 text-emerald-400" />
                      <span>{item.upvotes}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, -1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[10px] font-semibold transition active:scale-95"
                      title="Downvote / Dispute"
                    >
                      <ThumbsDown className="w-3 h-3 text-rose-400" />
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
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 transition"
                      title="Center Map on Incident"
                    >
                      <Crosshair className="w-3 h-3 text-blue-400" />
                      <span className="hidden sm:inline">Center</span>
                    </button>

                    <Link
                      href={`/reports/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] font-bold flex items-center gap-0.5 transition shadow-sm"
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
                    className="mt-2.5 pt-2 border-t border-slate-800 flex gap-1.5 animate-in fade-in duration-150"
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
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      disabled={isSubmittingComment || !commentText.trim()}
                      onClick={() => handlePostUpdate(item.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition flex items-center gap-1"
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
      <div className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between px-3.5 shrink-0">
        <span className="truncate">
          {language === "en"
            ? "⚠️ Dial 999 for emergency dispatch"
            : "⚠️ জরুরি প্রয়োজনে ৯৯৯ এ কল করুন"}
        </span>
        <span className="font-mono text-slate-500 shrink-0">BD-OSM v2.1</span>
      </div>
    </aside>
  );
}
