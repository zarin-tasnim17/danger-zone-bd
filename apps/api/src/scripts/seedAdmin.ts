import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';

async function seedAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@safetymap.bd').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSafety@2026';

  console.log(`[Seed Admin] Starting administrator account setup for: ${adminEmail}`);

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  const existingByEmail = await prisma.user.findFirst({
    where: {
      email: {
        equals: adminEmail,
        mode: 'insensitive',
      },
    },
  });

  if (existingByEmail) {
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        role: 'ADMIN',
        passwordHash,
        isVerified: true,
        trustScore: 100,
        isBanned: false,
      },
    });
    console.log(`[Seed Admin] Successfully updated existing user (${updated.id}) to ADMIN with password credentials.`);
  } else {
    const defaultAnonId = `admin-master-${Date.now().toString(36)}`;
    const created = await prisma.user.create({
      data: {
        email: adminEmail,
        anonymousId: defaultAnonId,
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
        trustScore: 100,
      },
    });
    console.log(`[Seed Admin] Successfully created new administrator account (${created.id}) with email: ${adminEmail}`);
  }

  // Double check credentials
  const verifiedUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: adminEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!verifiedUser || !verifiedUser.passwordHash) {
    throw new Error('Failed to verify seeded administrator in database.');
  }

  const isValid = await bcrypt.compare(adminPassword, verifiedUser.passwordHash);
  if (!isValid) {
    throw new Error('Password hash verification failed!');
  }

  console.log(`[Seed Admin] Verification complete: Role=${verifiedUser.role}, Email=${verifiedUser.email}, isVerified=${verifiedUser.isVerified}`);
}

seedAdmin()
  .catch((err) => {
    console.error('[Seed Admin] Error seeding administrator:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('[Seed Admin] Database connection closed.');
  });
