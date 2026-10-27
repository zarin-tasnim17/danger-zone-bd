"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  PlusCircle,
  MapPin,
  ShieldAlert,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  FileText,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

const PRESET_LOCATIONS = [
  { name: "Dhaka — Banani 11 Bridge", lat: 23.7925, lng: 90.4078 },
  { name: "Dhaka — Farmgate Footbridge", lat: 23.7570, lng: 90.3905 },
  { name: "Dhaka — Mohakhali Flyover", lat: 23.7776, lng: 90.4054 },
  { name: "Chittagong — GEC Circle", lat: 22.3585, lng: 91.8215 },
  { name: "Sylhet — Zindabazar", lat: 24.8949, lng: 91.8687 },
];

export default function ReportPage() {
  const router = useRouter();
  const { user, initAuth } = useAuthStore();

  // Form State
  const [category, setCategory] = useState<string>("MUGGING");
  const [severity, setSeverity] = useState<string>("HIGH");
  const [latitude, setLatitude] = useState<string>("23.7925");
  const [longitude, setLongitude] = useState<string>("90.4078");
  const [description, setDescription] = useState<string>("");

  // Device GPS Anti-Spoofing Headers
  const [deviceLat, setDeviceLat] = useState<string>("23.7925");
  const [deviceLng, setDeviceLng] = useState<string>("90.4078");

  // Media File
  const [file, setFile] = useState<File | null>(null);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseResult, setResponseResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Sync Device GPS with Incident GPS
  const handleSyncGps = () => {
    setDeviceLat(latitude);
    setDeviceLng(longitude);
  };

  // Simulate Spoofed Far-away GPS (e.g. 5km away)
  const handleSimulateSpoof = () => {
    const latNum = parseFloat(latitude) || 23.7925;
    const lngNum = parseFloat(longitude) || 90.4078;
    setDeviceLat((latNum + 0.05).toFixed(4));
    setDeviceLng((lngNum + 0.05).toFixed(4));
  };

  const handleApplyPreset = (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    setDeviceLat(lat.toString());
    setDeviceLng(lng.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setResponseResult(null);

    try {
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new Error("Invalid incident latitude or longitude values");
      }

      // 1. Submit incident report with device GPS headers
      const reportData = await apiFetch<any>("/reports", {
        method: "POST",
        headers: {
          "x-device-lat": deviceLat,
          "x-device-lng": deviceLng,
        },
        body: JSON.stringify({
          category,
          severity,
          latitude: latNum,
          longitude: lngNum,
          description: description.trim() || undefined,
        }),
      });

      // 2. Optional: Test Presigned URL media upload if file selected
      let mediaData: any = null;
      if (file && reportData?.id) {
        try {
          const presignedRes = await apiFetch<any>(
            `/media/presigned-url?reportId=${reportData.id}&fileType=${file.type}&fileSize=${file.size}`
          );

          // Confirm media upload
          mediaData = await apiFetch<any>("/media/confirm", {
            method: "POST",
            body: JSON.stringify({
              reportId: reportData.id,
              fileKey: presignedRes.fileKey || `reports/${reportData.id}/${file.name}`,
            }),
          });
        } catch (mediaErr: any) {
          console.warn("Media upload test notice:", mediaErr.message);
        }
      }

      setResponseResult({
        report: reportData,
        media: mediaData,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit incident report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Submit Incident & GPS Verification Tester
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Test incident ingestion, anti-spoofing proximity enforcement (&lt;= 200m), rate limiting (15m), and privacy media pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Submission Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Hazard Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MUGGING">Mugging (ছিনতাই)</option>
                  <option value="THEFT">Theft (চুরি / ছিনতাই)</option>
                  <option value="UNLIT_ROAD">Unlit Road (অন্ধকার রাস্তা)</option>
                  <option value="EXTORTION">Extortion (চাঁদাবাজি)</option>
                  <option value="DRUG_ACTIVITY">Drug Activity (মাদক আড্ডা)</option>
                </select>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["LOW", "MEDIUM", "HIGH"].map((sev) => (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setSeverity(sev)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                        severity === sev
                          ? sev === "HIGH"
                            ? "bg-rose-600 text-white border-rose-600"
                            : sev === "MEDIUM"
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Incident Coordinates */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Incident Coordinates (Reported Location)
                </label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium">Latitude</span>
                    <input
                      type="text"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="e.g. 23.7925"
                      className="w-full p-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium">Longitude</span>
                    <input
                      type="text"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="e.g. 90.4078"
                      className="w-full p-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Location Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 self-center mr-1">Presets:</span>
                  {PRESET_LOCATIONS.map((loc) => (
                    <button
                      type="button"
                      key={loc.name}
                      onClick={() => handleApplyPreset(loc.lat, loc.lng)}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    >
                      {loc.name.split("—")[1]?.trim() || loc.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* GPS Anti-Spoofing Tester Box */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Navigation className="w-4 h-4 text-amber-600" />
                  <span>Device GPS Proximity Check (x-device-lat / x-device-lng)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-normal">
                  The backend performs a Haversine distance calculation. The report is rejected with <code>400</code> if device GPS is &gt; 200m away.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={deviceLat}
                    onChange={(e) => setDeviceLat(e.target.value)}
                    placeholder="Device Lat"
                    className="p-1.5 text-xs bg-white border border-amber-300 rounded font-mono"
                  />
                  <input
                    type="text"
                    value={deviceLng}
                    onChange={(e) => setDeviceLng(e.target.value)}
                    placeholder="Device Lng"
                    className="p-1.5 text-xs bg-white border border-amber-300 rounded font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncGps}
                    className="flex-1 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                  >
                    Match Incident GPS (&lt;= 200m Pass)
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateSpoof}
                    className="flex-1 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors"
                  >
                    Simulate Spoof (&gt; 5km Fail)
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Incident Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe situational context, landmarks, or vehicle descriptions..."
                  rows={3}
                  className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Media File Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Media Attachment (Presigned Upload Tester)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Max 5MB (JPEG, PNG, WebP). Triggers automated face & plate privacy blurring pipeline.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 text-sm font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting & Validating GPS...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Submit Safety Incident (POST /api/v1/reports)</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Sidebar: Rules & Live Response Inspector */}
          <div className="space-y-6">
            {/* Live Response Inspector */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Backend Response Inspector</span>
              </h3>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Submission Error</span>
                  </div>
                  <p>{errorMessage}</p>
                </div>
              )}

              {responseResult && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">Incident Created (201 Created)</span>
                  </div>

                  <Link
                    href={`/reports/${responseResult.report?.id}`}
                    className="w-full py-2 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>View Created Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto max-h-60 scrollbar-thin">
                    {JSON.stringify(responseResult, null, 2)}
                  </pre>
                </div>
              )}

              {!errorMessage && !responseResult && (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Submit the form to inspect live HTTP response payload and status codes here.
                </p>
              )}
            </div>

            {/* Validation Rules Card */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-slate-600" />
                <span>Backend Guards Active</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                <li>Rate Limit: 1 report per 15 minutes per user.</li>
                <li>Proximity Guard: Max 200m between device GPS and incident pin.</li>
                <li>Privacy Fuzzing: Coordinates are fuzzed by ~50-100m on public map.</li>
                <li>Time Decay: Auto-expires in 6-24h based on severity.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
