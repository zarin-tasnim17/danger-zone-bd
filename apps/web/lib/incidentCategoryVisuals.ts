import React from "react";
import {
  Car,
  KeyRound,
  Skull,
  PackageX,
  Grab,
  Swords,
  Crosshair,
  Banknote,
  Users,
  UsersRound,
  Pill,
  LightbulbOff,
  ShieldBan,
  Flame,
  Zap,
  Megaphone,
  AlertTriangle,
  Siren,
} from "lucide-react";
import { Language, IncidentCategory } from "@repo/shared";
import { translations } from "@/lib/translations";

export interface IncidentCategoryVisual {
  canonicalCategory: string;
  icon: React.ComponentType<{ className?: string }>;
  getSvg: (size?: number) => string;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  badgeClass: string;
  accentColor: string;
  ariaLabelEn: string;
  ariaLabelBn: string;
}

/**
 * Universal fallback visual for unknown, missing, or unclassified categories.
 * Strict invariant: MUST NOT default to Car or any unrelated incident type.
 */
export const UNKNOWN_CATEGORY_VISUAL: IncidentCategoryVisual = {
  canonicalCategory: "UNKNOWN",
  icon: AlertTriangle,
  getSvg: (size = 14) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="transform: translateY(-0.5px);"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  labelEn: "Unclassified Incident",
  labelBn: "অনির্ধারিত ঘটনা",
  descriptionEn: "Reported public safety hazard with pending classification",
  descriptionBn: "রিপোর্টকৃত নিরাপত্তা ঘটনা (শ্রেণি যাচাইকরণ প্রক্রিয়াধীন)",
  badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
  accentColor: "#64748B",
  ariaLabelEn: "Unclassified public safety hazard",
  ariaLabelBn: "অনির্ধারিত সাধারণ নিরাপত্তা সতর্কতা",
};

/**
 * Centralized Category Visual Configuration
 * Every supported incident category has a unique Lucide icon, bespoke SVG,
 * localized display labels, distinct badge styling, and accessible description.
 */
export const CATEGORY_VISUALS: Record<string, IncidentCategoryVisual> = {
  // 1. Road Accident: Car collision icon
  ROAD_ACCIDENT: {
    canonicalCategory: "ROAD_ACCIDENT",
    icon: Car,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="m9 9 3 3m0-3-3 3"/></svg>`,
    labelEn: "Road Accident",
    labelBn: "সড়ক দুর্ঘটনা / এক্সিডেন্ট",
    descriptionEn: "Vehicle crashes, highway collisions, traffic impact incidents",
    descriptionBn: "যানবাহন দুর্ঘটনা, মহাসড়কে মুখোমুখি সংঘর্ষ বা গাড়ি উল্টে যাওয়া",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accentColor: "#059669",
    ariaLabelEn: "Road accident and vehicular crash hazard",
    ariaLabelBn: "সড়ক দুর্ঘটনা ও যানবাহন সংঘর্ষের সতর্কতা",
  },

  // 2. Theft: Stolen key / burglary icon
  THEFT: {
    canonicalCategory: "THEFT",
    icon: KeyRound,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 8.5-8.5"/><path d="M16 7h3"/><path d="M19 4h2"/></svg>`,
    labelEn: "Theft",
    labelBn: "চুরি",
    descriptionEn: "Residential burglary, vehicle theft, covert stealing",
    descriptionBn: "বাসাবাড়িতে বা দোকানে চুরি, মালামাল ও গাড়ি চুরি",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    accentColor: "#D97706",
    ariaLabelEn: "Theft and burglary hazard",
    ariaLabelBn: "চুরি ও সিঁধেল চুরির সতর্কতা",
  },

  // 3. Robbery: Masked robber / armed heist icon
  ROBBERY: {
    canonicalCategory: "ROBBERY",
    icon: Skull,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg>`,
    labelEn: "Robbery",
    labelBn: "ডাকাতি",
    descriptionEn: "Group armed robbery, home invasion, violent looting",
    descriptionBn: "দলবদ্ধ সশস্ত্র ডাকাতি, গৃহ আক্রমণ ও মালামাল লুণ্ঠন",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    accentColor: "#DC2626",
    ariaLabelEn: "Armed robbery hazard",
    ariaLabelBn: "সশস্ত্র ডাকাতির সতর্কতা",
  },

  // 4. Theft & Robbery (Combined): Stolen parcel / looted property icon
  THEFT_ROBBERY: {
    canonicalCategory: "THEFT_ROBBERY",
    icon: PackageX,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/><path d="m17 13 5 5m0-5-5 5"/></svg>`,
    labelEn: "Theft & Robbery",
    labelBn: "চুরি ডাকাতি",
    descriptionEn: "Combined burglary and armed property looting",
    descriptionBn: "চুরি ও সশস্ত্র ডাকাতির যৌথ ঘটনা",
    badgeClass: "bg-red-50 text-red-800 border-red-300 font-bold",
    accentColor: "#BE123C",
    ariaLabelEn: "Theft and robbery combined hazard",
    ariaLabelBn: "চুরি ও ডাকাতির যৌথ সতর্কতা",
  },

  // 5. Snatching: Hand grabbing / fast intercept icon
  SNATCHING: {
    canonicalCategory: "SNATCHING",
    icon: Grab,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
    labelEn: "Snatching",
    labelBn: "ছিনতাই",
    descriptionEn: "Bag snatching, phone grabbing, fast intercept",
    descriptionBn: "রাস্তায় ব্যাগ টানা, ফোন ছিনতাই বা গতিরোধ",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    accentColor: "#EA580C",
    ariaLabelEn: "Snatching and mugging hazard",
    ariaLabelBn: "ছিনতাইয়ের সতর্কতা",
  },

  // 6. Armed Assault: Weapon / physical attack / crossed swords icon
  ARMED_ASSAULT: {
    canonicalCategory: "ARMED_ASSAULT",
    icon: Swords,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 17.5 5 5"/><path d="m9.5 6.5-5-5"/><path d="m4.5 17.5 15-15"/><path d="m19.5 17.5-15-15"/><path d="m9.5 17.5-5 5"/><path d="m14.5 6.5 5-5"/></svg>`,
    labelEn: "Armed Assault",
    labelBn: "অস্ত্রসহ হামলা",
    descriptionEn: "Violent clash, sharp weapons, stabbing, physical fight, gunfire attack",
    descriptionBn: "সহিংস সংঘর্ষ, ধারালো অস্ত্র, কোপানো, ছুরিকাঘাত বা মারামারি",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    accentColor: "#E11D48",
    ariaLabelEn: "Armed assault and physical clash hazard",
    ariaLabelBn: "অস্ত্রসহ হামলা ও মারামারি সংঘর্ষের সতর্কতা",
  },

  // 7. Snatching & Armed Assault: Armed theft / crosshair targeting icon
  SNATCHING_ARMED_ASSAULT: {
    canonicalCategory: "SNATCHING_ARMED_ASSAULT",
    icon: Crosshair,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
    labelEn: "Snatching & Armed Assault",
    labelBn: "ছিনতাই ও অস্ত্রসহ হামলা",
    descriptionEn: "Snatching accompanied by sharp weapon assault or gunfire",
    descriptionBn: "ছিনতাইকালে ধারালো অস্ত্র দিয়ে কুপিয়ে বা আঘাত করে জখম",
    badgeClass: "bg-red-50 text-red-800 border-red-300 font-bold",
    accentColor: "#991B1B",
    ariaLabelEn: "Armed snatching and assault hazard",
    ariaLabelBn: "ছিনতাই ও অস্ত্রসহ হামলার সতর্কতা",
  },

  // 8. Extortion: Money demand / banknote icon
  EXTORTION: {
    canonicalCategory: "EXTORTION",
    icon: Banknote,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>`,
    labelEn: "Extortion",
    labelBn: "চাঁদাবাজি",
    descriptionEn: "Extortion threats, protection money demands, intimidation",
    descriptionBn: "ব্যবসায়ী বা সাধারণ মানুষের কাছ থেকে জোরপূর্বক চাঁদা দাবি ও হুমকি",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    accentColor: "#7C3AED",
    ariaLabelEn: "Extortion and illegal levy hazard",
    ariaLabelBn: "চাঁদাবাজির সতর্কতা",
  },

  // 9. Youth Gang Activity: Group confrontation / juvenile silhouettes icon
  YOUTH_GANG_ACTIVITY: {
    canonicalCategory: "YOUTH_GANG_ACTIVITY",
    icon: Users,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    labelEn: "Youth Gang Activity",
    labelBn: "কিশোর গ্যাং",
    descriptionEn: "Juvenile gang showdowns, street confrontations, intimidation",
    descriptionBn: "কিশোর গ্যাং মহড়া, মারামারি ও এলাকাভিত্তিক বিশৃঙ্খলা",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    accentColor: "#6D28D9",
    ariaLabelEn: "Youth gang activity and group conflict hazard",
    ariaLabelBn: "কিশোর গ্যাং বিশৃঙ্খলার সতর্কতা",
  },

  // 10. Teen Gang Armed Assault: Gang armed clash / users with weapon icon
  TEEN_GANG_ARMED_ASSAULT: {
    canonicalCategory: "TEEN_GANG_ARMED_ASSAULT",
    icon: UsersRound,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 15l-4-4"/><path d="M19 15l4-4"/></svg>`,
    labelEn: "Gang Armed Clash",
    labelBn: "কিশোর গ্যাং ও অস্ত্রসহ হামলা",
    descriptionEn: "Youth gang clashes involving bladed weapons or firearms",
    descriptionBn: "কিশোর গ্যাং কর্তৃক ধারালো অস্ত্র বা আগ্নেয়াস্ত্র নিয়ে হামলা",
    badgeClass: "bg-violet-50 text-violet-800 border-violet-300 font-bold",
    accentColor: "#581C87",
    ariaLabelEn: "Gang armed assault hazard",
    ariaLabelBn: "কিশোর গ্যাংয়ের সশস্ত্র হামলার সতর্কতা",
  },

  // 11. Drug-Related Crime: Prohibited substances / capsule pill icon
  DRUG_RELATED_CRIME: {
    canonicalCategory: "DRUG_RELATED_CRIME",
    icon: Pill,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
    labelEn: "Drug-Related Crime",
    labelBn: "মাদক সংক্রান্ত অপরাধ",
    descriptionEn: "Narcotics trade, substance abuse hotspots, peddling",
    descriptionBn: "মাদক কারবার, ইয়াবা ও মাদক সেবনের এলাকাভিত্তিক স্পট",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    accentColor: "#0284C7",
    ariaLabelEn: "Drug-related crime hazard",
    ariaLabelBn: "মাদক সংক্রান্ত অপরাধের সতর্কতা",
  },

  // 12. Unlit Road: Unlit street / crossed bulb icon
  UNLIT_ROAD: {
    canonicalCategory: "UNLIT_ROAD",
    icon: LightbulbOff,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
    labelEn: "Unlit Road",
    labelBn: "অন্ধকার রাস্তা",
    descriptionEn: "No streetlights, dark alleyways, dangerous broken road infrastructure",
    descriptionBn: "সড়ক বাতি বন্ধ, অন্ধকার গলি ও বিপজ্জনক ভাঙা রাস্তা",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    accentColor: "#475569",
    ariaLabelEn: "Unlit road infrastructure hazard",
    ariaLabelBn: "অন্ধকার ও বাতিবিহীন রাস্তার সতর্কতা",
  },

  // 13. Roadblock: Barrier / barricade (NOT a car!)
  ROADBLOCK: {
    canonicalCategory: "ROADBLOCK",
    icon: ShieldBan,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/></svg>`,
    labelEn: "Roadblock",
    labelBn: "সড়ক অবরোধ / ব্যারিকেড",
    descriptionEn: "Road blocked by barricades, agitation, or tree logs",
    descriptionBn: "ব্যারিকেড বা আন্দোলনের কারণে সড়ক যোগাযোগ বন্ধ",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    accentColor: "#B45309",
    ariaLabelEn: "Roadblock and barricade hazard",
    ariaLabelBn: "সড়ক অবরোধের সতর্কতা",
  },

  // 14. Fire: Fire hazard / flame icon
  FIRE: {
    canonicalCategory: "FIRE",
    icon: Flame,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    labelEn: "Fire Incident",
    labelBn: "অগ্নিকাণ্ড",
    descriptionEn: "Building fire, vehicle blaze, arson",
    descriptionBn: "ভবনে বা গাড়িতে আগুন, অগ্নিকাণ্ড",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-300",
    accentColor: "#C2410C",
    ariaLabelEn: "Fire hazard",
    ariaLabelBn: "অগ্নিকাণ্ডের সতর্কতা",
  },

  // 15. Natural Hazard: Lightning / storm
  NATURAL_HAZARD: {
    canonicalCategory: "NATURAL_HAZARD",
    icon: Zap,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    labelEn: "Natural Hazard",
    labelBn: "প্রাকৃতিক দুর্যোগ",
    descriptionEn: "Severe storm, lightning strike, flash flooding",
    descriptionBn: "বজ্রপাত, ঝড় ও বন্যা দুর্যোগ",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    accentColor: "#0369A1",
    ariaLabelEn: "Natural disaster hazard",
    ariaLabelBn: "প্রাকৃতিক দুর্যোগের সতর্কতা",
  },

  // 16. Harassment: Megaphone alert
  HARASSMENT: {
    canonicalCategory: "HARASSMENT",
    icon: Megaphone,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    labelEn: "Harassment",
    labelBn: "নিপীড়ন / হয়রানি",
    descriptionEn: "Public stalking, street harassment, eve-teasing",
    descriptionBn: "পথেঘাটে হয়রানি ও উত্ত্যক্তকরণ",
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
    accentColor: "#BE185D",
    ariaLabelEn: "Harassment hazard",
    ariaLabelBn: "হয়রানির সতর্কতা",
  },

  // 17. Violence / Riot: Emergency alarm / riot alert
  VIOLENCE_RIOT: {
    canonicalCategory: "VIOLENCE_RIOT",
    icon: Siren,
    getSvg: (size = 14) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12a5 5 0 0 1 10 0v4H7v-4Z"/><path d="M5 20h14"/><path d="M12 4v2"/><path d="m4.93 7.93 1.41 1.41"/><path d="m19.07 7.93-1.41 1.41"/></svg>`,
    labelEn: "Riot / Unrest",
    labelBn: "দাঙ্গা / সংঘর্ষ",
    descriptionEn: "Civil unrest, riot, mob clashes",
    descriptionBn: "দাঙ্গা, বিশৃঙ্খলা ও গণসংঘর্ষ",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-300 font-bold",
    accentColor: "#991B1B",
    ariaLabelEn: "Riot and civil unrest hazard",
    ariaLabelBn: "দাঙ্গা ও গণসংঘর্ষের সতর্কতা",
  },
};

/**
 * Backward compatibility alias mappings
 */
const CATEGORY_ALIASES: Record<string, string> = {
  MUGGING: "SNATCHING",
  DACOITY: "ROBBERY",
  THEFT_DACOITY: "THEFT_ROBBERY",
  TEEN_GANG: "YOUTH_GANG_ACTIVITY",
  DRUG_ACTIVITY: "DRUG_RELATED_CRIME",
  ACCIDENT: "ROAD_ACCIDENT",
  ROBBERY_CRIME: "ROBBERY",
  GENERAL_ALERT: "UNKNOWN",
};

/**
 * Normalizes any category string into its canonical category key.
 */
export function normalizeCategoryKey(rawCategory: string | null | undefined): string {
  if (!rawCategory) return "UNKNOWN";
  const upper = rawCategory.trim().toUpperCase();
  if (CATEGORY_ALIASES[upper]) {
    return CATEGORY_ALIASES[upper];
  }
  if (CATEGORY_VISUALS[upper]) {
    return upper;
  }
  // Try case-insensitive lookup
  const found = Object.keys(CATEGORY_VISUALS).find(
    (k) => k.toLowerCase() === rawCategory.trim().toLowerCase()
  );
  return found || "UNKNOWN";
}

/**
 * Retrieves the complete IncidentCategoryVisual for any given incident category.
 * If the category is unknown or unsupported, returns UNKNOWN_CATEGORY_VISUAL and logs
 * the classification problem for diagnostic investigation.
 * Strict invariant: NEVER defaults to Car icon.
 */
export function getCategoryVisual(category: string | null | undefined): IncidentCategoryVisual {
  const normKey = normalizeCategoryKey(category);
  const visual = CATEGORY_VISUALS[normKey];

  if (!visual) {
    if (category && category !== "UNKNOWN" && category !== "general_alert") {
      console.warn(
        `[CategoryVisuals] Unknown or unclassified incident category received: "${category}". Using neutral generic alert.`
      );
    }
    return UNKNOWN_CATEGORY_VISUAL;
  }

  return visual;
}

/**
 * Returns the matching Lucide icon component for any incident category.
 */
export function getCategoryIcon(
  category: string | null | undefined
): React.ComponentType<{ className?: string }> {
  return getCategoryVisual(category).icon;
}

/**
 * Returns the vector SVG markup string for any incident category.
 */
export function getCategorySvg(category: string | null | undefined, size = 14): string {
  return getCategoryVisual(category).getSvg(size);
}

/**
 * Returns the Tailwind CSS badge class string for any incident category.
 */
export function getCategoryBadgeClass(category: string | null | undefined): string {
  return getCategoryVisual(category).badgeClass;
}

/**
 * Returns the localized human-readable category display label.
 */
export function formatCategoryLabel(
  category: string | null | undefined,
  language: Language = "en"
): string {
  if (!category) return "";
  const visual = getCategoryVisual(category);
  if (visual.canonicalCategory !== "UNKNOWN") {
    return language === "bn" ? visual.labelBn : visual.labelEn;
  }

  // If UNKNOWN/unrecognized by CATEGORY_VISUALS, check translations table first
  const categories = translations[language]?.categories as Record<string, string> | undefined;
  const fallbackCategories = translations.en.categories as Record<string, string>;
  const upper = category.toUpperCase();
  const lower = category.toLowerCase();

  const translated =
    categories?.[category] ??
    categories?.[upper] ??
    categories?.[lower] ??
    fallbackCategories?.[category] ??
    fallbackCategories?.[upper] ??
    fallbackCategories?.[lower];

  if (translated) {
    return translated;
  }

  const cleaned = category.replace(/_/g, " ").trim();
  if (cleaned && cleaned.toLowerCase() !== "unknown") {
    if (language === "bn") {
      return visual.labelBn;
    }
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return language === "bn" ? visual.labelBn : visual.labelEn;
}

/**
 * Returns the localized descriptive text explaining the incident category.
 */
export function getCategoryDescription(
  category: string | null | undefined,
  language: Language = "en"
): string {
  const visual = getCategoryVisual(category);
  return language === "bn" ? visual.descriptionBn : visual.descriptionEn;
}

/**
 * Returns accessible ARIA label for screen readers.
 */
export function getCategoryAriaLabel(
  category: string | null | undefined,
  language: Language = "en"
): string {
  const visual = getCategoryVisual(category);
  return language === "bn" ? visual.ariaLabelBn : visual.ariaLabelEn;
}
