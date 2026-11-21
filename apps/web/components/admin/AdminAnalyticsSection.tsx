"use client";

import React from "react";
import { AdminTrends, CATEGORY_ALIAS_MAP, CATEGORY_BAR_COLORS } from "./types";
import { translations } from "@/lib/translations";
import {
  TrendingUp,
  Moon,
  ShieldAlert,
  CheckCircle2,
  BarChart3,
  Shield,
  Activity,
  Clock,
  RefreshCw,
} from "lucide-react";

interface AdminAnalyticsSectionProps {
  trends: AdminTrends | null;
  isBn: boolean;
  isLoadingTrends: boolean;
  onRefreshTrends: () => void;
}

export default function AdminAnalyticsSection({
  trends,
  isBn,
  isLoadingTrends,
  onRefreshTrends,
}: AdminAnalyticsSectionProps) {
  const totalReports = trends?.totalReports ?? 0;
  const nightPercentage = trends?.nightReportPercentage ?? 0;
  const highSeverityCount = trends?.breakdown?.bySeverity?.HIGH ?? 0;
  const resolvedCount = trends?.breakdown?.byStatus?.RESOLVED ?? 0;

  return (
    <div className="space-y-6">
      
      {/* 4 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: 30-Day Hazard Volume */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isBn ? "৩০ দিনে মোট বিপদ" : "30-Day Hazards"}
            </span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isLoadingTrends && !trends ? (
                <div className="h-8 w-16 bg-slate-200/80 rounded-lg animate-pulse" />
              ) : (
                totalReports
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {isBn ? "বাংলাদেশ জুড়ে নথিভুক্ত" : "Live recorded across Bangladesh"}
            </p>
          </div>
        </div>

        {/* Card 2: Night Hazard Ratio */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isBn ? "রাত্রিকালীন বিপদের হার" : "Night Hazard Ratio"}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
              {isLoadingTrends && !trends ? (
                <div className="h-8 w-16 bg-indigo-100/80 rounded-lg animate-pulse" />
              ) : (
                `${nightPercentage}%`
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium font-mono">
              {trends?.nightReportsCount ?? 0} {isBn ? "টি রাতের ঘটনা" : "incidents occurred at night"}
            </p>
          </div>
        </div>

        {/* Card 3: High Severity Threats */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isBn ? "উচ্চমাত্রার সশস্ত্র হুমকি" : "High Severity Threats"}
            </span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              {isLoadingTrends && !trends ? (
                <div className="h-8 w-16 bg-red-100/80 rounded-lg animate-pulse" />
              ) : (
                highSeverityCount
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {isBn ? "সশস্ত্র বা চরম ঝুঁকিপূর্ণ পিন" : "Armed or imminent danger pins"}
            </p>
          </div>
        </div>

        {/* Card 4: Resolved Incidents */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isBn ? "নিষ্পত্তিকৃত ঘটনা" : "Resolved Incidents"}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {isLoadingTrends && !trends ? (
                <div className="h-8 w-16 bg-emerald-100/80 rounded-lg animate-pulse" />
              ) : (
                resolvedCount
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {isBn ? "উদ্ধার বা নিরাপদ ঘোষিত" : "Neutralized or safe status"}
            </p>
          </div>
        </div>

      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Breakdown Bars */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {isBn ? "বিপদের ধরন অনুযায়ী বিভাজন" : "Hazard Category Distribution"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {isBn ? "বিগত ৩০ দিন" : "30-Day Aggregation"}
            </span>
          </div>

          <div className="space-y-3.5">
            {(() => {
              const rawCategories = (trends?.breakdown?.byCategory ?? {}) as Record<string, number>;
              const aggregated = new Map<string, number>();

              for (const [rawKey, rawCount] of Object.entries(rawCategories)) {
                const count = Number(rawCount) || 0;
                if (count <= 0) continue;
                const canonicalKey = CATEGORY_ALIAS_MAP[rawKey] ?? rawKey;
                aggregated.set(canonicalKey, (aggregated.get(canonicalKey) ?? 0) + count);
              }

              const entries = Array.from(aggregated.entries()).sort((a, b) => b[1] - a[1]);

              if (entries.length === 0) {
                if (isLoadingTrends && !trends) {
                  return (
                    <div className="py-4 space-y-3">
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-3/4" />
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-1/2" />
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-2/3" />
                    </div>
                  );
                }
                return (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    {isBn
                      ? "বিগত ৩০ দিনে কোনো শ্রেণিবদ্ধ রিপোর্ট পাওয়া যায়নি।"
                      : "No categorized reports recorded in the last 30 days."}
                  </p>
                );
              }

              const total = trends?.totalReports || entries.reduce((sum, [, c]) => sum + c, 0) || 1;
              const categoryLabels = translations[isBn ? "bn" : "en"].categories as Record<string, string>;

              return entries.map(([key, count]) => {
                const pct = Math.min(100, Math.round((count / total) * 100));
                const label = categoryLabels[key] || key.replace(/_/g, " ");
                const color = CATEGORY_BAR_COLORS[key] || "bg-slate-500";
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{label}</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Severity & Resolution Breakdown Grids */}
        <div className="space-y-6">
          {/* Threat Severity Breakdown */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {isBn ? "হুমকির তীব্রতা অনুপাত" : "Threat Severity Breakdown"}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80">
                <span className="text-[10px] font-bold text-red-700 block uppercase">HIGH</span>
                <span className="text-xl sm:text-2xl font-black text-red-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-red-200/70 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.bySeverity?.HIGH ?? 0
                  )}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80">
                <span className="text-[10px] font-bold text-amber-700 block uppercase">MEDIUM</span>
                <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-amber-200/70 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.bySeverity?.MEDIUM ?? 0
                  )}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                <span className="text-[10px] font-bold text-emerald-700 block uppercase">LOW</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-emerald-200/70 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.bySeverity?.LOW ?? 0
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Incident Resolution Pipeline */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {isBn ? "ঘটনা নিষ্পত্তি অবস্থা" : "Resolution Pipeline"}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/80">
                <span className="text-[10px] font-bold text-blue-700 block uppercase">ACTIVE</span>
                <span className="text-xl sm:text-2xl font-black text-blue-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-blue-200/70 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.byStatus?.ACTIVE ?? 0
                  )}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                <span className="text-[10px] font-bold text-emerald-700 block uppercase">RESOLVED</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-emerald-200/70 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.byStatus?.RESOLVED ?? 0
                  )}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-700 block uppercase">PURGED</span>
                <span className="text-xl sm:text-2xl font-black text-slate-700 font-mono">
                  {isLoadingTrends && !trends ? (
                    <span className="inline-block h-6 w-8 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    trends?.breakdown?.byStatus?.PURGED ?? 0
                  )}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Daily Incident Timeline */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isBn ? "দৈনিক ঘটনার টাইমলাইন (৩০ দিন)" : "Daily Incident Timeline"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefreshTrends}
            disabled={isLoadingTrends}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrends ? "animate-spin text-red-600" : "text-slate-500"}`} />
            <span>{isBn ? "রিফ্রেশ" : "Refresh"}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">{isBn ? "তারিখ" : "Date"}</th>
                <th className="p-3.5">{isBn ? "দাখিলকৃত রিপোর্ট" : "Reports"}</th>
                <th className="p-3.5">{isBn ? "বণ্টন অনুপাত" : "Distribution"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {!trends?.timeline || trends.timeline.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-400">
                    {isBn ? "বিগত ৩০ দিনে কোনো রেকর্ড পাওয়া যায়নি।" : "No timeline records in the last 30 days."}
                  </td>
                </tr>
              ) : (
                trends.timeline.map((row: { date: string; count: number }) => {
                  const maxCount = Math.max(...trends.timeline.map((r: any) => r.count), 1);
                  const barWidth = Math.round((row.count / maxCount) * 100);
                  return (
                    <tr key={row.date} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-red-600 whitespace-nowrap">
                        {row.count} {isBn ? "টি" : "reports"}
                      </td>
                      <td className="p-3.5 w-1/2 min-w-[140px]">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-red-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(barWidth, 6)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
