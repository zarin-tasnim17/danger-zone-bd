import crypto from 'node:crypto';
import {
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@repo/shared';
import type { VerificationStage, Citation } from './contractValidator';

export interface DbReport {
  id: string;
  userId: string;
  title: string | null;
  category: ReportCategory;
  severity: ReportSeverity;
  isNightReport: boolean;
  isGpsVerified: boolean;
  latitude: number;
  longitude: number;
  description: string | null;
  upvotes: number;
  downvotes: number;
  status: ReportStatus;
  verificationStage: VerificationStage;
  citations: Citation[];
  expiresAt: Date | null;
  sourceUrl: string | null;
  sourceName: string | null;
  createdAt: Date;
  updatedAt: Date;
  threatStatus?: any;
  locationPrecision?: string | null;
  district?: string | null;
  upazila?: string | null;
}

export interface DbNewsArticle {
  id: string;
  guid: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: Date;
  category: ReportCategory;
  severity: ReportSeverity;
  latitude: number;
  longitude: number;
  reportId: string | null;
  createdAt: Date;
}

export interface DbReportUpdate {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface DbUser {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED_RESPONDER' | 'ADMIN';
  isVerified: boolean;
  trustScore: number;
  isBanned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calculates Haversine distance in meters between two [latitude, longitude] points.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class MockDatabase {
  private reports: Map<string, DbReport> = new Map();
  private articles: Map<string, DbNewsArticle> = new Map();
  private updates: Map<string, DbReportUpdate> = new Map();
  private users: Map<string, DbUser> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers(): void {
    const defaultBot: DbUser = {
      id: 'news-bot-user-id',
      email: 'news-crawler-bot@safety.bd',
      role: 'VERIFIED_RESPONDER',
      isVerified: true,
      trustScore: 100,
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(defaultBot.id, defaultBot);
    this.users.set(defaultBot.email, defaultBot);

    const defaultAdmin: DbUser = {
      id: 'admin-user-id',
      email: 'admin@safety.bd',
      role: 'ADMIN',
      isVerified: true,
      trustScore: 100,
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(defaultAdmin.id, defaultAdmin);
    this.users.set(defaultAdmin.email, defaultAdmin);
  }

  public clear(): void {
    this.reports.clear();
    this.articles.clear();
    this.updates.clear();
    this.users.clear();
    this.seedDefaultUsers();
  }

  // ==========================================================================
  // Retention & Lifecycle Methods
  // ==========================================================================

  public getNewsCategoryLifespanHours(category: ReportCategory): number | null {
    switch (category) {
      case 'ROAD_ACCIDENT':
      case 'THEFT':
        return 48; // 48h active retention
      case 'YOUTH_GANG_ACTIVITY':
      case 'DRUG_RELATED_CRIME':
      case 'TEEN_GANG':
      case 'DRUG_ACTIVITY':
        return 96; // 96h active retention for syndicates/hotspots
      case 'UNLIT_ROAD':
        return null; // Persistent hazard logic (no automated time decay)
      default:
        return 72; // Standard 72h
    }
  }

  public calculateReportExpiry(category: ReportCategory, referenceTime = new Date()): Date | null {
    const hours = this.getNewsCategoryLifespanHours(category);
    if (hours === null) {
      return null;
    }
    return new Date(referenceTime.getTime() + hours * 60 * 60 * 1000);
  }

  public purgeExpiredReports(now = new Date()): { purgedCount: number; purgedIds: string[] } {
    const purgedIds: string[] = [];
    for (const [id, report] of this.reports.entries()) {
      if (report.status === 'ACTIVE' && report.expiresAt !== null && report.expiresAt <= now) {
        report.status = 'PURGED';
        report.updatedAt = now;
        purgedIds.push(id);
      }
    }
    return { purgedCount: purgedIds.length, purgedIds };
  }

  // ==========================================================================
  // Spatial Query Methods
  // ==========================================================================

  public getReportsInBounds(
    bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number },
    categoryFilter?: ReportCategory | 'all',
    status: ReportStatus = 'ACTIVE'
  ): DbReport[] {
    const results: DbReport[] = [];
    for (const report of this.reports.values()) {
      if (status && report.status !== status) continue;
      if (categoryFilter && categoryFilter !== 'all' && report.category !== categoryFilter) continue;
      if (
        report.latitude >= bounds.minLat &&
        report.latitude <= bounds.maxLat &&
        report.longitude >= bounds.minLng &&
        report.longitude <= bounds.maxLng
      ) {
        results.push({ ...report });
      }
    }
    return results;
  }

  public findReportsWithinRadius(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    status: ReportStatus = 'ACTIVE'
  ): DbReport[] {
    const matches: DbReport[] = [];
    for (const report of this.reports.values()) {
      if (status && report.status !== status) continue;
      const distance = calculateHaversineDistanceMeters(
        latitude,
        longitude,
        report.latitude,
        report.longitude
      );
      if (distance <= radiusMeters) {
        matches.push({ ...report });
      }
    }
    return matches;
  }

  // ==========================================================================
  // Seeding Helpers for Tests
  // ==========================================================================

  public seedReport(data: Partial<DbReport> & { latitude: number; longitude: number; category: ReportCategory }): DbReport {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const expiresAt =
      data.expiresAt !== undefined
        ? data.expiresAt
        : this.calculateReportExpiry(data.category, now);

    const report: DbReport = {
      id,
      userId: data.userId || 'news-bot-user-id',
      title: data.title ?? null,
      category: data.category,
      severity: data.severity || 'MEDIUM',
      isNightReport: data.isNightReport ?? false,
      isGpsVerified: data.isGpsVerified ?? true,
      latitude: data.latitude,
      longitude: data.longitude,
      description: data.description ?? 'Test incident report description',
      upvotes: data.upvotes ?? 0,
      downvotes: data.downvotes ?? 0,
      status: data.status || 'ACTIVE',
      verificationStage: data.verificationStage || 'CLASSIFIED',
      citations: data.citations || [],
      expiresAt,
      sourceUrl: data.sourceUrl ?? null,
      sourceName: data.sourceName ?? null,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      threatStatus: (data as any).threatStatus ?? null,
      locationPrecision: (data as any).locationPrecision ?? null,
      district: (data as any).district ?? null,
      upazila: (data as any).upazila ?? null,
      ...data,
    };
    this.reports.set(id, report);
    return report;
  }

  public seedArticle(data: Partial<DbNewsArticle> & { guid: string; title: string; category: ReportCategory }): DbNewsArticle {
    const id = data.id || crypto.randomUUID();
    const article: DbNewsArticle = {
      id,
      guid: data.guid,
      title: data.title,
      sourceUrl: data.sourceUrl || `https://news.bd.test/${id}`,
      sourceName: data.sourceName || 'The Daily Star',
      publishedAt: data.publishedAt || new Date(),
      category: data.category,
      severity: data.severity || 'MEDIUM',
      latitude: data.latitude ?? 23.8103,
      longitude: data.longitude ?? 90.4125,
      reportId: data.reportId ?? null,
      createdAt: data.createdAt || new Date(),
    };
    this.articles.set(id, article);
    this.articles.set(data.guid, article);
    return { ...article };
  }

  // ==========================================================================
  // Prisma Compatibility Interface
  // ==========================================================================

  public report = {
    create: async ({ data }: { data: any }): Promise<DbReport> => {
      return this.seedReport(data);
    },
    findUnique: async ({ where }: { where: { id?: string } }): Promise<DbReport | null> => {
      if (!where.id) return null;
      const r = this.reports.get(where.id);
      return r ? { ...r } : null;
    },
    findMany: async (args: any = {}): Promise<DbReport[]> => {
      let items = Array.from(this.reports.values());
      const { where, orderBy, take } = args;
      if (where) {
        if (where.status) {
          if (typeof where.status === 'string') {
            items = items.filter((i) => i.status === where.status);
          } else if (where.status.in) {
            items = items.filter((i) => where.status.in.includes(i.status));
          }
        }
        if (where.category) {
          if (typeof where.category === 'string') {
            items = items.filter((i) => i.category === where.category);
          } else if (where.category.in) {
            items = items.filter((i) => where.category.in.includes(i.category));
          }
        }
        if (where.latitude && where.latitude.gte !== undefined && where.latitude.lte !== undefined) {
          items = items.filter((i) => i.latitude >= where.latitude.gte && i.latitude <= where.latitude.lte);
        }
        if (where.longitude && where.longitude.gte !== undefined && where.longitude.lte !== undefined) {
          items = items.filter((i) => i.longitude >= where.longitude.gte && i.longitude <= where.longitude.lte);
        }
        if (where.createdAt && where.createdAt.gte) {
          items = items.filter((i) => i.createdAt >= where.createdAt.gte);
        }
      }
      if (orderBy?.createdAt === 'desc') {
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (take && typeof take === 'number') {
        items = items.slice(0, take);
      }
      return items.map((i) => ({ ...i }));
    },
    update: async ({ where, data }: { where: { id: string }; data: any }): Promise<DbReport> => {
      const existing = this.reports.get(where.id);
      if (!existing) throw new Error(`Report not found: ${where.id}`);
      const updated: DbReport = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      this.reports.set(where.id, updated);
      return { ...updated };
    },
    updateMany: async ({ where, data }: { where: any; data: any }): Promise<{ count: number }> => {
      const candidates = await this.report.findMany({ where });
      for (const item of candidates) {
        await this.report.update({ where: { id: item.id }, data });
      }
      return { count: candidates.length };
    },
    delete: async ({ where }: { where: { id: string } }): Promise<DbReport> => {
      const existing = this.reports.get(where.id);
      if (!existing) throw new Error(`Report not found: ${where.id}`);
      this.reports.delete(where.id);
      return { ...existing };
    },
    deleteMany: async ({ where }: { where?: any } = {}): Promise<{ count: number }> => {
      const candidates = await this.report.findMany({ where });
      for (const item of candidates) {
        this.reports.delete(item.id);
      }
      return { count: candidates.length };
    },
    count: async ({ where }: { where?: any } = {}): Promise<number> => {
      const candidates = await this.report.findMany({ where });
      return candidates.length;
    },
  };

  public newsArticle = {
    create: async ({ data }: { data: any }): Promise<DbNewsArticle> => {
      return this.seedArticle(data);
    },
    findUnique: async ({ where }: { where: { id?: string; guid?: string } }): Promise<DbNewsArticle | null> => {
      const key = where.id || where.guid;
      if (!key) return null;
      const a = this.articles.get(key);
      return a ? { ...a } : null;
    },
    findMany: async (args: any = {}): Promise<DbNewsArticle[]> => {
      const items = Array.from(new Set(this.articles.values()));
      return items.map((i) => ({ ...i }));
    },
    count: async (): Promise<number> => {
      return new Set(this.articles.values()).size;
    },
    deleteMany: async (): Promise<{ count: number }> => {
      const size = new Set(this.articles.values()).size;
      this.articles.clear();
      return { count: size };
    },
  };

  public reportUpdate = {
    create: async ({ data }: { data: any }): Promise<DbReportUpdate> => {
      const id = data.id || crypto.randomUUID();
      const update: DbReportUpdate = {
        id,
        reportId: data.reportId,
        userId: data.userId,
        content: data.content,
        createdAt: data.createdAt || new Date(),
      };
      this.updates.set(id, update);
      return { ...update };
    },
    findMany: async ({ where }: { where: { reportId?: string } }): Promise<DbReportUpdate[]> => {
      let items = Array.from(this.updates.values());
      if (where?.reportId) {
        items = items.filter((u) => u.reportId === where.reportId);
      }
      return items.map((u) => ({ ...u }));
    },
  };

  public user = {
    create: async ({ data }: { data: any }): Promise<DbUser> => {
      const id = data.id || crypto.randomUUID();
      const user: DbUser = {
        id,
        email: data.email,
        role: data.role || 'USER',
        isVerified: data.isVerified ?? false,
        trustScore: data.trustScore ?? 0,
        isBanned: data.isBanned ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, user);
      this.users.set(data.email, user);
      return { ...user };
    },
    findUnique: async ({ where }: { where: { id?: string; email?: string } }): Promise<DbUser | null> => {
      const key = where.id || where.email;
      if (!key) return null;
      const u = this.users.get(key);
      return u ? { ...u } : null;
    },
  };
}
