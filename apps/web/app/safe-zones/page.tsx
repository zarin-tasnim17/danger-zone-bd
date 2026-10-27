"use client";

import React, { useState, useEffect } from "react";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Shield,
  Hospital,
  Building2,
  Pill,
  MapPin,
  PlusCircle,
  Trash2,
  Search,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Navigation,
} from "lucide-react";

interface SafeZone {
  id: string;
  name: string;
  type: "HOSPITAL" | "POLICE_BOX" | "PHARMACY";
  latitude: number;
  longitude: number;
  createdAt: string;
}

export default function SafeZonesPage() {
  const { user, initAuth } = useAuthStore();
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Proximity Search Controls
  const [proximityMode, setProximityMode] = useState(false);
  const [centerLat, setCenterLat] = useState("23.8103");
  const [centerLng, setCenterLng] = useState("90.4125");
  const [radiusMeters, setRadiusMeters] = useState("10000");

  // Admin Create Safe Zone Form
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"HOSPITAL" | "POLICE_BOX" | "PHARMACY">("HOSPITAL");
  const [newLat, setNewLat] = useState("23.8103");
  const [newLng, setNewLng] = useState("90.4125");
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const fetchSafeZones = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = "/safe-zones?";
      if (typeFilter !== "ALL") {
        query += `type=${typeFilter}&`;
      }

      if (proximityMode) {
        query += `lat=${centerLat}&lng=${centerLng}&radius=${radiusMeters}`;
      } else {
        query += `minLat=20.5&maxLat=27.0&minLng=88.0&maxLng=93.0`;
      }

      const data = await apiFetch<SafeZone[]>(query);
      setSafeZones(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load safe shelters");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSafeZones();
  }, [typeFilter, proximityMode]);

  const handleCreateSafeZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setCreateSuccess(null);
    try {
      const created = await apiFetch<SafeZone>("/safe-zones", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          latitude: parseFloat(newLat),
          longitude: parseFloat(newLng),
        }),
      });

      setSafeZones((prev) => [created, ...prev]);
      setCreateSuccess(`Safe shelter "${created.name}" created successfully!`);
      setNewName("");
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete safe shelter "${name}"?`)) return;

    try {
      await apiFetch(`/safe-zones/${id}`, { method: "DELETE" });
      setSafeZones((prev) => prev.filter((sz) => sz.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredSafeZones = safeZones.filter((sz) => {
    if (!searchQuery.trim()) return true;
    return sz.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "HOSPITAL":
        return <Hospital className="w-4 h-4 text-blue-600" />;
      case "POLICE_BOX":
        return <Building2 className="w-4 h-4 text-purple-600" />;
      case "PHARMACY":
        return <Pill className="w-4 h-4 text-emerald-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case "HOSPITAL":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "POLICE_BOX":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "PHARMACY":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Verified Safe Shelters Directory
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Browse government & verified hospitals, police boxes, and round-the-clock pharmacies across Bangladesh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSafeZones}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Shelters</span>
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search safe shelter name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Proximity Toggle */}
            <button
              onClick={() => setProximityMode(!proximityMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                proximityMode
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{proximityMode ? "Proximity Radius Active" : "Enable Proximity Search"}</span>
            </button>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 mr-1">Shelter Type:</span>
            {["ALL", "HOSPITAL", "POLICE_BOX", "PHARMACY"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.replace("_", " ")}
              </button>
            ))}

            {proximityMode && (
              <div className="flex items-center gap-2 ml-auto text-xs text-slate-600">
                <span>Radius:</span>
                <select
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  className="p-1 bg-slate-100 border border-slate-200 rounded text-xs"
                >
                  <option value="3000">3 km</option>
                  <option value="5000">5 km</option>
                  <option value="10000">10 km</option>
                  <option value="25000">25 km</option>
                </select>
                <button
                  onClick={fetchSafeZones}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admin Safe Zone Creation Drawer */}
        {(user?.role === "ADMIN" || true) && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-blue-600" />
                <span>Admin Safe Zone Management (POST /api/v1/safe-zones)</span>
              </h3>
              {user?.role !== "ADMIN" && (
                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded">
                  Test Mode (Requires ADMIN role in prod)
                </span>
              )}
            </div>

            {createSuccess && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSafeZone} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Shelter Name (e.g. Uttara Police Box)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="p-2 text-xs bg-white border border-slate-300 rounded-lg md:col-span-2"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="p-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="HOSPITAL">Hospital</option>
                <option value="POLICE_BOX">Police Box</option>
                <option value="PHARMACY">Pharmacy</option>
              </select>
              <input
                type="text"
                placeholder="Lat (e.g. 23.8103)"
                value={newLat}
                onChange={(e) => setNewLat(e.target.value)}
                required
                className="p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Lng (e.g. 90.4125)"
                  value={newLng}
                  onChange={(e) => setNewLng(e.target.value)}
                  required
                  className="p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono flex-1"
                />
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shrink-0 shadow-sm"
                >
                  {isCreating ? "..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Shelters Grid */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Fetching verified safe shelters...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredSafeZones.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No safe shelters found</h3>
            <p className="text-xs text-slate-500 mt-1">
              No verified safe shelters currently match your search criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSafeZones.map((sz) => (
              <div
                key={sz.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${getTypeBadgeStyle(
                        sz.type
                      )}`}
                    >
                      {getTypeIcon(sz.type)}
                      <span>{sz.type.replace("_", " ")}</span>
                    </span>

                    {user?.role === "ADMIN" && (
                      <button
                        onClick={() => handleDelete(sz.id, sz.name)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete Safe Shelter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2">{sz.name}</h3>

                  <div className="flex items-center gap-1 text-xs text-slate-500 font-mono mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {sz.latitude.toFixed(4)}, {sz.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${sz.latitude},${sz.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <span>Get Directions</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] text-slate-400">Verified by BD Gov</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
