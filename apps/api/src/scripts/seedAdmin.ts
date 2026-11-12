import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error('[Seed Admin] ADMIN_EMAIL environment variable is required.');
  }

  let passwordHash: string;
  if (envPasswordHash) {
    if (!envPasswordHash.startsWith('$2')) {
      throw new Error('[Seed Admin] ADMIN_PASSWORD_HASH must be a valid bcrypt hash.');
    }
    passwordHash = envPasswordHash;
  } else {
    if (!envPassword || envPassword.length < 12) {
      throw new Error(
        '[Seed Admin] Provide ADMIN_PASSWORD_HASH or an explicit ADMIN_PASSWORD of at least 12 characters.'
      );
    }
    if (envPassword === 'AdminSafety@2026') {
      throw new Error('[Seed Admin] Refusing to seed the insecure legacy default password.');
    }
    passwordHash = await bcrypt.hash(envPassword, 12);
  }

  console.log(`[Seed Admin] Starting administrator account setup for: ${adminEmail}`);

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

  if (envPasswordHash) {
    if (verifiedUser.passwordHash !== passwordHash || verifiedUser.role !== 'ADMIN') {
      throw new Error('Seeded password hash verification failed!');
    }
  } else if (envPassword) {
    const isValid = await bcrypt.compare(envPassword, verifiedUser.passwordHash);
    if (!isValid) {
      throw new Error('Password hash verification failed!');
    }
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
