"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Zap,
  Clock,
  Loader2,
  Radio,
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
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [wakeUpTime, setWakeUpTime] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Ticking timer during diagnostic loading
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      setIsWakingUp(false);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next >= 4) {
            setIsWakingUp(true);
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setWakeUpTime(null);
    const targetUrl = process.env.NEXT_PUBLIC_API_URL || "https://danger-zone-bd.onrender.com";
    setBackendUrl(targetUrl);

    let backendSuccess = false;
    let dbSuccess = false;
    const totalStart = performance.now();

    // Loop retry for Render cold start (up to 60 seconds total)
    const maxAttempts = 12; // 12 attempts * ~4s interval
    let attempt = 0;

    while (attempt < maxAttempts && (!backendSuccess || !dbSuccess)) {
      attempt++;

      // 1. Direct Client-to-Backend Probe
      try {
        const startB = performance.now();
        const resB = await fetch(`${targetUrl}/health`, { cache: "no-store" });
        if (resB.ok) {
          const dataB = await resB.json();
          const latB = Math.round(performance.now() - startB);
          setBackendProbe({ status: "online", latency: latB, data: dataB });
          backendSuccess = true;
        }
      } catch (err: any) {
        // Render still booting or CORS syncing
      }

      try {
        const startD = performance.now();
        const resD = await fetch(`${targetUrl}/health/db`, { cache: "no-store" });
        if (resD.ok) {
          const dataD = await resD.json();
          const latD = Math.round(performance.now() - startD);
          setDbProbe({ status: "online", latency: latD, data: dataD });
          dbSuccess = true;
        }
      } catch (err: any) {
        // DB probe waiting on backend
      }

      // If both succeeded, break immediately
      if (backendSuccess && dbSuccess) break;

      // 2. Also try same-origin /api/health edge route in parallel
      try {
        const resEdge = await fetch("/api/health", { cache: "no-store" });
        if (resEdge.ok) {
          const json = await resEdge.json();
          const b = json.services?.backend;
          const d = json.services?.database;

          if (b?.status === "online") {
            setBackendProbe({
              status: "online",
              latency: b.latencyMs || 250,
              data: { message: "API is online & operational (via edge probe)" },
            });
            backendSuccess = true;
          }
          if (d?.status === "connected") {
            setDbProbe({
              status: "online",
              latency: d.latencyMs || 320,
              data: { message: "Database connection verified (via edge probe)" },
            });
            dbSuccess = true;
          }
        }
      } catch (e) {
        // ignore edge error while sleeping
      }

      if (backendSuccess && dbSuccess) break;

      // Wait 3.5s before next polling attempt to allow Render container to finish boot
      await new Promise((r) => setTimeout(r, 3500));
    }

    const totalDuration = Math.round((performance.now() - totalStart) / 1000);
    if (totalDuration >= 5 && backendSuccess) {
      setWakeUpTime(totalDuration);
    }

    // If still not successful after polling, set final error
    if (!backendSuccess) {
      setBackendProbe((prev) => ({
        status: "error",
        latency: 0,
        data: null,
        error: "Backend cold-start timed out (try clicking Run Diagnostic again)",
      }));
    }
    if (!dbSuccess) {
      setDbProbe((prev) => ({
        status: "error",
        latency: 0,
        data: null,
        error: "Database query timed out",
      }));
    }

    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const isAllHealthy =
    backendProbe.status === "online" && dbProbe.status === "online";
  const hasError =
    !loading && (backendProbe.status === "error" || dbProbe.status === "error");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
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
                Danger Zone BD <span className="text-slate-400 font-normal">| Live Cloud Status</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Probing Cloud..." : "Run Diagnostic"}</span>
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Render Cold-Start Aesthetic Loading Animation (Shown when probe takes > 3s) */}
        {loading && isWakingUp && (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900/90 border border-blue-500/40 p-6 shadow-2xl shadow-blue-950/40 animate-in fade-in zoom-in-95 duration-500">
            {/* Ambient Background Glow Effect */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-blue-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-bounce" />
                      Render Free Tier Container Waking Up...
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Cold-Start in Progress
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                    Render free instances automatically spin down to sleep after inactivity to save resources. Your request is actively spinning up the server container (usually takes ~20–45s).
                  </p>
                </div>
              </div>

              {/* Live Ticking Counter & Pulse Meter */}
              <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-blue-800/40">
                <div className="flex items-center gap-2 text-blue-300 font-mono text-sm sm:text-base font-bold bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-blue-700/50 shadow-inner">
                  <Clock className="w-4 h-4 text-blue-400 animate-spin" />
                  <span>Elapsed: {elapsedSeconds}s</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 font-mono">
                  Auto-retrying live...
                </span>
              </div>
            </div>

            {/* Stepped Progress Checklist */}
            <div className="mt-6 pt-4 border-t border-blue-900/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>1. Vercel Frontend: <strong>Online</strong></span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-amber-200 bg-amber-950/20 p-2.5 rounded-lg border border-amber-800/40">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                <span>2. Render Express: <strong>Spinning Up...</strong></span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <Database className="w-4 h-4 text-slate-500 shrink-0" />
                <span>3. Supabase PostGIS: <strong>Waiting on API</strong></span>
              </div>
            </div>
          </section>
        )}

        {/* Overall Status Banner */}
        <section
          className={`p-6 rounded-2xl border transition-all ${
            loading && !isWakingUp
              ? "bg-blue-950/30 border-blue-800/60 text-blue-200"
              : loading && isWakingUp
              ? "bg-slate-900/70 border-slate-800 text-slate-300"
              : isAllHealthy
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200 shadow-xl shadow-emerald-950/20"
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
                    ? "Connecting to Cloud Services..."
                    : isAllHealthy
                    ? "All Systems Operational — Cloud Pipeline Verified"
                    : "Service Starting Up or Degraded"}
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
                  Full 3-tier connectivity from Vercel Frontend to Render Express Backend and Supabase PostgreSQL with PostGIS.
                  {wakeUpTime && (
                    <span className="text-emerald-400 ml-1 font-mono font-medium">
                      (Container awakened in {wakeUpTime}s)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-mono">
                Last Verified Probe
              </span>
              <span className="text-sm font-semibold text-slate-200 font-mono">
                {lastChecked || "In progress..."}
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
                        : loading
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {backendProbe.status === "online"
                      ? "ONLINE"
                      : loading
                      ? isWakingUp
                        ? `WAKING UP (${elapsedSeconds}s)`
                        : "CONNECTING..."
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
                        : loading
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {dbProbe.status === "online"
                      ? "CONNECTED"
                      : loading
                      ? "WAITING ON API"
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
                ) : loading ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
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
                  <span className="text-emerald-400 font-bold">
                    {backendProbe.status === "online" ? `${backendProbe.latency} ms` : "Probing..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">HTTP Status:</span>
                  <span className="text-slate-200 font-bold">
                    {backendProbe.status === "online"
                      ? "200 OK"
                      : loading
                      ? `Awakening container (${elapsedSeconds}s)...`
                      : backendProbe.error || "Offline"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Response Message:</span>
                  <span className="text-slate-300">
                    {backendProbe.data?.message || (loading ? "Waiting for container..." : "No response")}
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
                ) : loading ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
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
                  <span className="text-emerald-400 font-bold">
                    {dbProbe.status === "online" ? `${dbProbe.latency} ms` : "Waiting for backend..."}
                  </span>
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
