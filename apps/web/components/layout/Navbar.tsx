"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useFilterStore } from "@/store/useFilterStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getTranslation } from "@/lib/translations";
import { ShieldAlert, AlertTriangle, Filter, Globe, Menu, X, PlusCircle, Search, Shield, UserCheck } from "lucide-react";

interface NavbarProps {
  totalIncidents?: number;
  onOpenReportModal?: () => void;
}

export default function Navbar({ totalIncidents = 0, onOpenReportModal }: NavbarProps) {
  const { language, toggleLanguage } = useLanguageStore();
  const { selectedSeverity, setSeverity, selectedCategory, setCategory, searchQuery, setSearchQuery } = useFilterStore();
  const user = useAuthStore((state) => state.user);
  const t = getTranslation(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b border-surface-border sticky top-0 z-30">
      {/* Top emergency broadcast & situational awareness strip */}
      <div className="bg-surface-dark text-white px-4 py-1 text-xs flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-danger-critical animate-pulse" />
          <span className="font-medium tracking-wide">
            {language === "en" ? "BANGLADESH EMERGENCY & SAFETY DESK" : "বাংলাদেশ গণনিরাপত্তা ও জরুরি তথ্য ডেস্ক"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
          <span className="hidden sm:inline">
            {language === "en" ? "Citizen Reported & Verified Network" : "নাগরিক রিপোর্ট ও যাচাইকৃত নেটওয়ার্ক"}
          </span>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            title="Switch Language"
            id="lang-toggle-btn"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-semibold">{language === "en" ? "বাংলা" : "English"}</span>
          </button>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-danger-critical flex items-center justify-center text-white shrink-0 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-content-primary tracking-tight">
                {t.appName}
              </h1>
              <span className="bg-danger-critical-bg text-danger-critical text-xs font-semibold px-2 py-0.5 rounded border border-danger-critical-border">
                {totalIncidents} {language === "en" ? "Active" : "সক্রিয়"}
              </span>
            </div>
            <p className="text-xs text-content-secondary hidden sm:block">
              {t.appTagline}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="hidden md:flex flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-surface-subtle border border-surface-border rounded-md text-content-primary placeholder-content-muted focus:bg-white transition-colors"
          />
        </div>

        {/* Action Controls & Role Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Role Status Indicator */}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 transition-colors shadow-sm"
              title="Open Admin Moderation Console"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-surface-subtle border border-surface-border rounded text-[11px] text-content-secondary">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">
                {user?.role === "VERIFIED_RESPONDER" ? "Verified" : "Citizen"}
              </span>
              <span className="text-content-muted font-mono">
                (Trust: {user?.trustScore ?? 10})
              </span>
            </div>
          )}

          {/* Quick report button */}
          <button
            onClick={onOpenReportModal}
            className="bg-danger-critical hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
            id="report-incident-btn"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.reportIncident}</span>
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md border border-surface-border text-content-primary hover:bg-surface-muted transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Filter Chips Toolbar */}
      <div className="border-t border-surface-border bg-surface-subtle px-4 sm:px-6 py-2 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
          <span className="text-xs font-semibold text-content-secondary flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            {language === "en" ? "Filter:" : "ফিল্টার:"}
          </span>

          <button
            onClick={() => {
              setSeverity("all");
              setCategory("all");
            }}
            className={`text-xs px-3 py-1 rounded-md font-medium border transition-colors ${
              selectedSeverity === "all" && selectedCategory === "all"
                ? "bg-content-primary text-white border-content-primary"
                : "bg-white text-content-secondary border-surface-border hover:bg-surface-muted"
            }`}
          >
            {t.allIncidents}
          </button>

          <button
            onClick={() => setSeverity(selectedSeverity === "critical" ? "all" : "critical")}
            className={`text-xs px-3 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
              selectedSeverity === "critical"
                ? "bg-danger-critical text-white border-danger-critical"
                : "bg-white text-danger-critical border-danger-critical-border hover:bg-danger-critical-bg"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-danger-critical" />
            {t.criticalAlerts}
          </button>

          <button
            onClick={() => setCategory(selectedCategory === "violence_riot" ? "all" : "violence_riot")}
            className={`text-xs px-3 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
              selectedCategory === "violence_riot"
                ? "bg-content-primary text-white border-content-primary"
                : "bg-white text-content-secondary border-surface-border hover:bg-surface-muted"
            }`}
          >
            {t.categories.violence_riot}
          </button>

          <button
            onClick={() => setCategory(selectedCategory === "robbery_crime" ? "all" : "robbery_crime")}
            className={`text-xs px-3 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-colors ${
              selectedCategory === "robbery_crime"
                ? "bg-content-primary text-white border-content-primary"
                : "bg-white text-content-secondary border-surface-border hover:bg-surface-muted"
            }`}
          >
            {t.categories.robbery_crime}
          </button>

          <Link
            href="/admin"
            className="text-xs text-content-muted hover:text-purple-700 ml-auto transition-colors flex items-center gap-1"
          >
            <Shield className="w-3 h-3" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
