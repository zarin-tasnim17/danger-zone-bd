"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { uploadReportEvidence, validateEvidenceFile } from "@/lib/mediaUpload";
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
  Grab,
  Skull,
  KeyRound,
  PackageX,
  Banknote,
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

import {
  MAX_GPS_PROXIMITY_METERS,
  ReportCategory,
  isHazardWithinTimeWindow,
  formatTimeTo12Hour,
  convert12HourTo24Hour,
} from "@repo/shared";
import { CATEGORY_VISUALS, getCategoryVisual, normalizeCategoryKey } from "@/lib/incidentCategoryVisuals";
import {
  HardwareGpsFix,
  evaluateHardwareGpsProximity,
  buildHardwareGpsHeaders,
} from "@/lib/gpsVerification";
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
    icon: Grab,
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
    icon: Crosshair,
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
    icon: KeyRound,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "ROBBERY",
    labelEn: "Robbery",
    labelBn: "ডাকাতি",
    descEn: "Group armed robbery, home invasion, looting",
    descBn: "দলবদ্ধ সশস্ত্র ডাকাতি, মালামাল লুণ্ঠন",
    icon: Skull,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "THEFT_ROBBERY",
    labelEn: "Theft & Robbery (Combined)",
    labelBn: "চুরি ডাকাতি",
    descEn: "Covert break-in escalating to armed gang robbery",
    descBn: "চুরির উদ্দেশ্যে প্রবেশ করে সশস্ত্র ডাকাতিতে রূপ নেওয়া",
    icon: PackageX,
    color: "text-red-800",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "EXTORTION",
    labelEn: "Extortion",
    labelBn: "চাঁদাবাজি",
    descEn: "Illegal toll collection, blackmail, commercial harassment",
    descBn: "অবৈধ চাঁদা দাবি, হুমকি, দোকানে চাঁদা তোলা",
    icon: Banknote,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    expiryHintEn: "Active for 3 hours",
    expiryHintBn: "৩ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "YOUTH_GANG_ACTIVITY",
    labelEn: "Youth Gang Activity",
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
    id: "DRUG_RELATED_CRIME",
    labelEn: "Drug-Related Crime",
    labelBn: "মাদক সংক্রান্ত অপরাধ",
    descEn: "Drug peddling, open narcotics dealing, illicit distribution",
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
  {
    id: "TEEN_GANG_ARMED_ASSAULT",
    labelEn: "Gang Armed Clash",
    labelBn: "কিশোর গ্যাং ও অস্ত্রসহ হামলা",
    descEn: "Youth gang clashes involving bladed weapons or firearms",
    descBn: "কিশোর গ্যাং কর্তৃক ধারালো অস্ত্র বা আগ্নেয়াস্ত্র নিয়ে হামলা",
    icon: Users,
    color: "text-violet-800",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-300",
    expiryHintEn: "Active for 12 hours",
    expiryHintBn: "১২ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "DACOITY",
    labelEn: "Robbery",
    labelBn: "ডাকাতি",
    descEn: "Group armed robbery, home invasion, looting",
    descBn: "দলবদ্ধ সশস্ত্র ডাকাতি, মালামাল লুণ্ঠন",
    icon: Skull,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    expiryHintEn: "Active for 4 hours",
    expiryHintBn: "৪ ঘণ্টা সক্রিয় থাকবে",
  },
  {
    id: "TEEN_GANG",
    labelEn: "Youth Gang Activity",
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
    id: "DRUG_ACTIVITY",
    labelEn: "Drug-Related Crime",
    labelBn: "মাদক সংক্রান্ত অপরাধ",
    descEn: "Drug peddling, open narcotics dealing, illicit distribution",
    descBn: "প্রকাশ্যে মাদক কেনাবেচা, অপরাধীদের জমায়েত",
    icon: Pill,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    expiryHintEn: "Active for 24 hours",
    expiryHintBn: "২৪ ঘণ্টা সক্রিয় থাকবে",
  },
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
    const normalizedTags = selectedTags.map((t) => normalizeCategoryKey(t));
    const hasTheft = normalizedTags.includes("THEFT");
    const hasRobbery = normalizedTags.includes("ROBBERY");
    const hasSnatching = normalizedTags.includes("SNATCHING");
    const hasArmedAssault = normalizedTags.includes("ARMED_ASSAULT");
    const hasYouthGang = normalizedTags.includes("YOUTH_GANG_ACTIVITY");

    if (hasTheft && hasRobbery) return "THEFT_ROBBERY";
    if (hasSnatching && hasArmedAssault) return "SNATCHING_ARMED_ASSAULT";
    if (hasYouthGang && hasArmedAssault) return "TEEN_GANG_ARMED_ASSAULT";

    const lastTag = selectedTags[selectedTags.length - 1];
    if (lastTag) {
      const canonical = normalizeCategoryKey(lastTag);
      if (canonical && canonical !== "UNKNOWN") return canonical as ReportCategory;
      return lastTag as ReportCategory;
    }
    return "SNATCHING";
  }, [selectedTags]);

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId) || selectedTags.some((t) => normalizeCategoryKey(t) === normalizeCategoryKey(tagId))) {
      if (selectedTags.length > 1) {
        setSelectedTags((prev) => prev.filter((id) => id !== tagId && normalizeCategoryKey(id) !== normalizeCategoryKey(tagId)));
      }
      return;
    }

    const norm = normalizeCategoryKey(tagId);

    // 1. THEFT + ROBBERY
    if (norm === "THEFT") {
      if (selectedTags.some((t) => normalizeCategoryKey(t) === "ROBBERY")) {
        setSelectedTags(["ROBBERY", tagId]);
      } else {
        setSelectedTags([tagId]);
      }
      return;
    }
    if (norm === "ROBBERY") {
      if (selectedTags.some((t) => normalizeCategoryKey(t) === "THEFT")) {
        setSelectedTags(["THEFT", tagId]);
      } else {
        setSelectedTags([tagId]);
      }
      return;
    }

    // 2. SNATCHING + ARMED_ASSAULT
    if (norm === "SNATCHING") {
      if (selectedTags.some((t) => normalizeCategoryKey(t) === "ARMED_ASSAULT")) {
        setSelectedTags(["ARMED_ASSAULT", tagId]);
      } else {
        setSelectedTags([tagId]);
      }
      return;
    }

    // 3. ARMED_ASSAULT + SNATCHING or YOUTH_GANG_ACTIVITY
    if (norm === "ARMED_ASSAULT") {
      if (selectedTags.some((t) => normalizeCategoryKey(t) === "SNATCHING")) {
        setSelectedTags(["SNATCHING", tagId]);
      } else if (selectedTags.some((t) => normalizeCategoryKey(t) === "YOUTH_GANG_ACTIVITY")) {
        setSelectedTags(["YOUTH_GANG_ACTIVITY", tagId]);
      } else {
        setSelectedTags([tagId]);
      }
      return;
    }

    // 4. YOUTH_GANG_ACTIVITY + ARMED_ASSAULT
    if (norm === "YOUTH_GANG_ACTIVITY") {
      if (selectedTags.some((t) => normalizeCategoryKey(t) === "ARMED_ASSAULT")) {
        setSelectedTags(["ARMED_ASSAULT", tagId]);
      } else {
        setSelectedTags([tagId]);
      }
      return;
    }

    // Standalone tag selection
    setSelectedTags([tagId]);
  };
  const [severity, setSeverity] = useState<IncidentSeverity>("HIGH");
  const [latitude, setLatitude] = useState<number>(23.7925);
  const [longitude, setLongitude] = useState<number>(90.4078);
  const [latInput, setLatInput] = useState<string>("23.7925");
  const [lngInput, setLngInput] = useState<string>("90.4078");
  const [description, setDescription] = useState<string>("");

  const syncCoordinates = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setLatInput(String(lat));
    setLngInput(String(lng));
  }, []);

  // Unmodified live hardware GPS (never populated from calibrated store or manual pin actions)
  const [hardwareGps, setHardwareGps] = useState<HardwareGpsFix | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaUploadStatus, setMediaUploadStatus] = useState<"none" | "uploading" | "uploaded" | "failed">("none");
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [isRetryingMedia, setIsRetryingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReport, setCreatedReport] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-authenticate device on page load
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Seed initial map pin from saved location if any, and always query genuine hardware geolocation separately.
  useEffect(() => {
    let hasSavedPin = false;
    if (typeof window !== "undefined") {
      const saved = useMapStore.getState().loadSavedLocation();
      if (saved) {
        hasSavedPin = true;
        syncCoordinates(saved.lat, saved.lng);
      }
    }

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
          setHardwareGps({ lat, lng, accuracy });

          if (!hasSavedPin) {
            syncCoordinates(lat, lng);
          }
        },
        (err) => {
          console.warn("[Report] Geolocation notice:", err.message);
          setHardwareGps(null);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    }
  }, [syncCoordinates]);

  // Evaluate whether unmodified hardware GPS verifies the current pin within 200m & <=250m accuracy
  const gpsEvaluation = useMemo(
    () => evaluateHardwareGpsProximity(hardwareGps, latitude, longitude),
    [hardwareGps, latitude, longitude]
  );
  // Danger Schedule / Active Time-Window State (12-hour AM/PM format with direct minute typing)
  const [isTimeBounded, setIsTimeBounded] = useState(false);
  const [startHour, setStartHour] = useState(6);
  const [startHourStr, setStartHourStr] = useState("06");
  const [startMinute, setStartMinute] = useState(0);
  const [startMinuteStr, setStartMinuteStr] = useState("00");
  const [startMeridiem, setStartMeridiem] = useState<"AM" | "PM">("PM");

  const [endHour, setEndHour] = useState(6);
  const [endHourStr, setEndHourStr] = useState("06");
  const [endMinute, setEndMinute] = useState(0);
  const [endMinuteStr, setEndMinuteStr] = useState("00");
  const [endMeridiem, setEndMeridiem] = useState<"AM" | "PM">("AM");

  const handleHourInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setterStr(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      setterNum(num);
    }
  };

  const handleHourBlur = (
    raw: string,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 1 || num > 12) {
      setterNum(12);
      setterStr("12");
    } else {
      setterNum(num);
      setterStr(String(num).padStart(2, "0"));
    }
  };

  const handleMinuteInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setterStr(raw);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setterNum(num);
    }
  };

  const handleMinuteBlur = (
    raw: string,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      setterNum(0);
      setterStr("00");
    } else {
      setterNum(num);
      setterStr(String(num).padStart(2, "0"));
    }
  };

  const handleHourKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentHour: number,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = currentHour >= 12 ? 1 : currentHour + 1;
      setterNum(next);
      setterStr(String(next).padStart(2, "0"));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const prev = currentHour <= 1 ? 12 : currentHour - 1;
      setterNum(prev);
      setterStr(String(prev).padStart(2, "0"));
    }
  };

  const handleMinuteKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentMinute: number,
    setterNum: (n: number) => void,
    setterStr: (s: string) => void
  ) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = (currentMinute + 1) % 60;
      setterNum(next);
      setterStr(String(next).padStart(2, "0"));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const prev = (currentMinute - 1 + 60) % 60;
      setterNum(prev);
      setterStr(String(prev).padStart(2, "0"));
    }
  };

  const formattedTimeStart = useMemo(
    () => convert12HourTo24Hour(startHour, startMinute, startMeridiem),
    [startHour, startMinute, startMeridiem]
  );
  const formattedTimeEnd = useMemo(
    () => convert12HourTo24Hour(endHour, endMinute, endMeridiem),
    [endHour, endMinute, endMeridiem]
  );
  const isScheduleCurrentlyActive = useMemo(
    () => isHazardWithinTimeWindow(formattedTimeStart, formattedTimeEnd),
    [formattedTimeStart, formattedTimeEnd]
  );

  // Location handlers
  const handleMapLocationChange = useCallback(
    (lat: number, lng: number) => {
      syncCoordinates(lat, lng);
    },
    [syncCoordinates]
  );

  const handleLocateCurrentPosition = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationNotice(
        isBn ? "আপনার ডিভাইসে জিপিএস সমর্থিত নয়।" : "Geolocation is not supported on this device."
      );
      return;
    }

    setIsLocating(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
        setHardwareGps({ lat, lng, accuracy });
        syncCoordinates(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        console.warn("[Report] Live geolocation error:", err.message);
        setIsLocating(false);
        const msg =
          err.code === 1
            ? isBn
              ? "ব্রাউজারে লোকেশন পারমিশন দিন বা ম্যাপে ক্লিক করে পিন বসান।"
              : "Location permission denied. Please allow GPS access or click the map."
            : err.code === 2
            ? isBn
              ? "অবস্থান সংকেত পাওয়া যায়নি।"
              : "Unable to retrieve device position. Please check your GPS."
            : isBn
            ? "অবস্থান নির্ণয়ে সময় শেষ হয়েছে।"
            : "Location request timed out. Please try again.";
        setLocationNotice(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [isBn, syncCoordinates]);

  const handleSnapToDeviceGps = () => {
    if (hardwareGps) {
      syncCoordinates(hardwareGps.lat, hardwareGps.lng);
    } else {
      handleLocateCurrentPosition();
    }
  };

  const processSelectedFile = (selected: File) => {
    const validation = validateEvidenceFile(selected);
    if (!validation.valid) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      handleRemoveFile();
      const localizedMsg =
        validation.code === "FILE_TOO_LARGE"
          ? isBn
            ? "ফাইলের সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।"
            : validation.message
          : validation.code === "UNSUPPORTED_TYPE"
            ? isBn
              ? "শুধুমাত্র JPEG, PNG বা WebP ছবি সমর্থিত।"
              : validation.message
            : isBn
              ? "নির্বাচিত ছবি ফাইলটি খালি।"
              : validation.message;
      setErrorMessage(localizedMsg);
      return;
    }

    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setFilePreview(url);
    setMediaUploadStatus("none");
    setMediaUploadError(null);
    setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processSelectedFile(selected);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processSelectedFile(dropped);
    }
  };

  const handleRemoveFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
    setFilePreview(null);
    setMediaUploadStatus("none");
    setMediaUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedLat = parseFloat(latInput);
    const parsedLng = parseFloat(lngInput);
    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      parsedLat < 20.0 ||
      parsedLat > 27.5 ||
      parsedLng < 88.0 ||
      parsedLng > 93.5
    ) {
      setErrorMessage(
        isBn
          ? "অনুগ্রহ করে বাংলাদেশের সীমার মধ্যে সঠিক অক্ষাংশ (20.0–27.5) ও দ্রাঘিমাংশ (88.0–93.5) দিন।"
          : "Please enter valid Bangladesh coordinates (Lat 20.0–27.5, Lng 88.0–93.5)."
      );
      return;
    }

    setIsSubmitting(true);
    setMediaUploadError(null);
    setMediaUploadStatus(file ? "uploading" : "none");

    try {
      // Only attach hardware GPS headers when unmodified browser geolocation (<= 250m accuracy)
      // matches the pin within 200m; manual pins omit these headers so backend records isGpsVerified=false.
      const gpsHeaders = buildHardwareGpsHeaders(hardwareGps, gpsEvaluation);

      // Submit report to backend
      const reportPayload = {
        category: resolvedCategory,
        severity,
        latitude: parsedLat,
        longitude: parsedLng,
        description: description.trim() || undefined,
        activeTimeStart: isTimeBounded ? formattedTimeStart : undefined,
        activeTimeEnd: isTimeBounded ? formattedTimeEnd : undefined,
      };

      const result = await apiFetch<any>("/reports", {
        method: "POST",
        headers: gpsHeaders,
        body: JSON.stringify(reportPayload),
      });

      // 3. Optional media upload if an image was attached
      if (file && result?.id) {
        try {
          await uploadReportEvidence(result.id, file);
          setMediaUploadStatus("uploaded");
        } catch (mediaErr: any) {
          console.warn("[Media Attachment Notice]", mediaErr?.message);
          setMediaUploadStatus("failed");
          setMediaUploadError(
            mediaErr?.message ||
              (isBn
                ? "ছবি প্রমাণ আপলোড ব্যর্থ হয়েছে।"
                : "Photo evidence upload failed.")
          );
        }
      }

      setCreatedReport(result);
    } catch (err: any) {
      console.error("[Report Submission Error]", err);
      setMediaUploadStatus("none");
      setErrorMessage(
        err.message ||
          (isBn ? "রিপোর্ট জমা দিতে ব্যর্থ হয়েছে।" : "Failed to submit report.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryMediaUpload = async () => {
    if (!createdReport?.id || !file || isRetryingMedia) return;
    setIsRetryingMedia(true);
    setMediaUploadStatus("uploading");
    setMediaUploadError(null);
    try {
      await uploadReportEvidence(createdReport.id, file);
      setMediaUploadStatus("uploaded");
    } catch (mediaErr: any) {
      setMediaUploadStatus("failed");
      setMediaUploadError(
        mediaErr?.message ||
          (isBn ? "ছবি পুনরায় আপলোড ব্যর্থ হয়েছে।" : "Photo retry upload failed.")
      );
    } finally {
      setIsRetryingMedia(false);
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
    setMediaUploadStatus("none");
    setMediaUploadError(null);
    setIsRetryingMedia(false);
    setErrorMessage(null);
  };

  const selectedCategoryDef = useMemo(() => {
    const direct = CATEGORIES.find((c) => c.id === resolvedCategory);
    if (direct) return direct;
    const canonical = normalizeCategoryKey(resolvedCategory);
    const byCanonical = CATEGORIES.find(
      (c) => c.id === canonical || normalizeCategoryKey(c.id) === canonical
    );
    return byCanonical || CATEGORIES[0];
  }, [resolvedCategory]);

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

            {mediaUploadStatus === "uploaded" && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  {isBn
                    ? "সংযুক্ত ছবির প্রমাণ সফলভাবে আপলোড এবং গোপনীয়তা প্রক্রিয়াকরণ সম্পন্ন হয়েছে।"
                    : "Attached photo evidence was uploaded and processed through the privacy pipeline."}
                </span>
              </div>
            )}

            {(mediaUploadStatus === "failed" || (mediaUploadStatus === "uploading" && isRetryingMedia)) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {isBn
                        ? "রিপোর্টটি ছবি ছাড়াই প্রকাশিত হয়েছে"
                        : "Incident published without photo evidence"}
                    </p>
                    <p className="text-amber-800">
                      {mediaUploadError ||
                        (isBn
                          ? "ছবি আপলোডের সময় একটি ত্রুটি ঘটেছে।"
                          : "Photo upload encountered an error.")}
                    </p>
                  </div>
                </div>
                {file && (
                  <button
                    type="button"
                    onClick={handleRetryMediaUpload}
                    disabled={isRetryingMedia}
                    className="shrink-0 py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingMedia ? "animate-spin" : ""}`} />
                    <span>
                      {isRetryingMedia
                        ? isBn
                          ? "আপলোড হচ্ছে..."
                          : "Retrying..."
                        : isBn
                          ? "ছবি পুনরায় আপলোড করুন"
                          : "Retry Photo Upload"}
                    </span>
                  </button>
                )}
              </div>
            )}

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
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold ${
                    gpsEvaluation.isVerified
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <Navigation
                    className={`w-3.5 h-3.5 ${
                      gpsEvaluation.isVerified ? "text-emerald-600" : "text-amber-600"
                    }`}
                  />
                  <span>
                    {gpsEvaluation.isVerified
                      ? isBn
                        ? "হার্ডওয়্যার জিপিএস যাচাইকৃত"
                        : "Hardware GPS Verified"
                      : isBn
                        ? "ম্যানুয়াল পিন / অযাচাইকৃত"
                        : "Manual Pin / Unverified GPS"}
                  </span>
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
                      <span>{isBn ? "বিপদের ক্যাটাগরি ট্যাগ নির্বাচন" : "Select Incident Category Tags"}</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      {isBn ? "প্রয়োজনে দুটি ট্যাগ একসাথে নির্বাচন করুন" : "Select tags (auto-combines)"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50/80 border border-slate-200 rounded-xl">
                    {[
                      { id: "SNATCHING", labelEn: CATEGORY_VISUALS.SNATCHING.labelEn, labelBn: CATEGORY_VISUALS.SNATCHING.labelBn, icon: CATEGORY_VISUALS.SNATCHING.icon, color: "text-orange-700" },
                      { id: "ARMED_ASSAULT", labelEn: CATEGORY_VISUALS.ARMED_ASSAULT.labelEn, labelBn: CATEGORY_VISUALS.ARMED_ASSAULT.labelBn, icon: CATEGORY_VISUALS.ARMED_ASSAULT.icon, color: "text-rose-700" },
                      { id: "THEFT", labelEn: CATEGORY_VISUALS.THEFT.labelEn, labelBn: CATEGORY_VISUALS.THEFT.labelBn, icon: CATEGORY_VISUALS.THEFT.icon, color: "text-amber-700" },
                      { id: "ROBBERY", labelEn: CATEGORY_VISUALS.ROBBERY.labelEn, labelBn: CATEGORY_VISUALS.ROBBERY.labelBn, icon: CATEGORY_VISUALS.ROBBERY.icon, color: "text-red-700" },
                      { id: "YOUTH_GANG_ACTIVITY", labelEn: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.labelEn, labelBn: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.labelBn, icon: CATEGORY_VISUALS.YOUTH_GANG_ACTIVITY.icon, color: "text-violet-700" },
                      { id: "EXTORTION", labelEn: CATEGORY_VISUALS.EXTORTION.labelEn, labelBn: CATEGORY_VISUALS.EXTORTION.labelBn, icon: CATEGORY_VISUALS.EXTORTION.icon, color: "text-purple-700" },
                      { id: "DRUG_RELATED_CRIME", labelEn: CATEGORY_VISUALS.DRUG_RELATED_CRIME.labelEn, labelBn: CATEGORY_VISUALS.DRUG_RELATED_CRIME.labelBn, icon: CATEGORY_VISUALS.DRUG_RELATED_CRIME.icon, color: "text-blue-700" },
                      { id: "ROAD_ACCIDENT", labelEn: CATEGORY_VISUALS.ROAD_ACCIDENT.labelEn, labelBn: CATEGORY_VISUALS.ROAD_ACCIDENT.labelBn, icon: CATEGORY_VISUALS.ROAD_ACCIDENT.icon, color: "text-emerald-700" },
                      { id: "UNLIT_ROAD", labelEn: CATEGORY_VISUALS.UNLIT_ROAD.labelEn, labelBn: CATEGORY_VISUALS.UNLIT_ROAD.labelBn, icon: CATEGORY_VISUALS.UNLIT_ROAD.icon, color: "text-slate-700" },
                    ].map((tag) => {
                      const isSelected = selectedTags.includes(tag.id) || selectedTags.some((t) => normalizeCategoryKey(t) === tag.id);
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
                            setDescription((prev) => {
                              const snippet = isBn ? prompt.bn : prompt.en;
                              const next = prev ? `${prev}. ${snippet}` : snippet;
                              return next.slice(0, 500);
                            })
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
                    <label
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/70 ring-4 ring-blue-500/10 scale-[1.01]"
                          : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isDragging
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600"
                        }`}
                      >
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span
                          className={`text-xs font-bold transition-colors ${
                            isDragging
                              ? "text-blue-700"
                              : "text-slate-800 group-hover:text-blue-600"
                          }`}
                        >
                          {isDragging
                            ? isBn
                              ? "ছবিটি এখানে ছেড়ে দিন"
                              : "Drop photo here to attach"
                            : isBn
                              ? "ছবি আপলোড করতে ক্লিক করুন বা টেনে আনুন"
                              : "Click or drag photo here to attach"}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          JPEG, PNG, WebP (Max 5MB)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>
                          {isBn
                            ? "স্বয়ংক্রিয় চেহারা ও নম্বরপ্লেট ব্লার সক্রিয়"
                            : "Automated Face & Plate Blurring Active"}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50/80 p-3 flex items-center gap-3.5">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filePreview}
                          alt="Evidence preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {file?.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {isBn
                              ? "প্রমাণের জন্য প্রস্তুত (ব্লারিং সক্রিয়)"
                              : "Ready for privacy pipeline"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                          title={isBn ? "ছবি পরিবর্তন করুন" : "Change photo"}
                        >
                          {isBn ? "পরিবর্তন" : "Change"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 transition-colors shrink-0 cursor-pointer"
                          title={isBn ? "ছবি মুছে ফেলুন" : "Remove photo"}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
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
                  </div>

                  {/* Fast Geocoding Location Search */}
                  <LocationSearchBar
                    onSelectLocation={(loc: GeocodedLocation) => {
                      syncCoordinates(loc.lat, loc.lng);
                    }}
                  />

                  <ReportPinMap
                    incidentLat={latitude}
                    incidentLng={longitude}
                    deviceLat={hardwareGps?.lat}
                    deviceLng={hardwareGps?.lng}
                    proximityDistance={gpsEvaluation.isEligibleHardwareGps ? gpsEvaluation.distanceMeters : null}
                    proximityRadius={MAX_GPS_PROXIMITY_METERS}
                    onLocationChange={handleMapLocationChange}
                    onSnapToDevice={handleSnapToDeviceGps}
                    onLocateMe={handleLocateCurrentPosition}
                    isLocating={isLocating}
                    severity={severity}
                    language={language}
                  />

                  {/* Location Guidance & Telemetry Status Indicator */}
                  {gpsEvaluation.isVerified ? (
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 text-xs transition-colors">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">
                          {isBn ? "হার্ডওয়্যার জিপিএস যাচাইকৃত" : "Hardware GPS Verified"}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        {isBn ? "যাচাইকৃত" : "Verified"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {isBn
                          ? "ম্যাপের মাধ্যমে কাস্টম অবস্থান পিন করুন — ম্যাপে ক্লিক করুন"
                          : "Pin custom location through map — click anywhere on the map"}
                      </span>
                    </div>
                  )}

                  {/* Optional Geolocation Error Alert if GPS permission was denied or failed */}
                  {locationNotice && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 animate-in fade-in-50 duration-150">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{locationNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocationNotice(null)}
                        className="p-1 rounded-lg hover:bg-amber-100 text-amber-700 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Manual Coordinates Readout */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        {isBn ? "অক্ষাংশ (Lat)" : "Latitude"}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={latInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setLatInput(raw);
                          const parsed = parseFloat(raw);
                          if (Number.isFinite(parsed)) {
                            setLatitude(parsed);
                          }
                        }}
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
                        value={lngInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setLngInput(raw);
                          const parsed = parseFloat(raw);
                          if (Number.isFinite(parsed)) {
                            setLongitude(parsed);
                          }
                        }}
                        className="w-full bg-transparent font-mono font-bold text-slate-900 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Danger Schedule & Active Hours Section */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>{isBn ? "বিপদের সময়সূচী ও প্রদর্শন সময়সীমা" : "Hazard Schedule & Active Hours"}</span>
                    </label>
                  </div>

                  {/* Mode Selector: 24h All Day vs Specific Time Window */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsTimeBounded(false)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isTimeBounded
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {isBn ? "সারাদিন (২৪ ঘণ্টা)" : "All Day (24 Hours)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTimeBounded(true)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isTimeBounded
                          ? "bg-white text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {isBn ? "নির্দিষ্ট সময়সীমা" : "Specific Time Window"}
                    </button>
                  </div>

                  {!isTimeBounded ? (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {isBn
                        ? "বিপদ পিনটি সবসময় ম্যাপে সক্রিয় থাকবে এবং ২৪ ঘণ্টা সার্বক্ষণিক দৃশ্যমান হবে।"
                        : "Continuous danger alert: The pin will remain actively visible on the map 24/7 until expiration."}
                    </p>
                  ) : (
                    <div className="space-y-3.5 pt-1">
                      {/* AM/PM Time Pickers */}
                      <div className="space-y-2.5">
                        {/* Start Time Row */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {isBn ? "শুরুর সময় (Start Time)" : "Start Time"}
                          </label>
                          <div className="flex items-center gap-1.5">
                            {/* Hour Input (Type any hour 01-12) */}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={startHourStr}
                              onChange={(e) => handleHourInput(e, setStartHour, setStartHourStr)}
                              onBlur={() => handleHourBlur(startHourStr, setStartHour, setStartHourStr)}
                              onKeyDown={(e) => handleHourKeyDown(e, startHour, setStartHour, setStartHourStr)}
                              className="w-12 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 text-center focus:outline-indigo-500 focus:border-indigo-500 shadow-2xs"
                              title={isBn ? "ঘণ্টা টাইপ করুন (০১–১২)" : "Type hour (01–12)"}
                            />
                            <span className="font-bold text-slate-400">:</span>
                            {/* Minute Input (Type any minute 00-59) */}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={startMinuteStr}
                              onChange={(e) => handleMinuteInput(e, setStartMinute, setStartMinuteStr)}
                              onBlur={() => handleMinuteBlur(startMinuteStr, setStartMinute, setStartMinuteStr)}
                              onKeyDown={(e) => handleMinuteKeyDown(e, startMinute, setStartMinute, setStartMinuteStr)}
                              className="w-12 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 text-center focus:outline-indigo-500 focus:border-indigo-500 shadow-2xs"
                              title={isBn ? "যেকোনো মিনিট টাইপ করুন (০০–৫৯)" : "Type any minute (00–59)"}
                            />
                            {/* AM/PM Segmented Toggle */}
                            <div className="flex rounded-lg p-0.5 bg-slate-200/80 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() => setStartMeridiem("AM")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                  startMeridiem === "AM"
                                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                AM
                              </button>
                              <button
                                type="button"
                                onClick={() => setStartMeridiem("PM")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                  startMeridiem === "PM"
                                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                PM
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* End Time Row */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {isBn ? "শেষের সময় (End Time)" : "End Time"}
                          </label>
                          <div className="flex items-center gap-1.5">
                            {/* Hour Input (Type any hour 01-12) */}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={endHourStr}
                              onChange={(e) => handleHourInput(e, setEndHour, setEndHourStr)}
                              onBlur={() => handleHourBlur(endHourStr, setEndHour, setEndHourStr)}
                              onKeyDown={(e) => handleHourKeyDown(e, endHour, setEndHour, setEndHourStr)}
                              className="w-12 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 text-center focus:outline-indigo-500 focus:border-indigo-500 shadow-2xs"
                              title={isBn ? "ঘণ্টা টাইপ করুন (০১–১২)" : "Type hour (01–12)"}
                            />
                            <span className="font-bold text-slate-400">:</span>
                            {/* Minute Input (Type any minute 00-59) */}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={endMinuteStr}
                              onChange={(e) => handleMinuteInput(e, setEndMinute, setEndMinuteStr)}
                              onBlur={() => handleMinuteBlur(endMinuteStr, setEndMinute, setEndMinuteStr)}
                              onKeyDown={(e) => handleMinuteKeyDown(e, endMinute, setEndMinute, setEndMinuteStr)}
                              className="w-12 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 text-center focus:outline-indigo-500 focus:border-indigo-500 shadow-2xs"
                              title={isBn ? "যেকোনো মিনিট টাইপ করুন (০০–৫৯)" : "Type any minute (00–59)"}
                            />
                            {/* AM/PM Segmented Toggle */}
                            <div className="flex rounded-lg p-0.5 bg-slate-200/80 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() => setEndMeridiem("AM")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                  endMeridiem === "AM"
                                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                AM
                              </button>
                              <button
                                type="button"
                                onClick={() => setEndMeridiem("PM")}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                  endMeridiem === "PM"
                                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                PM
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Real-Time Active Status Badge */}
                      <div
                        className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs transition-colors ${
                          isScheduleCurrentlyActive
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {isScheduleCurrentlyActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="leading-snug">
                          <span className="font-bold block">
                            {isScheduleCurrentlyActive
                              ? isBn
                                ? "🟢 বর্তমান সময়ে ম্যাপে সক্রিয়ভাবে প্রদর্শিত হবে"
                                : "🟢 Currently Active: Visible on live map right now"
                              : isBn
                                ? "⚪ বর্তমান সময়ে ম্যাপ থেকে লুকানো থাকবে"
                                : "⚪ Currently Inactive: Hidden from map right now"}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {isBn
                              ? `বিপদ পিনটি শুধুমাত্র প্রতিদিন ${formatTimeTo12Hour(formattedTimeStart)} থেকে ${formatTimeTo12Hour(formattedTimeEnd)} পর্যন্ত ম্যাপে দৃশ্যমান থাকবে।`
                              : `Pin will show on map only between ${formatTimeTo12Hour(formattedTimeStart)} and ${formatTimeTo12Hour(formattedTimeEnd)} BST.`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
                      <span>
                        {file
                          ? isBn
                            ? "রিপোর্ট ও ছবি প্রমাণ আপলোড হচ্ছে..."
                            : "Submitting Incident & Photo..."
                          : isBn
                            ? "রিপোর্ট প্রকাশ হচ্ছে..."
                            : "Submitting Incident..."}
                      </span>
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
