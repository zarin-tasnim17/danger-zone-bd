import { prisma } from './prisma';

/**
 * Ensures non-destructive backward-compatible schema alignment on database boot.
 * Auto-creates enums and columns if they do not yet exist in PostgreSQL.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'UPAZILA', 'DISTRICT', 'AMBIGUOUS');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "ThreatStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED_UNVERIFIED', 'UNDER_REVIEW');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeStart" TEXT;
      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeEnd" TEXT;
      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "locationPrecision" "LocationPrecision" DEFAULT 'EXACT';
      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "district" TEXT;
      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "upazila" TEXT;
      ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "threatStatus" "ThreatStatus" DEFAULT 'ACTIVE';
    `);
    console.log('[Database] Automated schema validation & self-healing complete.');
  } catch (err: any) {
    console.warn('[Database] Automated schema check notice:', err?.message || err);
  }
}
