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
  Globe,
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
  Radio,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { IncidentCategory } from "@repo/shared";

interface NavbarProps {
  totalIncidents?: number;
  onOpenReportModal?: () => void;
  showFilters?: boolean;
}

const CATEGORY_CHIPS: { id: IncidentCategory; labelEn: string; labelBn: string; icon: string }[] = [
  { id: "MUGGING", labelEn: "Mugging", labelBn: "ছিনতাই", icon: "🚨" },
  { id: "THEFT", labelEn: "Theft", labelBn: "চুরি", icon: "⚠️" },
  { id: "UNLIT_ROAD", labelEn: "Unlit Road", labelBn: "অন্ধকার সড়ক", icon: "💡" },
  { id: "EXTORTION", labelEn: "Extortion", labelBn: "চাঁদাবাজি", icon: "🛑" },
  { id: "DRUG_ACTIVITY", labelEn: "Narcotics", labelBn: "মাদক", icon: "💊" },
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
    { name: language === "en" ? "Live Map" : "মানচিত্র", href: "/", icon: Map },
    { name: language === "en" ? "Feed" : "ফিড", href: "/feed", icon: ListFilter },
    { name: language === "en" ? "Report" : "রিপোর্ট", href: "/report", icon: PlusCircle },
    { name: language === "en" ? "Safe Shelters" : "নিরাপদ স্থান", href: "/safe-zones", icon: Shield },
    { name: language === "en" ? "Safe Routes" : "নিরাপদ পথ", href: "/routes", icon: Navigation },
    { name: language === "en" ? "Alerts" : "সতর্কতা", href: "/alerts", icon: Bell },
    { name: language === "en" ? "Profile" : "প্রোফাইল", href: "/profile", icon: UserCheck },
    { name: "Dev Test", href: "/dev-test", icon: FlaskConical },
  ];

  const hasActiveFilters =
    selectedSeverity !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "";

  return (
    <header className="w-full bg-slate-950/90 backdrop-blur-2xl border-b border-slate-800/80 text-slate-100 sticky top-0 z-30 shadow-2xl transition-all">
      {/* Situational Emergency Telemetry Strip */}
      <div className="bg-slate-900/90 border-b border-slate-800/70 px-3 sm:px-6 py-1 text-xs flex justify-between items-center text-slate-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="font-semibold tracking-wider text-[11px] uppercase text-slate-200">
            {language === "en"
              ? "Bangladesh Public Safety Command • Live Network"
              : "বাংলাদেশ জরুরি নিরাপত্তা কমান্ড • সরাসরি নেটওয়ার্ক"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Grid: Synchronized</span>
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white transition-all border border-slate-700/60 text-[11px]"
            title="Switch Language (English / বাংলা)"
            id="lang-toggle-btn"
          >
            <Globe className="w-3 h-3 text-blue-400" />
            <span className="font-bold">{language === "en" ? "বাংলা" : "EN"}</span>
          </button>
        </div>
      </div>

      {/* Main Command Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Status Pill */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-950/60 ring-1 ring-red-500/40 group-hover:scale-105 transition-all">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-red-400 transition-colors">
                {language === "en" ? "DANGER ZONE ⚡" : "বিপদ সংকেত ⚡"}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/80 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>{totalIncidents} {language === "en" ? "Active" : "সক্রিয়"}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden md:block tracking-wide">
              {language === "en" ? "Real-Time Hazard & Red Zone Map" : "সরাসরি গণনিরাপত্তা ও ঝুঁকিপূর্ণ অঞ্চল মানচিত্র"}
            </p>
          </div>
        </Link>

        {/* Primary Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-slate-800/90 text-white shadow-inner border border-slate-700/80"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls, User Badge & Report Button */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Admin console button */}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-700/60 text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
              title="Open Admin Moderation Console"
            >
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : (
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-300 hover:border-slate-700 transition"
              title="Citizen Trust Score"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-slate-200">
                {user?.role === "VERIFIED_RESPONDER"
                  ? language === "en" ? "Verified" : "যাচাইকৃত"
                  : language === "en" ? "Citizen" : "নাগরিক"}
              </span>
              <span className="text-slate-400 font-mono">
                ({user?.trustScore ?? 50})
              </span>
            </Link>
          )}

          {/* High-Visibility Report Hazard CTA */}
          {onOpenReportModal ? (
            <button
              onClick={onOpenReportModal}
              className="relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/60 active:scale-95 ring-1 ring-red-400/40"
              id="report-incident-btn"
            >
              <span className="animate-ping absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/40 pointer-events-none" />
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>{language === "en" ? "Report Threat" : "বিপদ রিপোর্ট"}</span>
            </button>
          ) : (
            <Link
              href="/report"
              className="relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/60 active:scale-95 ring-1 ring-red-400/40"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>{language === "en" ? "Report Threat" : "বিপদ রিপোর্ট"}</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 py-3 space-y-1.5 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-slate-800/80">
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
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.name}</span>
                </Link>
              );
            })}
          </div>

          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60"
            >
              <Lock className="w-4 h-4" />
              <span>Admin Moderation Console</span>
            </Link>
          )}
        </div>
      )}

      {/* Filter Chips & Live Search Bar (Rendered on Landing Page) */}
      {showFilters && (
        <div className="border-t border-slate-800/80 bg-slate-950/90 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-none">
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
                    ? "bg-slate-800 text-white border-slate-600 shadow-sm"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {t.allIncidents}
              </button>

              {/* Critical / High Alert Filter */}
              <button
                onClick={() => setSeverity(selectedSeverity === "HIGH" ? "all" : "HIGH")}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all shrink-0 ${
                  selectedSeverity === "HIGH" || selectedSeverity === "critical"
                    ? "bg-red-950 text-red-300 border-red-700 shadow-md shadow-red-950/50"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-red-400 hover:bg-slate-800/50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>{language === "en" ? "High Risk" : "উচ্চ বিপদ"}</span>
              </button>

              {/* Dynamic Category Chips */}
              {CATEGORY_CHIPS.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(isSelected ? "all" : cat.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all shrink-0 ${
                      isSelected
                        ? "bg-blue-950 text-blue-300 border-blue-700 shadow-sm"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{language === "en" ? cat.labelEn : cat.labelBn}</span>
                  </button>
                );
              })}

              {/* Clear filters pill */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs px-2.5 py-1 text-slate-400 hover:text-white underline transition shrink-0 ml-1"
                >
                  {language === "en" ? "Reset" : "মুছে ফেলুন"}
                </button>
              )}
            </div>

            {/* Quick Keyword Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === "en"
                    ? "Filter area or title..."
                    : "এলাকা বা শিরোনাম খুঁজুন..."
                }
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
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
