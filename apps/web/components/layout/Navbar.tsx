"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getTranslation } from "@/lib/translations";
import {
  ShieldAlert,
  Menu,
  X,
  PlusCircle,
  Search,
  Shield,
  Map,
  ListFilter,
  Navigation,
  Bell,
  UserCheck,
  FlaskConical,
  Lock,
  RotateCcw,
} from "lucide-react";
import CategoryFilterPopover from "./CategoryFilterPopover";

interface NavbarProps {
  totalIncidents?: number;
  onOpenReportModal?: () => void;
  showFilters?: boolean;
}

export default function Navbar({
  totalIncidents = 0,
  onOpenReportModal,
  showFilters = false,
}: NavbarProps) {
  const pathname = usePathname();
  const { language, toggleLanguage } = useLanguageStore();
  const {
    selectedSeverity,
    setSeverity,
    selectedCategory,
    setCategory,
    searchQuery,
    setSearchQuery,
    resetFilters,
  } = useFilterStore();
  const user = useAuthStore((state) => state.user);
  const t = getTranslation(language);
  const isBn = language === "bn";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // All primary navigation links for the desktop and mobile header
  const navLinks = [
    { name: isBn ? "লাইভ ম্যাপ" : "Live Map", href: "/", icon: Map },
    { name: isBn ? "ফিড" : "Feed", href: "/feed", icon: ListFilter },
    { name: isBn ? "আশ্রয়স্থল" : "Safe Shelters", href: "/safe-zones", icon: Shield },
    { name: isBn ? "নিরাপদ পথ" : "Safe Routes", href: "/routes", icon: Navigation },
    { name: isBn ? "সতর্কতা" : "Alerts", href: "/alerts", icon: Bell },
    { name: isBn ? "প্রোফাইল" : "Profile", href: "/profile", icon: UserCheck },
    { name: "Dev Test", href: "/dev-test", icon: FlaskConical },
  ];

  const hasActiveFilters =
    selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "";

  return (
    <header className="w-full bg-white/95 backdrop-blur-xl border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-xs transition-all select-none">
      {/* Main Single Command Navbar */}
      <div className="max-w-[1536px] w-full mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3 lg:gap-4">
        {/* Brand Logo & Live Threat Counter */}
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-500/25 ring-1 ring-red-400/30 group-hover:scale-105 transition-all">
            <ShieldAlert className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-slate-900 group-hover:text-red-600 transition-colors whitespace-nowrap">
                {isBn ? "বিপদ সংকেত" : "DANGER ZONE"}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shadow-2xs font-mono whitespace-nowrap">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span>{totalIncidents} {isBn ? "সক্রিয়" : "Active"}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden 2xl:block tracking-wide font-medium whitespace-nowrap">
              {isBn
                ? "বাংলাদেশ জরুরি নাগরিক নিরাপত্তা ব্যবস্থা"
                : "Bangladesh Civic Safety Network"}
            </p>
          </div>
        </Link>

        {/* Primary Desktop Navigation Links: All 7 core views */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 bg-slate-100/90 p-0.5 xl:p-1 rounded-2xl border border-slate-200/90 shrink-0">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap inline-flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 py-1 xl:py-1.5 rounded-xl text-[11px] xl:text-xs font-semibold transition-all shrink-0 select-none ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/90 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-red-600" : "text-slate-400"}`} />
                <span className="whitespace-nowrap">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Hotline, Language Switcher, Citizen Badge & Primary CTA */}
        <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2 shrink-0">
          {/* Integrated Language Switcher (EN | বাংলা) */}
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs shrink-0">
            <button
              onClick={() => language !== "en" && toggleLanguage()}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition-all text-[10px] sm:text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                language === "en"
                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => language !== "bn" && toggleLanguage()}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition-all text-[10px] sm:text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                language === "bn"
                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="বাংলা"
            >
              বাংলা
            </button>
          </div>

          {/* Admin Moderation Console Link or Citizen Trust Score */}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-all shadow-2xs shrink-0 whitespace-nowrap"
              title="Open Admin Moderation Console"
            >
              <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Admin</span>
            </Link>
          ) : (
            <Link
              href="/profile"
              className="hidden 2xl:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs text-slate-700 transition shadow-2xs shrink-0 whitespace-nowrap"
              title="Citizen Trust Score & Identity"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-semibold text-slate-800 whitespace-nowrap">
                {user?.role === "VERIFIED_RESPONDER"
                  ? isBn ? "যাচাইকৃত" : "Verified"
                  : isBn ? "নাগরিক" : "Citizen"}
              </span>
              <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                ({user?.trustScore ?? 0})
              </span>
            </Link>
          )}

          {/* High-Visibility Primary Report Hazard CTA */}
          <Link
            href="/report"
            className="relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl inline-flex items-center gap-1 sm:gap-1.5 transition-all shadow-md shadow-red-600/20 active:scale-95 ring-1 ring-red-500/30 shrink-0 whitespace-nowrap cursor-pointer"
            id="report-incident-btn"
            title={isBn ? "বিপদ রিপোর্ট" : "Report Threat"}
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">
              {isBn ? "বিপদ রিপোর্ট" : "Report Threat"}
            </span>
            <span className="sm:hidden text-[11px] whitespace-nowrap">
              {isBn ? "রিপোর্ট" : "Report"}
            </span>
          </Link>

          {/* Mobile Navigation Drawer Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs shrink-0 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-2xl px-4 py-3 space-y-2.5 shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-slate-100">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                {isBn ? "নাগরিক স্কোর:" : "Citizen Score:"}{" "}
                <span className="font-mono text-slate-900 font-bold">{user?.trustScore ?? 0}</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Filter Ribbon & Fast Keyword Search (Streamlined Command Strip) */}
      {showFilters && (
        <div className="border-t border-slate-200/90 bg-slate-50/95 px-2.5 sm:px-4 lg:px-6 py-1.5 sm:py-2 relative z-20">
          <div className="max-w-[1536px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5 min-w-0">
            {/* Quick Filter Chips: Fully fitted on 375px mobile without clipping */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none min-w-0 flex-1">
              {/* All Incidents */}
              <button
                onClick={() => {
                  setSeverity("all");
                  setCategory("all");
                }}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-xl font-bold border transition-all shrink-0 cursor-pointer ${
                  selectedSeverity === "all" && selectedCategory === "all"
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span className="hidden sm:inline">{t.allIncidents}</span>
                <span className="sm:hidden">{isBn ? "সব ঘটনা" : "All"}</span>
              </button>

              {/* Critical / High Alert Filter */}
              <button
                onClick={() => setSeverity(selectedSeverity === "HIGH" ? "all" : "HIGH")}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/20"
                    : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="hidden sm:inline">{isBn ? "উচ্চ বিপদ" : "High Risk"}</span>
                <span className="sm:hidden">{isBn ? "উচ্চ ঝুঁকি" : "High Risk"}</span>
              </button>

              {/* Modern Grouped Category Filter Popover */}
              <CategoryFilterPopover
                selectedCategory={selectedCategory}
                onSelectCategory={setCategory}
                isBn={isBn}
              />

              {/* Active Filter Clear Tag */}
              {selectedCategory !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold animate-in fade-in shrink-0">
                  <span>
                    {t.categories[selectedCategory] || selectedCategory}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCategory("all")}
                    className="p-0.5 hover:bg-blue-200/60 rounded-full transition-colors text-blue-600 hover:text-blue-900 cursor-pointer"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Reset filter pill */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 hover:bg-slate-200/60 rounded-lg transition shrink-0 ml-1 font-semibold cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isBn ? "রিসেট" : "Reset"}</span>
                </button>
              )}
            </div>

            {/* Area or Title Filter Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isBn
                    ? "এলাকা বা শিরোনাম ফিল্টার করুন..."
                    : "Filter area or title..."
                }
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
