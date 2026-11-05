import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

export const loginOrRegisterDevice = async (anonymousId: string, email?: string) => {
  let user = await prisma.user.findUnique({
    where: { anonymousId }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        anonymousId,
        email: email || `${anonymousId}@anonymous.local`,
      }
    });
  }

  const accessToken = generateAccessToken({ id: user.id, role: user.role, isVerified: user.isVerified });
  const refreshToken = generateRefreshToken({ id: user.id });

  // Save refresh token to db
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }
  });

  return { user, accessToken, refreshToken };
};

export const refreshSession = async (token: string, userId: string) => {
  const existingToken = await prisma.refreshToken.findUnique({
    where: { token }
  });

  if (!existingToken || existingToken.isRevoked || existingToken.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBanned) {
    throw new Error('User not found or banned');
  }

  const accessToken = generateAccessToken({ id: user.id, role: user.role, isVerified: user.isVerified });
  
  return { accessToken };
};

export const logout = async (token: string) => {
  await prisma.refreshToken.update({
    where: { token },
    data: { isRevoked: true }
  }).catch(() => {
    // Ignore if token doesn't exist
  });
};

export const loginWithPassword = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.isBanned) {
    throw new Error('This account has been suspended');
  }

  if (!user.passwordHash) {
    throw new Error('Password authentication is not configured for this account');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  const accessToken = generateAccessToken({ id: user.id, role: user.role, isVerified: user.isVerified });
  const refreshToken = generateRefreshToken({ id: user.id });

  // Save refresh token to db
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { user, accessToken, refreshToken };
};
