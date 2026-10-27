import { prisma } from '../db/prisma';
import { emitReportVoted, emitReportPurged } from '../sockets';

export const submitVote = async (userId: string, reportId: string, voteType: 1 | -1) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true }
  });

  if (user?.isBanned) {
    const error: any = new Error('Your account has been suspended. You cannot vote on reports.');
    error.statusCode = 403;
    throw error;
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error('Report not found');
  }
  if (report.userId === userId) {
    throw new Error('You cannot vote on your own report');
  }
  if (report.status === 'PURGED') {
    throw new Error('Cannot vote on a purged report');
  }

  // Use a transaction to ensure vote record insertion and report aggregation happen atomically
  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Check if vote already exists to prevent duplicate votes
    const existingVote = await tx.vote.findUnique({
      where: {
        userId_reportId: {
          userId,
          reportId
        }
      }
    });

    if (existingVote) {
      throw new Error('You have already voted on this report');
    }

    // 2. Insert vote
    await tx.vote.create({
      data: {
        userId,
        reportId,
        voteType
      }
    });

    // 3. Atomically increment the respective column
    const updatedReport = await tx.report.update({
      where: { id: reportId },
      data: voteType === 1 
        ? { upvotes: { increment: 1 } }
        : { downvotes: { increment: 1 } }
    });

    let finalReport = updatedReport;

    // 4. Trust Engine Rule: Community verification upvotes increment creator's trust score
    if (voteType === 1) {
      await tx.user.update({
        where: { id: report.userId },
        data: { trustScore: { increment: 1 } }
      });
    }

    // 5. Trust Engine Rule: If downvotes hit threshold, automatically purge and penalize creator
    if (updatedReport.downvotes >= 5) {
      finalReport = await tx.report.update({
        where: { id: reportId },
        data: { status: 'PURGED' }
      });
      
      // In addition, decrement the trust score of the creator by 1
      await tx.user.update({
        where: { id: report.userId },
        data: { trustScore: { decrement: 1 } }
      });
    }

    return finalReport;
  });

  // Phase 8: Emit real-time vote updates
  emitReportVoted({
    reportId: result.id,
    upvotes: result.upvotes,
    downvotes: result.downvotes,
    status: result.status
  });

  if (result.status === 'PURGED') {
    emitReportPurged({
      reportId: result.id,
      reason: 'TRUST_ENGINE_DOWNVOTE_THRESHOLD'
    });
  }

  return result;
};
