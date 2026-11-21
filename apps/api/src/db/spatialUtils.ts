import { Prisma, ReportCategory, ReportSeverity } from '@prisma/client';
import { prisma } from './prisma';
import { isActiveThreatIncident } from '@repo/shared';

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface ReportFilterOptions {
  category?: ReportCategory;
  severity?: ReportSeverity;
  isNightReport?: boolean;
}

/**
 * Returns exact coordinates for pin accuracy.
 * Previously applied an artificial 40 to 80 meters offset which caused danger pins
 * to appear off-site from the user's actual GPS location.
 * Now preserves exact coordinates with zero offset.
 */
export const getFuzzedCoordinates = (
  _reportId: string,
  latitude: number,
  longitude: number
): { latitude: number; longitude: number; fuzzedRadiusMeters: number } => {
  return {
    latitude: Number(Number(latitude).toFixed(6)),
    longitude: Number(Number(longitude).toFixed(6)),
    fuzzedRadiusMeters: 150
  };
};

export const getReportsInBounds = async (bounds: BoundingBox, filters?: ReportFilterOptions) => {
  // PostGIS ST_MakeEnvelope signature: ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
  // Base conditions: active, within envelope, threatStatus active, and not yet expired in real time
  const whereConditions: Prisma.Sql[] = [
    Prisma.sql`status = 'ACTIVE'`,
    Prisma.sql`"expiresAt" > NOW()`,
    Prisma.sql`"threatStatus" = 'ACTIVE'`,
    Prisma.sql`("locationPrecision" IS NULL OR "locationPrecision" != 'AMBIGUOUS')`,
    Prisma.sql`location && ST_MakeEnvelope(
      ${bounds.minLng}, ${bounds.minLat},
      ${bounds.maxLng}, ${bounds.maxLat},
      4326
    )`
  ];

  if (filters?.category) {
    whereConditions.push(Prisma.sql`category = ${filters.category}::"ReportCategory"`);
  }

  if (filters?.severity) {
    whereConditions.push(Prisma.sql`severity = ${filters.severity}::"ReportSeverity"`);
  }

  if (typeof filters?.isNightReport === 'boolean') {
    whereConditions.push(Prisma.sql`"isNightReport" = ${filters.isNightReport}`);
  }

  const whereClause = Prisma.join(whereConditions, ' AND ');

  let rawReports: any[];
  try {
    rawReports = await prisma.$queryRaw`
      SELECT 
        id, category, severity, "isNightReport", "isGpsVerified", latitude, longitude, description, upvotes, downvotes, status, "expiresAt", "createdAt", "sourceUrl", "sourceName",
        "verificationStage", citations, "locationPrecision", district, upazila, "threatStatus", "activeTimeStart", "activeTimeEnd",
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', m.id, 'blurredUrl', m."blurredUrl", 'createdAt', m."createdAt"))
            FROM "ReportMedia" m
            WHERE m."reportId" = "Report".id
          ),
          '[]'::json
        ) as media
      FROM "Report"
      WHERE ${whereClause}
      ORDER BY "createdAt" DESC
    `;
  } catch (err: any) {
    // If activeTimeStart / activeTimeEnd column is missing in PostgreSQL (Code 42703), self-heal and fallback
    if (
      err?.code === '42703' ||
      String(err?.message || '').includes('activeTimeStart') ||
      String(err?.message || '').includes('activeTimeEnd')
    ) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeStart" TEXT;
          ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeEnd" TEXT;
        `);
        rawReports = await prisma.$queryRaw`
          SELECT 
            id, category, severity, "isNightReport", "isGpsVerified", latitude, longitude, description, upvotes, downvotes, status, "expiresAt", "createdAt", "sourceUrl", "sourceName",
            "verificationStage", citations, "locationPrecision", district, upazila, "threatStatus", "activeTimeStart", "activeTimeEnd",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', m.id, 'blurredUrl', m."blurredUrl", 'createdAt', m."createdAt"))
                FROM "ReportMedia" m
                WHERE m."reportId" = "Report".id
              ),
              '[]'::json
            ) as media
          FROM "Report"
          WHERE ${whereClause}
          ORDER BY "createdAt" DESC
        `;
      } catch {
        // Safe fallback without referencing the physical columns directly
        rawReports = await prisma.$queryRaw`
          SELECT 
            id, category, severity, "isNightReport", "isGpsVerified", latitude, longitude, description, upvotes, downvotes, status, "expiresAt", "createdAt", "sourceUrl", "sourceName",
            "verificationStage", citations, "locationPrecision", district, upazila, "threatStatus",
            NULL as "activeTimeStart", NULL as "activeTimeEnd",
            COALESCE(
              (
                SELECT json_agg(json_build_object('id', m.id, 'blurredUrl', m."blurredUrl", 'createdAt', m."createdAt"))
                FROM "ReportMedia" m
                WHERE m."reportId" = "Report".id
              ),
              '[]'::json
            ) as media
          FROM "Report"
          WHERE ${whereClause}
          ORDER BY "createdAt" DESC
        `;
      }
    } else {
      throw err;
    }
  }

  return rawReports
    .filter((r) => isActiveThreatIncident(r))
    .map((r) => {
      const fuzzed = getFuzzedCoordinates(r.id, r.latitude, r.longitude);
      return {
        ...r,
        latitude: fuzzed.latitude,
        longitude: fuzzed.longitude,
        fuzzedRadiusMeters: fuzzed.fuzzedRadiusMeters
      };
    });
};

// Populate the PostGIS geography point on a Report row (safe inside Prisma interactive transactions)
export const setReportLocation = async (
  db: Prisma.TransactionClient | typeof prisma,
  reportId: string,
  latitude: number,
  longitude: number
): Promise<void> => {
  await db.$executeRaw`
    UPDATE "Report"
    SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    WHERE id = ${reportId}
  `;
};

// Check if a point is within X meters of another point
export const isWithinDistance = async (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  distanceMeters: number
): Promise<boolean> => {
  const result: any[] = await prisma.$queryRaw`
    SELECT ST_DWithin(
      ST_SetSRID(ST_MakePoint(${lng1}, ${lat1}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${lng2}, ${lat2}), 4326)::geography,
      ${distanceMeters}
    ) as "isWithin"
  `;
  return result[0]?.isWithin ?? false;
};

export { validateCoordinateHierarchy } from '../services/geocodingService';
