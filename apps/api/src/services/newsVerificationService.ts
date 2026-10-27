import { prisma } from '../db/prisma';
import { emitReportVerified } from '../sockets';

export interface NewsIncidentCrossVerifyInput {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  sourceName: string;
  sourceUrl: string;
  title: string;
}

export interface CrossVerifyResult {
  matchedCount: number;
  verifiedReportIds: string[];
}

/**
 * Cross-references a newly ingested news incident against active crowdsourced citizen reports
 * within a 500-meter radius submitted within the last 24 hours.
 * Automatically marks matching reports as "Verified by Press" and awards +5 trustScore to the citizen reporter.
 */
export const crossVerifyCitizenReports = async (
  news: NewsIncidentCrossVerifyInput
): Promise<CrossVerifyResult> => {
  try {
    // 1. PostGIS spatial query checking for citizen reports within 500m in the last 24h
    // Uses COALESCE to gracefully handle both populated geography locations and fallback lat/lng points
    const matchedReports: any[] = await prisma.$queryRaw`
      SELECT id, "userId", description
      FROM "Report"
      WHERE status = 'ACTIVE'
        AND id != ${news.id}
        AND "sourceUrl" IS NULL
        AND ST_DWithin(
          COALESCE(location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint(${news.longitude}, ${news.latitude}), 4326)::geography,
          500
        )
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
    `;

    if (!matchedReports || matchedReports.length === 0) {
      return { matchedCount: 0, verifiedReportIds: [] };
    }

    const verifiedIds: string[] = [];

    // 2. Elevate matched reports & award trust score bonus
    for (const report of matchedReports) {
      const verificationTag = `[Verified by Press: ${news.sourceName}]`;

      // Avoid double-tagging
      if (report.description?.includes(verificationTag)) {
        continue;
      }

      const updatedDescription = report.description
        ? `${report.description} ${verificationTag}`
        : verificationTag;

      await prisma.$transaction([
        // Update report with verified tag
        prisma.report.update({
          where: { id: report.id },
          data: { description: updatedDescription },
        }),
        // Award citizen +5 Trust Score reputation points
        prisma.user.update({
          where: { id: report.userId },
          data: { trustScore: { increment: 5 } },
        }),
      ]);

      // Broadcast real-time verification event to connected clients
      emitReportVerified({
        reportId: report.id,
        verifiedBy: news.sourceName,
        sourceUrl: news.sourceUrl,
        articleTitle: news.title,
      });

      verifiedIds.push(report.id);
      console.log(
        `[News Cross-Verification] 📰 Citizen report ${report.id} confirmed by press story "${news.title}". +5 TrustScore awarded to user ${report.userId}.`
      );
    }

    return {
      matchedCount: verifiedIds.length,
      verifiedReportIds: verifiedIds,
    };
  } catch (error) {
    console.error('[News Cross-Verification] Error checking citizen matches:', error);
    return { matchedCount: 0, verifiedReportIds: [] };
  }
};
