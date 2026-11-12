import { prisma } from '../db/prisma';
import { Role, VerificationType } from '@prisma/client';
import { normalizeBangladeshPhone } from '@repo/shared';

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isVerified: true,
      trustScore: true,
      isBanned: true,
      createdAt: true,
      _count: {
        select: {
          reports: true,
          votes: true,
          alertZones: true,
        },
      },
      verifications: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          phoneNumber: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

/**
 * Defense-in-depth account suspension check for service-layer entry points.
 */
export const assertUserNotSuspended = async (userId: string, actionMessage: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  if (user.isBanned) {
    throw Object.assign(new Error(actionMessage), { statusCode: 403 });
  }
};

export const submitVerification = async (
  userId: string,
  type: VerificationType,
  documentUrl?: string,
  phoneNumber?: string
) => {
  await assertUserNotSuspended(
    userId,
    'Your account has been suspended. You cannot submit verification requests.'
  );

  // Check if there's already a pending verification
  const existing = await prisma.userVerification.findFirst({
    where: { userId, status: 'PENDING' }
  });

  if (existing) {
    throw new Error('You already have a pending verification request');
  }

  const normalizedPhone =
    type === 'PHONE_OTP' && phoneNumber
      ? normalizeBangladeshPhone(phoneNumber)
      : undefined;

  const verification = await prisma.userVerification.create({
    data: {
      userId,
      type,
      documentUrl: type === 'NID_DOCUMENT' ? documentUrl?.trim() : undefined,
      phoneNumber: normalizedPhone,
      status: 'PENDING'
    }
  });

  return verification;
};

export const getPendingVerifications = async () => {
  return prisma.userVerification.findMany({
    where: { status: 'PENDING' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          role: true,
          trustScore: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
};

export const approveVerification = async (adminId: string, verificationId: string) => {
  const verification = await prisma.userVerification.findUnique({
    where: { id: verificationId },
    include: {
      user: {
        select: {
          id: true,
          role: true,
        }
      }
    }
  });

  if (!verification) {
    const error: any = new Error('Verification request not found');
    error.statusCode = 404;
    throw error;
  }

  if (verification.status !== 'PENDING') {
    const error: any = new Error(`Verification is already ${verification.status}`);
    error.statusCode = 400;
    throw error;
  }

  // Never downgrade an existing ADMIN account to VERIFIED_RESPONDER on KYC approval
  const nextRole =
    verification.user.role === Role.ADMIN ? Role.ADMIN : Role.VERIFIED_RESPONDER;

  // Use a transaction to approve verification, update user role, and log the action
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: {
        isVerified: true,
        role: nextRole,
      },
      select: {
        id: true,
        anonymousId: true,
        email: true,
        role: true,
        isVerified: true,
        trustScore: true,
        isBanned: true,
        createdAt: true,
        updatedAt: true,
      }
    }),
    prisma.userVerification.update({
      where: { id: verificationId },
      data: { status: 'APPROVED' }
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetUserId: verification.userId,
        action: 'VERIFY_USER',
        reason: 'Manually approved KYC verification',
      }
    })
  ]);

  return updatedUser;
};

export const rejectVerification = async (adminId: string, verificationId: string, reason?: string) => {
  const verification = await prisma.userVerification.findUnique({
    where: { id: verificationId }
  });

  if (!verification) {
    const error: any = new Error('Verification request not found');
    error.statusCode = 404;
    throw error;
  }

  if (verification.status !== 'PENDING') {
    const error: any = new Error(`Verification is already ${verification.status}`);
    error.statusCode = 400;
    throw error;
  }

  const [rejected] = await prisma.$transaction([
    prisma.userVerification.update({
      where: { id: verificationId },
      data: { status: 'REJECTED' }
    }),
    prisma.moderationLog.create({
      data: {
        adminId,
        targetUserId: verification.userId,
        action: 'REJECT_VERIFICATION',
        reason: reason || 'Rejected KYC verification request',
      }
    })
  ]);

  return rejected;
};
