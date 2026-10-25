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
