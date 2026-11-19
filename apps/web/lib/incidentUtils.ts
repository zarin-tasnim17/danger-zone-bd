import React from "react";
import { Language } from "@repo/shared";
import {
  getCategoryVisual,
  getCategoryIcon,
  getCategoryBadgeClass,
  formatCategoryLabel,
  getCategoryDescription,
  getCategoryAriaLabel,
  CATEGORY_VISUALS,
  UNKNOWN_CATEGORY_VISUAL,
  type IncidentCategoryVisual,
} from "./incidentCategoryVisuals";

export {
  getCategoryVisual,
  getCategoryIcon,
  getCategoryBadgeClass,
  formatCategoryLabel,
  getCategoryDescription,
  getCategoryAriaLabel,
  CATEGORY_VISUALS,
  UNKNOWN_CATEGORY_VISUAL,
  type IncidentCategoryVisual,
};

/**
 * Cleans raw news headlines by stripping bracketed feed aggregator prefixes
 * (e.g. "[Google News BD Safety (Bangla)]") and trailing source suffixes
 * (e.g. " - dhakapost.com", " - প্রথম আলো", or " dbcnews.tv").
 */
export function cleanIncidentTitle(rawTitle: string): string {
  if (!rawTitle) return "";

  // 1. Strip leading [Source] or [Google News ...] tags
  let cleaned = rawTitle
    .replace(/^\[(?:Google News[^\]]*|The Daily Star[^\]]*|Press:[^\]]*)\]\s*/i, "")
    .trim();

  // 2. Strip trailing publisher credits like "- dhakapost.com", "- প্রথম আলো", or " dbcnews.tv"
  cleaned = cleaned
    .replace(
      /\s*[-–—|]\s*(?:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|প্রথম আলো|দৈনিক ইত্তেফাক|যুগান্তর|কালের কণ্ঠ|সমকাল|ইনকিলাব|মানবজমিন|banglanews24|dhakapost|bdnews24|prothomalo|daily star|daily observer|ajker patrika|the business standard|jagonews24|bangladesh pratidin|bd bulletin|sarabangla|cvoice24|dbc news|dbcnews).*$/i,
      ""
    )
    .trim();

  // 3. Strip trailing media outlet domain or brand suffix directly attached at the end
  cleaned = cleaned
    .replace(
      /\s+(?:[a-zA-Z0-9-]+\.(?:tv|com|org|net|bd|info|xyz|me|news|live)|dbcnews\.tv|dhakapost\.com|banglanews24\.com|bdnews24\.com|prothomalo\.com|dbc news|dbcnews)\s*$/i,
      ""
    )
    .trim();

  return cleaned || rawTitle;
}
