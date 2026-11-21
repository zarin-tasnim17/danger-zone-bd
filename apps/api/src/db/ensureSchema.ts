import { prisma } from './prisma';

/**
 * Ensures non-destructive backward-compatible schema alignment on database boot and cron triggers.
 * Auto-creates enums and columns individually if they do not yet exist in PostgreSQL.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const statements = [
    // Column additions for danger schedule / active time window
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeStart" TEXT;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeEnd" TEXT;`,
    // Administrative district/upazila and precision tagging
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "district" TEXT;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "upazila" TEXT;`,
    // LocationPrecision Enum
    `DO $$ BEGIN CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'UPAZILA', 'DISTRICT', 'AMBIGUOUS'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "locationPrecision" "LocationPrecision" DEFAULT 'EXACT';`,
    // ThreatStatus Enum
    `DO $$ BEGIN CREATE TYPE "ThreatStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED_UNVERIFIED', 'UNDER_REVIEW'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "threatStatus" "ThreatStatus" DEFAULT 'ACTIVE';`,
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err: any) {
      // Safe non-blocking warning for isolated statements
      console.warn(`[Database Schema Notice] Statement "${sql.slice(0, 45)}...":`, err?.message || err);
    }
  }

  console.log('[Database] Automated schema verification & migration pass complete.');
}
