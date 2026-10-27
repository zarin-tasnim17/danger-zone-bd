import { prisma } from '../db/prisma';
import { SafeZoneType, Prisma } from '@prisma/client';
import { BoundingBox } from '../db/spatialUtils';

export interface SafeZoneInput {
  name: string;
  type: SafeZoneType;
  latitude: number;
  longitude: number;
}

/**
 * Default prominent safe havens across Bangladesh for immediate public safety utility
 */
const DEFAULT_BANGLADESH_SAFE_ZONES: SafeZoneInput[] = [
  // Hospitals
  {
    name: 'Khulna Medical College Hospital',
    type: 'HOSPITAL',
    latitude: 22.8456,
    longitude: 89.5403,
  },
  {
    name: 'Dhaka Medical College & Hospital',
    type: 'HOSPITAL',
    latitude: 23.7259,
    longitude: 90.3976,
  },
  {
    name: 'Chittagong Medical College Hospital',
    type: 'HOSPITAL',
    latitude: 22.3592,
    longitude: 91.8267,
  },
  {
    name: 'Rajshahi Medical College Hospital',
    type: 'HOSPITAL',
    latitude: 24.3707,
    longitude: 88.5833,
  },
  {
    name: 'Sylhet MAG Osmani Medical College Hospital',
    type: 'HOSPITAL',
    latitude: 24.8998,
    longitude: 91.8541,
  },
  // Police Stations & Police Boxes
  {
    name: 'Shib Bari Police Box, Khulna',
    type: 'POLICE_BOX',
    latitude: 22.8205,
    longitude: 89.5539,
  },
  {
    name: 'Shahbagh Police Station, Dhaka',
    type: 'POLICE_BOX',
    latitude: 23.7381,
    longitude: 90.3957,
  },
  {
    name: 'Farmgate Police Box, Dhaka',
    type: 'POLICE_BOX',
    latitude: 23.7565,
    longitude: 90.3888,
  },
  {
    name: 'Kotwali Police Station, Chittagong',
    type: 'POLICE_BOX',
    latitude: 22.3354,
    longitude: 91.8325,
  },
  // 24/7 Pharmacies
  {
    name: 'Labaid 24/7 Pharmacy, Dhanmondi',
    type: 'PHARMACY',
    latitude: 23.7461,
    longitude: 90.3789,
  },
  {
    name: 'Square Hospital Pharmacy (24/7), Panthapath',
    type: 'PHARMACY',
    latitude: 23.7531,
    longitude: 90.3816,
  },
];

/**
 * Automatically seeds prominent safe zones if the SafeZone table is empty.
 */
export const seedDefaultSafeZones = async (): Promise<number> => {
  const count = await prisma.safeZone.count();
  if (count > 0) {
    return 0; // Already seeded
  }

  console.log('[SafeZoneService] Seeding default Bangladesh safe havens (hospitals, police boxes, pharmacies)...');
  let inserted = 0;

  for (const zone of DEFAULT_BANGLADESH_SAFE_ZONES) {
    await prisma.$executeRaw`
      INSERT INTO "SafeZone" (id, type, name, latitude, longitude, location, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${zone.type}::"SafeZoneType",
        ${zone.name},
        ${zone.latitude},
        ${zone.longitude},
        ST_SetSRID(ST_MakePoint(${zone.longitude}, ${zone.latitude}), 4326)::geography,
        NOW(),
        NOW()
      )
    `;
    inserted++;
  }

  console.log(`[SafeZoneService] Successfully seeded ${inserted} safe zones.`);
  return inserted;
};

/**
 * Fetches safe zones inside map bounding box with optional SafeZoneType filtering.
 */
export const fetchSafeZonesInBounds = async (
  bounds: BoundingBox,
  type?: SafeZoneType
) => {
  // Ensure default safe zones are seeded
  await seedDefaultSafeZones();

  const whereConditions: Prisma.Sql[] = [
    Prisma.sql`location && ST_MakeEnvelope(
      ${bounds.minLng}, ${bounds.minLat},
      ${bounds.maxLng}, ${bounds.maxLat},
      4326
    )`
  ];

  if (type) {
    whereConditions.push(Prisma.sql`type = ${type}::"SafeZoneType"`);
  }

  const whereClause = Prisma.join(whereConditions, ' AND ');

  const safeZones: any = await prisma.$queryRaw`
    SELECT id, type, name, latitude, longitude, "createdAt"
    FROM "SafeZone"
    WHERE ${whereClause}
    ORDER BY name ASC
  `;

  return safeZones;
};

/**
 * Fetches nearest safe zones within a radial distance from user's coordinates.
 */
export const fetchNearbySafeZones = async (
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  type?: SafeZoneType
) => {
  await seedDefaultSafeZones();

  const whereConditions: Prisma.Sql[] = [
    Prisma.sql`ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )`
  ];

  if (type) {
    whereConditions.push(Prisma.sql`type = ${type}::"SafeZoneType"`);
  }

  const whereClause = Prisma.join(whereConditions, ' AND ');

  const safeZones: any = await prisma.$queryRaw`
    SELECT 
      id, type, name, latitude, longitude,
      ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )::numeric, 1) as "distanceMeters"
    FROM "SafeZone"
    WHERE ${whereClause}
    ORDER BY "distanceMeters" ASC
    LIMIT 20
  `;

  return safeZones;
};

/**
 * Creates and persists a new verified safe haven (Admin only).
 */
export const createSafeZone = async (input: SafeZoneInput) => {
  const inserted: any[] = await prisma.$queryRaw`
    INSERT INTO "SafeZone" (id, type, name, latitude, longitude, location, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      ${input.type}::"SafeZoneType",
      ${input.name},
      ${input.latitude},
      ${input.longitude},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
      NOW(),
      NOW()
    )
    RETURNING id, type, name, latitude, longitude, "createdAt"
  `;

  return inserted[0];
};

/**
 * Deletes an existing verified safe haven (Admin only).
 */
export const deleteSafeZone = async (id: string) => {
  const existing = await prisma.safeZone.findUnique({ where: { id } });
  if (!existing) {
    const error: any = new Error('Safe zone not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.safeZone.delete({ where: { id } });
  return { id, deleted: true, name: existing.name };
};
