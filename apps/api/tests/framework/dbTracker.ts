import './config';
import { prisma } from '../../src/db/prisma';

export { prisma };

export class TestDataTracker {
  public readonly userIds = new Set<string>();
  public readonly reportIds = new Set<string>();
  public readonly alertZoneIds = new Set<string>();
  public readonly safeZoneIds = new Set<string>();
  public readonly verificationIds = new Set<string>();
  public readonly moderationLogIds = new Set<string>();
  public readonly mediaIds = new Set<string>();
  public readonly newsArticleIds = new Set<string>();

  trackUser(id?: string): void {
    if (id) this.userIds.add(id);
  }

  trackReport(id?: string): void {
    if (id) this.reportIds.add(id);
  }

  trackAlertZone(id?: string): void {
    if (id) this.alertZoneIds.add(id);
  }

  trackSafeZone(id?: string): void {
    if (id) this.safeZoneIds.add(id);
  }

  trackVerification(id?: string): void {
    if (id) this.verificationIds.add(id);
  }

  trackModerationLog(id?: string): void {
    if (id) this.moderationLogIds.add(id);
  }

  trackMedia(id?: string): void {
    if (id) this.mediaIds.add(id);
  }

  trackNewsArticle(id?: string): void {
    if (id) this.newsArticleIds.add(id);
  }

  async cleanup(): Promise<void> {
    const uIds = Array.from(this.userIds);
    const rIds = Array.from(this.reportIds);
    const azIds = Array.from(this.alertZoneIds);
    const szIds = Array.from(this.safeZoneIds);
    const vIds = Array.from(this.verificationIds);
    const mlIds = Array.from(this.moderationLogIds);
    const mIds = Array.from(this.mediaIds);
    const naIds = Array.from(this.newsArticleIds);

    if (
      uIds.length === 0 &&
      rIds.length === 0 &&
      azIds.length === 0 &&
      szIds.length === 0 &&
      vIds.length === 0 &&
      mlIds.length === 0 &&
      mIds.length === 0 &&
      naIds.length === 0
    ) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (mlIds.length > 0 || rIds.length > 0 || uIds.length > 0) {
        const orClauses: any[] = [];
        if (mlIds.length > 0) orClauses.push({ id: { in: mlIds } });
        if (rIds.length > 0) orClauses.push({ targetReportId: { in: rIds } });
        if (uIds.length > 0) {
          orClauses.push({ targetUserId: { in: uIds } });
          orClauses.push({ adminId: { in: uIds } });
        }
        await tx.moderationLog.deleteMany({ where: { OR: orClauses } });
      }

      if (mIds.length > 0 || rIds.length > 0) {
        const orClauses: any[] = [];
        if (mIds.length > 0) orClauses.push({ id: { in: mIds } });
        if (rIds.length > 0) orClauses.push({ reportId: { in: rIds } });
        await tx.reportMedia.deleteMany({ where: { OR: orClauses } });
      }

      if (rIds.length > 0 || uIds.length > 0) {
        const orClauses: any[] = [];
        if (rIds.length > 0) orClauses.push({ reportId: { in: rIds } });
        if (uIds.length > 0) orClauses.push({ userId: { in: uIds } });
        await tx.reportUpdate.deleteMany({ where: { OR: orClauses } });
        await tx.vote.deleteMany({ where: { OR: orClauses } });
      }

      if (naIds.length > 0 || rIds.length > 0) {
        const orClauses: any[] = [];
        if (naIds.length > 0) orClauses.push({ id: { in: naIds } });
        if (rIds.length > 0) orClauses.push({ reportId: { in: rIds } });
        await tx.newsArticle.deleteMany({ where: { OR: orClauses } });
      }

      if (rIds.length > 0 || uIds.length > 0) {
        const orClauses: any[] = [];
        if (rIds.length > 0) orClauses.push({ id: { in: rIds } });
        if (uIds.length > 0) orClauses.push({ userId: { in: uIds } });
        await tx.report.deleteMany({ where: { OR: orClauses } });
      }

      if (azIds.length > 0 || uIds.length > 0) {
        const orClauses: any[] = [];
        if (azIds.length > 0) orClauses.push({ id: { in: azIds } });
        if (uIds.length > 0) orClauses.push({ userId: { in: uIds } });
        await tx.userAlertZone.deleteMany({ where: { OR: orClauses } });
      }

      if (vIds.length > 0 || uIds.length > 0) {
        const orClauses: any[] = [];
        if (vIds.length > 0) orClauses.push({ id: { in: vIds } });
        if (uIds.length > 0) orClauses.push({ userId: { in: uIds } });
        await tx.userVerification.deleteMany({ where: { OR: orClauses } });
      }

      if (uIds.length > 0) {
        await tx.refreshToken.deleteMany({ where: { userId: { in: uIds } } });
      }

      if (szIds.length > 0) {
        await tx.safeZone.deleteMany({ where: { id: { in: szIds } } });
      }

      if (uIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: uIds } } });
      }
    });

    this.userIds.clear();
    this.reportIds.clear();
    this.alertZoneIds.clear();
    this.safeZoneIds.clear();
    this.verificationIds.clear();
    this.moderationLogIds.clear();
    this.mediaIds.clear();
    this.newsArticleIds.clear();
  }
}
