import { prisma } from '../db/prisma';
import { emitStatsUpdated, hasInitializedIO } from '../sockets';

export interface PlatformStats {
  totalReports: number;
  activeReports: number;
  resolvedReports: number;
  criticalThreats: number;
  totalCitizens: number;
  verifiedCitizens: number;
  safeHavens: number;
  totalVotes: number;
  lastActiveAt: string;
  timestamp: string;
}

/**
 * Aggregates live, database-backed platform metrics directly from Supabase PostgreSQL.
 * Strict Single Source of Truth: Never returns mock or hardcoded statistics.
 */
export const getPlatformStats = async (): Promise<PlatformStats> => {
  const now = new Date();

  const [
    totalReports,
    activeReports,
    resolvedReports,
    criticalThreats,
    totalCitizens,
    verifiedCitizens,
    safeHavens,
    totalVotes,
    latestReport,
  ] = await prisma.$transaction([
    prisma.report.count(),
    prisma.report.count({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
    }),
    prisma.report.count({
      where: {
        status: 'RESOLVED',
      },
    }),
    prisma.report.count({
      where: {
        status: 'ACTIVE',
        severity: 'HIGH',
        expiresAt: { gt: now },
      },
    }),
    prisma.user.count({
      where: {
        isBanned: false,
      },
    }),
    prisma.user.count({
      where: {
        isVerified: true,
        isBanned: false,
      },
    }),
    prisma.safeZone.count(),
    prisma.vote.count(),
    prisma.report.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalReports,
    activeReports,
    resolvedReports,
    criticalThreats,
    totalCitizens,
    verifiedCitizens,
    safeHavens,
    totalVotes,
    lastActiveAt: latestReport?.createdAt ? latestReport.createdAt.toISOString() : now.toISOString(),
    timestamp: now.toISOString(),
  };
};

let isBroadcastingStats = false;
let hasPendingStatsBroadcast = false;

/**
 * Coalesces concurrent stats recalculations so rapid mutations (e.g. RSS batch ingestion)
 * run at most one active query plus one trailing refresh and never block or fail callers.
 */
export const broadcastPlatformStats = async (): Promise<void> => {
  if (!hasInitializedIO()) return;
  if (isBroadcastingStats) {
    hasPendingStatsBroadcast = true;
    return;
  }

  isBroadcastingStats = true;
  try {
    do {
      hasPendingStatsBroadcast = false;
      const stats = await getPlatformStats();
      emitStatsUpdated(stats);
    } while (hasPendingStatsBroadcast && hasInitializedIO());
  } catch (err) {
    console.warn('[Stats Broadcaster] Failed to broadcast STATS_UPDATED:', err);
  } finally {
    isBroadcastingStats = false;
  }
};
