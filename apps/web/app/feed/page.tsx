"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  ListFilter,
  Search,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Clock,
  MapPin,
  AlertTriangle,
  Moon,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

interface Incident {
  id: string;
  category: "MUGGING" | "THEFT" | "UNLIT_ROAD" | "EXTORTION" | "DRUG_ACTIVITY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  latitude: number;
  longitude: number;
  description?: string | null;
  upvotes: number;
  downvotes: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
}

export default function FeedPage() {
  const { user, initAuth } = useAuthStore();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [nightFilter, setNightFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = "/reports?minLat=20&maxLat=27&minLng=88&maxLng=93";
      if (categoryFilter !== "ALL") query += `&category=${categoryFilter}`;
      if (severityFilter !== "ALL") query += `&severity=${severityFilter}`;
      if (nightFilter) query += `&isNightReport=true`;

      const data = await apiFetch<Incident[]>(query);
      setIncidents(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load incidents");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [categoryFilter, severityFilter, nightFilter]);

  const handleVote = async (reportId: string, voteType: 1 | -1) => {
    setVotingId(reportId);
    try {
      const updated = await apiFetch<any>(`/reports/${reportId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteType }),
      });

      setIncidents((prev) =>
        prev.map((item) =>
          item.id === reportId
            ? { ...item, upvotes: updated.upvotes, downvotes: updated.downvotes }
            : item
        )
      );
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`);
    } finally {
      setVotingId(null);
    }
  };

  const filteredIncidents = incidents.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.category.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.sourceName && item.sourceName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar totalIncidents={incidents.length} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <ListFilter className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Live Incident Feed & Explorer
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Real-time crowd-sourced and news-verified safety alerts across Bangladesh
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchIncidents}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Feed</span>
            </button>
            <Link
              href="/report"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
            >
              <span>+ Submit Incident</span>
            </Link>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search incidents by keyword or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Night Report Toggle */}
            <button
              onClick={() => setNightFilter(!nightFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                nightFilter
                  ? "bg-indigo-950 text-indigo-200 border-indigo-800"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Night Incidents (6PM - 6AM)</span>
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 mr-1">Category:</span>
            {["ALL", "MUGGING", "THEFT", "UNLIT_ROAD", "EXTORTION", "DRUG_ACTIVITY"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}

            <span className="text-xs font-semibold text-slate-500 ml-auto mr-1">Severity:</span>
            {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  severityFilter === sev
                    ? sev === "HIGH"
                      ? "bg-rose-600 text-white"
                      : sev === "MEDIUM"
                      ? "bg-amber-600 text-white"
                      : "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Content State */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Fetching real-time safety reports...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchIncidents}
              className="mt-3 px-4 py-1.5 text-xs bg-rose-600 text-white rounded-md hover:bg-rose-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No active incidents found</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are currently no reported hazards matching your selected filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Metadata */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        incident.severity === "HIGH"
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : incident.severity === "MEDIUM"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {incident.severity} SEVERITY
                    </span>

                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(incident.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Category Title */}
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {incident.category.replace("_", " ")}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 mb-3">
                    {incident.description || "No additional description provided for this incident pin."}
                  </p>

                  {/* Verified from News Badge */}
                  {incident.sourceUrl && (
                    <div className="mb-3 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-[11px] text-blue-900">
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">
                          Verified: {incident.sourceName || "Press Portal"}
                        </span>
                      </div>
                      <a
                        href={incident.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 shrink-0 ml-1"
                        title="View source article"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Approximate Coordinates */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)} (fuzzed)
                    </span>
                  </div>
                </div>

                {/* Card Bottom: Voting & Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVote(incident.id, 1)}
                      disabled={votingId === incident.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                      title="Upvote as valid"
                    >
                      <ThumbsUp className="w-3 h-3 text-emerald-600" />
                      <span className="font-semibold">{incident.upvotes}</span>
                    </button>

                    <button
                      onClick={() => handleVote(incident.id, -1)}
                      disabled={votingId === incident.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                      title="Downvote as false"
                    >
                      <ThumbsDown className="w-3 h-3 text-rose-600" />
                      <span className="font-semibold">{incident.downvotes}</span>
                    </button>
                  </div>

                  <Link
                    href={`/reports/${incident.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <span>Details & Updates</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
