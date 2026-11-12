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
    reportStatsRows,
    totalCitizens,
    verifiedCitizens,
    safeHavens,
    totalVotes,
  ] = await prisma.$transaction([
    prisma.$queryRaw<
      Array<{
        totalReports: number;
        activeReports: number;
        resolvedReports: number;
        criticalThreats: number;
        latestCreatedAt: Date | null;
      }>
    >`
      SELECT
        COUNT(*)::int AS "totalReports",
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND "expiresAt" > NOW())::int AS "activeReports",
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS "resolvedReports",
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND severity = 'HIGH' AND "expiresAt" > NOW())::int AS "criticalThreats",
        MAX("createdAt") AS "latestCreatedAt"
      FROM "Report"
      WHERE location IS NOT NULL
    `,
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
  ]);

  const reportStats = reportStatsRows[0] ?? {
    totalReports: 0,
    activeReports: 0,
    resolvedReports: 0,
    criticalThreats: 0,
    latestCreatedAt: null,
  };

  return {
    totalReports: reportStats.totalReports,
    activeReports: reportStats.activeReports,
    resolvedReports: reportStats.resolvedReports,
    criticalThreats: reportStats.criticalThreats,
    totalCitizens,
    verifiedCitizens,
    safeHavens,
    totalVotes,
    lastActiveAt: reportStats.latestCreatedAt
      ? new Date(reportStats.latestCreatedAt).toISOString()
      : now.toISOString(),
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
