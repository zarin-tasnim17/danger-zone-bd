export type MapMode = "basic" | "heatmap" | "labeled";

export const REPORT_CATEGORIES = [
  "MUGGING",
  "THEFT",
  "UNLIT_ROAD",
  "EXTORTION",
  "DRUG_ACTIVITY",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

export const REPORT_STATUSES = ["ACTIVE", "RESOLVED", "PURGED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Backward-compatible unified types for web and api
export type IncidentSeverity =
  | ReportSeverity
  | "critical"
  | "high"
  | "medium"
  | "low";

export type IncidentCategory =
  | ReportCategory
  | "violence_riot"
  | "robbery_crime"
  | "roadblock"
  | "accident"
  | "fire"
  | "natural_hazard"
  | "harassment"
  | "general_alert";

export type VerificationStatus =
  | "unverified"
  | "community_confirmed"
  | "authority_verified"
  | "disputed"
  | "resolved";

export type Language = "en" | "bn";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DangerIncident {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  descriptionBn?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  coordinates: Coordinates;
  locationName: string;
  locationNameBn?: string;
  district?: string;
  division?: string;
  timestamp: string;
  upvotes: number;
  downvotes: number;
  status: VerificationStatus;
  reportedBy: string;
  verifiedCount: number;
  sourceUrl?: string | null;
  sourceName?: string | null;
  fuzzedRadiusMeters?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  JOIN_MAP_BOUNDS: "joinMapBounds",
  NEW_REPORT: "NEW_REPORT",
  REPORT_VOTED: "REPORT_VOTED",
  REPORT_PURGED: "REPORT_PURGED",
  REPORT_EXPIRED: "REPORT_EXPIRED",
  REPORT_RESOLVED: "REPORT_RESOLVED",
  NEW_REPORT_UPDATE: "NEW_REPORT_UPDATE",
  REPORT_VERIFIED: "REPORT_VERIFIED",
  GEOFENCE_ALERT: "GEOFENCE_ALERT",
} as const;
