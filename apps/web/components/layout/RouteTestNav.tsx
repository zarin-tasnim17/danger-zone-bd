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
  ChevronDown,
  ChevronUp,
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
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    // Check backend health
    apiFetch<{ success: boolean }>("/health")
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  if (isCollapsed) {
    return (
      <div className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 text-[11px] px-3 sm:px-4 py-1 flex items-center justify-between z-40 relative backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendOnline === true ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="font-mono text-slate-300">
            API: {backendOnline === true ? "Online" : backendOnline === false ? "Offline" : "Connecting..."}
          </span>
          {user && (
            <span className="hidden sm:inline text-slate-400">
              • {user.role} (Trust: {user.trustScore})
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-slate-800/60"
        >
          <span className="text-[10px] font-semibold tracking-wide uppercase">Route Explorer</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/95 border-b border-slate-800 text-white text-xs px-3 sm:px-4 py-2 z-40 relative backdrop-blur-md animate-in slide-in-from-top-1 duration-150">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        {/* Left: Backend Status and Route Guide */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-[10px] text-amber-400">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Route Explorer</span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline === true
                    ? "bg-emerald-400 animate-pulse"
                    : backendOnline === false
                    ? "bg-rose-500"
                    : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="font-mono text-slate-300">
                {backendOnline === true
                  ? "API: Online"
                  : backendOnline === false
                  ? "API: Offline"
                  : "API: Connecting..."}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(true)}
            className="md:hidden flex items-center gap-1 text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-900"
          >
            <span>Hide</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Quick navigation links */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {ROUTES.map((route) => {
            const isActive = route.href === "/" ? pathname === "/" : pathname?.startsWith(route.href);
            const Icon = route.icon;

            // Only show admin route to admin
            if (route.adminOnly && user?.role !== "ADMIN") return null;

            return (
              <Link
                key={route.href}
                href={route.href}
                title={route.description}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{route.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right: Collapse toggle button on desktop */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="hidden md:flex items-center gap-1 text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800 transition"
          title="Collapse Route Explorer"
        >
          <span>Hide</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
