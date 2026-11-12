import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma';
import { generateAccessToken, generateRefreshToken, generateSocketToken } from '../utils/jwt';

const createForbiddenError = (message: string) =>
  Object.assign(new Error(message), { statusCode: 403 });

const issueClientTokens = (user: { id: string; role: string; isVerified: boolean }) => {
  const claims = { id: user.id, role: user.role, isVerified: user.isVerified };
  return {
    accessToken: generateAccessToken(claims),
    socketToken: generateSocketToken(claims),
  };
};

const assertDeviceAuthAllowed = (account: {
  role: string;
  passwordHash: string | null;
  isBanned: boolean;
}) => {
  // Prevent device-based session issuance for privileged, password-protected, or suspended accounts
  if (account.role !== 'USER' || Boolean(account.passwordHash)) {
    throw createForbiddenError(
      'Privileged or password-protected accounts must authenticate with email and password via /auth/login.'
    );
  }
  if (account.isBanned) {
    throw createForbiddenError('Account is suspended');
  }
};

export const loginOrRegisterDevice = async (anonymousId: string, email?: string) => {
  const normalizedEmail = email?.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: { anonymousId }
  });

  if (user) {
    assertDeviceAuthAllowed(user);
  } else {
    if (normalizedEmail) {
      const existingByEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      });
      if (existingByEmail) {
        assertDeviceAuthAllowed(existingByEmail);
      }
    }

    user = await prisma.user.create({
      data: {
        anonymousId,
        email: normalizedEmail || `${anonymousId}@anonymous.local`,
      }
    });
  }

  if (user.isBanned) {
    throw createForbiddenError('Account is suspended');
  }

  const { accessToken, socketToken } = issueClientTokens(user);
  const refreshToken = generateRefreshToken({ id: user.id });

  // Save refresh token to db
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }
  });

  return { user, accessToken, refreshToken, socketToken };
};

export const refreshSession = async (token: string, userId: string) => {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existingToken = await tx.refreshToken.findUnique({
      where: { token },
    });

    if (
      !existingToken ||
      existingToken.userId !== userId ||
      existingToken.isRevoked ||
      existingToken.expiresAt < now
    ) {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    // Atomically mark the presented refresh token as revoked to prevent replay under concurrent requests
    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: existingToken.id,
        isRevoked: false,
        expiresAt: { gte: now },
      },
      data: { isRevoked: true },
    });

    if (revoked.count === 0) {
      throw Object.assign(new Error('Refresh token already used or expired'), { statusCode: 401 });
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) {
      throw Object.assign(new Error('User not found or banned'), { statusCode: 401 });
    }

    const { accessToken, socketToken } = issueClientTokens(user);
    const newRefreshToken = generateRefreshToken({ id: user.id });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken: newRefreshToken, socketToken };
  });
};

export const logout = async (token: string) => {
  await prisma.refreshToken.updateMany({
    where: { token, isRevoked: false },
    data: { isRevoked: true },
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

  const { accessToken, socketToken } = issueClientTokens(user);
  const refreshToken = generateRefreshToken({ id: user.id });

  // Save refresh token to db
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { user, accessToken, refreshToken, socketToken };
};
