import { prisma } from '../db/prisma';
import { emitNewReportUpdate } from '../sockets';

export const addReportUpdate = async (userId: string, reportId: string, content: string) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true }
  });

  if (!report) {
    const error: any = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (report.status === 'PURGED') {
    const error: any = new Error('Cannot append context updates to a purged report');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isVerified: true, anonymousId: true, isBanned: true }
  });

  if (user?.isBanned) {
    const error: any = new Error('Your account has been suspended. You cannot post context updates.');
    error.statusCode = 403;
    throw error;
  }

  const update = await prisma.reportUpdate.create({
    data: {
      userId,
      reportId,
      content: content.trim(),
    }
  });

  const sanitizedUpdate = {
    id: update.id,
    reportId: update.reportId,
    content: update.content,
    createdAt: update.createdAt,
    author: {
      isVerified: user?.isVerified ?? false,
      role: user?.role ?? 'USER',
      alias: user?.role === 'ADMIN' 
        ? 'Official Administrator' 
        : user?.isVerified 
          ? 'Verified Responder' 
          : `Citizen (${user?.anonymousId.slice(0, 6)}...)`
    }
  };

  // Broadcast live context update to all active map clients
  emitNewReportUpdate({
    reportId,
    update: sanitizedUpdate
  });

  return sanitizedUpdate;
};

export const getReportUpdates = async (reportId: string) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true }
  });

  if (!report || report.status === 'PURGED') {
    const error: any = new Error('Report not found or has been purged');
    error.statusCode = 404;
    throw error;
  }

  const updates = await prisma.reportUpdate.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          isVerified: true,
          role: true,
          anonymousId: true
        }
      }
    }
  });

  return updates.map((u) => ({
    id: u.id,
    reportId: u.reportId,
    content: u.content,
    createdAt: u.createdAt,
    author: {
      isVerified: u.user.isVerified,
      role: u.user.role,
      alias: u.user.role === 'ADMIN' 
        ? 'Official Administrator' 
        : u.user.isVerified 
          ? 'Verified Responder' 
          : `Citizen (${u.user.anonymousId.slice(0, 6)}...)`
    }
  }));
};
