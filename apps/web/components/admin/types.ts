export type AdminTab = "overview" | "reports" | "verifications" | "users" | "logs";

export interface AdminReport {
  id: string;
  category: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  description?: string | null;
  upvotes: number;
  downvotes: number;
  verificationStage?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    trustScore?: number;
    role?: string;
  };
}

export interface AdminVerification {
  id: string;
  userId: string;
  type: string;
  documentUrl?: string | null;
  phoneNumber?: string | null;
  status?: string;
  createdAt: string;
  user?: {
    id: string;
    phoneNumber?: string | null;
    trustScore?: number;
  };
}

export interface AdminLog {
  id: string;
  action: string;
  adminId: string;
  targetReportId?: string | null;
  targetUserId?: string | null;
  reason: string;
  createdAt: string;
}

export interface AdminTrends {
  totalReports: number;
  nightReportPercentage: number;
  nightReportsCount: number;
  breakdown: {
    bySeverity: {
      HIGH?: number;
      MEDIUM?: number;
      LOW?: number;
    };
    byStatus: {
      ACTIVE?: number;
      RESOLVED?: number;
      PURGED?: number;
    };
    byCategory?: Record<string, number>;
  };
  timeline: Array<{
    date: string;
    count: number;
  }>;
}

export const CATEGORY_ALIAS_MAP: Record<string, string> = {
  MUGGING: "SNATCHING",
  DACOITY: "ROBBERY",
  THEFT_DACOITY: "THEFT_ROBBERY",
  TEEN_GANG: "YOUTH_GANG_ACTIVITY",
  DRUG_ACTIVITY: "DRUG_RELATED_CRIME",
};

export const CATEGORY_BAR_COLORS: Record<string, string> = {
  SNATCHING: "bg-orange-500",
  ARMED_ASSAULT: "bg-rose-600",
  SNATCHING_ARMED_ASSAULT: "bg-red-600",
  ROBBERY: "bg-red-500",
  THEFT: "bg-amber-500",
  THEFT_ROBBERY: "bg-red-700",
  EXTORTION: "bg-purple-500",
  YOUTH_GANG_ACTIVITY: "bg-violet-500",
  DRUG_RELATED_CRIME: "bg-blue-500",
  UNLIT_ROAD: "bg-yellow-500",
  ROAD_ACCIDENT: "bg-emerald-500",
  TEEN_GANG_ARMED_ASSAULT: "bg-fuchsia-600",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
