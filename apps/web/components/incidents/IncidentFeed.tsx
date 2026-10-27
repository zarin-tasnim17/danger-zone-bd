"use client";

import React, { useMemo, useState } from "react";
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
  ChevronRight,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

export default function IncidentFeed() {
  const { language } = useLanguageStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const voteIncident = useIncidentStore((state) => state.voteIncident);
  const addContextUpdate = useIncidentStore((state) => state.addContextUpdate);
  const { selectedSeverity, selectedCategory, searchQuery } = useFilterStore();
  const setCenter = useMapStore((state) => state.setCenter);
  const setZoom = useMapStore((state) => state.setZoom);
  const t = getTranslation(language);

  const [activeCommentIncidentId, setActiveCommentIncidentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

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

  const handleSelectIncident = (incident: DangerIncident) => {
    setCenter(incident.coordinates);
    setZoom(15);
  };

  const handlePostUpdate = async (incidentId: string) => {
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addContextUpdate(incidentId, commentText.trim());
      setCommentText("");
      setActiveCommentIncidentId(null);
    } catch (err: any) {
      alert(err.message || "Failed to post status update");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-surface-border flex flex-col h-full z-10">
      {/* Header bar */}
      <div className="p-3.5 border-b border-surface-border bg-surface-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger-critical" />
          <h2 className="font-semibold text-xs sm:text-sm text-content-primary">
            {language === "en" ? "Live Danger Feed" : "সরাসরি বিপদ সংকেতসমূহ"}
          </h2>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface-muted text-content-secondary">
          {filtered.length}
        </span>
      </div>

      {/* Scrollable incidents list */}
      <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-content-muted text-xs">
            {language === "en"
              ? "No active hazards reported in this viewport."
              : "এই এলাকার মধ্যে কোনো সক্রিয় সতর্কবার্তা নেই।"}
          </div>
        ) : (
          filtered.map((item) => {
            const isCritical =
              item.severity.toUpperCase() === "HIGH" || item.severity === "critical";

            return (
              <div
                key={item.id}
                onClick={() => handleSelectIncident(item)}
                className="p-3.5 hover:bg-surface-subtle cursor-pointer transition-colors group relative"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        isCritical
                          ? "bg-danger-critical text-white border-danger-critical"
                          : item.severity.toUpperCase() === "MEDIUM"
                          ? "bg-danger-warning text-white border-danger-warning"
                          : "bg-danger-caution text-white border-danger-caution"
                      }`}
                    >
                      {(t.severity as any)[item.severity.toLowerCase()] || item.severity}
                    </span>

                    {item.sourceUrl && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300">
                        <ShieldCheck className="w-3 h-3 text-sky-600" />
                        <span>Press Confirmed</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-content-muted">
                    {(t.categories as any)[item.category.toLowerCase()] || item.category}
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-semibold text-content-primary group-hover:text-brand-primary leading-snug mb-1">
                  {language === "bn" && item.titleBn ? item.titleBn : item.title}
                </h3>

                <p className="text-xs text-content-secondary line-clamp-2 mb-2">
                  {language === "bn" && item.descriptionBn ? item.descriptionBn : item.description}
                </p>

                {/* Footer / Community Controls */}
                <div className="flex items-center justify-between text-[11px] text-content-muted pt-1 border-t border-surface-border">
                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                    <MapPin className="w-3 h-3 text-content-muted shrink-0" />
                    <span className="truncate">{item.locationName}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Upvote button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, 1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-0.5 text-content-secondary hover:text-emerald-700 transition-colors p-1"
                      title="Upvote / Corroborate"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-semibold text-[10px]">{item.upvotes}</span>
                    </button>

                    {/* Downvote button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        voteIncident(item.id, -1).catch((err) => alert(err.message));
                      }}
                      className="flex items-center gap-0.5 text-content-secondary hover:text-rose-700 transition-colors p-1"
                      title="Downvote / Dispute"
                    >
                      <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-semibold text-[10px]">{item.downvotes}</span>
                    </button>

                    {/* Comment button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCommentIncidentId(
                          activeCommentIncidentId === item.id ? null : item.id
                        );
                      }}
                      className="text-content-muted hover:text-brand-primary p-1"
                      title="Post Live Status Update"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    {/* External source link */}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-primary hover:underline p-1"
                        title="Read news story"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Inline Comment Drawer */}
                {activeCommentIncidentId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 pt-2 border-t border-surface-border flex gap-1.5"
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
                      className="flex-1 px-2.5 py-1 text-xs border border-surface-border rounded bg-surface-subtle text-content-primary"
                    />
                    <button
                      disabled={isSubmittingComment || !commentText.trim()}
                      onClick={() => handlePostUpdate(item.id)}
                      className="px-2.5 py-1 bg-brand-primary text-white text-xs font-semibold rounded disabled:opacity-50"
                    >
                      {language === "en" ? "Post" : "পাঠান"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Safety notice footer */}
      <div className="p-2.5 bg-surface-muted border-t border-surface-border text-[10px] text-content-muted flex flex-col sm:flex-row items-center justify-between gap-1 px-3">
        <span>
          {language === "en"
            ? "Always verify with local emergency services during active danger."
            : "জরুরি প্রয়োজনে সর্বদা জাতীয় জরুরি সেবা ৯৯৯ এ যোগাযোগ করুন।"}
        </span>
        <span className="opacity-70 whitespace-nowrap text-[9px]">Map &copy; OpenStreetMap</span>
      </div>
    </aside>
  );
}
