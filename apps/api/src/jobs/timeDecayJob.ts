import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { emitReportExpired } from '../sockets';

let isPurging = false;

/**
 * Isolated service function to purge expired reports.
 * Employs a mutex lock to avoid overlapping runs.
 */
export const purgeExpiredReports = async (now: Date = new Date()): Promise<number> => {
  if (isPurging) {
    console.warn('[Time-Decay Job] Previous purge still in progress. Skipping tick.');
    return 0;
  }

  isPurging = true;
  try {
    // 1. Query active reports whose expiration has passed
    const expiredReports = await prisma.report.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now }
      },
      select: { id: true }
    });

    if (expiredReports.length === 0) {
      return 0;
    }

    const expiredIds = expiredReports.map((r) => r.id);

    // 2. Atomically flip status to PURGED
    await prisma.report.updateMany({
      where: {
        id: { in: expiredIds }
      },
      data: {
        status: 'PURGED'
      }
    });

    // 3. Emit real-time event to connected map clients
    emitReportExpired({
      reportIds: expiredIds,
      reason: 'TIME_DECAY_EXPIRED'
    });

    return expiredIds.length;
  } catch (error) {
    console.error('[Time-Decay Job] Database error during purge:', error);
    throw error;
  } finally {
    isPurging = false;
  }
};

let isHardCleaning = false;

export interface RetentionCleanupResult {
  deletedReports: number;
  deletedVotes: number;
  deletedUpdates: number;
  deletedMedia: number;
  updatedModerationLogs: number;
  deletedNews: number;
  deletedTokens: number;
}

/**
 * Permanently removes stale PURGED reports, orphan news articles, and expired auth tokens
 * older than retentionDays (default: 30 days) to enforce Supabase free tier (500 MB) quota protection.
 * Cascades foreign key dependencies safely inside an isolated transaction.
 */
export const hardDeleteStaleRetentionData = async (
  retentionDays: number = 30,
  now: Date = new Date()
): Promise<RetentionCleanupResult> => {
  if (isHardCleaning) {
    console.warn('[Retention Cleanup] Previous hard-delete cleanup still running. Skipping tick.');
    return {
      deletedReports: 0,
      deletedVotes: 0,
      deletedUpdates: 0,
      deletedMedia: 0,
      updatedModerationLogs: 0,
      deletedNews: 0,
      deletedTokens: 0,
    };
  }

  isHardCleaning = true;
  try {
    const thresholdDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    // 1. Identify PURGED reports older than the retention threshold
    const staleReports = await prisma.report.findMany({
      where: {
        status: 'PURGED',
        createdAt: { lt: thresholdDate },
      },
      select: { id: true },
      take: 500, // Batch limit to keep transaction lock window small
    });

    const staleReportIds = staleReports.map((r) => r.id);

    let deletedVotes = 0;
    let deletedUpdates = 0;
    let deletedMedia = 0;
    let updatedModerationLogs = 0;
    let deletedNews = 0;
    let deletedReports = 0;

    if (staleReportIds.length > 0) {
      // Execute cascading foreign-key deletion in a transaction
      await prisma.$transaction(async (tx) => {
        // Child 1: Votes
        const vRes = await tx.vote.deleteMany({
          where: { reportId: { in: staleReportIds } },
        });
        deletedVotes = vRes.count;

        // Child 2: Report Updates
        const uRes = await tx.reportUpdate.deleteMany({
          where: { reportId: { in: staleReportIds } },
        });
        deletedUpdates = uRes.count;

        // Child 3: Report Media
        const mRes = await tx.reportMedia.deleteMany({
          where: { reportId: { in: staleReportIds } },
        });
        deletedMedia = mRes.count;

        // Child 4: Moderation Logs referencing these reports
        const mlRes = await tx.moderationLog.updateMany({
          where: { targetReportId: { in: staleReportIds } },
          data: { targetReportId: null },
        });
        updatedModerationLogs = mlRes.count;

        // Child 5: Linked NewsArticles
        const nRes = await tx.newsArticle.deleteMany({
          where: { reportId: { in: staleReportIds } },
        });
        deletedNews = nRes.count;

        // Parent: Delete stale Reports
        const rRes = await tx.report.deleteMany({
          where: { id: { in: staleReportIds } },
        });
        deletedReports = rRes.count;
      });
    }

    // 2. Delete any unlinked/orphan NewsArticles published prior to threshold
    const orphanNewsRes = await prisma.newsArticle.deleteMany({
      where: {
        publishedAt: { lt: thresholdDate },
      },
    });
    deletedNews += orphanNewsRes.count;

    // 3. Clean up expired or revoked refresh tokens (prevents auth table bloat)
    const tokenRes = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { isRevoked: true },
        ],
      },
    });

    const result: RetentionCleanupResult = {
      deletedReports,
      deletedVotes,
      deletedUpdates,
      deletedMedia,
      updatedModerationLogs,
      deletedNews,
      deletedTokens: tokenRes.count,
    };

    if (deletedReports > 0 || deletedNews > 0 || tokenRes.count > 0) {
      console.log(
        `[Retention Cleanup] 🧹 Reclaimed database storage: ` +
        `Deleted ${deletedReports} stale reports (with ${deletedVotes} votes, ${deletedUpdates} updates, ${deletedMedia} media, ${updatedModerationLogs} logs unlinked), ` +
        `${deletedNews} old news articles, and ${tokenRes.count} expired refresh tokens.`
      );
    }

    return result;
  } catch (error) {
    console.error('[Retention Cleanup] Database error during hard-delete cleanup:', error);
    throw error;
  } finally {
    isHardCleaning = false;
  }
};

/**
 * Initialize time-decay cron schedule (default: every 5 minutes)
 */
export const initTimeDecayCron = (cronExpression = '*/5 * * * *') => {
  console.log(`[Time-Decay Job] Scheduled with expression: "${cronExpression}"`);

  const task = cron.schedule(cronExpression, async () => {
    try {
      const count = await purgeExpiredReports();
      if (count > 0) {
        console.log(`[Time-Decay Job] Successfully purged ${count} expired report(s).`);
      }
    } catch (err) {
      console.error('[Time-Decay Job] Unhandled error during scheduled run:', err);
    }
  });

  return {
    task,
    stop: () => {
      console.log('[Time-Decay Job] Stopping cron task...');
      task.stop();
    }
  };
};

/**
 * Initializes the daily retention cleanup cron job.
 * Default schedule: Daily at 3:00 AM UTC+6 ('0 3 * * *')
 */
export const initDailyRetentionCron = (cronExpression = '0 3 * * *') => {
  console.log(`[Retention Job] Scheduled daily rolling cleanup with expression: "${cronExpression}"`);

  const task = cron.schedule(cronExpression, async () => {
    try {
      await hardDeleteStaleRetentionData(30);
    } catch (err) {
      console.error('[Retention Job] Unhandled error during scheduled retention cleanup:', err);
    }
  });

  return {
    task,
    stop: () => {
      console.log('[Retention Job] Stopping daily retention cleanup cron task...');
      task.stop();
    },
  };
};
