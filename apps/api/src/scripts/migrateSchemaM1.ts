import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Running non-destructive M1 schema migration...");

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'UPAZILA', 'DISTRICT', 'AMBIGUOUS');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("Verified/created LocationPrecision enum.");

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "ThreatStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED_UNVERIFIED', 'UNDER_REVIEW');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("Verified/created ThreatStatus enum.");

  const stages = [
    'SINGLE_SOURCE_PRESS',
    'PRESS_CORROBORATED',
    'WIRE_SYNDICATED',
    'CITIZEN_UNVERIFIED',
    'COMMUNITY_CONFIRMED',
  ];
  for (const stage of stages) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "VerificationStage" ADD VALUE IF NOT EXISTS '${stage}';`);
      console.log(`Added VerificationStage: ${stage}`);
    } catch (e: any) {
      console.log(`VerificationStage ${stage} check/add:`, e.message);
    }
  }

  const statements = [
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "locationPrecision" "LocationPrecision" DEFAULT 'EXACT';`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "district" TEXT;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "upazila" TEXT;`,
    `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "threatStatus" "ThreatStatus" DEFAULT 'ACTIVE';`,
    `ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "isWireSyndicated" BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "wireAgency" TEXT;`,
  ];

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("Executed:", stmt.substring(0, 50));
  }

  console.log("Migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
