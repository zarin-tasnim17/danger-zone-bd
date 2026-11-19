import { ModerationAction, ReportCategory, ReportSeverity, ReportStatus, Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { emitReportPurged } from '../sockets';
import { broadcastPlatformStats } from './statsService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const findUserByIdentifier = async (identifier: string) => {
  const trimmed = identifier.trim();
  if (UUID_REGEX.test(trimmed)) {
    const user = await prisma.user.findUnique({ where: { id: trimmed } });
    if (user) return user;
  }
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: trimmed.toLowerCase(), mode: 'insensitive' } },
        { anonymousId: trimmed },
        { phoneNumber: trimmed },
      ],
    },
  });
};

export interface ModerationLogOutput {
  id: string;
  adminId: string;
  targetUserId?: string | null;
  targetReportId?: string | null;
  action: ModerationAction;
  reason: string;
  createdAt: Date;
}

const SAFE_ADMIN_USER_SELECT = {
  id: true,
  email: true,
  phoneNumber: true,
  anonymousId: true,
  role: true,
  isVerified: true,
  trustScore: true,
  isBanned: true,
  lastReportAt: true,
  createdAt: true,
} as const;

/**
 * Bans a user account, revokes all active refresh tokens, and records an immutable entry in ModerationLog.
 * Accepts either UUID, email, phone number, or anonymousId.
 */
export const banUser = async (
  adminId: string,
  targetIdentifier: string,
  reason: string
) => {
  const targetUser = await findUserByIdentifier(targetIdentifier);

  if (!targetUser) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const targetUserId = targetUser.id;

  if (targetUser.id === adminId) {
    const error: any = new Error('Administrators cannot ban their own account');
    error.statusCode = 403;
    throw error;
  }

  if (targetUser.role === 'ADMIN') {
    const error: any = new Error('Administrators cannot ban another administrator account');
    error.statusCode = 403;
    throw error;
  }

  if (targetUser.isBanned) {
    const error: any = new Error('User is already banned');
    error.statusCode = 400;
    throw error;
  }

  // Atomic transaction: suspend user, globally revoke all active sessions, and record immutable moderation log
  const [updatedUser, , log] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: true },
      select: SAFE_ADMIN_USER_SELECT,
    }),
    prisma.refreshToken.updateMany({
      where: { userId: targetUserId, isRevoked: false },
      data: { isRevoked: true },
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetUserId,
        action: 'BAN_USER',
        reason,
      },
    }),
  ]);

  void broadcastPlatformStats();

  return { user: updatedUser, log };
};

/**
 * Unbans a user account and records an immutable entry in ModerationLog.
 * Accepts either UUID, email, phone number, or anonymousId.
 */
export const unbanUser = async (
  adminId: string,
  targetIdentifier: string,
  reason: string
) => {
  const targetUser = await findUserByIdentifier(targetIdentifier);

  if (!targetUser) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const targetUserId = targetUser.id;

  if (!targetUser.isBanned) {
    const error: any = new Error('User is not banned');
    error.statusCode = 400;
    throw error;
  }

  // Atomic transaction: restore user and record immutable moderation log
  const [updatedUser, log] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: false },
      select: SAFE_ADMIN_USER_SELECT,
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetUserId,
        action: 'UNBAN_USER',
        reason,
      },
    }),
  ]);

  void broadcastPlatformStats();

  return { user: updatedUser, log };
};

/**
 * Manually purges a report and records an immutable entry in ModerationLog.
 * Emits real-time REPORT_PURGED event to active map clients.
 */
export const purgeReport = async (
  adminId: string,
  targetReportId: string,
  reason: string
) => {
  const targetReport = await prisma.report.findUnique({
    where: { id: targetReportId },
  });

  if (!targetReport) {
    const error: any = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetReport.status === 'PURGED') {
    const error: any = new Error('Report is already purged');
    error.statusCode = 400;
    throw error;
  }

  // Atomic transaction: purge report and record immutable moderation log
  const [updatedReport, log] = await prisma.$transaction([
    prisma.report.update({
      where: { id: targetReportId },
      data: { status: 'PURGED' },
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetReportId,
        action: 'PURGE_REPORT',
        reason,
      },
    }),
  ]);

  // Broadcast real-time PURGED event to all active clients
  emitReportPurged({
    reportId: targetReportId,
    reason: `ADMIN_PURGED: ${reason}`,
  });

  void broadcastPlatformStats();

  return { report: updatedReport, log };
};

/**
 * Retrieves paginated audit logs of all administrative actions.
 * Strictly read-only; no endpoints exist to update or delete moderation logs.
 */
export const getModerationLogs = async (
  page: number = 1,
  limit: number = 20,
  action?: ModerationAction
) => {
  if (!Number.isInteger(page) || page < 1) {
    const error: any = new Error('page must be a positive integer');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error: any = new Error('limit must be an integer between 1 and 100');
    error.statusCode = 400;
    throw error;
  }

  const skip = (page - 1) * limit;
  const where = action ? { action } : undefined;

  const [total, logs] = await prisma.$transaction([
    prisma.moderationLog.count({ where }),
    prisma.moderationLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { id: true, email: true, role: true },
        },
        targetUser: {
          select: { id: true, email: true, role: true, isBanned: true },
        },
        targetReport: {
          select: { id: true, category: true, severity: true, status: true },
        },
      },
    }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Calculates 30-day incident trends, frequency breakdown by category and severity,
 * night-time proportions, and daily timeline distribution for administrative analytics.
 */
export const getHazardTrends = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalReports,
    byCategory,
    bySeverity,
    byStatus,
    nightReportsCount,
    dailyTimeline
  ] = await prisma.$transaction([
    // Total reports in last 30 days
    prisma.report.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    // Breakdown by category
    prisma.report.groupBy({
      by: ['category'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      orderBy: { category: 'asc' }
    }),
    // Breakdown by severity
    prisma.report.groupBy({
      by: ['severity'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      orderBy: { severity: 'asc' }
    }),
    // Breakdown by status
    prisma.report.groupBy({
      by: ['status'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      orderBy: { status: 'asc' }
    }),
    // Total night-time reports
    prisma.report.count({
      where: { createdAt: { gte: thirtyDaysAgo }, isNightReport: true }
    }),
    // Daily incident timeline
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as day,
        COUNT(*)::bigint as count
      FROM "Report"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt") ASC
    `
  ]);

  const categoryMap: Record<string, number> = {};
  for (const item of byCategory) {
    categoryMap[item.category] = (item as any)._count?._all ?? 0;
  }

  const severityMap: Record<string, number> = {};
  for (const item of bySeverity) {
    severityMap[item.severity] = (item as any)._count?._all ?? 0;
  }

  const statusMap: Record<string, number> = {};
  for (const item of byStatus) {
    statusMap[item.status] = (item as any)._count?._all ?? 0;
  }

  const timelineFormatted = dailyTimeline.map((row) => ({
    date: row.day,
    count: Number(row.count)
  }));

  return {
    timeframe: '30_DAYS',
    startDate: thirtyDaysAgo.toISOString(),
    totalReports,
    nightReportsCount,
    nightReportPercentage: totalReports > 0 ? Number(((nightReportsCount / totalReports) * 100).toFixed(1)) : 0,
    breakdown: {
      byCategory: categoryMap,
      bySeverity: severityMap,
      byStatus: statusMap
    },
    timeline: timelineFormatted
  };
};

/**
 * Promotes a report to ADMIN_VERIFIED stage and records an immutable entry in ModerationLog.
 */
export const verifyReport = async (
  adminId: string,
  targetReportId: string,
  reason: string = 'Incident verified by administrator'
) => {
  const targetReport = await prisma.report.findUnique({
    where: { id: targetReportId },
  });

  if (!targetReport) {
    const error: any = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetReport.status === 'PURGED') {
    const error: any = new Error('Cannot verify a purged report');
    error.statusCode = 400;
    throw error;
  }

  const [updatedReport, log] = await prisma.$transaction([
    prisma.report.update({
      where: { id: targetReportId },
      data: { verificationStage: 'ADMIN_VERIFIED' },
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetReportId,
        action: 'VERIFY_INCIDENT',
        reason,
      },
    }),
  ]);

  return { report: updatedReport, log };
};

/**
 * Reclassifies a report's category and/or severity with an immutable audit log entry.
 */
export const reclassifyReport = async (
  adminId: string,
  targetReportId: string,
  params: {
    category?: ReportCategory;
    severity?: ReportSeverity;
    reason?: string;
  }
) => {
  const targetReport = await prisma.report.findUnique({
    where: { id: targetReportId },
  });

  if (!targetReport) {
    const error: any = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetReport.status === 'PURGED') {
    const error: any = new Error('Cannot reclassify a purged report');
    error.statusCode = 400;
    throw error;
  }

  if (!params.category && !params.severity) {
    const error: any = new Error('At least one of category or severity must be provided');
    error.statusCode = 400;
    throw error;
  }

  const dataToUpdate: any = {};
  if (params.category) dataToUpdate.category = params.category;
  if (params.severity) dataToUpdate.severity = params.severity;

  const reason = params.reason || `Report reclassified: ${JSON.stringify(dataToUpdate)}`;

  const [updatedReport, log] = await prisma.$transaction([
    prisma.report.update({
      where: { id: targetReportId },
      data: dataToUpdate,
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetReportId,
        action: 'RECLASSIFY_REPORT',
        reason,
      },
    }),
  ]);

  return { report: updatedReport, log };
};

export interface GetAdminUsersParams {
  search?: string;
  role?: Role;
  isBanned?: boolean;
  isVerified?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'trustScore' | 'lastReportAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Retrieves paginated users list with search by email, phone, anonymousId, or UUID,
 * with role/status filters and aggregated activity metrics.
 */
export const getAdminUsers = async (params: GetAdminUsersParams = {}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const whereConditions: any[] = [];

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const isUuid = UUID_REGEX.test(term);
    const searchConditions: any[] = [
      { email: { contains: term, mode: 'insensitive' } },
      { anonymousId: { contains: term, mode: 'insensitive' } },
      { phoneNumber: { contains: term } },
    ];
    if (isUuid) {
      searchConditions.push({ id: term });
    }
    whereConditions.push({ OR: searchConditions });
  }

  if (params.role) {
    whereConditions.push({ role: params.role });
  }

  if (typeof params.isBanned === 'boolean') {
    whereConditions.push({ isBanned: params.isBanned });
  }

  if (typeof params.isVerified === 'boolean') {
    whereConditions.push({ isVerified: params.isVerified });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const validSortFields = ['createdAt', 'trustScore', 'lastReportAt'] as const;
  const sortField = validSortFields.includes(params.sortBy as any) ? params.sortBy! : 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: sortOrder },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        anonymousId: true,
        role: true,
        isVerified: true,
        trustScore: true,
        isBanned: true,
        lastReportAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reports: true,
            votes: true,
            verifications: true,
          },
        },
      },
    }),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export interface GetAdminReportsParams {
  search?: string;
  category?: ReportCategory;
  severity?: ReportSeverity;
  status?: ReportStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

/**
 * Retrieves paginated reports for moderation with rich metadata, including
 * reporter account details, verification status, and attached evidence.
 */
export const getAdminReports = async (params: GetAdminReportsParams = {}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const whereConditions: any[] = [];

  if (params.category) {
    whereConditions.push({ category: params.category });
  }
  if (params.severity) {
    whereConditions.push({ severity: params.severity });
  }
  if (params.status) {
    whereConditions.push({ status: params.status });
  }
  if (params.userId) {
    whereConditions.push({ userId: params.userId });
  }
  if (params.search && params.search.trim()) {
    whereConditions.push({
      description: { contains: params.search.trim(), mode: 'insensitive' },
    });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const [total, reports] = await prisma.$transaction([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        severity: true,
        status: true,
        verificationStage: true,
        description: true,
        latitude: true,
        longitude: true,
        upvotes: true,
        downvotes: true,
        isNightReport: true,
        isGpsVerified: true,
        sourceName: true,
        sourceUrl: true,
        createdAt: true,
        expiresAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            anonymousId: true,
            role: true,
            trustScore: true,
            isBanned: true,
            isVerified: true,
          },
        },
        media: {
          select: {
            id: true,
            blurredUrl: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return {
    reports,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
