"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Database,
  Shield,
  Key,
  FileText,
  MapPin,
  ThumbsUp,
  MessageSquare,
  Navigation,
  Bell,
  Lock,
} from "lucide-react";

interface TestCase {
  id: string;
  module: string;
  name: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
  frontendRoute: string;
  status: "IDLE" | "RUNNING" | "PASSED" | "FAILED";
  statusCode?: number;
  durationMs?: number;
  response?: any;
  error?: string;
}

const INITIAL_TESTS: TestCase[] = [
  // 1. Health
  {
    id: "health-api",
    module: "1. System & Health",
    name: "API Liveness Ping",
    method: "GET",
    endpoint: "/health",
    frontendRoute: "/",
    status: "IDLE",
  },
  {
    id: "health-db",
    module: "1. System & Health",
    name: "PostGIS Database Connection",
    method: "GET",
    endpoint: "/health/db",
    frontendRoute: "/",
    status: "IDLE",
  },

  // 2. Auth
  {
    id: "auth-device",
    module: "2. Authentication",
    name: "Anonymous Device Login (Sets Cookies)",
    method: "POST",
    endpoint: "/auth/device",
    body: { anonymousId: "test-dev-suite-uuid" },
    frontendRoute: "/profile",
    status: "IDLE",
  },
  {
    id: "auth-refresh",
    module: "2. Authentication",
    name: "Session Refresh via RefreshToken Cookie",
    method: "POST",
    endpoint: "/auth/refresh",
    frontendRoute: "/profile",
    status: "IDLE",
  },

  // 3. User
  {
    id: "user-me",
    module: "3. Users & Profile",
    name: "Get Authenticated User Profile",
    method: "GET",
    endpoint: "/users/me",
    frontendRoute: "/profile",
    status: "IDLE",
  },
  {
    id: "user-verify",
    module: "3. Users & Profile",
    name: "Submit Citizen KYC Verification",
    method: "POST",
    endpoint: "/users/verify",
    body: { type: "PHONE_OTP" },
    frontendRoute: "/profile",
    status: "IDLE",
  },

  // 4. Reports
  {
    id: "reports-query",
    module: "4. Incident Reports",
    name: "Query Incidents in Bangladesh Bounds",
    method: "GET",
    endpoint: "/reports?minLat=20.5&maxLat=26.5&minLng=88.5&maxLng=92.5",
    frontendRoute: "/feed",
    status: "IDLE",
  },
  {
    id: "reports-create",
    module: "4. Incident Reports",
    name: "Create Incident (with <= 200m GPS headers)",
    method: "POST",
    endpoint: "/reports",
    headers: {
      "x-device-lat": "23.7925",
      "x-device-lng": "90.4078",
    },
    body: {
      category: "MUGGING",
      severity: "HIGH",
      latitude: 23.7925,
      longitude: 90.4078,
      description: "Automated test incident submitted via API test suite.",
    },
    frontendRoute: "/report",
    status: "IDLE",
  },

  // 5. Safe Zones
  {
    id: "safezones-query",
    module: "5. Safe Shelters",
    name: "Query Verified Safe Shelters",
    method: "GET",
    endpoint: "/safe-zones?minLat=20.5&maxLat=27.0&minLng=88.0&maxLng=93.0",
    frontendRoute: "/safe-zones",
    status: "IDLE",
  },

  // 6. Safe Routes
  {
    id: "routes-safe-path",
    module: "6. Safe Route Pathfinding",
    name: "Calculate Route Avoiding Active Hazards",
    method: "POST",
    endpoint: "/routes/safe-path",
    body: {
      startLat: 23.7570,
      startLng: 90.3905,
      endLat: 23.7925,
      endLng: 90.4078,
    },
    frontendRoute: "/routes",
    status: "IDLE",
  },

  // 7. Alerts
  {
    id: "alerts-zones",
    module: "7. Geofenced Alerts",
    name: "List User Alert Geofences",
    method: "GET",
    endpoint: "/alerts/zones",
    frontendRoute: "/alerts",
    status: "IDLE",
  },
  {
    id: "alerts-subscribe",
    module: "7. Geofenced Alerts",
    name: "Register Web Push Subscription",
    method: "POST",
    endpoint: "/alerts/subscribe",
    body: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-suite-endpoint",
      keys: { p256dh: "test-key", auth: "test-auth" },
    },
    frontendRoute: "/alerts",
    status: "IDLE",
  },

  // 8. Admin
  {
    id: "admin-analytics",
    module: "8. Admin & Analytics",
    name: "30-Day Incident Frequency Trends",
    method: "GET",
    endpoint: "/admin/analytics/trends",
    frontendRoute: "/admin",
    status: "IDLE",
  },
  {
    id: "admin-logs",
    module: "8. Admin & Analytics",
    name: "Moderation Audit Logs",
    method: "GET",
    endpoint: "/admin/logs?page=1&limit=10",
    frontendRoute: "/admin",
    status: "IDLE",
  },
];

export default function DevTestPage() {
  const { user, initAuth } = useAuthStore();
  const [tests, setTests] = useState<TestCase[]>(INITIAL_TESTS);
  const [expandedResponses, setExpandedResponses] = useState<Record<string, boolean>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const toggleExpand = (id: string) => {
    setExpandedResponses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runTest = async (testId: string) => {
    const target = tests.find((t) => t.id === testId);
    if (!target) return;

    setTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: "RUNNING", error: undefined } : t))
    );

    const startTime = performance.now();

    try {
      const res = await apiFetch<any>(target.endpoint, {
        method: target.method,
        headers: target.headers,
        body: target.body ? JSON.stringify(target.body) : undefined,
      });

      const durationMs = Math.round(performance.now() - startTime);

      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: "PASSED",
                statusCode: 200,
                durationMs,
                response: res,
              }
            : t
        )
      );

      // Auto-expand response for this test
      setExpandedResponses((prev) => ({ ...prev, [testId]: true }));
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);

      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: "FAILED",
                statusCode: err.statusCode || 400,
                durationMs,
                error: err.message,
                response: err.data,
              }
            : t
        )
      );
      setExpandedResponses((prev) => ({ ...prev, [testId]: true }));
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (const test of tests) {
      await runTest(test.id);
    }
    setIsRunningAll(false);
  };

  const passedCount = tests.filter((t) => t.status === "PASSED").length;
  const failedCount = tests.filter((t) => t.status === "FAILED").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Backend API Test Suite & Frontend Route Hub
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Interactive workbench to execute live backend tests, inspect JSON payloads, and verify all 9 frontend routes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm">
              <span className="text-emerald-600">Passed: {passedCount}</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600">Failed: {failedCount}</span>
            </div>

            <button
              onClick={runAllTests}
              disabled={isRunningAll}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-sm transition-colors"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningAll ? "animate-spin" : ""}`} />
              <span>{isRunningAll ? "Running Test Suite..." : "Run All API Tests"}</span>
            </button>
          </div>
        </div>

        {/* Tests List Grouped by Module */}
        <div className="space-y-4">
          {tests.map((test) => {
            const isExpanded = expandedResponses[test.id];

            return (
              <div
                key={test.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Test Row Header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Method Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                        test.method === "GET"
                          ? "bg-blue-100 text-blue-700"
                          : test.method === "POST"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {test.method}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{test.name}</h3>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {test.endpoint}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">{test.module}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status Indicator */}
                    {test.status === "RUNNING" && (
                      <span className="text-xs text-amber-600 flex items-center gap-1 font-semibold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </span>
                    )}

                    {test.status === "PASSED" && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Passed ({test.durationMs}ms)</span>
                      </span>
                    )}

                    {test.status === "FAILED" && (
                      <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Failed ({test.statusCode})</span>
                      </span>
                    )}

                    {/* Run Single Button */}
                    <button
                      onClick={() => runTest(test.id)}
                      disabled={test.status === "RUNNING"}
                      className="px-3 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                    >
                      Run
                    </button>

                    {/* Direct Frontend Route Link */}
                    <Link
                      href={test.frontendRoute}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-1"
                      title={`Go to frontend route: ${test.frontendRoute}`}
                    >
                      <span>{test.frontendRoute}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>

                    {/* Toggle Inspector Button */}
                    {(test.response || test.error) && (
                      <button
                        onClick={() => toggleExpand(test.id)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="Toggle JSON Response"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Response & Details Drawer */}
                {isExpanded && (
                  <div className="bg-slate-900 border-t border-slate-800 p-4 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
                      <span>HTTP Response Payload</span>
                      {test.durationMs && <span>Latency: {test.durationMs}ms</span>}
                    </div>

                    {test.error && (
                      <div className="p-2 bg-rose-950/80 border border-rose-800 rounded text-rose-300 text-[11px] mb-2">
                        <strong>Error:</strong> {test.error}
                      </div>
                    )}

                    <pre className="text-emerald-400 text-[11px] overflow-x-auto max-h-56 scrollbar-thin">
                      {JSON.stringify(test.response || test.error, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
