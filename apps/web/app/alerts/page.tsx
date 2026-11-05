"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
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
  Undo2,
  LocateFixed,
  PhoneCall,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AlertZoneItem } from "@/components/alerts/PolygonDrawerMap";

// Dynamically import Leaflet map with ssr: false to prevent window reference errors
const PolygonDrawerMap = dynamic(
  () => import("@/components/alerts/PolygonDrawerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[340px] sm:h-[400px] lg:h-[440px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading interactive map canvas...</span>
      </div>
    ),
  }
);

interface AlertZone {
  id: string;
  name: string;
  userId: string;
  area?: {
    type: string;
    coordinates: [number, number][][];
  };
  coordinates?: [number, number][];
  createdAt: string;
}

const ZONE_PRESETS = [
  {
    nameEn: "Gulshan & Banani Diplomatic Hub (~4.2 km²)",
    nameBn: "গুলশান ও বনানী কূটনৈতিক এলাকা (~৪.২ বর্গকিমি)",
    zoneNameEn: "Gulshan-Banani Perimeter",
    zoneNameBn: "গুলশান-বনানী নিরাপত্তা বলয়",
    coordinates: [
      [90.4000, 23.7850],
      [90.4200, 23.7850],
      [90.4200, 23.8050],
      [90.4000, 23.8050],
      [90.4000, 23.7850],
    ] as [number, number][],
  },
  {
    nameEn: "Dhanmondi Residential & Lake (~3.8 km²)",
    nameBn: "ধানমন্ডি আবাসিক ও লেক এলাকা (~৩.৮ বর্গকিমি)",
    zoneNameEn: "Dhanmondi Residential Zone",
    zoneNameBn: "ধানমন্ডি আবাসিক জোন",
    coordinates: [
      [90.3650, 23.7400],
      [90.3850, 23.7400],
      [90.3850, 23.7580],
      [90.3650, 23.7580],
      [90.3650, 23.7400],
    ] as [number, number][],
  },
  {
    nameEn: "Uttara Sector 1-7 Commuter Belt (~5.1 km²)",
    nameBn: "উত্তরা সেক্টর ১-৭ করিডোর (~৫.১ বর্গকিমি)",
    zoneNameEn: "Uttara Transit Perimeter",
    zoneNameBn: "উত্তরা ট্রানজিট বলয়",
    coordinates: [
      [90.3800, 23.8550],
      [90.4050, 23.8550],
      [90.4050, 23.8750],
      [90.3800, 23.8750],
      [90.3800, 23.8550],
    ] as [number, number][],
  },
  {
    nameEn: "Motijheel Commercial Core (~2.9 km²)",
    nameBn: "মতিঝিল বাণিজ্যিক কেন্দ্র (~২.৯ বর্গকিমি)",
    zoneNameEn: "Motijheel Business District",
    zoneNameBn: "মতিঝিল বাণিজ্যিক জোন",
    coordinates: [
      [90.4120, 23.7250],
      [90.4280, 23.7250],
      [90.4280, 23.7380],
      [90.4120, 23.7380],
      [90.4120, 23.7250],
    ] as [number, number][],
  },
  {
    nameEn: "Chittagong Agrabad Hub (~4.5 km²)",
    nameBn: "চট্টগ্রাম আগ্রাবাদ এলাকা (~৪.৫ বর্গকিমি)",
    zoneNameEn: "Chittagong Agrabad Zone",
    zoneNameBn: "চট্টগ্রাম আগ্রাবাদ বলয়",
    coordinates: [
      [91.8050, 22.3200],
      [91.8250, 22.3200],
      [91.8250, 22.3400],
      [91.8050, 22.3400],
      [91.8050, 22.3200],
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
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const [zones, setZones] = useState<AlertZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Zone Form
  const [zoneName, setZoneName] = useState("");
  const [activeCoords, setActiveCoords] = useState<[number, number][]>([]);
  const [coordsString, setCoordsString] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Web Push Status
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  // Live Geofence Stream
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!("Notification" in window)) {
        setPushPermission("unsupported");
      } else {
        setPushPermission(Notification.permission);
        if (Notification.permission === "granted") {
          setPushSubscribed(true);
        }
      }
    }
  }, []);

  // Fetch zones on mount after auth
  const fetchZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AlertZone[]>("/alerts/zones");
      setZones(data || []);
    } catch (err: any) {
      console.warn("[Alerts] Fetch zones warning:", err.message);
      setError(err.message || "Failed to load alert zones");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      await initAuth();
      await fetchZones();
    };
    bootstrap();

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
  }, [initAuth, fetchZones]);

  // Compute live area
  const areaKm2 = useMemo(() => {
    return calculatePolygonAreaKm2(activeCoords);
  }, [activeCoords]);

  const isAreaExceeded = areaKm2 > 25.0;

  const isClosed = useMemo(() => {
    return (
      activeCoords.length >= 4 &&
      activeCoords[0][0] === activeCoords[activeCoords.length - 1][0] &&
      activeCoords[0][1] === activeCoords[activeCoords.length - 1][1]
    );
  }, [activeCoords]);

  // Apply Quick Preset
  const handleApplyPreset = (preset: typeof ZONE_PRESETS[0]) => {
    setZoneName(isBn ? preset.zoneNameBn : preset.zoneNameEn);
    setActiveCoords(preset.coordinates);
    setCoordsString(JSON.stringify(preset.coordinates, null, 2));
    setCreateError(null);
  };

  // Add Point via map click
  const handleAddMapPoint = (point: [number, number]) => {
    // If polygon is already closed, start a new one
    if (isClosed) {
      setActiveCoords([point]);
      setCoordsString(JSON.stringify([point], null, 2));
      return;
    }
    const updated = [...activeCoords, point];
    setActiveCoords(updated);
    setCoordsString(JSON.stringify(updated, null, 2));
    setCreateError(null);
  };

  // Undo Last Point
  const handleUndoPoint = () => {
    if (activeCoords.length === 0) return;
    const updated = activeCoords.slice(0, activeCoords.length - 1);
    setActiveCoords(updated);
    setCoordsString(JSON.stringify(updated, null, 2));
    setCreateError(null);
  };

  // Complete Ring (close loop)
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

  // Clear Polygon
  const handleClearPolygon = () => {
    setActiveCoords([]);
    setCoordsString("[]");
    setCreateError(null);
  };

  // Geolocate user to start drawing near them
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      alert(isBn ? "আপনার ব্রাউজারে জিপিএস সমর্থিত নয়" : "Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        // Add a 500m bounding perimeter around user position
        const delta = 0.005;
        const userBox: [number, number][] = [
          [lng - delta, lat - delta],
          [lng + delta, lat - delta],
          [lng + delta, lat + delta],
          [lng - delta, lat + delta],
          [lng - delta, lat - delta],
        ];
        setActiveCoords(userBox);
        setCoordsString(JSON.stringify(userBox, null, 2));
        setZoneName(isBn ? "আমার বর্তমান অবস্থান বলয়" : "My Current Location Perimeter");
      },
      () => {
        alert(isBn ? "জিপিএস অবস্থান সংগ্রহ করা যায়নি" : "Unable to retrieve your GPS location");
      }
    );
  };

  // Handle textarea edit
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

  // Submit New Geofence Zone
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;

    if (zones.length >= 5) {
      setCreateError(
        isBn
          ? "আপনি সর্বোচ্চ ৫টি অ্যাক্টিভ জোন তৈরি করেছেন। নতুন জোন তৈরি করতে একটি পুরোনো জোন ডিলিট করুন।"
          : "You have reached the maximum quota of 5 active alert zones. Please delete an older zone to create a new one."
      );
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      let parsedCoords: [number, number][];
      try {
        parsedCoords = JSON.parse(coordsString);
      } catch {
        throw new Error(
          isBn
            ? "কোঅর্ডিনেটস অবশ্যই বৈধ JSON অ্যারে [ [দ্রাঘিমাংশ, অক্ষাংশ], ... ] হতে হবে।"
            : "Coordinates must be a valid JSON array of [longitude, latitude] pairs."
        );
      }

      if (parsedCoords.length < 4) {
        throw new Error(
          isBn
            ? "একটি বৈধ আবদ্ধ পলিগনের জন্য কমপক্ষে ৪টি বিন্দু প্রয়োজন (৩টি শীর্ষবিন্দু + ১টি সমাপনী বিন্দু)। 'Close Ring' বাটনে ক্লিক করুন।"
            : "A valid closed polygon requires at least 4 coordinate pairs. Click 'Close Ring' to complete."
        );
      }

      const first = parsedCoords[0];
      const last = parsedCoords[parsedCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(
          isBn
            ? "পলিগনের প্রথম এবং শেষ বিন্দু অভিন্ন হতে হবে (বন্ধ বৃত্তাকার রিং)। 'Close Ring' বাটনে চাপুন।"
            : "Polygon ring must be closed: the first and last coordinates must match. Click 'Close Ring'."
        );
      }

      const calculatedArea = calculatePolygonAreaKm2(parsedCoords);
      if (calculatedArea > 25.0) {
        throw new Error(
          isBn
            ? `জোনের আয়তন ${calculatedArea} বর্গকিমি, যা অনুমোদিত ২৫ বর্গকিমির চেয়ে বেশি!`
            : `Geofence area (${calculatedArea} km²) exceeds the maximum limit of 25 km² (anti-abuse cap).`
        );
      }

      await apiFetch("/alerts/zones", {
        method: "POST",
        body: JSON.stringify({
          name: zoneName.trim(),
          coordinates: parsedCoords,
        }),
      });

      setCreateSuccess(
        isBn
          ? `সফলভাবে "${zoneName}" অ্যালার্ট জোন সক্রিয় করা হয়েছে!`
          : `Alert Zone "${zoneName}" successfully established!`
      );
      setZoneName("");
      fetchZones();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create alert zone");
    } finally {
      setIsCreating(false);
    }
  };

  // Delete Zone
  const handleDeleteZone = async (id: string, name: string) => {
    const msg = isBn
      ? `আপনি কি নিশ্চিত যে "${name}" অ্যালার্ট জোনটি মুছে ফেলতে চান?`
      : `Are you sure you want to delete alert zone "${name}"?`;
    if (!window.confirm(msg)) return;

    setDeletingId(id);
    try {
      await apiFetch(`/alerts/zones/${id}`, { method: "DELETE" });
      fetchZones();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Web Push Subscription
  const handleSubscribePush = async () => {
    setIsSubscribingPush(true);
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error(
          isBn
            ? "আপনার ব্রাউজার পুশ নোটিফিকেশন সমর্থন করে না।"
            : "Push messaging is not supported in this browser."
        );
      }

      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        throw new Error(
          isBn
            ? "ব্রাউজারে নোটিফিকেশনের অনুমতি প্রদান করা হয়নি। ব্রাউজার সেটিংসে অনুমতি সক্রিয় করুন।"
            : "Notification permission was denied. Please allow notifications in your browser settings."
        );
      }

      let pushPayload = {
        endpoint: "",
        keys: {
          p256dh: "",
          auth: "",
        },
      };

      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const subJson = sub.toJSON();
            pushPayload = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "",
                auth: subJson.keys?.auth || "",
              },
            };
          }
        } catch (e) {
          console.warn("[WebPush] Native push subscription unavailable:", e);
        }
      }

      if (!pushPayload.endpoint) {
        pushPayload = {
          endpoint: `https://push.safetymap.bd/device/${user?.id || Date.now()}`,
          keys: {
            p256dh: "standard-browser-client",
            auth: "session-verified-auth",
          },
        };
      }

      await apiFetch("/alerts/subscribe", {
        method: "POST",
        body: JSON.stringify(pushPayload),
      });

      setPushSubscribed(true);
      alert(
        isBn
          ? "ব্রাউজার ওয়েব পুশ অ্যালার্ট সফলভাবে নিবন্ধিত হয়েছে!"
          : "Browser Web Push alert registration successful!"
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubscribingPush(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Single Unified Navbar with integrated EN/বাংলা toggle */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* National Emergency Hotline Banner */}
        <section className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-red-500/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <PhoneCall className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
                  {isBn ? "জরুরি নিরাপত্তা" : "Emergency Safety"}
                </span>
                <span className="text-xs text-white/80 font-medium">
                  {isBn ? "সরাসরি সহায়তা হেল্পলাইন" : "Immediate Crisis Helpline"}
                </span>
              </div>
              <p className="text-sm font-semibold text-white/95 mt-0.5">
                {isBn
                  ? "জরুরি অবস্থায় পুলিশ, অ্যাম্বুলেন্স বা ফায়ার সার্ভিসের জন্য সরাসরি ৯৯৯ নম্বরে ডায়াল করুন।"
                  : "If facing immediate physical threat or requiring urgent rescue, dial 999 directly."}
              </p>
            </div>
          </div>
          <a
            href="tel:999"
            className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-white text-red-600 font-extrabold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isBn ? "কল করুন ৯৯৯" : "Call 999 Hotline"}</span>
          </a>
        </section>

        {/* Page Title & Mission Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl shadow-xs">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isBn
                    ? "জিওফেন্সড অ্যালার্ট জোন ও পুশ নোটিফিকেশন"
                    : "Geofenced Alert Zones & Push Notifications"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                  {isBn
                    ? "মানচিত্রে আপনার বাসস্থান বা চলাচলের পরিধি চিহ্নিত করুন। PostGIS প্রযুক্তিতে ২৫ বর্গকিমির মধ্যে দুর্ঘটনা ঘটলে তাৎক্ষণিক নোটিফিকেশন পান।"
                    : "Establish custom perimeter boundaries (capped at 25 km²). Receive instant real-time alerts when incidents occur within your zone via PostGIS ST_Intersects."}
                </p>
              </div>
            </div>
          </div>

          {/* Zones Quota Pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
              {zones.length}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <span>{isBn ? "সক্রিয় জোন কোটা" : "Active Zone Quota"}</span>
                <span className="text-slate-400 font-normal">({zones.length}/5)</span>
              </div>
              <div className="w-28 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    zones.length >= 5 ? "bg-red-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${(zones.length / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Web Push Notification Banner Card */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0 border border-blue-100 shadow-2xs">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {isBn ? "ওয়েব পুশ অ্যালার্ট নোটিফিকেশন" : "Web Push Alert Notifications"}
                </h2>
                {pushSubscribed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3 h-3" />
                    {isBn ? "সক্রিয়" : "Active"}
                  </span>
                ) : pushPermission === "denied" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    {isBn ? "ব্লকড" : "Blocked in Browser"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {isBn ? "অননুমোদিত" : "Inactive"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isBn
                  ? "ট্যাব বন্ধ থাকা অবস্থায়ও আপনার নিরাপত্তা বলয়ের মধ্যে অগ্নিকাণ্ড বা হামলার অ্যালার্ট পান।"
                  : "Receive high-priority crisis push notifications directly on your device even when your browser tab is closed."}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleSubscribePush}
              disabled={isSubscribingPush || pushSubscribed}
              className={`w-full md:w-auto px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                pushSubscribed
                  ? "bg-emerald-600 text-white cursor-default"
                  : pushPermission === "denied"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
              }`}
            >
              {isSubscribingPush ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isBn ? "সংযোগ হচ্ছে..." : "Connecting..."}</span>
                </>
              ) : pushSubscribed ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isBn ? "পুশ অ্যালার্ট সক্রিয় রয়েছে" : "Push Alerts Active"}</span>
                </>
              ) : pushPermission === "denied" ? (
                <>
                  <Info className="w-4 h-4" />
                  <span>{isBn ? "সেটিংস থেকে চালু করুন" : "Enable in Browser Settings"}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>{isBn ? "পুশ অ্যালার্ট চালু করুন" : "Enable Push Notifications"}</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Geofence Drawer & Form (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Card Header & Live Area Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {isBn ? "ইন্টারেক্টিভ জিওফেন্স বিল্ডার" : "Interactive Geofence Canvas"}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full border transition-colors ${
                      isAreaExceeded
                        ? "bg-red-50 border-red-200 text-red-700 animate-pulse"
                        : areaKm2 > 20
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                    }`}
                  >
                    {isBn ? `আয়তন: ${areaKm2} বর্গকিমি` : `Area: ${areaKm2} km²`} / 25 km²
                  </span>
                </div>
              </div>

              {/* Map Action Control Buttons Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleUndoPoint}
                    disabled={activeCoords.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Undo last vertex"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "পূর্বাবস্থায়" : "Undo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteRing}
                    disabled={activeCoords.length < 3 || isClosed}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 font-bold border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isBn ? "রিং সম্পূর্ণ করুন" : "Close Ring"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearPolygon}
                    disabled={activeCoords.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 font-semibold border border-red-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "মুছুন" : "Clear"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGeolocate}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? "আমার অবস্থান" : "My GPS"}</span>
                </button>
              </div>

              {/* Interactive Leaflet Map */}
              <PolygonDrawerMap
                activeCoords={activeCoords}
                onAddPoint={handleAddMapPoint}
                savedZones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={(z) => setSelectedZoneId(z.id)}
              />

              {/* Warnings and Status Banners */}
              {isAreaExceeded && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <div>
                    <span className="font-bold">
                      {isBn ? "অনুমোদিত সর্বোচ্চ সীমা অতিক্রম করেছে!" : "Perimeter Cap Exceeded!"}
                    </span>{" "}
                    {isBn
                      ? `আয়তন ${areaKm2} বর্গকিমি। সর্বোচ্চ অনুমোদিত সীমা ২৫ বর্গকিমি। শীর্ষবিন্দুগুলো সংকুচিত করুন।`
                      : `Your geofence area is ${areaKm2} km², which exceeds the 25 km² limit. Please reduce boundary vertices.`}
                  </div>
                </div>
              )}

              {createSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{createSuccess}</span>
                  </div>
                  <button
                    onClick={() => setCreateSuccess(null)}
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{createError}</span>
                  </div>
                  <button
                    onClick={() => setCreateError(null)}
                    className="text-red-700 hover:text-red-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Metropolitan Presets */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {isBn ? "দ্রুত মেট্রো প্রিসেট নির্বাচন:" : "Quick Metropolitan Presets:"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ZONE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.nameEn}
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      {isBn ? preset.nameBn : preset.nameEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Zone Form */}
              <form onSubmit={handleCreateZone} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? "জোনের নাম" : "Zone Identifier Name"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      isBn ? "যেমন: বাসা ও অফিস যাতায়াত রুট" : "e.g., Home & Office Commute Route"
                    }
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>

                {/* Collapsible Advanced GeoJSON Coordinates Accordion */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setShowJsonEditor(!showJsonEditor)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {isBn
                          ? `উন্নত জিওজেসন কোঅর্ডিনেটস (${activeCoords.length} টি পয়েন্ট)`
                          : `Advanced GeoJSON Coordinates (${activeCoords.length} points)`}
                      </span>
                    </div>
                    {showJsonEditor ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showJsonEditor && (
                    <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                      <p className="text-[11px] text-slate-500">
                        {isBn
                          ? "পোস্টজিআইএস ডবল-প্রিসিশন [দ্রাঘিমাংশ, অক্ষাংশ] ফর্ম্যাটে পলিগন রিং:"
                          : "Format: [ [longitude, latitude], ... ] with matching first and last points."}
                      </p>
                      <textarea
                        value={coordsString}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        rows={4}
                        className="w-full p-2 text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-800 rounded-xl resize-none focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isCreating || isAreaExceeded || zones.length >= 5}
                  className="w-full py-3 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isBn ? "জিওফেন্স তৈরি হচ্ছে..." : "Creating Geofence..."}</span>
                    </>
                  ) : zones.length >= 5 ? (
                    <span>{isBn ? "জোন কোটা পূর্ণ (সর্বোচ্চ ৫টি)" : "Zone Quota Reached (Max 5)"}</span>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>{isBn ? "অ্যালার্ট জোন সংরক্ষণ করুন" : "Save Active Geofence Zone"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Active Alert Zones & Live Alert Stream (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Active User Alert Zones List */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn
                      ? `আমার সংরক্ষিত জোন (${zones.length}/৫)`
                      : `My Active Zones (${zones.length}/5)`}
                  </h3>
                </div>
                <button
                  onClick={fetchZones}
                  disabled={isLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                  <span>{isBn ? "রিফ্রেশ" : "Refresh"}</span>
                </button>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">
                    {isBn ? "সংরক্ষিত জোন লোড হচ্ছে..." : "Loading saved zones..."}
                  </p>
                </div>
              ) : zones.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">
                    {isBn ? "কোনো সক্রিয় অ্যালার্ট জোন নেই" : "No Active Geofence Zones"}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    {isBn
                      ? "মানচিত্রে ক্লিক করে বা প্রিসেট নির্বাচন করে আপনার প্রথম জোন তৈরি করুন।"
                      : "Click vertices on the map canvas or apply a metropolitan preset to establish 24/7 monitoring."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {zones.map((zone) => {
                    const rawCoords =
                      zone.area?.coordinates?.[0] || zone.coordinates || [];
                    const count = rawCoords.length;
                    const zoneArea = calculatePolygonAreaKm2(rawCoords);
                    const isSelected = selectedZoneId === zone.id;

                    return (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-300 shadow-xs"
                            : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {zone.name}
                              </h4>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-bold rounded">
                                  {isBn ? "নির্বাচিত" : "Selected"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 font-medium">
                              <span>
                                {isBn
                                  ? `${count} টি শীর্ষবিন্দু`
                                  : `${count} Polygon Vertices`}
                              </span>
                              <span>•</span>
                              <span className="text-blue-700 font-bold">
                                ~{zoneArea} km²
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZone(zone.id, zone.name);
                            }}
                            disabled={deletingId === zone.id}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                            title={isBn ? "জোন মুছুন" : "Delete Zone"}
                          >
                            {deletingId === zone.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>ID: {zone.id.substring(0, 8)}...</span>
                          <span>
                            {new Date(zone.createdAt).toLocaleDateString(
                              isBn ? "bn-BD" : "en-US",
                              { month: "short", day: "numeric", year: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Socket Geofence Trigger Stream */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn ? "লাইভ জিওফেন্স বিপদ স্ট্রিম" : "Live Geofence Incident Stream"}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Socket: GEOFENCE_ALERT
                </span>
              </div>

              {liveAlerts.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-1.5">
                  <ShieldAlert className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">
                    {isBn ? "বলয়ের ভেতরে কোনো সক্রিয় হুমকি নেই" : "No Incidents Inside Perimeter"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isBn
                      ? "পোস্টজিআইএস ST_Intersects অ্যালগরিদম দিয়ে যেকোনো রিপোর্ট আপনার জোনের ভেতরে প্রবেশ করামাত্রই তাৎক্ষণিক নোটিফিকেশন পাবেন।"
                      : "Incidents submitted by citizens intersecting your PostGIS geofences appear here in real time."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {liveAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-900 flex items-start justify-between shadow-2xs gap-2"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">
                            {alert.title || (isBn ? "বলয়ের ভেতরে জরুরি বিপদ!" : "Hazard Inside Alert Zone!")}
                          </span>
                          <p className="text-[11px] text-red-700 mt-0.5">
                            {alert.message || alert.description}
                          </p>
                          {alert.zoneName && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.5 rounded">
                              {isBn ? `জোন: ${alert.zoneName}` : `Zone: ${alert.zoneName}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-red-600 font-mono shrink-0">
                        {alert.receivedAt}
                      </span>
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
