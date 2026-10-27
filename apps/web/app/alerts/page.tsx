"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

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
    ],
  },
  {
    name: "Dhanmondi Residential Polygon (~3.8 km²)",
    coordinates: [
      [90.3650, 23.7400],
      [90.3850, 23.7400],
      [90.3850, 23.7580],
      [90.3650, 23.7580],
      [90.3650, 23.7400],
    ],
  },
  {
    name: "Oversized Zone (Fails > 25 km² validation)",
    coordinates: [
      [90.3000, 23.7000],
      [90.5000, 23.7000],
      [90.5000, 23.9000],
      [90.3000, 23.9000],
      [90.3000, 23.7000],
    ],
  },
];

export default function AlertsPage() {
  const { user, initAuth } = useAuthStore();
  const [zones, setZones] = useState<AlertZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Zone Form
  const [zoneName, setZoneName] = useState("");
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
  }, []);

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

  const handleApplyPreset = (preset: typeof ZONE_PRESETS[0]) => {
    setZoneName(preset.name.split("(")[0]?.trim() || preset.name);
    setCoordsString(JSON.stringify(preset.coordinates, null, 2));
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
      // Register or simulate Web Push subscription endpoint
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Geofenced Alert Zones & Push Notifications
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Define custom polygon safety fences (capped at 25 km²). Receive targeted alerts when incidents occur within your perimeter.
          </p>
        </div>

        {/* Web Push Subscription Action Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
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
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors shrink-0 ${
              pushSubscribed
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {pushSubscribed
              ? "✓ Subscribed to Push Alerts"
              : isSubscribingPush
              ? "Subscribing..."
              : "Subscribe to Push Alerts"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Alert Zone Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              <span>Create Geofence Zone</span>
            </h2>

            {createSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateZone} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Home & Office Route"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  required
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Polygon Presets</label>
                <div className="space-y-1">
                  {ZONE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left p-1.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors truncate"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinates Editor */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  GeoJSON Polygon Coordinates [ [lng, lat], ... ]
                </label>
                <textarea
                  value={coordsString}
                  onChange={(e) => setCoordsString(e.target.value)}
                  rows={6}
                  className="w-full p-2 text-[11px] font-mono bg-slate-900 text-emerald-400 rounded-lg resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Must be closed loop (first and last coordinate pair identical). Max area: 25 km².
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
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

          {/* Active Zones List & Live Alert Log */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active User Alert Zones */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-slate-600" />
                  <span>My Active Alert Zones ({zones.length})</span>
                </h3>
                <button
                  onClick={fetchZones}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active alert zones yet. Define a polygon on the left to activate geofenced monitoring.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{zone.name}</h4>
                          <button
                            onClick={() => handleDeleteZone(zone.id, zone.name)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Delete Zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {zone.coordinates?.length || 0} Polygon Vertices
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>ID: {zone.id.substring(0, 8)}...</span>
                        <span>{new Date(zone.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Socket Geofence Trigger Stream */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Live Geofence Alert Stream (Socket: GEOFENCE_ALERT)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Room: user:{user?.id?.substring(0, 8)}</span>
              </div>

              {liveAlerts.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                  Awaiting simulated or real incident within your perimeter. When an incident matches your polygon via PostGIS <code>ST_Intersects</code>, it pops up here instantly.
                </div>
              ) : (
                <div className="space-y-2">
                  {liveAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-bold">{alert.title || "Hazard Inside Alert Zone!"}</span>
                          <p className="text-[11px] text-rose-700">{alert.message || alert.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-rose-500 font-mono">{alert.receivedAt}</span>
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
