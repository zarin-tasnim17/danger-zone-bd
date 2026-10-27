"use client";

import React, { useState, useEffect } from "react";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Navigation,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Route,
  Activity,
  Compass,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface SafeRouteResult {
  isDiverted: boolean;
  divertedReason: string;
  waypoints: Waypoint[];
  hazardsAvoidedCount: number;
  distanceMeters: number;
}

const ROUTE_PRESETS = [
  {
    name: "Farmgate → Banani (High Crime Corridor)",
    start: { lat: 23.7570, lng: 90.3905 },
    end: { lat: 23.7925, lng: 90.4078 },
  },
  {
    name: "Mohakhali → Gulshan 2 (Night Corridor)",
    start: { lat: 23.7776, lng: 90.4054 },
    end: { lat: 23.7979, lng: 90.4144 },
  },
  {
    name: "Dhanmondi 27 → Shahbagh (Unlit Segments)",
    start: { lat: 23.7533, lng: 90.3768 },
    end: { lat: 23.7388, lng: 90.3957 },
  },
  {
    name: "Uttara Sector 3 → Airport Road",
    start: { lat: 23.8683, lng: 90.3995 },
    end: { lat: 23.8433, lng: 90.4049 },
  },
];

export default function RoutesPage() {
  const { initAuth } = useAuthStore();

  const [startLat, setStartLat] = useState("23.7570");
  const [startLng, setStartLng] = useState("90.3905");
  const [endLat, setEndLat] = useState("23.7925");
  const [endLng, setEndLng] = useState("90.4078");

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SafeRouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const handleApplyPreset = (preset: typeof ROUTE_PRESETS[0]) => {
    setStartLat(preset.start.lat.toString());
    setStartLng(preset.start.lng.toString());
    setEndLat(preset.end.lat.toString());
    setEndLng(preset.end.lng.toString());
  };

  const handleCalculateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const sLat = parseFloat(startLat);
      const sLng = parseFloat(startLng);
      const eLat = parseFloat(endLat);
      const eLng = parseFloat(endLng);

      if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
        throw new Error("Please enter valid start and end coordinates.");
      }

      const data = await apiFetch<SafeRouteResult>("/routes/safe-path", {
        method: "POST",
        body: JSON.stringify({
          startLat: sLat,
          startLng: sLng,
          endLat: eLat,
          endLng: eLng,
        }),
      });

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to calculate safe route");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Safe Route Pathfinding Engine
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Pathfinding algorithm routing pedestrians and vehicles around active red hazard zones and high-crime clusters.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Form: Route Parameters */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <form onSubmit={handleCalculateRoute} className="space-y-4">
              {/* Presets */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Sample Route Corridors
                </label>
                <div className="space-y-1.5">
                  {ROUTE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left p-2 rounded-lg text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium truncate">{preset.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Point */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Start Location (Origin)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={startLat}
                    onChange={(e) => setStartLat(e.target.value)}
                    placeholder="Start Lat"
                    required
                    className="p-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                  />
                  <input
                    type="text"
                    value={startLng}
                    onChange={(e) => setStartLng(e.target.value)}
                    placeholder="Start Lng"
                    required
                    className="p-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              {/* Destination Point */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>Destination Location</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={endLat}
                    onChange={(e) => setEndLat(e.target.value)}
                    placeholder="End Lat"
                    required
                    className="p-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                  />
                  <input
                    type="text"
                    value={endLng}
                    onChange={(e) => setEndLng(e.target.value)}
                    placeholder="End Lng"
                    required
                    className="p-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Calculating Safe Path...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    <span>Calculate Safe Path (POST /safe-path)</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Display: Path Results */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <p className="font-semibold">{error}</p>
              </div>
            )}

            {result ? (
              <div className="space-y-5">
                {/* Status Alert Banner */}
                <div
                  className={`border rounded-xl p-5 ${
                    result.isDiverted
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {result.isDiverted ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    <span>
                      {result.isDiverted
                        ? "Diverted Safe Route Active"
                        : "Direct Route Clear (No Active Hazards)"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{result.divertedReason}</p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Distance</span>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">
                      {(result.distanceMeters / 1000).toFixed(2)} km
                    </p>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {result.distanceMeters.toLocaleString()} meters
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Hazards Avoided</span>
                    <p
                      className={`text-lg font-bold mt-0.5 ${
                        result.hazardsAvoidedCount > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {result.hazardsAvoidedCount} Zones
                    </p>
                    <span className="text-[11px] text-slate-500">150m Safety Buffer</span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Waypoints</span>
                    <p className="text-lg font-bold text-blue-600 mt-0.5">
                      {result.waypoints?.length || 0} Nodes
                    </p>
                    <span className="text-[11px] text-slate-500">PostGIS LineString</span>
                  </div>
                </div>

                {/* Waypoints Sequence Table */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Route className="w-4 h-4 text-slate-500" />
                    <span>Calculated Navigation Waypoints</span>
                  </h3>

                  <div className="overflow-x-auto max-h-60 scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3 font-semibold">Node</th>
                          <th className="py-2 px-3 font-semibold">Role</th>
                          <th className="py-2 px-3 font-semibold font-mono">Latitude</th>
                          <th className="py-2 px-3 font-semibold font-mono">Longitude</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.waypoints.map((wp, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-700">#{idx + 1}</td>
                            <td className="py-2 px-3">
                              {idx === 0 ? (
                                <span className="text-emerald-700 font-bold">Start Origin</span>
                              ) : idx === result.waypoints.length - 1 ? (
                                <span className="text-rose-700 font-bold">Destination</span>
                              ) : (
                                <span className="text-blue-600">Safe Detour Node</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{wp.latitude.toFixed(5)}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{wp.longitude.toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
                <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No route calculated yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select a corridor preset or specify start and destination GPS coordinates to generate a hazard-free path.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
