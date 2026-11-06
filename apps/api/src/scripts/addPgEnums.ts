import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newEnums = [
    'SNATCHING',
    'ROBBERY',
    'THEFT_ROBBERY',
    'ARMED_ASSAULT',
    'SNATCHING_ARMED_ASSAULT',
    'YOUTH_GANG_ACTIVITY',
    'DRUG_RELATED_CRIME',
    'ROAD_ACCIDENT',
    'DACOITY',
    'THEFT_DACOITY',
    'TEEN_GANG',
    'TEEN_GANG_ARMED_ASSAULT',
  ];

  for (const val of newEnums) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS '${val}';`);
      console.log(`Added enum value: ${val}`);
    } catch (e: any) {
      console.error(`Error adding ${val}:`, e.message);
    }
  }

  const enumValues = await prisma.$queryRawUnsafe<any[]>(`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'ReportCategory';
  `);
  console.log("Updated PostgreSQL ReportCategory enum values:", enumValues.map(r => r.enumlabel));
}

main().finally(() => prisma.$disconnect());
