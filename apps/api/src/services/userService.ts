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

export const approveVerification = async (adminId: string, verificationId: string) => {
  const verification = await prisma.userVerification.findUnique({
    where: { id: verificationId }
  });

  if (!verification) {
    throw new Error('Verification request not found');
  }

  if (verification.status !== 'PENDING') {
    throw new Error(`Verification is already ${verification.status}`);
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
