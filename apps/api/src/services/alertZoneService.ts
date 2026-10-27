import { prisma } from '../db/prisma';

export const MAX_ZONE_AREA_SQ_METERS = 25_000_000; // 25 square kilometers
export const MAX_ZONES_PER_USER = 5;

export interface AlertZoneOutput {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  area: any; // Parsed GeoJSON geometry
}

/**
 * Validates polygon coordinates ring structure and bounding values
 */
export const validatePolygonCoordinates = (coordinates: [number, number][]): void => {
  if (!Array.isArray(coordinates) || coordinates.length < 4) {
    throw new Error('Polygon must contain at least 4 coordinate pairs (3 vertices + 1 closing vertex).');
  }

  // Ring closure check: first point must equal last point
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error('Polygon ring must be closed: the first and last coordinates must be identical.');
  }

  // Bounds check: WGS84 range [longitude, latitude]
  for (const [lng, lat] of coordinates) {
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      throw new Error('All coordinates must be valid numbers.');
    }
    if (lng < -180 || lng > 180) {
      throw new Error(`Longitude ${lng} is out of bounds (-180 to 180).`);
    }
    if (lat < -90 || lat > 90) {
      throw new Error(`Latitude ${lat} is out of bounds (-90 to 90).`);
    }
  }
};

/**
 * Creates and persists a PostGIS geofence polygon for a user
 */
export const createAlertZone = async (
  userId: string,
  name: string,
  coordinates: [number, number][]
): Promise<AlertZoneOutput> => {
  validatePolygonCoordinates(coordinates);

  // 1. Quota Check: Max active zones per user
  const countResult: any[] = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count 
    FROM "UserAlertZone" 
    WHERE "userId" = ${userId} AND "isActive" = true
  `;
  const currentCount = countResult[0]?.count ?? 0;
  if (currentCount >= MAX_ZONES_PER_USER) {
    throw new Error(`You have reached the maximum allowed active alert zones (${MAX_ZONES_PER_USER}).`);
  }

  // 2. Format GeoJSON Polygon
  const geoJson = {
    type: 'Polygon',
    coordinates: [coordinates]
  };
  const geoJsonStr = JSON.stringify(geoJson);

  // 3. PostGIS Geodesic Area Calculation & Anti-Abuse Cap (25 km²)
  const areaResult: any[] = await prisma.$queryRaw`
    SELECT ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326)::geography) as "sqMeters"
  `;
  const sqMeters = parseFloat(areaResult[0]?.sqMeters ?? '0');

  if (sqMeters > MAX_ZONE_AREA_SQ_METERS) {
    throw new Error(
      `Zone area of ${(sqMeters / 1_000_000).toFixed(2)} km² exceeds the maximum limit of 25 km² (anti-abuse cap).`
    );
  }

  // 4. Insert into database using native PostGIS conversion
  const inserted: any[] = await prisma.$queryRaw`
    INSERT INTO "UserAlertZone" (id, "userId", name, area, "isActive", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      ${userId},
      ${name},
      ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonStr}), 4326)::geography,
      true,
      NOW(),
      NOW()
    )
    RETURNING id, "userId", name, "isActive", "createdAt", "updatedAt", ST_AsGeoJSON(area) as area
  `;

  const zone = inserted[0];
  return {
    ...zone,
    area: JSON.parse(zone.area)
  };
};

/**
 * Fetches all active alert zones for a user with parsed GeoJSON boundaries
 */
export const getUserAlertZones = async (userId: string): Promise<AlertZoneOutput[]> => {
  const zones: any[] = await prisma.$queryRaw`
    SELECT 
      id, "userId", name, "isActive", "createdAt", "updatedAt",
      ST_AsGeoJSON(area) as area
    FROM "UserAlertZone"
    WHERE "userId" = ${userId} AND "isActive" = true
    ORDER BY "createdAt" DESC
  `;

  return zones.map((z) => ({
    ...z,
    area: JSON.parse(z.area)
  }));
};

/**
 * Deletes an alert zone verifying ownership
 */
export const deleteAlertZone = async (userId: string, zoneId: string): Promise<boolean> => {
  // Check if zone exists first
  const existing: any[] = await prisma.$queryRaw`
    SELECT id, "userId" FROM "UserAlertZone" WHERE id = ${zoneId}
  `;

  if (existing.length === 0) {
    throw new Error('Alert zone not found');
  }

  if (existing[0].userId !== userId) {
    const error: any = new Error('You do not have permission to delete this alert zone');
    error.statusCode = 403;
    throw error;
  }

  await prisma.$executeRaw`
    DELETE FROM "UserAlertZone" WHERE id = ${zoneId} AND "userId" = ${userId}
  `;

  return true;
};

/**
 * Finds all active user alert zones intersecting with a given coordinate point.
 * Leverages the GiST index on UserAlertZone.area for fast spatial lookups.
 */
export const findIntersectingAlertZones = async (
  latitude: number,
  longitude: number
): Promise<{ zoneId: string; userId: string; zoneName: string }[]> => {
  const matches: any[] = await prisma.$queryRaw`
    SELECT 
      z.id as "zoneId",
      z."userId",
      z.name as "zoneName"
    FROM "UserAlertZone" z
    WHERE z."isActive" = true
      AND ST_Intersects(
        z.area,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      )
  `;

  return matches;
};
