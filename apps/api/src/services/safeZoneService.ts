import { prisma } from '../db/prisma';
import { SafeZoneType, Prisma } from '@prisma/client';
import { BoundingBox } from '../db/spatialUtils';
import verifiedPoliceData from '../data/verifiedPoliceStations.json';

export interface SafeZoneInput {
  name: string;
  type: SafeZoneType;
  latitude: number;
  longitude: number;
}

/**
 * Base prominent hospitals, pharmacies, and unique outpost boxes across Bangladesh
 */
const BASE_PROMINENT_SAFE_ZONES: SafeZoneInput[] = [
  // 5 Hospitals
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
  // 2 Unique Police Outposts (retained)
  {
    name: 'Shib Bari Police Box, Khulna',
    type: 'POLICE_BOX',
    latitude: 22.8205,
    longitude: 89.5539,
  },
  {
    name: 'Farmgate Police Box, Dhaka',
    type: 'POLICE_BOX',
    latitude: 23.7565,
    longitude: 90.3888,
  },
  // 2 24/7 Pharmacies
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
 * 94 physically verified police stations across all divisions of Bangladesh.
 * Formatted cleanly as "${station_name_en}, ${district}".
 */
const VERIFIED_POLICE_SAFE_ZONES: SafeZoneInput[] = (
  (verifiedPoliceData as any).stations as Array<{
    station_name_en: string;
    district: string;
    location: { latitude: number; longitude: number };
  }>
).map((s) => ({
  name: `${s.station_name_en}, ${s.district}`,
  type: 'POLICE_BOX' as SafeZoneType,
  latitude: s.location.latitude,
  longitude: s.location.longitude,
}));

/**
 * Reconciled 103 prominent safe havens across Bangladesh:
 * 5 hospitals + 2 pharmacies + 2 outposts + 94 verified police stations = 103 points
 * Note: Duplicate approximate police stations (Shahbagh & Kotwali Chittagong) are superseded
 * by their physically verified premises.
 */
export const DEFAULT_BANGLADESH_SAFE_ZONES: SafeZoneInput[] = [
  ...BASE_PROMINENT_SAFE_ZONES,
  ...VERIFIED_POLICE_SAFE_ZONES,
];

/**
 * Bengali name lookup map for verified police stations
 */
const POLICE_STATION_BN_LOOKUP = new Map<string, string>();
for (const s of ((verifiedPoliceData as any).stations || []) as Array<{
  station_name_en: string;
  station_name_bn: string;
  district: string;
}>) {
  POLICE_STATION_BN_LOOKUP.set(`${s.station_name_en}, ${s.district}`, s.station_name_bn);
  POLICE_STATION_BN_LOOKUP.set(s.station_name_en, s.station_name_bn);
}

let hasSeededSafeZones = false;
let seedSafeZonesPromise: Promise<number> | null = null;

/**
 * Automatically seeds prominent safe zones at most once per server process
 * lifecycle if missing. Uses idempotent checks so pre-existing databases receive
 * all 94 verified police stations without duplicating records.
 */
export const seedDefaultSafeZones = async (): Promise<number> => {
  if (hasSeededSafeZones) {
    return 0;
  }

  if (seedSafeZonesPromise) {
    return seedSafeZonesPromise;
  }

  seedSafeZonesPromise = (async () => {
    const count = await prisma.safeZone.count();
    if (count >= DEFAULT_BANGLADESH_SAFE_ZONES.length) {
      hasSeededSafeZones = true;
      return 0; // Already fully seeded
    }

    // Remove legacy approximate duplicate police stations if present
    await prisma.$executeRaw`
      DELETE FROM "SafeZone"
      WHERE name IN ('Shahbagh Police Station, Dhaka', 'Kotwali Police Station, Chittagong')
    `;

    // Deduplicate any exact-name duplicate rows if present
    await prisma.$executeRaw`
      DELETE FROM "SafeZone"
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id
        FROM "SafeZone"
        ORDER BY name, "createdAt" ASC
      )
    `;

    console.log('[SafeZoneService] Seeding reconciled Bangladesh safe havens (103 verified shelters)...');
    let inserted = 0;

    for (const zone of DEFAULT_BANGLADESH_SAFE_ZONES) {
      const res = await prisma.$executeRaw`
        INSERT INTO "SafeZone" (id, type, name, latitude, longitude, location, "createdAt", "updatedAt")
        SELECT
          gen_random_uuid(),
          ${zone.type}::"SafeZoneType",
          ${zone.name},
          ${zone.latitude},
          ${zone.longitude},
          ST_SetSRID(ST_MakePoint(${zone.longitude}, ${zone.latitude}), 4326)::geography,
          NOW(),
          NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "SafeZone"
          WHERE name = ${zone.name}
        )
      `;
      inserted += res;
    }

    hasSeededSafeZones = true;
    console.log(`[SafeZoneService] Successfully seeded ${inserted} safe zones.`);
    return inserted;
  })();

  try {
    return await seedSafeZonesPromise;
  } finally {
    seedSafeZonesPromise = null;
  }
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

  return safeZones.map((zone: any) => {
    const nameBn = POLICE_STATION_BN_LOOKUP.get(zone.name);
    return {
      ...zone,
      ...(nameBn ? { nameBn } : {}),
    };
  });
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

  const safeZones: any[] = await prisma.$queryRaw`
    SELECT 
      id, type, name, latitude, longitude,
      ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )::numeric, 1)::double precision as "distanceMeters"
    FROM "SafeZone"
    WHERE ${whereClause}
    ORDER BY "distanceMeters" ASC
    LIMIT 20
  `;

  return safeZones.map((zone) => {
    const nameBn = POLICE_STATION_BN_LOOKUP.get(zone.name);
    return {
      ...zone,
      ...(nameBn ? { nameBn } : {}),
      distanceMeters:
        zone.distanceMeters !== null && zone.distanceMeters !== undefined
          ? Number(zone.distanceMeters)
          : zone.distanceMeters,
    };
  });
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
