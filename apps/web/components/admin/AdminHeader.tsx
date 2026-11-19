"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  RefreshCw,
  Globe,
  LogOut,
  Keyboard,
  Radio,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface AdminHeaderProps {
  user: {
    id: string;
    email?: string | null;
  };
  isBn: boolean;
  isLoadingData: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenShortcuts: () => void;
  onTriggerNewsCrawl: () => void;
  isCrawling: boolean;
  crawlStatus: string | null;
  dataError: string | null;
}

export default function AdminHeader({
  user,
  isBn,
  isLoadingData,
  onRefresh,
  onLogout,
  onOpenShortcuts,
  onTriggerNewsCrawl,
  isCrawling,
  crawlStatus,
  dataError,
}: AdminHeaderProps) {
  return (
    <header className="space-y-3 sm:space-y-4">
      {/* Error alert banner if API failed */}
      {dataError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 sm:p-4 text-xs font-semibold flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{dataError}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shrink-0 cursor-pointer text-xs"
          >
            {isBn ? "পুনরায় চেষ্টা করুন" : "Retry"}
          </button>
        </div>
      )}

      {/* Main SaaS Admin Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Brand Identity & Admin Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-center text-red-600 shrink-0 shadow-2xs">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {isBn ? "মডারেশন ও সিকিউরিটি কনসোল" : "Moderation & Security Console"}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900 text-white tracking-wide">
                ROOT ADMIN
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
              <span>
                {isBn ? "অ্যাডমিন: " : "Admin: "}
                <span className="font-mono text-slate-700 font-semibold">{user.id.slice(0, 8)}...</span>
              </span>
              {user.email && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 truncate">{user.email}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Quick News Crawler Trigger */}
          <button
            type="button"
            onClick={onTriggerNewsCrawl}
            disabled={isCrawling}
            title={crawlStatus || (isBn ? "সংবাদ ক্রলার চালু করুন" : "Trigger news crawler")}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/90 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <Radio className={`w-3.5 h-3.5 ${isCrawling ? "text-sky-600 animate-pulse" : "text-slate-500"}`} />
            <span className="hidden sm:inline">
              {isCrawling
                ? isBn ? "ক্রলিং..." : "Crawling..."
                : isBn ? "নিউজ ক্রলার" : "News Crawler"}
            </span>
          </button>

          {/* Keyboard Shortcuts Trigger Button */}
          <button
            type="button"
            onClick={onOpenShortcuts}
            title={isBn ? "কিবোর্ড শর্টকাট দেখুন" : "View keyboard shortcuts"}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/90 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{isBn ? "শর্টকাট" : "Shortcuts"}</span>
          </button>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingData}
            title={isBn ? "ডেটা রিফ্রেশ করুন" : "Refresh administrative data"}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/90 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin text-red-600" : "text-slate-500"}`} />
            <span className="hidden sm:inline">{isBn ? "রিফ্রেশ" : "Refresh"}</span>
          </button>

          {/* Live Map Link */}
          <Link
            href="/"
            title={isBn ? "লাইভ ম্যাপে যান" : "Open live public map"}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/90 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">{isBn ? "লাইভ ম্যাপ" : "Live Map"}</span>
          </Link>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5 ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isBn ? "সাইন আউট" : "Sign Out"}</span>
          </button>
        </div>

      </div>

      {/* Crawl Status Notification Banner */}
      {crawlStatus && (
        <div className="bg-sky-50 border border-sky-200 text-sky-900 rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
          <span>{crawlStatus}</span>
        </div>
      )}
    </header>
  );
}
