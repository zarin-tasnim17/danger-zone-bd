import { prisma } from '../db/prisma';

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
