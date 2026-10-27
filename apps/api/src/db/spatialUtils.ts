import { Prisma, ReportCategory, ReportSeverity } from '@prisma/client';
import { prisma } from './prisma';
import crypto from 'crypto';

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
 * Computes deterministic cryptographic location fuzzing offset (40 to 80 meters)
 * based on HMAC-SHA256 of the report ID.
 * Protects whistleblower / citizen anonymity from retaliation while keeping the marker stable.
 */
export const getFuzzedCoordinates = (
  reportId: string,
  latitude: number,
  longitude: number
): { latitude: number; longitude: number; fuzzedRadiusMeters: number } => {
  const hash = crypto.createHmac('sha256', 'bd-public-safety-fuzzing-salt').update(reportId).digest('hex');
  const angleInt = parseInt(hash.slice(0, 8), 16);
  const distInt = parseInt(hash.slice(8, 16), 16);

  const angleRad = ((angleInt % 360) * Math.PI) / 180;
  // Offset between 40 and 80 meters
  const distanceMeters = 40 + (distInt % 41);

  // 1 degree latitude ~ 111,320 meters
  const deltaLat = (distanceMeters * Math.cos(angleRad)) / 111320;
  // 1 degree longitude ~ 111,320 * cos(lat) meters
  const deltaLng = (distanceMeters * Math.sin(angleRad)) / (111320 * Math.cos((latitude * Math.PI) / 180));

  return {
    latitude: Number((latitude + deltaLat).toFixed(6)),
    longitude: Number((longitude + deltaLng).toFixed(6)),
    fuzzedRadiusMeters: 150
  };
};

export const getReportsInBounds = async (bounds: BoundingBox, filters?: ReportFilterOptions) => {
  // PostGIS ST_MakeEnvelope signature: ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
  // Base conditions: active, within envelope, and not yet expired in real time
  const whereConditions: Prisma.Sql[] = [
    Prisma.sql`status = 'ACTIVE'`,
    Prisma.sql`"expiresAt" > NOW()`,
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

  const rawReports: any[] = await prisma.$queryRaw`
    SELECT 
      id, category, severity, "isNightReport", latitude, longitude, description, upvotes, downvotes, status, "expiresAt", "createdAt",
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

  // Apply deterministic cryptographic location fuzzing (40-80m) to protect citizen reporter privacy
  return rawReports.map((r) => {
    const fuzzed = getFuzzedCoordinates(r.id, r.latitude, r.longitude);
    return {
      ...r,
      latitude: fuzzed.latitude,
      longitude: fuzzed.longitude,
      fuzzedRadiusMeters: fuzzed.fuzzedRadiusMeters
    };
  });
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
