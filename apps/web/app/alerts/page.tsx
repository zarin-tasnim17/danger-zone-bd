"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket } from "@/lib/socket";
import {
  Bell,
  MapPin,
  PlusCircle,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Radio,
  ShieldAlert,
  Send,
  RefreshCw,
  Edit3,
} from "lucide-react";

// Dynamically import map component with ssr: false to prevent Leaflet window reference errors
const PolygonDrawerMap = dynamic(
  () => import("@/components/alerts/PolygonDrawerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 sm:h-72 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
        Loading interactive map canvas...
      </div>
    ),
  }
);

interface AlertZone {
  id: string;
  name: string;
  userId: string;
  coordinates: [number, number][];
  createdAt: string;
}

const ZONE_PRESETS = [
  {
    name: "Banani & Gulshan Polygon (~4.2 km²)",
    coordinates: [
      [90.4000, 23.7850],
      [90.4200, 23.7850],
      [90.4200, 23.8050],
      [90.4000, 23.8050],
      [90.4000, 23.7850],
    ] as [number, number][],
  },
  {
    name: "Dhanmondi Residential Polygon (~3.8 km²)",
    coordinates: [
      [90.3650, 23.7400],
      [90.3850, 23.7400],
      [90.3850, 23.7580],
      [90.3650, 23.7580],
      [90.3650, 23.7400],
    ] as [number, number][],
  },
  {
    name: "Oversized Zone (Fails > 25 km² validation)",
    coordinates: [
      [90.3000, 23.7000],
      [90.5000, 23.7000],
      [90.5000, 23.9000],
      [90.3000, 23.9000],
      [90.3000, 23.7000],
    ] as [number, number][],
  },
];

// Geodesic spherical area calculation in km²
function calculatePolygonAreaKm2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const radius = 6378137; // Earth radius in meters
  let area = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];
    const phi1 = (p1[1] * Math.PI) / 180;
    const phi2 = (p2[1] * Math.PI) / 180;
    const deltaLambda = ((p2[0] - p1[0]) * Math.PI) / 180;
    area += deltaLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
  }
  area = Math.abs(area * radius * radius) / 2.0;
  return Number((area / 1e6).toFixed(2));
}

export default function AlertsPage() {
  const { user, initAuth } = useAuthStore();
  const [zones, setZones] = useState<AlertZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Zone Form
  const [zoneName, setZoneName] = useState("");
  const [activeCoords, setActiveCoords] = useState<[number, number][]>(
    ZONE_PRESETS[0].coordinates
  );
  const [coordsString, setCoordsString] = useState(
    JSON.stringify(ZONE_PRESETS[0].coordinates, null, 2)
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Web Push Status
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  // Live Geofence Stream
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    initAuth();
    fetchZones();

    // Listen to real-time GEOFENCE_ALERT socket event
    const socket = getSocket();
    if (socket) {
      const handleGeofenceAlert = (data: any) => {
        setLiveAlerts((prev) => [
          {
            ...data,
            receivedAt: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      };

      socket.on("GEOFENCE_ALERT", handleGeofenceAlert);
      return () => {
        socket.off("GEOFENCE_ALERT", handleGeofenceAlert);
      };
    }
  }, [initAuth]);

  const fetchZones = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AlertZone[]>("/alerts/zones");
      setZones(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load alert zones");
    } finally {
      setIsLoading(false);
    }
  };

  const areaKm2 = useMemo(() => {
    return calculatePolygonAreaKm2(activeCoords);
  }, [activeCoords]);

  const isAreaExceeded = areaKm2 > 25.0;

  const handleApplyPreset = (preset: typeof ZONE_PRESETS[0]) => {
    setZoneName(preset.name.split("(")[0]?.trim() || preset.name);
    setActiveCoords(preset.coordinates);
    setCoordsString(JSON.stringify(preset.coordinates, null, 2));
  };

  const handleAddMapPoint = (point: [number, number]) => {
    const updated = [...activeCoords, point];
    setActiveCoords(updated);
    setCoordsString(JSON.stringify(updated, null, 2));
  };

  const handleCompleteRing = () => {
    if (activeCoords.length < 3) return;
    const firstPoint = activeCoords[0];
    const lastPoint = activeCoords[activeCoords.length - 1];
    if (firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]) {
      return; // Already closed
    }
    const closed = [...activeCoords, firstPoint];
    setActiveCoords(closed);
    setCoordsString(JSON.stringify(closed, null, 2));
  };

  const handleClearPolygon = () => {
    setActiveCoords([]);
    setCoordsString("[]");
  };

  const handleTextareaChange = (val: string) => {
    setCoordsString(val);
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        setActiveCoords(parsed);
      }
    } catch {
      // Ignore parse error while user is typing
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      let parsedCoords: [number, number][];
      try {
        parsedCoords = JSON.parse(coordsString);
      } catch {
        throw new Error("Coordinates must be valid JSON array of [longitude, latitude] pairs.");
      }

      if (!Array.isArray(parsedCoords) || parsedCoords.length < 4) {
        throw new Error("Polygon must contain at least 4 coordinate pairs (closed ring).");
      }

      if (isAreaExceeded) {
        throw new Error(`Polygon area is ${areaKm2} km², which exceeds the 25 km² limit.`);
      }

      const created = await apiFetch<AlertZone>("/alerts/zones", {
        method: "POST",
        body: JSON.stringify({
          name: zoneName.trim(),
          coordinates: parsedCoords,
        }),
      });

      setZones((prev) => [created, ...prev]);
      setCreateSuccess(`Alert zone "${created.name}" created successfully!`);
      setZoneName("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create alert zone");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteZone = async (id: string, name: string) => {
    if (!confirm(`Delete alert zone "${name}"?`)) return;

    try {
      await apiFetch(`/alerts/zones/${id}`, { method: "DELETE" });
      setZones((prev) => prev.filter((z) => z.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSubscribePush = async () => {
    setIsSubscribingPush(true);
    try {
      const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/simulated-${user?.id || Date.now()}`;
      await apiFetch("/alerts/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: fakeEndpoint,
          keys: {
            p256dh: "BFu3x9kL42...",
            auth: "9sA2xQ...",
          },
        }),
      });

      setPushSubscribed(true);
      alert("Browser Web Push alert registration successful!");
    } catch (err: any) {
      alert(`Push registration failed: ${err.message}`);
    } finally {
      setIsSubscribingPush(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-950/60 border border-indigo-700/60 text-indigo-400 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Geofenced Alert Zones & Push Notifications
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Draw custom safety perimeters on the map or choose presets (capped at 25 km²). Receive targeted alerts when incidents occur within your perimeter.
          </p>
        </div>

        {/* Web Push Subscription Action Banner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950 text-indigo-400 rounded-xl shrink-0 border border-indigo-800/50">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Web Push Alert Notifications (POST /api/v1/alerts/subscribe)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enables background push notifications even when your browser tab is closed.
              </p>
            </div>
          </div>

          <button
            onClick={handleSubscribePush}
            disabled={isSubscribingPush || pushSubscribed}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all shrink-0 ${
              pushSubscribed
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {pushSubscribed
              ? "✓ Subscribed to Push Alerts"
              : isSubscribingPush
              ? "Subscribing..."
              : "Subscribe to Push Alerts"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Alert Zone Canvas (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Interactive Geofence Builder</span>
              </h2>

              {/* Area Real-Time Badge */}
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isAreaExceeded
                    ? "bg-red-950/60 border-red-800 text-red-400"
                    : "bg-indigo-950/60 border-indigo-800 text-indigo-300"
                }`}
              >
                {areaKm2} km² / 25 km²
              </span>
            </div>

            {/* Interactive Leaflet Drawing Map */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Click map to place polygon vertices ({activeCoords.length} points)</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleCompleteRing}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-semibold"
                  >
                    Close Ring
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleClearPolygon}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <PolygonDrawerMap
                coordinates={activeCoords}
                onAddPoint={handleAddMapPoint}
              />
            </div>

            {isAreaExceeded && (
              <div className="p-2.5 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  Warning: Area is {areaKm2} km², exceeding the 25 km² limit! Please reduce perimeter size.
                </span>
              </div>
            )}

            {createSuccess && (
              <div className="p-2.5 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateZone} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Home & Office Route"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Quick Presets</label>
                <div className="grid grid-cols-1 gap-1">
                  {ZONE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50 transition-colors truncate"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinates Editor */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GeoJSON Polygon Coordinates [ [lng, lat], ... ]
                </label>
                <textarea
                  value={coordsString}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  rows={4}
                  className="w-full p-2 text-[10px] font-mono bg-slate-950 border border-slate-800 text-emerald-400 rounded-lg resize-none focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || isAreaExceeded}
                className="w-full py-2.5 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Geofence...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Zone (POST /alerts/zones)</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Active Zones List & Live Alert Log (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active User Alert Zones */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>My Active Alert Zones ({zones.length})</span>
                </h3>
                <button
                  onClick={fetchZones}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading saved zones...</p>
                </div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No active alert zones yet. Click points on the map or pick a preset to activate geofenced monitoring.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-white">{zone.name}</h4>
                          <button
                            onClick={() => handleDeleteZone(zone.id, zone.name)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {zone.coordinates?.length || 0} Polygon Vertices
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>ID: {zone.id.substring(0, 8)}...</span>
                        <span>{new Date(zone.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Socket Geofence Trigger Stream */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Geofence Alert Stream (Socket: GEOFENCE_ALERT)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Room: user:{user?.id?.substring(0, 8)}</span>
              </div>

              {liveAlerts.length === 0 ? (
                <div className="p-6 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                  Awaiting simulated or real incident within your perimeter. When an incident matches your polygon via PostGIS <code>ST_Intersects</code>, it pops up here instantly.
                </div>
              ) : (
                <div className="space-y-2">
                  {liveAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <div>
                          <span className="font-bold">{alert.title || "Hazard Inside Alert Zone!"}</span>
                          <p className="text-[11px] text-red-300">{alert.message || alert.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-red-400 font-mono">{alert.receivedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
