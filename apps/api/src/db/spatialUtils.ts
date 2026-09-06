import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export const getReportsInBounds = async (bounds: BoundingBox) => {
  // PostGIS ST_MakeEnvelope signature: ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)
  const reports = await prisma.$queryRaw`
    SELECT 
      id, category, severity, "isNightReport", latitude, longitude, description, upvotes, downvotes, status, "expiresAt", "createdAt"
    FROM "Report"
    WHERE status = 'ACTIVE' 
      AND location && ST_MakeEnvelope(
        ${bounds.minLng}, ${bounds.minLat},
        ${bounds.maxLng}, ${bounds.maxLat},
        4326
      )
  `;
  return reports;
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
