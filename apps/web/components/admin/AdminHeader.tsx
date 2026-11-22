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
  AlertCircle,
  X,
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
  isCrawlError?: boolean;
  dataError: string | null;
  onDismissCrawlStatus?: () => void;
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
  isCrawlError,
  dataError,
  onDismissCrawlStatus,
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
          {/* Quick News Crawler Trigger with Active Live Pulse */}
          <button
            type="button"
            onClick={onTriggerNewsCrawl}
            disabled={isCrawling}
            title={crawlStatus || (isBn ? "সংবাদ ক্রলার চালু করুন" : "Trigger news crawler")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-2xs ${
              isCrawling
                ? "bg-sky-50 border-sky-300 text-sky-800 ring-2 ring-sky-500/20 cursor-wait"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90 cursor-pointer active:scale-95"
            }`}
          >
            {isCrawling ? (
              <>
                <span className="relative flex h-2 w-2 mr-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                <span className="hidden sm:inline font-bold">
                  {isBn ? "ক্রলিং চলছে..." : "Crawling Feeds..."}
                </span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">
                  {isBn ? "নিউজ ক্রলার" : "News Crawler"}
                </span>
              </>
            )}
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
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-2xs ${
              isLoadingData
                ? "bg-red-50/90 text-red-700 border-red-200 ring-2 ring-red-500/20 cursor-wait"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90 cursor-pointer active:scale-95"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin text-red-600" : "text-slate-500"}`} />
            <span className="hidden sm:inline">
              {isLoadingData ? (isBn ? "রিফ্রেশ হচ্ছে..." : "Refreshing...") : (isBn ? "রিফ্রেশ" : "Refresh")}
            </span>
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

      {/* Active News Crawler Live Stream & Animated Scroller */}
      {isCrawling && (
        <div
          role="status"
          aria-live="polite"
          className="relative overflow-hidden bg-gradient-to-r from-sky-50 via-sky-50/90 to-blue-50 border border-sky-200 rounded-2xl p-2.5 sm:p-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-3">
            {/* Live Crawler Pulse Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-bold tracking-wide shrink-0 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>{isBn ? "লাইভ নিউজ ক্রলার" : "LIVE CRAWLER"}</span>
            </div>

            {/* Scrolling News Ticker Stream */}
            <div className="flex-1 overflow-hidden relative">
              <div className="animate-news-ticker">
                {/* News Feed Stream - Set 1 */}
                <div className="flex items-center gap-6 text-xs text-sky-950 font-medium whitespace-nowrap pr-6">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                      GOOGLE NEWS BD
                    </span>
                    {isBn
                      ? "ঢাকা ও চট্টগ্রাম অঞ্চলের ছিনতাই ও ডাকাতি সংক্রান্ত আরএসএস ফিড রিড করা হচ্ছে..."
                      : "Scanning real-time theft, robbery & snatching dispatches..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                      THE DAILY STAR
                    </span>
                    {isBn
                      ? "ব্রেকিং পাবলিক সেফটি ও ক্রাইম রিপোর্ট ইনজেস্ট হচ্ছে..."
                      : "Ingesting verified crime & road accident bulletins..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                      GEOCODER
                    </span>
                    {isBn
                      ? "৬৪ জেলার ভৌগোলিক স্থানাঙ্ক ও জেলা সীমানা ক্রস-ভেরিফাই করা হচ্ছে..."
                      : "Resolving geospatial boundaries across 64 Bangladesh districts..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      CROSS-VERIFY
                    </span>
                    {isBn
                      ? "নাগরিক বিপদের রিপোর্টের সাথে নিউজ বুলেটিন ক্রস-রেফারেন্স চলছে..."
                      : "Matching citizen emergency reports against breaking news sources..."}
                  </span>
                </div>

                {/* News Feed Stream - Duplicate Set for Seamless Continuous Loop */}
                <div className="flex items-center gap-6 text-xs text-sky-950 font-medium whitespace-nowrap pr-6" aria-hidden="true">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                      GOOGLE NEWS BD
                    </span>
                    {isBn
                      ? "ঢাকা ও চট্টগ্রাম অঞ্চলের ছিনতাই ও ডাকাতি সংক্রান্ত আরএসএস ফিড রিড করা হচ্ছে..."
                      : "Scanning real-time theft, robbery & snatching dispatches..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                      THE DAILY STAR
                    </span>
                    {isBn
                      ? "ব্রেকিং পাবলিক সেফটি ও ক্রাইম রিপোর্ট ইনজেস্ট হচ্ছে..."
                      : "Ingesting verified crime & road accident bulletins..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                      GEOCODER
                    </span>
                    {isBn
                      ? "৬৪ জেলার ভৌগোলিক স্থানাঙ্ক ও জেলা সীমানা ক্রস-ভেরিফাই করা হচ্ছে..."
                      : "Resolving geospatial boundaries across 64 Bangladesh districts..."}
                  </span>
                  <span className="text-sky-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      CROSS-VERIFY
                    </span>
                    {isBn
                      ? "নাগরিক বিপদের রিপোর্টের সাথে নিউজ বুলেটিন ক্রস-রেফারেন্স চলছে..."
                      : "Matching citizen emergency reports against breaking news sources..."}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Live Sync Spinner Icon */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-sky-700 font-semibold shrink-0 bg-sky-100/70 border border-sky-200/80 px-2.5 py-1 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
              <span>{isBn ? "স্ক্যানিং..." : "Scanning..."}</span>
            </div>
          </div>

          {/* Laser Scanning Track Indicator */}
          <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-sky-200/60 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-sky-600 to-transparent animate-scan-laser"></div>
          </div>
        </div>
      )}

      {/* Crawl Completed or Failed Notification Banner */}
      {!isCrawling && crawlStatus && (() => {
        const isError =
          isCrawlError ??
          /unauthorized|failed|error|ব্যর্থ|ত্রুটি|401|500/i.test(crawlStatus);

        return (
          <div
            role="status"
            className={
              isError
                ? "bg-red-50 border border-red-200 text-red-950 rounded-2xl px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200"
                : "bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200"
            }
          >
            <div className="flex items-center gap-2.5">
              <div
                className={
                  isError
                    ? "w-6 h-6 rounded-lg bg-red-100 border border-red-300 flex items-center justify-center text-red-700 shrink-0"
                    : "w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0"
                }
              >
                {isError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </div>
              <div>
                <span
                  className={
                    isError
                      ? "font-bold text-red-800 mr-2"
                      : "font-bold text-emerald-800 mr-2"
                  }
                >
                  {isError
                    ? isBn
                      ? "ক্রল ব্যর্থ হয়েছে:"
                      : "Crawl Failed:"
                    : isBn
                    ? "ক্রল সম্পন্ন:"
                    : "Crawl Complete:"}
                </span>
                <span className={isError ? "text-red-900" : "text-emerald-950"}>
                  {crawlStatus}
                </span>
              </div>
            </div>
            {onDismissCrawlStatus && (
              <button
                type="button"
                onClick={onDismissCrawlStatus}
                title={isBn ? "বন্ধ করুন" : "Dismiss"}
                className={
                  isError
                    ? "p-1 rounded-lg text-red-600 hover:text-red-900 hover:bg-red-100 transition-colors cursor-pointer"
                    : "p-1 rounded-lg text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer"
                }
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })()}
    </header>
  );
}
