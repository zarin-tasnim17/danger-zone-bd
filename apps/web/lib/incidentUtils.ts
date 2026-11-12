import React from "react";
import {
  Lock,
  ShieldAlert,
  Siren,
  Swords,
  AlertOctagon,
  Users,
  Pill,
  LightbulbOff,
  Car,
  AlertTriangle,
} from "lucide-react";
import { IncidentCategory, Language } from "@repo/shared";
import { translations } from "@/lib/translations";

/**
 * Formats a raw hazard category enum into a localized human-readable label,
 * replacing all underscores globally when falling back to raw enum text.
 */
export function formatCategoryLabel(
  category: string,
  language: Language = "en"
): string {
  if (!category) return "";
  const categories = translations[language]?.categories as
    | Record<string, string>
    | undefined;
  const fallbackCategories = translations.en.categories as Record<
    string,
    string
  >;
  const normalizedUpper = category.toUpperCase();
  const normalizedLower = category.toLowerCase();

  return (
    categories?.[category] ??
    categories?.[normalizedUpper] ??
    categories?.[normalizedLower] ??
    fallbackCategories[category] ??
    fallbackCategories[normalizedUpper] ??
    fallbackCategories[normalizedLower] ??
    category.replace(/_/g, " ")
  );
}

/**
 * Cleans raw news headlines by stripping bracketed feed aggregator prefixes
 * (e.g. "[Google News BD Safety (Bangla)]") and trailing source suffixes
 * (e.g. " - dhakapost.com" or " - প্রথম আলো").
 */
export function cleanIncidentTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  
  // 1. Strip leading [Source] or [Google News ...] tags
  let cleaned = rawTitle.replace(/^\[(?:Google News[^\]]*|The Daily Star[^\]]*|Press:[^\]]*)\]\s*/i, "").trim();

  // 2. Strip trailing publisher credits like "- dhakapost.com", "- প্রথম আলো", "- যুগান্তর"
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|প্রথম আলো|দৈনিক ইত্তেফাক|যুগান্তর|কালের কণ্ঠ|সমকাল|ইনকিলাব|মানবজমিন|banglanews24|dhakapost|bdnews24|prothomalo|daily star|daily observer|ajker patrika|the business standard|jagonews24|bangladesh pratidin|bd bulletin|sarabangla|cvoice24).*$/i, "").trim();

  return cleaned || rawTitle;
}

/**
 * Returns the matching Lucide icon component for any incident category.
 */
export function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  const norm = (category || "").toUpperCase();

  switch (norm) {
    case "THEFT":
      return Lock;
    case "ROBBERY":
    case "DACOITY":
      return ShieldAlert;
    case "THEFT_ROBBERY":
    case "THEFT_DACOITY":
      return ShieldAlert;
    case "SNATCHING":
    case "MUGGING":
      return Siren;
    case "ARMED_ASSAULT":
      return Swords;
    case "SNATCHING_ARMED_ASSAULT":
      return ShieldAlert;
    case "EXTORTION":
      return AlertOctagon;
    case "YOUTH_GANG_ACTIVITY":
    case "TEEN_GANG":
    case "TEEN_GANG_ARMED_ASSAULT":
      return Users;
    case "DRUG_RELATED_CRIME":
    case "DRUG_ACTIVITY":
      return Pill;
    case "UNLIT_ROAD":
      return LightbulbOff;
    case "ROAD_ACCIDENT":
    case "ACCIDENT":
      return Car;
    default:
      return AlertTriangle;
  }
}

/**
 * Returns distinct styling badges for incident categories.
 */
export function getCategoryBadgeClass(category: string): string {
  const norm = (category || "").toUpperCase();

  switch (norm) {
    case "SNATCHING":
    case "MUGGING":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "ARMED_ASSAULT":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "SNATCHING_ARMED_ASSAULT":
      return "bg-red-50 text-red-800 border-red-300 font-bold";
    case "ROBBERY":
    case "DACOITY":
      return "bg-red-50 text-red-700 border-red-200";
    case "THEFT":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "THEFT_ROBBERY":
    case "THEFT_DACOITY":
      return "bg-red-50 text-red-800 border-red-300 font-bold";
    case "EXTORTION":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "YOUTH_GANG_ACTIVITY":
    case "TEEN_GANG":
    case "TEEN_GANG_ARMED_ASSAULT":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "DRUG_RELATED_CRIME":
    case "DRUG_ACTIVITY":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "ROAD_ACCIDENT":
    case "ACCIDENT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "UNLIT_ROAD":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
