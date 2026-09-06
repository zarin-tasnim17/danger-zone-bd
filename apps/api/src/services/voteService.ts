import { prisma } from '../db/prisma';

export const submitVote = async (userId: string, reportId: string, voteType: 1 | -1) => {
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
  return await prisma.$transaction(async (tx) => {
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

    // 4. Trust Engine Rule: if downvotes hit threshold, automatically purge.
    if (updatedReport.downvotes >= 5) {
      await tx.report.update({
        where: { id: reportId },
        data: { status: 'PURGED' }
      });
      
      // In addition, decrement the trust score of the creator by 1
      await tx.user.update({
        where: { id: report.userId },
        data: { trustScore: { decrement: 1 } }
      });
    }

    return updatedReport;
  });
};
