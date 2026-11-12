import type { SafeZoneType } from "@repo/shared";

export type SafeZoneIconKey = "hospital" | "police" | "pharmacy";

export interface SafeZonePresentation {
  type: SafeZoneType;
  label: string;
  shortLabel: string;
  iconKey: SafeZoneIconKey;
  badgeClass: string;
  boxClass: string;
  iconColor: string;
  accentColor: string;
  markerBgColor: string;
  markerRadius: string;
}

/**
 * Normalizes backend/legacy safe zone type strings onto canonical SafeZoneType values.
 */
export function normalizeSafeZoneType(type?: string | null): SafeZoneType {
  const normalized = (type || "").trim().toUpperCase();
  if (normalized === "POLICE_BOX" || normalized === "POLICE_STATION") {
    return "POLICE_BOX";
  }
  if (normalized === "PHARMACY") {
    return "PHARMACY";
  }
  return "HOSPITAL";
}

/**
 * Returns unified bilingual labels, icon keys, and Tailwind/marker styles per SafeZoneType.
 */
export function getSafeZonePresentation(
  type?: string | null,
  language: "en" | "bn" = "en"
): SafeZonePresentation {
  const canonical = normalizeSafeZoneType(type);
  const isBn = language === "bn";

  switch (canonical) {
    case "POLICE_BOX":
      return {
        type: "POLICE_BOX",
        label: isBn ? "পুলিশ বক্স / ফাঁড়ি" : "Police Outpost / Box",
        shortLabel: isBn ? "পুলিশ বক্স" : "Police Box",
        iconKey: "police",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        boxClass: "bg-indigo-50 text-indigo-600 border-indigo-200",
        iconColor: "text-indigo-600",
        accentColor: "border-indigo-500",
        markerBgColor: "#4F46E5",
        markerRadius: "12px",
      };
    case "PHARMACY":
      return {
        type: "PHARMACY",
        label: isBn ? "২৪/৭ ফার্মেসি" : "24/7 Pharmacy",
        shortLabel: isBn ? "ফার্মেসি" : "Pharmacy",
        iconKey: "pharmacy",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        boxClass: "bg-emerald-50 text-emerald-600 border-emerald-200",
        iconColor: "text-emerald-600",
        accentColor: "border-emerald-500",
        markerBgColor: "#059669",
        markerRadius: "10px",
      };
    case "HOSPITAL":
    default:
      return {
        type: "HOSPITAL",
        label: isBn ? "জরুরি হাসপাতাল" : "Emergency Hospital",
        shortLabel: isBn ? "হাসপাতাল" : "Hospital",
        iconKey: "hospital",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        boxClass: "bg-blue-50 text-blue-600 border-blue-200",
        iconColor: "text-blue-600",
        accentColor: "border-blue-500",
        markerBgColor: "#2563EB",
        markerRadius: "10px",
      };
  }
}
