"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ProbeResult {
  status: "idle" | "loading" | "online" | "error";
  latency: number;
  data: any;
  error?: string;
}

export default function HealthPage() {
  const [backendUrl, setBackendUrl] = useState<string>("https://danger-zone-bd.onrender.com");
  const [loading, setLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [showJson, setShowJson] = useState<boolean>(false);

  const [backendProbe, setBackendProbe] = useState<ProbeResult>({
    status: "idle",
    latency: 0,
    data: null,
  });

  const [dbProbe, setDbProbe] = useState<ProbeResult>({
    status: "idle",
    latency: 0,
    data: null,
  });

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    const targetUrl = process.env.NEXT_PUBLIC_API_URL || "https://danger-zone-bd.onrender.com";
    setBackendUrl(targetUrl);

    // 1. Probe Backend API (/health)
    const probeBackend = async () => {
      setBackendProbe((prev) => ({ ...prev, status: "loading" }));
      const start = performance.now();
      try {
        const res = await fetch(`${targetUrl}/health`, { cache: "no-store" });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          setBackendProbe({ status: "online", latency, data });
        } else {
          setBackendProbe({
            status: "error",
            latency,
            data: null,
            error: `HTTP ${res.status}: ${res.statusText}`,
          });
        }
      } catch (err: any) {
        setBackendProbe({
          status: "error",
          latency: Math.round(performance.now() - start),
          data: null,
          error: err.message || "Failed to reach backend",
        });
      }
    };

    // 2. Probe Database (/health/db)
    const probeDatabase = async () => {
      setDbProbe((prev) => ({ ...prev, status: "loading" }));
      const start = performance.now();
      try {
        const res = await fetch(`${targetUrl}/health/db`, { cache: "no-store" });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          setDbProbe({ status: "online", latency, data });
        } else {
          setDbProbe({
            status: "error",
            latency,
            data: null,
            error: `HTTP ${res.status}: ${res.statusText}`,
          });
        }
      } catch (err: any) {
        setDbProbe({
          status: "error",
          latency: Math.round(performance.now() - start),
          data: null,
          error: err.message || "Failed to execute database query",
        });
      }
    };

    await Promise.all([probeBackend(), probeDatabase()]);
    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const isAllHealthy =
    backendProbe.status === "online" && dbProbe.status === "online";
  const hasError =
    backendProbe.status === "error" || dbProbe.status === "error";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Return to Map"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Danger Zone BD <span className="text-slate-400 font-normal">| System Health & Diagnostics</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Diagnosing..." : "Run Diagnostic"}</span>
            </button>
            <Link
              href="/"
              className="hidden sm:inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Safety Map
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Overall Status Banner */}
        <section
          className={`p-6 rounded-2xl border transition-all ${
            loading
              ? "bg-blue-950/30 border-blue-800/60 text-blue-200"
              : isAllHealthy
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200 shadow-lg shadow-emerald-950/20"
              : hasError
              ? "bg-rose-950/30 border-rose-800/60 text-rose-200"
              : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              {loading ? (
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
              ) : isAllHealthy ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  {loading
                    ? "Executing Real-Time Cloud Diagnostics..."
                    : isAllHealthy
                    ? "All Systems Operational — Cloud Pipeline Verified"
                    : "Partial Degradation Detected"}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      loading
                        ? "bg-blue-400 animate-ping"
                        : isAllHealthy
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-rose-500 animate-pulse"
                    }`}
                  />
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Full 3-tier connectivity from Vercel Frontend to Render Backend and Supabase PostgreSQL with PostGIS.
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-mono">
                Last Probe Time
              </span>
              <span className="text-sm font-semibold text-slate-200 font-mono">
                {lastChecked || "Checking..."}
              </span>
            </div>
          </div>
        </section>

        {/* Cloud Architecture Pipeline Flow Diagram */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              3-Tier Full-Stack Cloud Architecture
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Tier 1: Frontend */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-sm text-white">Tier 1: Frontend</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-slate-400">Next.js 14 App Router, React, Tailwind CSS, Leaflet</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Hosting</span>
                <span className="text-slate-200 font-mono">Vercel Edge</span>
              </div>
            </div>

            {/* Tier 2: Backend */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-violet-400" />
                    <span className="font-semibold text-sm text-white">Tier 2: Backend API</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      backendProbe.status === "online"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : backendProbe.status === "loading"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {backendProbe.status === "online"
                      ? "ONLINE"
                      : backendProbe.status === "loading"
                      ? "PROBING..."
                      : "FAILED"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Express.js, TypeScript, Socket.IO, JWT Auth, CORS</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Hosting</span>
                <span className="text-slate-200 font-mono">Render Singapore</span>
              </div>
            </div>

            {/* Tier 3: Database */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm text-white">Tier 3: Geospatial DB</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      dbProbe.status === "online"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : dbProbe.status === "loading"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {dbProbe.status === "online"
                      ? "CONNECTED"
                      : dbProbe.status === "loading"
                      ? "QUERYING..."
                      : "FAILED"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">PostgreSQL + PostGIS 3.3.7, Prisma ORM, PgBouncer</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Provider</span>
                <span className="text-slate-200 font-mono">Supabase Mumbai</span>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Live Probes Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Probe Endpoints & Diagnostic Metrics
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend Probe Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Server className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Backend REST Service</h4>
                    <p className="text-xs text-slate-400 font-mono">GET /health</p>
                  </div>
                </div>
                {backendProbe.status === "online" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : backendProbe.status === "loading" ? (
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
              </div>

              <div className="space-y-2 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target URL:</span>
                  <span className="text-slate-200 truncate max-w-[220px]" title={backendUrl}>
                    {backendUrl}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Roundtrip Latency:</span>
                  <span className="text-emerald-400 font-bold">{backendProbe.latency} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">HTTP Status:</span>
                  <span className="text-slate-200 font-bold">
                    {backendProbe.status === "online" ? "200 OK" : backendProbe.error || "Probing..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Response Message:</span>
                  <span className="text-slate-300">
                    {backendProbe.data?.message || (loading ? "Waiting..." : "No response")}
                  </span>
                </div>
              </div>
            </div>

            {/* Database Probe Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Database className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Database & Geospatial Engine</h4>
                    <p className="text-xs text-slate-400 font-mono">GET /health/db</p>
                  </div>
                </div>
                {dbProbe.status === "online" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : dbProbe.status === "loading" ? (
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
              </div>

              <div className="space-y-2 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Database Engine:</span>
                  <span className="text-slate-200">PostgreSQL (Supabase)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Spatial Extension:</span>
                  <span className="text-emerald-400">PostGIS 3.3.7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Query Executed:</span>
                  <span className="text-slate-300 font-bold">SELECT 1 (Prisma $queryRaw)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Query Latency:</span>
                  <span className="text-emerald-400 font-bold">{dbProbe.latency} ms</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collapsible Raw JSON Inspector */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <button
            onClick={() => setShowJson(!showJson)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <span>Inspect Live Raw JSON Payload</span>
            {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showJson && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <pre className="p-4 bg-slate-950 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800">
                {JSON.stringify(
                  {
                    timestamp: new Date().toISOString(),
                    backend: {
                      url: backendUrl,
                      status: backendProbe.status,
                      latencyMs: backendProbe.latency,
                      response: backendProbe.data,
                    },
                    database: {
                      status: dbProbe.status,
                      latencyMs: dbProbe.latency,
                      response: dbProbe.data,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 text-center text-xs text-slate-400">
        Bangladesh Real-Time Public Safety & Crime Map • CSE 3104 Project
      </footer>
    </div>
  );
}
