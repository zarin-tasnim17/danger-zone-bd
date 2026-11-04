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
  Siren,
  AlertTriangle,
  LightbulbOff,
  AlertOctagon,
  Pill,
} from "lucide-react";
import { IncidentCategory } from "@repo/shared";

interface NavbarProps {
  totalIncidents?: number;
  onOpenReportModal?: () => void;
  showFilters?: boolean;
}

const CATEGORY_CHIPS: {
  id: IncidentCategory;
  labelEn: string;
  labelBn: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "MUGGING", labelEn: "Mugging", labelBn: "ছিনতাই", icon: Siren },
  { id: "THEFT", labelEn: "Theft", labelBn: "চুরি", icon: AlertTriangle },
  { id: "UNLIT_ROAD", labelEn: "Unlit Road", labelBn: "অন্ধকার সড়ক", icon: LightbulbOff },
  { id: "EXTORTION", labelEn: "Extortion", labelBn: "চাঁদাবাজি", icon: AlertOctagon },
  { id: "DRUG_ACTIVITY", labelEn: "Narcotics", labelBn: "মাদক", icon: Pill },
];

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: language === "en" ? "Live Map" : "লাইভ ম্যাপ", href: "/", icon: Map },
    { name: language === "en" ? "Feed" : "ফিড", href: "/feed", icon: ListFilter },
    { name: language === "en" ? "Safe Shelters" : "আশ্রয়স্থল", href: "/safe-zones", icon: Shield },
    { name: language === "en" ? "Safe Routes" : "নিরাপদ পথ", href: "/routes", icon: Navigation },
    { name: language === "en" ? "Alerts" : "সতর্কতা", href: "/alerts", icon: Bell },
    { name: language === "en" ? "Profile" : "প্রোফাইল", href: "/profile", icon: UserCheck },
    { name: "Dev Test", href: "/dev-test", icon: FlaskConical },
  ];

  const hasActiveFilters =
    selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "";

  return (
    <header className="w-full bg-white/95 backdrop-blur-xl border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-xs transition-all select-none">
      {/* Main Single Premium Navbar (No top strip, language toggle integrated directly) */}
      <div className="max-w-[1536px] w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Live Threat Counter */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-500/25 ring-1 ring-red-400/30 group-hover:scale-105 transition-all">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-red-600 transition-colors whitespace-nowrap">
                {language === "en" ? "DANGER ZONE" : "বিপদ সংকেত"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shadow-2xs font-mono whitespace-nowrap">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
                <span>{totalIncidents} {language === "en" ? "Active" : "সক্রিয়"}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden 2xl:block tracking-wide font-medium whitespace-nowrap">
              {language === "en"
                ? "Bangladesh Civic Safety Network"
                : "বাংলাদেশ জরুরি নাগরিক নিরাপত্তা ব্যবস্থা"}
            </p>
          </div>
        </Link>

        {/* Primary Desktop Navigation Links (Strict single-line guarantee with whitespace-nowrap) */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 shrink-0">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 select-none ${
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

        {/* Right Controls: Integrated Language Switcher, Citizen Trust Badge & Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Integrated Tactile Language Switcher (EN | বাংলা) */}
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-2xs shrink-0">
            <button
              onClick={() => language !== "en" && toggleLanguage()}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold whitespace-nowrap ${
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
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold whitespace-nowrap ${
                language === "bn"
                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="বাংলা"
            >
              বাংলা
            </button>
          </div>

          {/* Admin Moderation Console Link */}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-all shadow-2xs shrink-0 whitespace-nowrap"
              title="Open Admin Moderation Console"
            >
              <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Admin</span>
            </Link>
          ) : (
            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs text-slate-700 transition shadow-2xs shrink-0 whitespace-nowrap"
              title="Citizen Trust Score & Identity"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-semibold text-slate-800 whitespace-nowrap">
                {user?.role === "VERIFIED_RESPONDER"
                  ? language === "en" ? "Verified" : "যাচাইকৃত"
                  : language === "en" ? "Citizen" : "নাগরিক"}
              </span>
              <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                ({user?.trustScore ?? 0})
              </span>
            </Link>
          )}

          {/* High-Visibility Primary Report Hazard CTA */}
          <Link
            href="/report"
            className="relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-all shadow-md shadow-red-600/20 active:scale-95 ring-1 ring-red-500/30 shrink-0 whitespace-nowrap"
            id="report-incident-btn"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{language === "en" ? "Report Threat" : "বিপদ রিপোর্ট"}</span>
          </Link>

          {/* Mobile Navigation Drawer Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs shrink-0"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-2xl px-4 py-3 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-150">
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
                {language === "en" ? "Citizen Trust Score:" : "নাগরিক ট্রাস্ট স্কোর:"}{" "}
                <span className="font-mono text-slate-900 font-bold">{user?.trustScore ?? 0}</span>
              </span>
            </Link>

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Filter Chips & Live Search Bar (Smooth Daylight Glassmorphism) */}
      {showFilters && (
        <div className="border-t border-slate-200/80 bg-slate-50/70 backdrop-blur-md px-3 sm:px-6 py-2 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
              {/* All Incidents */}
              <button
                onClick={() => {
                  setSeverity("all");
                  setCategory("all");
                }}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all shrink-0 ${
                  selectedSeverity === "all" && selectedCategory === "all"
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {t.allIncidents}
              </button>

              {/* Critical / High Alert Filter */}
              <button
                onClick={() => setSeverity(selectedSeverity === "HIGH" ? "all" : "HIGH")}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all shrink-0 ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/20"
                    : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>{language === "en" ? "High Risk" : "উচ্চ বিপদ"}</span>
              </button>

              {/* Dynamic Category Chips */}
              {CATEGORY_CHIPS.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(isSelected ? "all" : cat.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                        : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-500"}`} />
                    <span>{language === "en" ? cat.labelEn : cat.labelBn}</span>
                  </button>
                );
              })}

              {/* Clear filters pill */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-900 underline transition shrink-0 ml-1 font-medium"
                >
                  {language === "en" ? "Reset" : "মুছে ফেলুন"}
                </button>
              )}
            </div>

            {/* Quick Keyword Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Filter area or title..."
                    : "এলাকা বা শিরোনাম খুঁজুন..."
                }
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
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
