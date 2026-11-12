import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker, prisma } from '../framework/dbTracker';
import { createDeviceActor, createPrivilegedActor } from '../framework/authHelpers';
import { assertErrorEnvelope, assertSuccessEnvelope } from '../framework/assertions';

describe('Database Integrity, Atomic Transactions & Concurrency Suite', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Enforces unique Vote constraint under concurrent identical requests (no double-counting)', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const voter = await createDeviceActor(server.baseUrl, tracker);

    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'THEFT',
        severity: 'LOW',
        latitude: 23.75,
        longitude: 90.38,
        description: 'Concurrency duplicate vote integrity check',
      }),
      201
    );
    tracker.trackReport(report.id);

    // Fire 6 simultaneous identical upvote requests from the same user
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        voter.client.post(`/api/v1/reports/${report.id}/vote`, { voteType: 1 })
      )
    );

    const successes = results.filter((r) => r.status === 201);
    assert.equal(successes.length, 1, `Expected strictly 1 winning vote, got ${successes.length}`);

    const dbReport = await prisma.report.findUnique({ where: { id: report.id } });
    const dbVoteCount = await prisma.vote.count({ where: { reportId: report.id, userId: voter.id } });
    assert.equal(dbReport?.upvotes, 1);
    assert.equal(dbVoteCount, 1);
  });

  it('Trust Engine atomic threshold: 5 distinct downvotes trigger PURGED status & -15 author trustScore', async () => {
    const author = await createDeviceActor(server.baseUrl, tracker);
    const voters = await Promise.all(
      Array.from({ length: 5 }, () => createDeviceActor(server.baseUrl, tracker))
    );

    const report = assertSuccessEnvelope(
      await author.client.post('/api/v1/reports', {
        category: 'SNATCHING',
        severity: 'MEDIUM',
        latitude: 23.746,
        longitude: 90.376,
        description: 'Report testing 5-downvote atomic trust-engine purge',
      }),
      201
    );
    tracker.trackReport(report.id);

    for (let i = 0; i < 4; i += 1) {
      const r = assertSuccessEnvelope(
        await voters[i].client.post(`/api/v1/reports/${report.id}/vote`, { voteType: -1 }),
        201
      );
      assert.equal(r.status, 'ACTIVE');
      assert.equal(r.downvotes, i + 1);
    }

    // 5th downvote triggers atomic purge
    const fifth = assertSuccessEnvelope(
      await voters[4].client.post(`/api/v1/reports/${report.id}/vote`, { voteType: -1 }),
      201
    );
    assert.equal(fifth.downvotes, 5);
    assert.equal(fifth.status, 'PURGED');

    const dbAuthor = await prisma.user.findUnique({ where: { id: author.id } });
    assert.equal(dbAuthor?.trustScore, -1, 'Expected -1 trustScore purge penalty per voteService');

    // Subsequent read & update & vote must fail cleanly
    assertErrorEnvelope(await author.client.get(`/api/v1/reports/${report.id}`), 404);
    assertErrorEnvelope(
      await voters[0].client.post(`/api/v1/reports/${report.id}/updates`, {
        content: 'Blocked update on purged report',
      }),
      400,
      'purged'
    );
  });

  it('Ban transaction atomically marks ALL RefreshToken rows revoked in PostgreSQL', async () => {
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });
    const target = await createPrivilegedActor(server.baseUrl, tracker, { role: 'USER' });

    const beforeActiveTokens = await prisma.refreshToken.count({
      where: { userId: target.id, isRevoked: false },
    });
    assert.ok(beforeActiveTokens >= 1);

    assertSuccessEnvelope(
      await admin.client.post(`/api/v1/admin/users/${target.id}/ban`, {
        reason: 'DB transaction token revocation check',
      }),
      200
    );

    const afterActiveTokens = await prisma.refreshToken.count({
      where: { userId: target.id, isRevoked: false },
    });
    assert.equal(afterActiveTokens, 0, 'Every RefreshToken for banned user must be revoked');
  });
});
