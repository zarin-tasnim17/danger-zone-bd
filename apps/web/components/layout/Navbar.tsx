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
} from "lucide-react";

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
  const { selectedSeverity, setSeverity, selectedCategory, setCategory, searchQuery, setSearchQuery } = useFilterStore();
  const user = useAuthStore((state) => state.user);
  const t = getTranslation(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: language === "en" ? "Map" : "মানচিত্র", href: "/", icon: Map },
    { name: language === "en" ? "Feed" : "ফিড", href: "/feed", icon: ListFilter },
    { name: language === "en" ? "Report" : "রিপোর্ট", href: "/report", icon: PlusCircle },
    { name: language === "en" ? "Safe Shelters" : "নিরাপদ স্থান", href: "/safe-zones", icon: Shield },
    { name: language === "en" ? "Safe Routes" : "নিরাপদ পথ", href: "/routes", icon: Navigation },
    { name: language === "en" ? "Alerts" : "সতর্কতা", href: "/alerts", icon: Bell },
    { name: language === "en" ? "Profile" : "প্রোফাইল", href: "/profile", icon: UserCheck },
    { name: "Dev Test", href: "/dev-test", icon: FlaskConical },
  ];

  return (
    <header className="w-full bg-white border-b border-surface-border sticky top-0 z-30 shadow-sm">
      {/* Top situational awareness & language bar */}
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

      {/* Main navigation header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-md bg-danger-critical flex items-center justify-center text-white shrink-0 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold text-content-primary tracking-tight">
                {t.appName}
              </span>
              <span className="bg-danger-critical-bg text-danger-critical text-xs font-semibold px-2 py-0.5 rounded border border-danger-critical-border">
                {totalIncidents} {language === "en" ? "Active" : "সক্রিয়"}
              </span>
            </div>
            <p className="text-xs text-content-secondary hidden sm:block">
              {t.appTagline}
            </p>
          </div>
        </Link>

        {/* Primary Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-content-secondary hover:text-content-primary hover:bg-surface-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls & Role Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Link Badge */}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 transition-colors shadow-sm"
              title="Open Admin Moderation Console"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-surface-subtle border border-surface-border rounded text-[11px] text-content-secondary">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">
                {user?.role === "VERIFIED_RESPONDER" ? "Verified" : "Citizen"}
              </span>
              <span className="text-content-muted font-mono">
                ({user?.trustScore ?? 50})
              </span>
            </div>
          )}

          {/* Quick report button */}
          {onOpenReportModal ? (
            <button
              onClick={onOpenReportModal}
              className="bg-danger-critical hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
              id="report-incident-btn"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.reportIncident}</span>
            </button>
          ) : (
            <Link
              href="/report"
              className="bg-danger-critical hover:bg-red-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.reportIncident}</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md border border-surface-border text-content-primary hover:bg-surface-muted transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-surface-border bg-white px-4 py-3 space-y-1 shadow-lg">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? "bg-brand-primary text-white"
                    : "text-content-primary hover:bg-surface-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.name}</span>
              </Link>
            );
          })}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium bg-purple-700 text-white"
            >
              <Lock className="w-4 h-4" />
              <span>Admin Portal</span>
            </Link>
          )}
        </div>
      )}

      {/* Optional Filter Chips Toolbar on Map Page */}
      {showFilters && (
        <div className="border-t border-surface-border bg-surface-subtle px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
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
          </div>
        </div>
      )}
    </header>
  );
}
