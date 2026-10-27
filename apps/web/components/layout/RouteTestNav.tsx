"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { apiFetch } from "@/lib/api";
import {
  Map,
  ListFilter,
  PlusCircle,
  Shield,
  Navigation,
  Bell,
  UserCheck,
  FlaskConical,
  Lock,
  Activity,
} from "lucide-react";

interface RouteItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  adminOnly?: boolean;
}

const ROUTES: RouteItem[] = [
  { name: "Live Map", href: "/", icon: Map, description: "Interactive map with pins & safe zones" },
  { name: "Feed", href: "/feed", icon: ListFilter, description: "Incident feed with filtering & voting" },
  { name: "Report", href: "/report", icon: PlusCircle, description: "Submit incident & test GPS proximity" },
  { name: "Safe Shelters", href: "/safe-zones", icon: Shield, description: "Hospitals, police boxes & pharmacies" },
  { name: "Safe Routes", href: "/routes", icon: Navigation, description: "Pathfinding avoiding active hazards" },
  { name: "Alert Zones", href: "/alerts", icon: Bell, description: "Geofences (25km² max) & Push alerts" },
  { name: "Profile & KYC", href: "/profile", icon: UserCheck, description: "Trust score, device ID & verification" },
  { name: "Admin Portal", href: "/admin", icon: Lock, description: "Purge reports, ban users & news crawl", adminOnly: true },
  { name: "API Test Suite", href: "/dev-test", icon: FlaskConical, description: "Interactive 1-click backend tester" },
];

export default function RouteTestNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend health
    apiFetch<{ success: boolean }>("/health")
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white text-xs px-4 py-2 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        {/* Left: Backend Status and Route Guide */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[10px] text-amber-400">
            <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Route Explorer</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendOnline === true
                  ? "bg-emerald-400 animate-pulse"
                  : backendOnline === false
                  ? "bg-rose-500"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-slate-300">
              {backendOnline === true
                ? "Backend Connected"
                : backendOnline === false
                ? "Backend Disconnected"
                : "Checking API..."}
            </span>
          </div>

          {user && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
              <span className="text-slate-400">Role:</span>
              <span className="font-semibold text-emerald-400">{user.role}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Trust:</span>
              <span className="font-semibold text-amber-300">{user.trustScore}</span>
            </div>
          )}
        </div>

        {/* Right: Quick-jump Pills */}
        <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {ROUTES.map((route) => {
            const isActive =
              route.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(route.href);
            const Icon = route.icon;

            return (
              <Link
                key={route.href}
                href={route.href}
                title={route.description}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all shrink-0 ${
                  isActive
                    ? "bg-brand-primary text-white shadow-sm ring-1 ring-blue-400"
                    : route.adminOnly
                    ? "bg-purple-950/60 text-purple-300 hover:bg-purple-900 border border-purple-800/50"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50"
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{route.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
