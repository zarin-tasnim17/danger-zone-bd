export type MapMode = "basic" | "heatmap" | "labeled";

export const MAX_GPS_PROXIMITY_METERS = 200;
export const MAX_HARDWARE_GPS_ACCURACY_METERS = 250;

export type GeolocationAccuracyTier =
  | 'HIGH'            // 0 – 15m
  | 'GOOD'            // 15 – 30m
  | 'MODERATE'        // 30 – 100m
  | 'LOW'             // 100 – 500m
  | 'VERY_LOW'        // 500 – 1,000m
  | 'EXTREMELY_POOR'; // > 1,000m or invalid

export interface GeolocationThresholdConfig {
  HIGH_MAX: 15;
  GOOD_MAX: 30;
  MODERATE_MAX: 100;
  LOW_MAX: 500;
  VERY_LOW_MAX: 1000;
}

export const GEOLOCATION_THRESHOLDS: GeolocationThresholdConfig = {
  HIGH_MAX: 15,
  GOOD_MAX: 30,
  MODERATE_MAX: 100,
  LOW_MAX: 500,
  VERY_LOW_MAX: 1000,
};

export function classifyGeolocationAccuracy(accuracy: number | null | undefined): GeolocationAccuracyTier {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(accuracy) || accuracy < 0) {
    return 'EXTREMELY_POOR';
  }
  if (accuracy <= 15) return 'HIGH';
  if (accuracy <= 30) return 'GOOD';
  if (accuracy <= 100) return 'MODERATE';
  if (accuracy <= 500) return 'LOW';
  if (accuracy <= 1000) return 'VERY_LOW';
  return 'EXTREMELY_POOR';
}

export interface BangladeshBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const BANGLADESH_BOUNDS: BangladeshBoundingBox = {
  minLat: 20.3,
  maxLat: 26.8,
  minLng: 87.8,
  maxLng: 92.9,
};

export function isWithinBangladesh(lat: number, lng: number): boolean {
  return (
    lat >= BANGLADESH_BOUNDS.minLat &&
    lat <= BANGLADESH_BOUNDS.maxLat &&
    lng >= BANGLADESH_BOUNDS.minLng &&
    lng <= BANGLADESH_BOUNDS.maxLng
  );
}

export function formatCoordinate(val: number): number {
  return Number(val.toFixed(6));
}

export function sanitizeAccuracy(accuracy: number | null | undefined): number | null {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(accuracy) || accuracy < 0) {
    return null;
  }
  return accuracy;
}

export function computeAccuracyCircleRadius(
  source: string | null,
  accuracy: number | null | undefined
): number {
  if (source === 'calibrated') {
    return 25;
  }
  const sanitized = sanitizeAccuracy(accuracy);
  return sanitized !== null ? sanitized : 50;
}

export function isFreshPosition(
  timestamp: number | null | undefined,
  maxAgeMs = 30000,
  currentTime = Date.now()
): boolean {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }
  return currentTime - timestamp <= maxAgeMs;
}

export const BD_MOBILE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

export function normalizeBangladeshPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+880")) return trimmed;
  if (trimmed.startsWith("880")) return `+${trimmed}`;
  if (trimmed.startsWith("01")) return `+880${trimmed.slice(1)}`;
  return trimmed;
}

export const REPORT_CATEGORIES = [
  "THEFT",
  "ROBBERY",
  "THEFT_ROBBERY",
  "SNATCHING",
  "ARMED_ASSAULT",
  "SNATCHING_ARMED_ASSAULT",
  "EXTORTION",
  "YOUTH_GANG_ACTIVITY",
  "DRUG_RELATED_CRIME",
  "UNLIT_ROAD",
  "ROAD_ACCIDENT",
  // Backward compatibility aliases
  "MUGGING",
  "DACOITY",
  "THEFT_DACOITY",
  "TEEN_GANG",
  "TEEN_GANG_ARMED_ASSAULT",
  "DRUG_ACTIVITY",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

export const REPORT_STATUSES = ["ACTIVE", "RESOLVED", "PURGED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SAFE_ZONE_TYPES = ["HOSPITAL", "POLICE_BOX", "PHARMACY"] as const;
export type SafeZoneType = (typeof SAFE_ZONE_TYPES)[number];
export type SafeZoneItemType = SafeZoneType | "POLICE_STATION";

export interface SafeZoneItem {
  id: string;
  name: string;
  nameBn?: string;
  type: SafeZoneItemType;
  latitude: number;
  longitude: number;
  createdAt?: string;
  distanceMeters?: number | string;
}

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
  isGpsVerified?: boolean;
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
  STATS_UPDATED: "STATS_UPDATED",
} as const;

export interface SocketReportIdPayload {
  reportId?: string;
  id?: string;
}

export interface ReportVotedPayload extends SocketReportIdPayload {
  upvotes: number;
  downvotes: number;
  status?: string;
}

export interface ReportPurgedPayload extends SocketReportIdPayload {
  reason?: string;
}

export interface ReportExpiredPayload {
  reportIds: string[];
  reason?: string;
}

export interface ReportResolvedPayload extends SocketReportIdPayload {
  status?: string;
  resolvedAt?: string;
}

export interface NewReportUpdatePayload<TUpdate = any> extends SocketReportIdPayload {
  update: TUpdate;
}

export interface ReportVerifiedPayload extends SocketReportIdPayload {
  verifiedBy: string;
  sourceUrl?: string;
  articleTitle?: string;
}

export function getSocketReportId(
  payload?: SocketReportIdPayload | null
): string | undefined {
  return payload?.reportId ?? payload?.id;
}
