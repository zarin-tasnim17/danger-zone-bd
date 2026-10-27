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
 * Bans a user account and records an immutable entry in ModerationLog.
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

  // Atomic transaction: suspend user and record immutable moderation log
  const [updatedUser, log] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: true },
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
