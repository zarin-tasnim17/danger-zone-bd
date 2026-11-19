"use client";

import React, { useState, useMemo } from "react";
import { AdminReport } from "./types";
import {
  ShieldAlert,
  Search,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Filter,
  X,
} from "lucide-react";

interface AdminReportsSectionProps {
  reports: AdminReport[];
  isBn: boolean;
  onSelectPurge: (report: AdminReport) => void;
}

export default function AdminReportsSection({
  reports,
  isBn,
  onSelectPurge,
}: AdminReportsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesSeverity =
        severityFilter === "ALL" || r.severity?.toUpperCase() === severityFilter;

      if (!matchesSeverity) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const catMatch = r.category?.toLowerCase().includes(q);
      const descMatch = r.description?.toLowerCase().includes(q);
      const idMatch = r.id?.toLowerCase().includes(q);

      return catMatch || descMatch || idMatch;
    });
  }, [reports, searchQuery, severityFilter]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      
      {/* Section Header & Interactive Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200/80 flex items-center justify-center text-red-600 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {isBn ? "লাইভ বিপদ রিপোর্টসমূহ" : "Active Hazard Reports"}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {isBn
                ? `মোট ${reports.length} টি রিপোর্টের মধ্যে ${filteredReports.length} টি প্রদর্শিত`
                : `Showing ${filteredReports.length} of ${reports.length} live incidents`}
            </p>
          </div>
        </div>

        {/* Search & Severity Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative min-w-[200px] sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? "খুঁজুন (বিভাগ, বিবরণ বা আইডি)..." : "Search reports..."}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Severity Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200/80 rounded-xl text-[11px] font-semibold shrink-0">
            {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                  severityFilter === sev
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {sev === "ALL" ? (isBn ? "সব" : "All") : sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Table View (Hidden on mobile < md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
            <tr>
              <th className="p-3.5">{isBn ? "বিভাগ" : "Category"}</th>
              <th className="p-3.5">{isBn ? "তীব্রতা" : "Severity"}</th>
              <th className="p-3.5">{isBn ? "বিবরণ" : "Description"}</th>
              <th className="p-3.5">{isBn ? "ভোট" : "Votes"}</th>
              <th className="p-3.5">{isBn ? "সময়" : "Time"}</th>
              <th className="p-3.5 text-right">{isBn ? "পদক্ষেপ" : "Action"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-medium">
                      {isBn ? "কোনো রিপোর্ট পাওয়া যায়নি।" : "No incident reports found matching criteria."}
                    </p>
                    {(searchQuery || severityFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSeverityFilter("ALL");
                        }}
                        className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        {isBn ? "ফিল্টার রিসেট করুন" : "Reset filters"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredReports.map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {idx === 0 && !searchQuery && severityFilter === "ALL" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-50 border border-red-200 text-red-700 font-mono font-bold">
                          [P] TOP
                        </span>
                      )}
                      <span>{r.category?.replace(/_/g, " ")}</span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        r.severity === "HIGH"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : r.severity === "MEDIUM"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>

                  <td className="p-3.5 max-w-sm truncate text-slate-800" title={r.description || ""}>
                    {r.description || "—"}
                  </td>

                  <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 mr-2 text-emerald-600">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{r.upvotes}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <ThumbsDown className="w-3 h-3" />
                      <span>{r.downvotes}</span>
                    </span>
                  </td>

                  <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>

                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectPurge(r)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
                      title={isBn ? "রিপোর্ট বাতিল ও অপসারণ" : "Purge this report"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isBn ? "মুছুন" : "Purge"}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Shown on screens < md) */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredReports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <ShieldAlert className="w-8 h-8 text-slate-300 stroke-[1.5] mx-auto mb-2" />
            <p className="text-xs font-medium">
              {isBn ? "কোনো রিপোর্ট পাওয়া যায়নি।" : "No incident reports found."}
            </p>
          </div>
        ) : (
          filteredReports.map((r, idx) => (
            <div key={r.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {idx === 0 && !searchQuery && severityFilter === "ALL" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-50 border border-red-200 text-red-700 font-mono font-bold shrink-0">
                      [P]
                    </span>
                  )}
                  <span className="font-bold text-xs text-slate-900 truncate">
                    {r.category?.replace(/_/g, " ")}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                    r.severity === "HIGH"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : r.severity === "MEDIUM"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {r.severity}
                </span>
              </div>

              {r.description && (
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                  {r.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{r.upvotes}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <ThumbsDown className="w-3 h-3" />
                    <span>{r.downvotes}</span>
                  </span>
                  <span className="font-mono text-slate-400">
                    {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPurge(r)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBn ? "মুছুন" : "Purge"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
