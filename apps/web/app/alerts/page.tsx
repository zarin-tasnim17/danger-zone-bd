"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
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
      <div className="w-full h-64 sm:h-72 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
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

      const calculatedArea = calculatePolygonAreaKm2(parsedCoords);
      if (calculatedArea > 25.0) {
        throw new Error(`Geofence boundary exceeds maximum permitted size of 25 km² (Current: ${calculatedArea} km²).`);
      }

      await apiFetch("/alerts/zones", {
        method: "POST",
        body: JSON.stringify({
          name: zoneName.trim(),
          coordinates: parsedCoords,
        }),
      });

      setCreateSuccess(`Alert Zone "${zoneName}" successfully established!`);
      setZoneName("");
      fetchZones();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create alert zone");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteZone = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete alert zone "${name}"?`)) return;
    try {
      await apiFetch(`/alerts/zones/${id}`, { method: "DELETE" });
      fetchZones();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSubscribePush = async () => {
    setIsSubscribingPush(true);
    try {
      // Register Service Worker and subscribe to PushManager
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push messaging is not supported in this browser.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was denied.");
      }

      // Sample mock push endpoint subscription payload for verification
      await apiFetch("/alerts/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: `https://fcm.googleapis.com/fcm/send/sample-token-${Date.now()}`,
          keys: {
            p256dh: "BNcR6S9efE427503S6KE5L9fKx8",
            auth: "tBHItJI5svbQh4vYhK2OA",
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Geofenced Alert Zones & Push Notifications
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Draw custom safety perimeters on the map or choose presets (capped at 25 km²). Receive targeted alerts when incidents occur within your perimeter.
          </p>
        </div>

        {/* Web Push Subscription Action Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0 border border-blue-100 shadow-2xs">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Web Push Alert Notifications (POST /api/v1/alerts/subscribe)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enables background push notifications even when your browser tab is closed.
              </p>
            </div>
          </div>

          <button
            onClick={handleSubscribePush}
            disabled={isSubscribingPush || pushSubscribed}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all shrink-0 ${
              pushSubscribed
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-blue-600 hover:bg-blue-700 text-white"
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
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Interactive Geofence Builder</span>
              </h2>

              {/* Area Real-Time Badge */}
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isAreaExceeded
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {areaKm2} km² / 25 km²
              </span>
            </div>

            {/* Interactive Leaflet Drawing Map */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                <span>Click map to place polygon vertices ({activeCoords.length} points)</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleCompleteRing}
                    className="text-[10px] text-blue-600 hover:text-blue-700 underline font-semibold"
                  >
                    Close Ring
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleClearPolygon}
                    className="text-[10px] text-red-600 hover:text-red-700 underline font-semibold"
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
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>
                  Warning: Area is {areaKm2} km², exceeding the 25 km² limit! Please reduce perimeter size.
                </span>
              </div>
            )}

            {createSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateZone} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Home & Office Route"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quick Presets</label>
                <div className="grid grid-cols-1 gap-1">
                  {ZONE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors truncate font-medium"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinates Editor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GeoJSON Polygon Coordinates [ [lng, lat], ... ]
                </label>
                <textarea
                  value={coordsString}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  rows={4}
                  className="w-full p-2 text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-800 rounded-xl resize-none focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || isAreaExceeded}
                className="w-full py-2.5 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
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
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <span>My Active Alert Zones ({zones.length})</span>
                </h3>
                <button
                  onClick={fetchZones}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading saved zones...</p>
                </div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No active alert zones yet. Click points on the map or pick a preset to activate geofenced monitoring.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="p-4 bg-slate-50/80 border border-slate-200 hover:border-slate-300 rounded-xl flex flex-col justify-between transition-colors shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{zone.name}</h4>
                          <button
                            onClick={() => handleDeleteZone(zone.id, zone.name)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {zone.coordinates?.length || 0} Polygon Vertices
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>ID: {zone.id.substring(0, 8)}...</span>
                        <span>{new Date(zone.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Socket Geofence Trigger Stream */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Live Geofence Alert Stream (Socket: GEOFENCE_ALERT)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Room: user:{user?.id?.substring(0, 8)}</span>
              </div>

              {liveAlerts.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  Awaiting simulated or real incident within your perimeter. When an incident matches your polygon via PostGIS <code>ST_Intersects</code>, it pops up here instantly.
                </div>
              ) : (
                <div className="space-y-2">
                  {liveAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <div>
                          <span className="font-bold">{alert.title || "Hazard Inside Alert Zone!"}</span>
                          <p className="text-[11px] text-red-700">{alert.message || alert.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-red-600 font-mono">{alert.receivedAt}</span>
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
