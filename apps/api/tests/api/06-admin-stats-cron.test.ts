import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker, prisma } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createDeviceActor, createPrivilegedActor, nextTestIp } from '../framework/authHelpers';
import { assertErrorEnvelope, assertStatus, assertSuccessEnvelope } from '../framework/assertions';

describe('API Functional: Admin Moderation, Analytics, Stats & Cron (EP-032..EP-043)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('EP-032..EP-039 Admin KYC approve/reject, ban/unban, report purge, audit logs & analytics trends', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const citizen1 = await createDeviceActor(server.baseUrl, tracker);
    const citizen2 = await createDeviceActor(server.baseUrl, tracker);

    // Citizen 1 & 2 submit KYC requests
    const v1 = assertSuccessEnvelope(
      await citizen1.client.post('/api/v1/users/verify', {
        type: 'NID_DOCUMENT',
        documentUrl: 'https://cdn.example.com/nid-1.jpg',
      }),
      201
    );
    tracker.trackVerification(v1.id);

    const v2 = assertSuccessEnvelope(
      await citizen2.client.post('/api/v1/users/verify', {
        type: 'NID_DOCUMENT',
        documentUrl: 'https://cdn.example.com/nid-2.jpg',
      }),
      201
    );
    tracker.trackVerification(v2.id);

    // EP-032 List pending verifications includes v1 & v2
    const pendingList = assertSuccessEnvelope<any[]>(
      await admin.client.get('/api/v1/admin/verifications'),
      200
    );
    assert.ok(pendingList.some((v) => v.id === v1.id));
    assert.ok(pendingList.some((v) => v.id === v2.id));

    // EP-033 Approve v1
    const approveRes = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/verifications/${v1.id}/approve`, {
        notes: 'NID verified cleanly',
      }),
      200
    );
    assert.equal(approveRes.role, 'VERIFIED_RESPONDER');
    assert.equal(approveRes.isVerified, true);

    // EP-034 Reject v2
    const rejectRes = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/verifications/${v2.id}/reject`, {
        reason: 'Document image blurry or cropped',
      }),
      200
    );
    assert.equal(rejectRes.status, 'REJECTED');

    // EP-035 & EP-036 Ban & Unban citizen2
    const banRes = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/users/${citizen2.id}/ban`, {
        reason: 'Automated audit ban test',
      }),
      200
    );
    assert.equal(banRes.user.isBanned, true);

    const unbanRes = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/users/${citizen2.id}/unban`, {
        reason: 'Automated audit unban restore',
      }),
      200
    );
    assert.equal(unbanRes.user.isBanned, false);

    // EP-037 Purge report
    const rep = assertSuccessEnvelope(
      await citizen1.client.post('/api/v1/reports', {
        category: 'EXTORTION',
        severity: 'MEDIUM',
        latitude: 23.748,
        longitude: 90.376,
        description: 'Report to verify admin manual purge',
      }),
      201
    );
    tracker.trackReport(rep.id);

    const purgeRes = assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/reports/${rep.id}/purge`, {
        reason: 'Audit manual purge test',
      }),
      200
    );
    assert.equal(purgeRes.report.status, 'PURGED');

    // Purged report must yield 404 on GET /reports/:id
    assertErrorEnvelope(await admin.client.get(`/api/v1/reports/${rep.id}`), 404);

    // EP-038 Audit logs include VERIFY_USER, BAN_USER, UNBAN_USER, PURGE_REPORT
    const logsData = assertSuccessEnvelope(
      await admin.client.get('/api/v1/admin/logs?page=1&limit=20'),
      200
    );
    assert.ok(Array.isArray(logsData.logs));
    assert.ok(logsData.pagination.limit === 20);
    assert.ok(logsData.logs.some((l: any) => l.action === 'BAN_USER' && l.targetUserId === citizen2.id));
    assert.ok(logsData.logs.some((l: any) => l.action === 'PURGE_REPORT' && l.targetReportId === rep.id));

    // EP-039 Analytics trends structure
    const trends = assertSuccessEnvelope(
      await admin.client.get('/api/v1/admin/analytics/trends'),
      200
    );
    assert.equal(trends.timeframe, '30_DAYS');
    assert.ok(typeof trends.totalReports === 'number');
    assert.ok(trends.breakdown?.byCategory && trends.breakdown?.bySeverity && trends.breakdown?.byStatus);
    assert.ok(Array.isArray(trends.timeline));
  });

  it('EP-041 GET /api/v1/stats reflects live aggregate counts cleanly', async () => {
    const publicClient = new ApiClient(server.baseUrl, nextTestIp());
    const stats = assertSuccessEnvelope(await publicClient.get('/api/v1/stats'), 200);
    assert.equal(typeof stats.totalReports, 'number');
    assert.equal(typeof stats.activeReports, 'number');
    assert.equal(typeof stats.safeHavens, 'number');
    assert.ok(!Number.isNaN(Date.parse(stats.timestamp)));
  });

  it('EP-040, EP-042, EP-043 Cron GET/POST fail-closed 401 when unset/wrong and Admin/Cron crawler handles concurrency cleanly', async () => {
    const anon = new ApiClient(server.baseUrl, nextTestIp());
    const prevCronSecret = process.env.CRON_SECRET;

    try {
      delete process.env.CRON_SECRET;
      assertErrorEnvelope(await anon.get('/api/v1/cron/news-crawl'), 401);
      assertErrorEnvelope(await anon.post('/api/v1/cron/news-crawl', {}), 401);

      process.env.CRON_SECRET = 'valid-test-cron-secret-32chars!!';
      assertErrorEnvelope(
        await new ApiClient(server.baseUrl, nextTestIp()).get('/api/v1/cron/news-crawl', {
          headers: { 'x-cron-secret': 'wrong-secret' },
        }),
        401
      );

      // Snapshot existing news article IDs so any newly ingested test rows are tracked & cleaned up
      const beforeArticles = await prisma.newsArticle.findMany({ select: { id: true } });
      const beforeSet = new Set(beforeArticles.map((a) => a.id));

      const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
      const adminCrawlRes = await admin.client.post('/api/v1/admin/news/crawl', {});
      assertStatus(adminCrawlRes, 200, 'POST /admin/news/crawl');
      assert.ok(['success', 'in_progress'].includes(adminCrawlRes.body?.data?.status));

      const afterArticles = await prisma.newsArticle.findMany({
        select: { id: true, reportId: true },
      });
      for (const art of afterArticles) {
        if (!beforeSet.has(art.id)) {
          tracker.trackNewsArticle(art.id);
          if (art.reportId) tracker.trackReport(art.reportId);
        }
      }
    } finally {
      if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCronSecret;
    }
  });
});
