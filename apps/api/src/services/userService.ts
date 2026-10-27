import { prisma } from '../db/prisma';
import { VerificationType } from '@prisma/client';

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
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

export const submitVerification = async (userId: string, type: VerificationType, documentUrl?: string) => {
  // Check if there's already a pending verification
  const existing = await prisma.userVerification.findFirst({
    where: { userId, status: 'PENDING' }
  });

  if (existing) {
    throw new Error('You already have a pending verification request');
  }

  const verification = await prisma.userVerification.create({
    data: {
      userId,
      type,
      documentUrl,
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

  // Use a transaction to approve verification, update user role, and log the action
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: {
        isVerified: true,
        role: 'VERIFIED_RESPONDER',
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
        action: 'VERIFY_USER',
        reason: reason || 'Rejected KYC verification request',
      }
    })
  ]);

  return rejected;
};
