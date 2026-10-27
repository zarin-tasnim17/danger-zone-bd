import { prisma } from '../db/prisma';
import { emitReportPurged } from '../sockets';

export interface ModerationLogOutput {
  id: string;
  adminId: string;
  targetUserId?: string | null;
  targetReportId?: string | null;
  action: 'BAN_USER' | 'UNBAN_USER' | 'PURGE_REPORT' | 'VERIFY_USER';
  reason: string;
  createdAt: Date;
}

/**
 * Bans a user account, revokes all active refresh tokens, and records an immutable entry in ModerationLog.
 */
export const banUser = async (
  adminId: string,
  targetUserId: string,
  reason: string
) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
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

  return { user: updatedUser, log };
};

/**
 * Unbans a user account and records an immutable entry in ModerationLog.
 */
export const unbanUser = async (
  adminId: string,
  targetUserId: string,
  reason: string
) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    const error: any = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (targetUser.isBanned) {
    const error: any = new Error('User is not banned');
    error.statusCode = 400;
    throw error;
  }

  // Atomic transaction: restore user and record immutable moderation log
  const [updatedUser, log] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: false },
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

  return { report: updatedReport, log };
};

/**
 * Retrieves paginated audit logs of all administrative actions.
 * Strictly read-only; no endpoints exist to update or delete moderation logs.
 */
export const getModerationLogs = async (page: number = 1, limit: number = 20) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const [total, logs] = await prisma.$transaction([
    prisma.moderationLog.count(),
    prisma.moderationLog.findMany({
      skip,
      take: safeLimit,
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
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
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
