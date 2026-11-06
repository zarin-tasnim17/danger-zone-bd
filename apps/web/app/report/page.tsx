"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useMapStore } from "@/store/useMapStore";
import { getTranslation } from "@/lib/translations";
import {
  Siren,
  AlertTriangle,
  LightbulbOff,
  AlertOctagon,
  Pill,
  Swords,
  Users,
  Car,
  Sparkles,
  MapPin,
  Crosshair,
  Navigation,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Moon,
  Sun,
  Lock,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  ExternalLink,
  Copy,
  Check,
  Info,
  HelpCircle,
  FileText,
} from "lucide-react";

// Dynamically import Leaflet Map with ssr: false
import LocationSearchBar, { GeocodedLocation } from "@/components/map/LocationSearchBar";
const ReportPinMap = dynamic(() => import("@/components/report/ReportPinMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 sm:h-80 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-500 gap-2">
      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      <span className="text-xs font-semibold">Loading interactive GPS map...</span>
    </div>
  ),
});

// Haversine distance calculator in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Check if Bangladesh time (UTC+6) is currently night (8 PM to 5 AM)
function isCurrentNightBangladesh(): boolean {
  const now = new Date();
  const bdHour = (now.getUTCHours() + 6) % 24;
  return bdHour >= 20 || bdHour < 5;
}

import { ReportCategory } from "@repo/shared";
type IncidentCategory = ReportCategory;
type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH";

interface CategoryDefinition {
  id: IncidentCategory;
  labelEn: string;
  labelBn: string;
  descEn: string;
  descBn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  expiryHintEn: string;
  expiryHintBn: string;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "SNATCHING",
    labelEn: "Snatching / Mugging",
    labelBn: "ছিনতাই",
    descEn: "Bag snatching, phone grabbing, fast intercept",
    descBn: "রাস্তায় ব্যাগ টানা, ফোন ছিনতাই বা গতিরোধ",
    icon: Siren,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "ARMED_ASSAULT",
    labelEn: "Armed Assault",
    labelBn: "অস্ত্রসহ হামলা",
    descEn: "Sharp weapons, stabbing, gunfire attack",
    descBn: "ধারালো অস্ত্র, কোপানো, ছুরিকাঘাত বা গুলি বর্ষণ",
    icon: Swords,
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "SNATCHING_ARMED_ASSAULT",
    labelEn: "Armed Snatching & Assault",
    labelBn: "ছিনতাই ও অস্ত্রসহ হামলা",
    descEn: "Snatching accompanied by sharp weapon assault or gunfire",
    descBn: "ছিনতাইকালে ধারালো অস্ত্র দিয়ে কুপিয়ে বা গুলি করে জখম",
    icon: ShieldAlert,
    color: "text-red-800",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "THEFT",
    labelEn: "Theft & Burglary",
    labelBn: "চুরি",
    descEn: "Residential burglary, vehicle theft, covert stealing",
    descBn: "বাসাবাড়িতে বা দোকানে চুরি, গাড়ি চুরি",
    icon: Lock,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "DACOITY",
    labelEn: "Dacoity / Armed Robbery",
    labelBn: "ডাকাতি",
    descEn: "Group armed robbery, home invasion, looting",
    descBn: "দলবদ্ধ সশস্ত্র ডাকাতি, মালামাল লুণ্ঠন",
    icon: ShieldAlert,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "THEFT_DACOITY",
    labelEn: "Theft & Dacoity (Combined)",
    labelBn: "চুরি ডাকাতি",
    descEn: "Covert break-in escalating to armed gang robbery",
    descBn: "চুরির উদ্দেশ্যে প্রবেশ করে সশস্ত্র ডাকাতিতে রূপ নেওয়া",
    icon: ShieldAlert,
    color: "text-red-800",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "TEEN_GANG",
    labelEn: "Teen Gang Activity",
    labelBn: "কিশোর গ্যাং",
    descEn: "Juvenile gang intimidation, turf clash, neighborhood menace",
    descBn: "কিশোর গ্যাংয়ের মহড়া, হুমকি, আধিপত্য বিস্তার",
    icon: Users,
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    expiryHintEn: "Active for 24 hours",
    expiryHintBn: "২৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "TEEN_GANG_ARMED_ASSAULT",
    labelEn: "Teen Gang Armed Clash",
    labelBn: "কিশোর গ্যাং ও অস্ত্রসহ হামলা",
    descEn: "Juvenile gangs attacking with sharp weapons and machetes",
    descBn: "কিশোর গ্যাং কর্তৃক ধারালো অস্ত্র নিয়ে রক্তক্ষয়ী হামলা",
    icon: ShieldAlert,
    color: "text-purple-800",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    expiryHintEn: "Active for 6 hours",
    expiryHintBn: "৬ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "EXTORTION",
    labelEn: "Extortion & Gang Toll",
    labelBn: "চাঁদাবাজি",
    descEn: "Illegal toll collection, blackmail, commercial harassment",
    descBn: "অবৈধ চাঁদা দাবি, হুমকি, দোকানে চাঁদা তোলা",
    icon: AlertOctagon,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "DRUG_ACTIVITY",
    labelEn: "Narcotics & Open Dealing",
    labelBn: "মাদক সংক্রান্ত অপরাধ",
    descEn: "Drug peddling, open narcotics dealing, addict gatherings",
    descBn: "প্রকাশ্যে মাদক কেনাবেচা, অপরাধীদের জমায়েত",
    icon: Pill,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    expiryHintEn: "Active for 24 hours",
    expiryHintBn: "২৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "ROAD_ACCIDENT",
    labelEn: "Road / Traffic Accident",
    labelBn: "সড়ক দুর্ঘটনা / এক্সিডেন্ট",
    descEn: "Vehicular collisions, overturned buses, pedestrian hit-and-run",
    descBn: "যানবাহন দুর্ঘটনা, গাড়ি উল্টে যাওয়া, পথচারী আহত",
    icon: Car,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    expiryHintEn: "Active for 6 hours",
    expiryHintBn: "৬ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "UNLIT_ROAD",
    labelEn: "Unlit or Broken Road Hazard",
    labelBn: "অন্ধকার রাস্তা",
    descEn: "Broken streetlamps, pitch black alleys, hazardous open manholes",
    descBn: "বাতিহীন অন্ধকার সড়ক, ভাঙা পথ, খোলা ম্যানহোল",
    icon: LightbulbOff,
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    expiryHintEn: "Active for 14 days",
    expiryHintBn: "১৪ দিন সক্রিয় থাকবে",
  },
  {
    id: "MUGGING",
    labelEn: "Mugging",
    labelBn: "ছিনতাই",
    descEn: "Street mugging (legacy alias)",
    descBn: "ছিনতাই",
    icon: Siren,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
];

const PRESETS = [
  { nameEn: "Banani 11 Bridge (Dhaka)", nameBn: "বনানী ১১ ব্রিজ", lat: 23.7925, lng: 90.4078 },
  { nameEn: "Farmgate Footbridge (Dhaka)", nameBn: "ফার্মগেট ওভারব্রিজ", lat: 23.7570, lng: 90.3905 },
  { nameEn: "Mohakhali Flyover (Dhaka)", nameBn: "মহাখালী ফ্লাইওভার", lat: 23.7776, lng: 90.4054 },
  { nameEn: "GEC Circle (Chittagong)", nameBn: "জিইসি মোড় (চট্টগ্রাম)", lat: 22.3585, lng: 91.8215 },
  { nameEn: "Zindabazar (Sylhet)", nameBn: "জিন্দাবাজার (সিলেট)", lat: 24.8949, lng: 91.8687 },
];

const QUICK_PROMPTS = [
  { en: "Armed individuals spotted on motorcycles", bn: "মোটরসাইকেলে অস্ত্রধারী দল দেখা গেছে" },
  { en: "Pitch dark alley for 200m; streetlamps broken", bn: "২০০ মিটার অন্ধকার রাস্তা; সড়কবাতি নষ্ট" },
  { en: "Snatchers targeting pedestrians near footbridge", bn: "ফুটব্রিজের কাছে পথচারীদের ওপর ছিনতাই চলছে" },
  { en: "Illegal toll collection blocking transport", bn: "অবৈধ চাঁদাবাজির কারণে যানবাহন আটকে আছে" },
];

export default function ReportPage() {
  const router = useRouter();
  const { user, initAuth } = useAuthStore();
  const { language } = useLanguageStore();
  const t = getTranslation(language);
  const isBn = language === "bn";

  // Form State (Option A Smart Combine)
  const [selectedTags, setSelectedTags] = useState<string[]>(["SNATCHING"]);
  const resolvedCategory = useMemo<ReportCategory>(() => {
    const hasTheft = selectedTags.includes("THEFT");
    const hasDacoity = selectedTags.includes("DACOITY");
    const hasSnatching = selectedTags.includes("SNATCHING");
    const hasArmedAssault = selectedTags.includes("ARMED_ASSAULT");
    const hasTeenGang = selectedTags.includes("TEEN_GANG");

    if (hasTheft && hasDacoity) return "THEFT_DACOITY";
    if (hasSnatching && hasArmedAssault) return "SNATCHING_ARMED_ASSAULT";
    if (hasTeenGang && hasArmedAssault) return "TEEN_GANG_ARMED_ASSAULT";

    const lastTag = selectedTags[selectedTags.length - 1];
    if (lastTag) return lastTag as ReportCategory;
    return "SNATCHING";
  }, [selectedTags]);

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      if (selectedTags.length > 1) {
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      }
      return;
    }
    if (tagId === "THEFT") {
      if (selectedTags.includes("DACOITY")) setSelectedTags(["DACOITY", "THEFT"]);
      else setSelectedTags(["THEFT"]);
      return;
    }
    if (tagId === "DACOITY") {
      if (selectedTags.includes("THEFT")) setSelectedTags(["THEFT", "DACOITY"]);
      else setSelectedTags(["DACOITY"]);
      return;
    }
    if (tagId === "SNATCHING") {
      if (selectedTags.includes("ARMED_ASSAULT")) setSelectedTags(["ARMED_ASSAULT", "SNATCHING"]);
      else setSelectedTags(["SNATCHING"]);
      return;
    }
    if (tagId === "TEEN_GANG") {
      if (selectedTags.includes("ARMED_ASSAULT")) setSelectedTags(["ARMED_ASSAULT", "TEEN_GANG"]);
      else setSelectedTags(["TEEN_GANG"]);
      return;
    }
    if (tagId === "ARMED_ASSAULT") {
      if (selectedTags.includes("SNATCHING")) setSelectedTags(["SNATCHING", "ARMED_ASSAULT"]);
      else if (selectedTags.includes("TEEN_GANG")) setSelectedTags(["TEEN_GANG", "ARMED_ASSAULT"]);
      else setSelectedTags(["ARMED_ASSAULT"]);
      return;
    }
    setSelectedTags([tagId]);
  };
  const [severity, setSeverity] = useState<IncidentSeverity>("HIGH");
  const [latitude, setLatitude] = useState<number>(23.7925);
  const [longitude, setLongitude] = useState<number>(90.4078);
  const [description, setDescription] = useState<string>("");

  // Live Device GPS
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReport, setCreatedReport] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-authenticate device on page load
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Automatically request device GPS once on load (respecting calibrated location)
  useEffect(() => {
    let hasCalibrated = false;
    if (typeof window !== "undefined") {
      const saved = useMapStore.getState().loadSavedLocation();
      if (saved) {
        hasCalibrated = true;
        setLatitude(saved.lat);
        setLongitude(saved.lng);
        setDeviceGps({ lat: saved.lat, lng: saved.lng });
        setGpsAccuracy(saved.accuracy || 25);
        setGpsNotice(
          isBn
            ? "✓ আপনার সংরক্ষিত সঠিক অবস্থান থেকে পিন শুরু হয়েছে।"
            : "✓ Initialized from your saved calibrated location."
        );
      }
    }

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      if (!hasCalibrated) setIsAcquiringGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          if (!hasCalibrated) {
            setDeviceGps({ lat, lng });
            setGpsAccuracy(pos.coords.accuracy || null);
            setLatitude(lat);
            setLongitude(lng);
            setGpsNotice(
              isBn
                ? "✓ আপনার বর্তমান জিপিএস অবস্থান সফলভাবে সনাক্ত হয়েছে।"
                : "✓ Live device GPS location successfully acquired."
            );
          }
          setIsAcquiringGps(false);
        },
        (err) => {
          console.warn("[Report] Geolocation notice:", err.message);
          setIsAcquiringGps(false);
          if (!hasCalibrated) {
            setDeviceGps(null);
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [isBn]);

  // Calculate live Haversine distance between device GPS and incident pin
  const proximityDistance = useMemo(() => {
    if (!deviceGps) return null;
    return calculateDistanceMeters(deviceGps.lat, deviceGps.lng, latitude, longitude);
  }, [deviceGps, latitude, longitude]);

  const allowableProximityRadius = useMemo(() => {
    if (!gpsAccuracy) return 200;
    // Adapt to desktop browser Wi-Fi/IP accuracy limits (e.g. 500m) while keeping mobile GPS tight
    return Math.max(200, Math.min(Math.round(gpsAccuracy), 2500));
  }, [gpsAccuracy]);

  const isWithinProximity = proximityDistance === null || proximityDistance <= allowableProximityRadius;
  const isNightDetected = isCurrentNightBangladesh();

  // Location handlers
  const handleMapLocationChange = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const handleSnapToDeviceGps = () => {
    if (deviceGps) {
      setLatitude(deviceGps.lat);
      setLongitude(deviceGps.lng);
    }
  };

  const handleApplyPreset = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    // Align simulated device GPS to preset so distance passes 200m rule
    setDeviceGps({ lat, lng });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      setErrorMessage(
        isBn
          ? "ফাইলের সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।"
          : "File size exceeds the 5MB maximum limit."
      );
      return;
    }

    setFile(selected);
    const url = URL.createObjectURL(selected);
    setFilePreview(url);
    setErrorMessage(null);
  };

  const handleRemoveFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Proximity gate check
      if (proximityDistance !== null && proximityDistance > allowableProximityRadius) {
        throw new Error(
          isBn
            ? `ভুয়া রিপোর্ট প্রতিরোধ ব্যবস্থা: আপনি পিন করা স্থান থেকে ${proximityDistance} মিটার দূরে আছেন। রিপোর্ট প্রকাশের জন্য বর্তমান জিপিএস স্থানের ${allowableProximityRadius} মিটারের মধ্যে হতে হবে অথবা "পিনে অবস্থান সেট করুন" চাপুন। "আমার জিপিএস-এ বসান" বোতামে চাপুন।`
            : `Anti-Spoofing Proximity Error: Your pinned location is ${proximityDistance}m away from your device GPS. Reports must be within ${allowableProximityRadius}m. Click "Calibrate GPS to Pin" or "Snap to Me" to align.`
        );
      }

      const effectiveDeviceLat = deviceGps ? deviceGps.lat.toString() : latitude.toString();
      const effectiveDeviceLng = deviceGps ? deviceGps.lng.toString() : longitude.toString();

      // 2. Submit report to backend
      const reportPayload = {
        category: resolvedCategory,
        severity,
        latitude,
        longitude,
        description: description.trim() || undefined,
      };

      const result = await apiFetch<any>("/reports", {
        method: "POST",
        headers: {
          "x-device-lat": effectiveDeviceLat,
          "x-device-lng": effectiveDeviceLng,
        },
        body: JSON.stringify(reportPayload),
      });

      // 3. Optional media upload if an image was attached
      if (file && result?.id) {
        try {
          const presignedRes = await apiFetch<any>(
            `/media/presigned-url?reportId=${result.id}&fileType=${file.type}&fileSize=${file.size}`
          );

          await apiFetch<any>("/media/confirm", {
            method: "POST",
            body: JSON.stringify({
              reportId: result.id,
              fileKey: presignedRes.fileKey || `reports/${result.id}/${file.name}`,
            }),
          });
        } catch (mediaErr: any) {
          console.warn("[Media Attachment Notice]", mediaErr.message);
        }
      }

      setCreatedReport(result);
    } catch (err: any) {
      console.error("[Report Submission Error]", err);
      setErrorMessage(
        err.message ||
          (isBn ? "রিপোর্ট জমা দিতে ব্যর্থ হয়েছে।" : "Failed to submit report.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdReport?.id) return;
    const url = `${window.location.origin}/reports/${createdReport.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleResetForm = () => {
    setCreatedReport(null);
    setDescription("");
    handleRemoveFile();
    setErrorMessage(null);
  };

  const selectedCategoryDef = CATEGORIES.find((c) => c.id === resolvedCategory) || CATEGORIES[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-red-500 selection:text-white">
      {/* Premium Top Navigation (Integrated Language Switcher, No RouteTestNav strip) */}
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Subtle Emergency Dispatch Advisory */}
        <div className="bg-slate-100/90 border border-slate-200/90 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              {isBn
                ? "সরাসরি বা জীবননাশের আশঙ্কা থাকলে অনলাইনের অপেক্ষায় না থেকে এখনই ৯৯৯-এ ফোন করুন।"
                : "If in immediate life-threatening danger, dial 999 dispatch directly before filing."}
            </span>
          </div>
          <a
            href="tel:999"
            className="font-bold text-red-600 hover:text-red-700 hover:underline shrink-0 text-xs flex items-center gap-1"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>999</span>
          </a>
        </div>

        {/* Success Confirmation Modal / Card */}
        {createdReport ? (
          <div className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-md shadow-emerald-500/5 animate-in fade-in-50 zoom-in-95 duration-200 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {isBn ? "রিপোর্ট সফলভাবে প্রকাশিত" : "Incident Published Successfully"}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ID: {createdReport.id?.substring(0, 8)}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isBn ? "নাগরিক নিরাপত্তা তথ্য ডাটাবেসে সংরক্ষিত হয়েছে" : "Hazard Verified & Live on Bangladesh Safety Grid"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {isBn
                    ? "আপনার রিপোর্টটি পোস্টজিআইএস স্থানিক ইনডেক্সিং এবং ১৫০ মিটার গোপনীয়তা ফাজিং সম্পন্ন করে জনসাধারণের জন্য লাইভ করা হয়েছে। নিকটবর্তী নাগরিকগণ এই সংকেত পাবেন।"
                    : "Your report has been spatially indexed with PostGIS and broadcasted across the live civic safety network with 150m privacy fuzzing applied."}
                </p>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">{isBn ? "শ্রেণি" : "Category"}</span>
                <span className="font-bold text-slate-900">{selectedCategoryDef.labelEn}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">{isBn ? "ঝুঁকির মাত্রা" : "Severity"}</span>
                <span
                  className={`font-black ${
                    severity === "HIGH"
                      ? "text-red-600"
                      : severity === "MEDIUM"
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {severity}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">{isBn ? "স্থান স্থানাঙ্ক" : "Coordinates"}</span>
                <span className="font-mono font-semibold text-slate-800">
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">{isBn ? "মেয়াদকাল" : "Expiry"}</span>
                <span className="font-bold text-slate-900">{selectedCategoryDef.expiryHintEn}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link
                href={`/reports/${createdReport.id}`}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <span>{isBn ? "লাইভ ফিডে রিপোর্ট দেখুন" : "View Live Report on Safety Map"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? (isBn ? "লিঙ্ক কপি হয়েছে" : "Link Copied!") : (isBn ? "শেয়ার লিঙ্ক" : "Share Alert")}</span>
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{isBn ? "নতুন রিপোর্ট করুন" : "Report Another Hazard"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Submission Experience */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {isBn ? "নাগরিক বিপদ সংকেত রিপোর্ট" : "Report Hazard & Danger Zone"}
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {isBn
                    ? "সরাসরি নাগরিক তথ্যের মাধ্যমে জননিরাপত্তা জোরদার করুন। জিপিএস যাচাইকরণের পর তথ্য লাইভ ম্যাপে যোগ হবে।"
                    : "Crowdsource community safety in real-time. Verified reports update live heatmaps and route pathfinding."}
                </p>
              </div>

              {/* Security Telemetry Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBn ? "১৫০মি গোপনীয়তা সুরক্ষা" : "150m Privacy Fuzzed"}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isBn ? "২০০মি জিপিএস গেট" : "≤ 200m GPS Verified"}</span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in-50 duration-150">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold">{isBn ? "রিপোর্ট জমা সংক্রান্ত ত্রুটি:" : "Submission Validation Alert:"}</p>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="p-1 rounded-lg hover:bg-red-100 text-red-500"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Category, Severity, Description, Evidence (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Step 1: Category Selection (Option A: Smart Combine) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        1
                      </span>
                      <span>{isBn ? "বিপদের ক্যাটাগরি ট্যাগ নির্বাচন (Option A)" : "Select Incident Category Tags"}</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      {isBn ? "প্রয়োজনে দুটি ট্যাগ একসাথে নির্বাচন করুন" : "Select tags (auto-combines)"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50/80 border border-slate-200 rounded-xl">
                    {[
                      { id: "SNATCHING", labelEn: "Snatching", labelBn: "ছিনতাই", icon: Siren, color: "text-orange-700" },
                      { id: "ARMED_ASSAULT", labelEn: "Armed Assault", labelBn: "অস্ত্রসহ হামলা", icon: Swords, color: "text-rose-700" },
                      { id: "THEFT", labelEn: "Theft", labelBn: "চুরি", icon: Lock, color: "text-amber-700" },
                      { id: "DACOITY", labelEn: "Dacoity", labelBn: "ডাকাতি", icon: ShieldAlert, color: "text-red-700" },
                      { id: "TEEN_GANG", labelEn: "Teen Gang", labelBn: "কিশোর গ্যাং", icon: Users, color: "text-violet-700" },
                      { id: "EXTORTION", labelEn: "Extortion", labelBn: "চাঁদাবাজি", icon: AlertOctagon, color: "text-purple-700" },
                      { id: "DRUG_ACTIVITY", labelEn: "Narcotics", labelBn: "মাদক অপরাধ", icon: Pill, color: "text-blue-700" },
                      { id: "ROAD_ACCIDENT", labelEn: "Road Accident", labelBn: "সড়ক দুর্ঘটনা", icon: Car, color: "text-emerald-700" },
                      { id: "UNLIT_ROAD", labelEn: "Unlit Road", labelBn: "অন্ধকার রাস্তা", icon: LightbulbOff, color: "text-slate-700" },
                    ].map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      const Icon = tag.icon;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={`text-xs px-3 py-2 rounded-xl font-bold border flex items-center gap-2 transition-all select-none cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : tag.color}`} />
                          <span>{isBn ? tag.labelBn : tag.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reactive Resolved Category Status Banner */}
                  <div className="p-3 rounded-xl border flex items-center justify-between gap-2 transition-all bg-blue-50 border-blue-200 text-blue-900">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold block">
                          {isBn ? "কার্যকর ক্যাটাগরি:" : "Resolved Incident Category:"}{" "}
                          <span className="underline decoration-blue-500 underline-offset-2">
                            {isBn ? selectedCategoryDef.labelBn : selectedCategoryDef.labelEn}
                          </span>
                        </span>
                        <span className="text-[11px] text-blue-700/80 block mt-0.5">
                          {isBn ? selectedCategoryDef.descBn : selectedCategoryDef.descEn}
                        </span>
                      </div>
                    </div>
                    {resolvedCategory.includes("_") && (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-blue-600 text-white shadow-xs shrink-0">
                        {isBn ? "সমন্বিত অ্যালার্ট" : "Combined Alert"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2: Severity Level */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        2
                      </span>
                      <span>{isBn ? "ঝুঁকির তীব্রতা" : "Severity Level"}</span>
                    </label>
                    <span className="text-[11px] font-bold text-slate-500">
                      {selectedCategoryDef.expiryHintEn}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      {
                        id: "LOW" as IncidentSeverity,
                        labelEn: "Low Advisory",
                        labelBn: "সাধারণ সতর্কতা",
                        subEn: "Minor disturbance",
                        subBn: "ছোটখাটো সমস্যা",
                        activeClass: "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/20",
                        dotClass: "bg-emerald-500",
                      },
                      {
                        id: "MEDIUM" as IncidentSeverity,
                        labelEn: "Medium Caution",
                        labelBn: "মধ্যম সতর্কতা",
                        subEn: "Escalating risk",
                        subBn: "ক্রমবর্ধমান ঝুঁকি",
                        activeClass: "bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/20",
                        dotClass: "bg-amber-500",
                      },
                      {
                        id: "HIGH" as IncidentSeverity,
                        labelEn: "Critical Threat",
                        labelBn: "উচ্চ ঝুঁকি",
                        subEn: "Immediate threat",
                        subBn: "সরাসরি বিপদ",
                        activeClass: "bg-red-50 border-red-300 text-red-900 ring-2 ring-red-500/20",
                        dotClass: "bg-red-600",
                      },
                    ].map((sev) => {
                      const isSelected = severity === sev.id;
                      return (
                        <button
                          key={sev.id}
                          type="button"
                          onClick={() => setSeverity(sev.id)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? sev.activeClass + " shadow-2xs font-bold"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sev.dotClass}`} />
                            <span className="text-xs font-bold">{isBn ? sev.labelBn : sev.labelEn}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal">{isBn ? sev.subBn : sev.subEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Description & Quick Prompts */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        3
                      </span>
                      <span>{isBn ? "ঘটনার বিস্তারিত বিবরণ" : "Incident Details"}</span>
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {description.length}/500 {isBn ? "অক্ষর" : "chars"}
                    </span>
                  </div>

                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isBn
                        ? "ঘটনার পরিস্থিতি, আশপাশের ল্যান্ডমার্ক, সন্দেহভাজনদের সংখ্যা বা নিরাপদ বিকল্প পথ উল্লেখ করুন..."
                        : "Describe situational context, landmarks, suspect count, or safe alternate pathways..."
                    }
                    rows={4}
                    maxLength={500}
                    className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-slate-900 placeholder:text-slate-400"
                  />

                  {/* 1-Click Context Suggestions */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isBn ? "দ্রুত বিবরণ যুক্ত করুন:" : "Quick contextual prompts:"}</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setDescription((prev) =>
                              prev ? `${prev}. ${isBn ? prompt.bn : prompt.en}` : (isBn ? prompt.bn : prompt.en)
                            )
                          }
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer text-left"
                        >
                          + {isBn ? prompt.bn : prompt.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 4: Photo Evidence Upload */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        4
                      </span>
                      <span>{isBn ? "ছবি / প্রমাণের প্রমাণক (ঐচ্ছিক)" : "Photo Evidence (Optional)"}</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {isBn ? "সর্বোচ্চ ৫ মেগাবাইট" : "Max 5MB"}
                    </span>
                  </div>

                  {!filePreview ? (
                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                          {isBn ? "ছবি আপলোড করতে ক্লিক করুন" : "Click or drag photo here to attach"}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          JPEG, PNG, WebP (Max 5MB)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>{isBn ? "স্বয়ংক্রিয় চেহারা ও নম্বরপ্লেট ব্লার সক্রিয়" : "Automated Face & Plate Blurring Active"}</span>
                      </div>
                    </label>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 p-2 flex items-center gap-3">
                      <img
                        src={filePreview}
                        alt="Evidence preview"
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {file?.name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isBn ? "প্রমাণের জন্য প্রস্তুত" : "Ready for privacy pipeline"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 transition-colors shrink-0"
                        title="Remove image"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Interactive Location Map & GPS Verification Radar (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Step 5: Location Map & Coordinates */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                        5
                      </span>
                      <span>{isBn ? "ঘটনাস্থল ও জিপিএস রাডার" : "Incident Location & GPS"}</span>
                    </label>

                    {deviceGps && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceGps({ lat: latitude, lng: longitude });
                            setGpsAccuracy(15);
                          }}
                          className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors cursor-pointer"
                          title={isBn ? "আমার আসল অবস্থান বর্তমান পিনে সমন্বয় করুন" : "Calibrate GPS to current pin"}
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-500" />
                          <span>{isBn ? "পিনে অবস্থান সেট করুন" : "Set GPS to Pin"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSnapToDeviceGps}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>{isBn ? "আমার অবস্থানে বসান" : "Snap to Me"}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Interactive Leaflet Pin Placement Map */}
                  {/* Fast Geocoding Location Search */}
                  <LocationSearchBar
                    onSelectLocation={(loc: GeocodedLocation) => {
                      setLatitude(loc.lat);
                      setLongitude(loc.lng);
                    }}
                  />

                  <ReportPinMap
                    incidentLat={latitude}
                    incidentLng={longitude}
                    deviceLat={deviceGps?.lat}
                    deviceLng={deviceGps?.lng}
                    proximityDistance={proximityDistance}
                    proximityRadius={allowableProximityRadius}
                    onLocationChange={handleMapLocationChange}
                    onSnapToDevice={handleSnapToDeviceGps}
                    severity={severity}
                    language={language}
                  />

                  {/* Anti-Spoofing Proximity Status Pill */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                      isWithinProximity
                        ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                        : "bg-red-50/80 border-red-200 text-red-900"
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-white shrink-0 shadow-2xs">
                      {isWithinProximity ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold">
                          {isWithinProximity
                            ? isBn
                              ? `জিপিএস অবস্থান অনুমোদিত (≤ ${allowableProximityRadius} মি)`
                              : `Anti-Spoofing GPS Check: PASSED (≤ ${allowableProximityRadius}m)`
                            : isBn
                              ? `দূরত্ব ত্রুটি: ${allowableProximityRadius} মিটারের বেশি`
                              : `GPS Proximity Gate Warning (> ${allowableProximityRadius}m)`}
                        </span>
                        {proximityDistance !== null && (
                          <span className="font-mono font-bold">{proximityDistance}m</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {isWithinProximity
                          ? isBn
                            ? "আপনার ডিভাইসের বর্তমান অবস্থান ও পিন করা স্থানের দূরত্ব ২০০ মিটারের মধ্যে রয়েছে।"
                            : "Haversine distance between device and report pin is within the 200m civic validation radius."
                          : isBn
                            ? "আপনি নির্বাচিত স্থান থেকে দূরে আছেন। ভুয়া রিপোর্ট রোধে ঘটনাটি আপনার ২০০ মিটারের মধ্যে হতে হবে।"
                            : "Your device is too far from the incident pin. Align coordinates to your physical location."}
                      </p>
                    </div>
                  </div>

                  {/* Manual Coordinates Readout */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        {isBn ? "অক্ষাংশ (Lat)" : "Latitude"}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 23.7925)}
                        className="w-full bg-transparent font-mono font-bold text-slate-900 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        {isBn ? "দ্রাঘিমাংশ (Lng)" : "Longitude"}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 90.4078)}
                        className="w-full bg-transparent font-mono font-bold text-slate-900 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Preset Locations */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isBn ? "দ্রুত এলাকা নির্বাচন:" : "Quick verified city presets:"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyPreset(p.lat, p.lng)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                        >
                          {isBn ? p.nameBn : p.nameEn.split("—")[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Night-time Safety Flag Banner */}
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                    isNightDetected
                      ? "bg-indigo-50/80 border-indigo-200 text-indigo-900"
                      : "bg-amber-50/80 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isNightDetected ? (
                      <Moon className="w-5 h-5 text-indigo-600 shrink-0" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {isNightDetected
                          ? isBn
                            ? "🌙 নৈশকালীন বিপদ সংকেত স্বয়ংক্রিয়ভাবে সক্রিয়"
                            : "🌙 Night Hazard Priority Flag: Auto-Detected"
                          : isBn
                            ? "☀️ দিবাকালীন বিপদ সংকেত"
                            : "☀️ Daytime Incident Context"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {isNightDetected
                          ? isBn
                            ? "রাত ৮টা থেকে ভোর ৫টা পর্যন্ত উচ্চ ঝুঁকির সময় হিসেবে চিহ্নিত হয়।"
                            : "Active between 8:00 PM and 5:00 AM BST (High Risk window)."
                          : isBn
                            ? "সাধারণ দিবাকালীন ট্র্যাকিং প্রযোজ্য।"
                            : "Standard daytime surveillance active."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Citizen Trust & Privacy Policy */}
                <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>{isBn ? "নাগরিক গোপনীয়তা ও ট্রাস্ট স্কোর" : "Citizen Anonymity & Trust"}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {isBn
                      ? "আপনার রিপোর্টটি বেনামে প্রকাশিত হবে। আপনার ফোন বা ডিভাইসের আইডেন্টিটি ক্রিপ্টোগ্রাফিকভাবে সুরক্ষিত থাকে এবং জনসাধারণের নিকট প্রকাশ করা হয় না।"
                      : "Reports are anonymous by default. Your device UUID is cryptographically signed to maintain community trust without disclosing personal info."}
                  </p>
                </div>

                {/* Primary Submission Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-black text-sm sm:text-base shadow-md shadow-red-600/30 ring-1 ring-red-400/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{isBn ? "জিপিএস যাচাই ও রিপোর্ট পাঠানো হচ্ছে..." : "Validating GPS & Submitting..."}</span>
                    </>
                  ) : (
                    <>
                      <Siren className="w-5 h-5" />
                      <span>{isBn ? "জরুরি বিপদ সংকেত প্রকাশ করুন" : "Publish Incident to Safety Network"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
