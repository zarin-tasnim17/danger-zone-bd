"use client";

import React from "react";
import { AdminTab } from "./types";
import {
  LayoutDashboard,
  ShieldAlert,
  UserCheck,
  UserX,
  FileText,
} from "lucide-react";

interface AdminTabsNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  reportsCount: number;
  verificationsCount: number;
  logsCount: number;
  isBn: boolean;
}

export default function AdminTabsNav({
  activeTab,
  onTabChange,
  reportsCount,
  verificationsCount,
  logsCount,
  isBn,
}: AdminTabsNavProps) {
  const tabs: Array<{
    id: AdminTab;
    labelEn: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    badgeColor?: string;
  }> = [
    {
      id: "overview",
      labelEn: "Overview",
      labelBn: "সারসংক্ষেপ",
      icon: LayoutDashboard,
    },
    {
      id: "reports",
      labelEn: "Incidents",
      labelBn: "সক্রিয় বিপদ",
      icon: ShieldAlert,
      count: reportsCount,
      badgeColor: "bg-red-50 text-red-700 border-red-200",
    },
    {
      id: "verifications",
      labelEn: "Verifications",
      labelBn: "কেওয়াইসি যাচাই",
      icon: UserCheck,
      count: verificationsCount,
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "users",
      labelEn: "User Defense",
      labelBn: "ইউজার প্রতিরোধ",
      icon: UserX,
    },
    {
      id: "logs",
      labelEn: "Audit Trail",
      labelBn: "অডিট ট্রেইল",
      icon: FileText,
      count: logsCount,
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    },
  ];

  return (
    <nav
      aria-label="Admin Navigation"
      className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs overflow-x-auto scrollbar-none flex items-center gap-1 min-w-0"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              isActive
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                isActive
                  ? tab.id === "reports"
                    ? "text-red-400"
                    : tab.id === "verifications"
                    ? "text-amber-400"
                    : "text-slate-300"
                  : "text-slate-400"
              }`}
            />
            <span>{isBn ? tab.labelBn : tab.labelEn}</span>

            {typeof tab.count === "number" && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold border ${
                  isActive
                    ? "bg-white/15 text-white border-white/20"
                    : tab.badgeColor || "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
