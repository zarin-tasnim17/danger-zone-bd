"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useMapStore } from "@/store/useMapStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { showToast } from "@/store/useToastStore";
import { getSocket } from "@/lib/socket";
import { getVapidPublicKey, urlBase64ToUint8Array } from "@/lib/webPush";
import {
  Bell,
  BellOff,
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
  Info,
  ShieldCheck,
  X,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { isPointInPolygon } from "@/lib/gpsVerification";
import type { AlertZoneItem, ZoneIncidentMarkerItem } from "@/components/alerts/PolygonDrawerMap";

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
  const { incidents, fetchAllIncidents, initSocketListeners } = useIncidentStore();

  const [zones, setZones] = useState<AlertZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Zone Form
  const [zoneName, setZoneName] = useState("");
  const [activeCoords, setActiveCoords] = useState<[number, number][]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // User GPS Tracking & Map Center Target
  const [mapCenterTarget, setMapCenterTarget] = useState<[number, number] | null>(null);
  const [userGpsLocation, setUserGpsLocation] = useState<[number, number] | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Web Push Status
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  // Live Geofence Stream
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check notification permission and active push subscription on mount
  useEffect(() => {
    let isCancelled = false;
    if (typeof window !== "undefined") {
      if (
        !("serviceWorker" in navigator) ||
        !("Notification" in window) ||
        !("PushManager" in window)
      ) {
        setPushPermission("unsupported");
        setPushSubscribed(false);
      } else {
        setPushPermission(Notification.permission);
        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => {
              if (!isCancelled) {
                setPushSubscribed(!!sub);
              }
            })
            .catch(() => {
              if (!isCancelled) {
                setPushSubscribed(false);
              }
            });
        } else {
          setPushSubscribed(false);
        }
      }
    }
    return () => {
      isCancelled = true;
    };
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
    let isCancelled = false;
    let boundSocket: ReturnType<typeof getSocket> = null;

    const handleGeofenceAlert = (data: any) => {
      setLiveAlerts((prev) => [
        {
          ...data,
          receivedAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    };

    const bootstrap = async () => {
      await initAuth();
      if (isCancelled) return;

      await Promise.all([fetchZones(), fetchAllIncidents()]);
      if (isCancelled) return;

      initSocketListeners();

      // Connect Socket.IO only after initAuth() finishes so the handshake carries socketToken
      const socket = getSocket();
      if (socket && !isCancelled) {
        boundSocket = socket;
        socket.on("GEOFENCE_ALERT", handleGeofenceAlert);
      }
    };
    bootstrap();

    return () => {
      isCancelled = true;
      if (boundSocket) {
        boundSocket.off("GEOFENCE_ALERT", handleGeofenceAlert);
      }
    };
  }, [initAuth, fetchZones, fetchAllIncidents, initSocketListeners]);

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

  // Filter active incidents that fall inside the user's active geofences
  const activeZoneIncidents = useMemo(() => {
    if (!zones.length || !incidents.length) return [];

    const results: ZoneIncidentMarkerItem[] = [];

    // Filter by selectedZoneId if one is explicitly selected, otherwise evaluate across all active zones
    const relevantZones = selectedZoneId
      ? zones.filter((z) => z.id === selectedZoneId)
      : zones;

    for (const zone of relevantZones) {
      let ring: [number, number][] = [];
      if (zone.area?.coordinates?.[0]) {
        ring = zone.area.coordinates[0];
      } else if (zone.coordinates) {
        ring = zone.coordinates;
      }
      if (ring.length < 3) continue;

      for (const inc of incidents) {
        if (
          !inc.coordinates ||
          typeof inc.coordinates.lat !== "number" ||
          typeof inc.coordinates.lng !== "number"
        ) {
          continue;
        }
        // point-in-polygon checks [longitude, latitude]
        const pt: [number, number] = [inc.coordinates.lng, inc.coordinates.lat];
        if (isPointInPolygon(pt, ring)) {
          if (!results.some((r) => r.id === inc.id && r.zoneName === zone.name)) {
            results.push({
              id: inc.id,
              title: inc.title || `${inc.category} Incident`,
              description: inc.description || "",
              category: inc.category,
              severity: inc.severity,
              coordinates: inc.coordinates,
              zoneName: zone.name,
            });
          }
        }
      }
    }

    return results;
  }, [zones, selectedZoneId, incidents]);

  // Combined incident stream: existing active incidents inside perimeter + live socket triggers
  const allGeofenceIncidents = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Existing verified active incidents inside the perimeter
    activeZoneIncidents.forEach((item) => {
      map.set(item.id, {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        severity: item.severity,
        coordinates: item.coordinates,
        zoneName: item.zoneName,
        isLiveStream: false,
        receivedAt: (item as any).timestamp
          ? new Date((item as any).timestamp).toLocaleTimeString()
          : undefined,
      });
    });

    // 2. Real-time GEOFENCE_ALERT socket notifications
    liveAlerts.forEach((item) => {
      const id = item.data?.reportId || item.id || `live-${Math.random()}`;
      map.set(id, {
        id,
        title: item.title || (isBn ? "বলয়ের ভেতরে জরুরি বিপদ!" : "Hazard Inside Alert Zone!"),
        description: item.body || item.message || item.description || "",
        category: item.data?.category || item.category || "GENERAL",
        severity: item.data?.severity || item.severity || "HIGH",
        coordinates: item.data
          ? { lat: item.data.latitude, lng: item.data.longitude }
          : item.coordinates,
        zoneName: item.data?.zones?.[0] || item.zoneName || "Active Zone",
        isLiveStream: true,
        receivedAt: item.receivedAt || new Date().toLocaleTimeString(),
      });
    });

    return Array.from(map.values());
  }, [activeZoneIncidents, liveAlerts, isBn]);

  // Add Point via map click
  const handleAddMapPoint = (point: [number, number]) => {
    // If polygon is already closed, start a new one
    if (isClosed) {
      setActiveCoords([point]);
      return;
    }
    const updated = [...activeCoords, point];
    setActiveCoords(updated);
    setCreateError(null);
  };

  // Undo Last Point
  const handleUndoPoint = () => {
    if (activeCoords.length === 0) return;
    const updated = activeCoords.slice(0, activeCoords.length - 1);
    setActiveCoords(updated);
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
  };

  // Clear Polygon
  const handleClearPolygon = () => {
    setActiveCoords([]);
    setCreateError(null);
  };

  // Geolocate user to start drawing near them
  const handleGeolocate = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      showToast(
        isBn ? "আপনার ব্রাউজারে জিপিএস সমর্থিত নয়" : "Geolocation is not supported by your browser",
        "error"
      );
      return;
    }

    setIsLocatingUser(true);

    const applyLocationAndBox = (lat: number, lng: number) => {
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
      setZoneName(isBn ? "আমার বর্তমান অবস্থান বলয়" : "My Current Location Perimeter");
      setUserGpsLocation([lat, lng]);
      setMapCenterTarget([lat, lng]);
      setIsLocatingUser(false);
      showToast(
        isBn ? "আপনার অবস্থান মানচিত্রে প্রদর্শিত হয়েছে!" : "Successfully centered on your location!",
        "success"
      );
    };

    const tryCoarseOrStoredFallback = (primaryErr?: GeolocationPositionError) => {
      // On Windows PC without dedicated GPS hardware, attempt coarse network/IP positioning
      navigator.geolocation.getCurrentPosition(
        (coarsePos) => {
          const lat = parseFloat(coarsePos.coords.latitude.toFixed(5));
          const lng = parseFloat(coarsePos.coords.longitude.toFixed(5));
          applyLocationAndBox(lat, lng);
        },
        (fallbackErr) => {
          // Check if user has calibrated location or cached store location from Live Map
          const storeLoc =
            useMapStore.getState().userLocation || useMapStore.getState().loadSavedLocation();
          if (storeLoc && typeof storeLoc.lat === "number" && typeof storeLoc.lng === "number") {
            applyLocationAndBox(storeLoc.lat, storeLoc.lng);
            showToast(
              isBn
                ? "ডিভাইসে লাইভ জিপিএস সিগন্যাল পাওয়া যায়নি, পূর্বের সংরক্ষিত অবস্থান ব্যবহার করা হয়েছে।"
                : "Live GPS unavailable. Using last known/saved location.",
              "info"
            );
            return;
          }

          setIsLocatingUser(false);
          if (primaryErr?.code === 1 || fallbackErr.code === 1) {
            showToast(
              isBn
                ? "ব্রাউজারে লোকেশন পারমিশন ব্লক করা আছে। ব্রাউজার সেটিংস থেকে লোকেশন অনুমতি দিন।"
                : "Location access denied. Please allow location permissions in your browser settings.",
              "error"
            );
          } else {
            showToast(
              isBn
                ? "ডিভাইসে জিপিএস পাওয়া যায়নি। ফোনের লোকেশন অন করুন অথবা মানচিত্রে সরাসরি ক্লিক করুন।"
                : "Could not detect GPS. Please check device location settings or click directly on the map.",
              "error"
            );
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    };

    // First attempt with high accuracy, fast timeout
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        applyLocationAndBox(lat, lng);
      },
      (err) => {
        tryCoarseOrStoredFallback(err);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
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

    if (activeCoords.length < 4) {
      setCreateError(
        isBn
          ? "একটি বৈধ আবদ্ধ পলিগনের জন্য কমপক্ষে ৪টি বিন্দু প্রয়োজন (৩টি শীর্ষবিন্দু + ১টি সমাপনী বিন্দু)। মানচিত্রে ক্লিক করুন এবং 'Close Ring' বাটনে চাপুন।"
          : "A valid closed polygon requires at least 4 coordinate pairs. Click on the map and select 'Close Ring' to complete."
      );
      return;
    }

    const first = activeCoords[0];
    const last = activeCoords[activeCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      setCreateError(
        isBn
          ? "পলিগনের প্রথম এবং শেষ বিন্দু অভিন্ন হতে হবে (বন্ধ বৃত্তাকার রিং)। 'Close Ring' বাটনে চাপুন।"
          : "Polygon ring must be closed: the first and last coordinates must match. Click 'Close Ring'."
      );
      return;
    }

    const calculatedArea = calculatePolygonAreaKm2(activeCoords);
    if (calculatedArea > 25.0) {
      setCreateError(
        isBn
          ? `জোনের আয়তন ${calculatedArea} বর্গকিমি, যা অনুমোদিত ২৫ বর্গকিমির চেয়ে বেশি!`
          : `Geofence area (${calculatedArea} km²) exceeds the maximum limit of 25 km² (anti-abuse cap).`
      );
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      await apiFetch("/alerts/zones", {
        method: "POST",
        body: JSON.stringify({
          name: zoneName.trim(),
          coordinates: activeCoords,
        }),
      });

      setCreateSuccess(
        isBn
          ? `সফলভাবে "${zoneName}" অ্যালার্ট জোন সক্রিয় করা হয়েছে!`
          : `Alert Zone "${zoneName}" successfully established!`
      );
      setZoneName("");
      setActiveCoords([]);
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
      showToast(`Delete failed: ${err.message}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Web Push Subscription
  const handleSubscribePush = async () => {
    setIsSubscribingPush(true);
    try {
      if (
        !("serviceWorker" in navigator) ||
        !("Notification" in window) ||
        !("PushManager" in window)
      ) {
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

      // Ensure service worker is registered and ready
      const existingReg = await navigator.serviceWorker.getRegistration();
      if (!existingReg) {
        await navigator.serviceWorker.register("/sw.js");
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      const vapidPublicKey = getVapidPublicKey();
      if (!vapidPublicKey) {
        throw new Error(
          isBn
            ? "পুশ নোটিফিকেশন সার্ভার কনফিগারেশন অনুপলব্ধ। দয়া করে পরে আবার চেষ্টা করুন।"
            : "Web Push notifications are not configured on this server yet."
        );
      }
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // If existing subscription was created with a different key, unsubscribe it
      if (sub && sub.options?.applicationServerKey) {
        const existingKeyBytes = new Uint8Array(sub.options.applicationServerKey);
        const keysMatch =
          existingKeyBytes.length === appServerKey.length &&
          existingKeyBytes.every((val, idx) => val === appServerKey[idx]);
        if (!keysMatch) {
          await sub.unsubscribe();
          sub = null;
        }
      }

      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey,
          });
        } catch (subErr: any) {
          // If browser throws due to key conflict or stale state, attempt unsubscribe and retry once
          const staleSub = await reg.pushManager.getSubscription();
          if (staleSub) {
            await staleSub.unsubscribe();
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: appServerKey,
            });
          } else {
            throw subErr;
          }
        }
      }

      if (!sub?.endpoint) {
        throw new Error(
          isBn
            ? "ব্রাউজার থেকে বৈধ পুশ সাবস্ক্রিপশন পাওয়া যায়নি।"
            : "Unable to obtain a valid browser push subscription."
        );
      }

      // Ensure user session exists before posting subscription
      if (!useAuthStore.getState().user) {
        await initAuth();
      }

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;
      const pushPayload: {
        endpoint: string;
        keys?: { p256dh: string; auth: string };
      } = {
        endpoint: sub.endpoint,
        ...(p256dh && auth ? { keys: { p256dh, auth } } : {}),
      };

      await apiFetch("/alerts/subscribe", {
        method: "POST",
        body: JSON.stringify(pushPayload),
      });

      setPushSubscribed(true);
      showToast(
        isBn
          ? "ব্রাউজার ওয়েব পুশ অ্যালার্ট সফলভাবে নিবন্ধিত হয়েছে!"
          : "Browser Web Push alert registration successful!",
        "success"
      );
    } catch (err: any) {
      showToast(
        err?.message ||
          (isBn
            ? "ব্রাউজার ওয়েব পুশ নিবন্ধন ব্যর্থ হয়েছে।"
            : "Failed to register browser push alerts."),
        "error"
      );
    } finally {
      setIsSubscribingPush(false);
    }
  };

  // Web Push Unsubscribe
  const handleUnsubscribePush = async () => {
    setIsSubscribingPush(true);
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          try {
            await apiFetch("/alerts/unsubscribe", {
              method: "POST",
              body: JSON.stringify({ endpoint }),
            });
          } catch (apiErr) {
            console.info("[Alerts] Backend unsubscribe notice:", apiErr);
          }
        }
      }
      setPushSubscribed(false);
      showToast(
        isBn ? "ওয়েব পুশ অ্যালার্ট সফলভাবে বন্ধ করা হয়েছে।" : "Web push alerts turned off successfully.",
        "info"
      );
    } catch (err: any) {
      showToast(
        err?.message ||
          (isBn ? "পুশ নোটিফিকেশন বন্ধ করা যায়নি।" : "Failed to turn off push notifications."),
        "error"
      );
    } finally {
      setIsSubscribingPush(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Single Unified Navbar with integrated EN/বাংলা toggle */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

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

          <div className="shrink-0 flex items-center gap-2.5 w-full md:w-auto">
            {pushSubscribed ? (
              <>
                <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? "পুশ অ্যালার্ট সক্রিয়" : "Push Alerts Active"}</span>
                </div>
                <button
                  type="button"
                  onClick={handleUnsubscribePush}
                  disabled={isSubscribingPush}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 active:scale-95"
                >
                  {isSubscribingPush ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      <span>{isBn ? "বন্ধ হচ্ছে..." : "Turning off..."}</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 text-rose-600" />
                      <span>{isBn ? "অ্যালার্ট বন্ধ করুন" : "Turn Off Alerts"}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSubscribePush}
                disabled={isSubscribingPush}
                className={`w-full md:w-auto px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  pushPermission === "denied"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                }`}
              >
                {isSubscribingPush ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isBn ? "সংযোগ হচ্ছে..." : "Connecting..."}</span>
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
            )}
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
              </div>

              {/* Dynamic Guidance Banner (Placed outside the map to prevent blocking tiles and zoom buttons) */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 font-medium shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isClosed
                        ? "bg-emerald-500"
                        : activeCoords.length > 0
                        ? "bg-blue-600 animate-pulse"
                        : "bg-blue-600 animate-ping"
                    }`}
                  />
                  <span className="truncate font-semibold text-slate-800">
                    {activeCoords.length === 0
                      ? isBn
                        ? "মানচিত্রে ক্লিক করে আপনার এলাকার চারপাশে পয়েন্ট বসান"
                        : "Click map to place perimeter vertices around your area"
                      : !isClosed
                      ? isBn
                        ? `${activeCoords.length}টি পয়েন্ট চিহ্নিত হয়েছে। রিং সম্পূর্ণ করতে ১ম পয়েন্টে চাপুন`
                        : `${activeCoords.length} vertices placed. Click first point or 'Close Ring' to finish`
                      : isBn
                        ? `নিরাপত্তা বলয় আবদ্ধ হয়েছে (${areaKm2} বর্গকিমি)। নিচে নাম দিয়ে সংরক্ষণ করুন`
                        : `Perimeter closed (${areaKm2} km²). Give your zone a name below to save`}
                  </span>
                </div>
                {activeCoords.length > 0 && !isClosed && (
                  <span className="text-[11px] text-slate-500 shrink-0 font-mono hidden sm:inline bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {Math.max(0, 3 - activeCoords.length) > 0
                      ? isBn
                        ? `আরও ${3 - activeCoords.length}টি প্রয়োজন`
                        : `Need ${3 - activeCoords.length} more`
                      : isBn
                        ? "রিং সম্পূর্ণের জন্য প্রস্তুত"
                        : "Ready to close ring"}
                  </span>
                )}
              </div>

              {/* Interactive Leaflet Map */}
              <PolygonDrawerMap
                activeCoords={activeCoords}
                onAddPoint={handleAddMapPoint}
                savedZones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={(z) => {
                  if (selectedZoneId === z.id) {
                    setSelectedZoneId(null);
                  } else {
                    setSelectedZoneId(z.id);
                    let coords: [number, number][] = [];
                    if (z.area?.coordinates?.[0]) coords = z.area.coordinates[0];
                    else if (z.coordinates) coords = z.coordinates;
                    if (coords.length > 0) {
                      const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
                      const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
                      setMapCenterTarget([sumLat / coords.length, sumLng / coords.length]);
                    }
                  }
                }}
                flyToCenter={mapCenterTarget}
                userLocationMarker={userGpsLocation}
                onLocateMe={handleGeolocate}
                isLocating={isLocatingUser}
                zoneIncidents={activeZoneIncidents}
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
                      ? "মানচিত্রে ক্লিক করে আপনার প্রথম নিরাপত্তা জোন তৈরি করুন।"
                      : "Click vertices on the map canvas to establish 24/7 monitoring."}
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
                        onClick={() => {
                          if (selectedZoneId === zone.id) {
                            setSelectedZoneId(null);
                          } else {
                            setSelectedZoneId(zone.id);
                            if (rawCoords.length > 0) {
                              const sumLng = rawCoords.reduce((sum, c) => sum + c[0], 0);
                              const sumLat = rawCoords.reduce((sum, c) => sum + c[1], 0);
                              setMapCenterTarget([sumLat / rawCoords.length, sumLng / rawCoords.length]);
                            }
                          }
                        }}
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

            {/* Live Socket & Intersecting Geofence Incidents Stream */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      allGeofenceIncidents.length > 0
                        ? "bg-red-500 animate-ping"
                        : "bg-emerald-500"
                    }`}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {isBn ? "বলয়ের অভ্যন্তরীণ বিপদসমূহ" : "Geofence Incidents Stream"}
                  </h3>
                  {allGeofenceIncidents.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                      {allGeofenceIncidents.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedZoneId
                    ? isBn
                      ? "নির্বাচিত জোন ফিল্টার"
                      : "Filtered by Zone"
                    : "PostGIS Live Stream"}
                </span>
              </div>

              {allGeofenceIncidents.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-1.5">
                  <ShieldAlert className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">
                    {isBn ? "বলয়ের ভেতরে কোনো সক্রিয় হুমকি নেই" : "No Incidents Inside Perimeter"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isBn
                      ? "পোস্টজিআইএস ST_Intersects অ্যালগরিদম দিয়ে যেকোনো রিপোর্ট আপনার জোনের ভেতরে প্রবেশ করামাত্রই তাৎক্ষণিক নোটিফিকেশন পাবেন এবং এখানে প্রদর্শিত হবে।"
                      : "Incidents submitted by citizens intersecting your PostGIS geofences appear here in real time."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                  {allGeofenceIncidents.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        if (alert.coordinates?.lat && alert.coordinates?.lng) {
                          setMapCenterTarget([alert.coordinates.lat, alert.coordinates.lng]);
                        }
                      }}
                      className="p-3 bg-red-50/90 hover:bg-red-100/90 border border-red-200 rounded-xl text-xs text-red-900 transition-colors shadow-2xs space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-red-950 truncate">
                                {alert.title}
                              </span>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-600 text-white shrink-0">
                                {alert.severity}
                              </span>
                              {alert.category && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-red-200 shrink-0">
                                  {alert.category}
                                </span>
                              )}
                            </div>
                            {alert.description && alert.description !== alert.title && (
                              <p className="text-[11px] text-red-800 mt-1 line-clamp-2">
                                {alert.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {alert.receivedAt && (
                          <span className="text-[10px] text-red-600 font-mono shrink-0">
                            {alert.receivedAt}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-red-700 pt-1.5 border-t border-red-200/60 font-medium">
                        {alert.zoneName && (
                          <span className="font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            {isBn ? `জোন: ${alert.zoneName}` : `Zone: ${alert.zoneName}`}
                          </span>
                        )}
                        <span className="text-blue-700 hover:underline flex items-center gap-0.5">
                          {isBn ? "মানচিত্রে দেখুন →" : "View on Map →"}
                        </span>
                      </div>
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
