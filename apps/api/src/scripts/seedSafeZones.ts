import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../db/prisma';
import { seedDefaultSafeZones, DEFAULT_BANGLADESH_SAFE_ZONES } from '../services/safeZoneService';

/**
 * Standalone CLI script to seed or synchronize the 103 reconciled safe havens
 * (including all 94 verified police stations) into the database.
 */
async function main() {
  console.log('[Seed Safe Zones] Connecting to database...');
  const initialCount = await prisma.safeZone.count();
  console.log(`[Seed Safe Zones] Initial safe zone count in database: ${initialCount}`);

  console.log(`[Seed Safe Zones] Synchronizing ${DEFAULT_BANGLADESH_SAFE_ZONES.length} reconciled safe shelters...`);
  const inserted = await seedDefaultSafeZones();

  const finalCount = await prisma.safeZone.count();
  console.log(
    `[Seed Safe Zones] Seeding complete: inserted ${inserted} records. Total safe havens in database: ${finalCount} (target: ${DEFAULT_BANGLADESH_SAFE_ZONES.length}).`
  );
}

main()
  .catch((err) => {
    console.error('[Seed Safe Zones] Error during safe zones seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('[Seed Safe Zones] Database connection closed.');
  });
