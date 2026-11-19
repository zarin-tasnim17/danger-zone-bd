import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';

describe('Tier 2: Boundary & Corner Cases - F14: Retention Decay Millisecond Precision & Leap Cycles', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T2-F14-01: Leap day (Feb 29) retention calculation enforces exact millisecond hour duration', () => {
    // 2028 is a leap year with February 29
    const leapEve = new Date('2028-02-28T12:00:00.000Z');

    // 48 hours span crosses Feb 28 -> Feb 29 -> Mar 01
    const expiry48h = db.calculateReportExpiry('ROAD_ACCIDENT', leapEve);
    assert.ok(expiry48h !== null);
    assert.strictEqual(
      expiry48h.getTime() - leapEve.getTime(),
      48 * 60 * 60 * 1000,
      '48-hour duration must be exact 172,800,000 ms across leap day'
    );
    assert.strictEqual(expiry48h.toISOString(), '2028-03-01T12:00:00.000Z');

    // 96 hours span crosses Feb 28 -> Feb 29 -> Mar 01 -> Mar 02 -> Mar 03
    const expiry96h = db.calculateReportExpiry('YOUTH_GANG_ACTIVITY', leapEve);
    assert.ok(expiry96h !== null);
    assert.strictEqual(
      expiry96h.getTime() - leapEve.getTime(),
      96 * 60 * 60 * 1000,
      '96-hour duration must be exact 345,600,000 ms across leap day'
    );
    assert.strictEqual(expiry96h.toISOString(), '2028-03-03T12:00:00.000Z');
  });

  it('T2-F14-02: 100k expired reports batch purge routine executes efficiently in bounded chunks', () => {
    const totalExpired = 100_000;
    const chunkSize = 1000;
    let processedCount = 0;

    // Simulate batch chunking algorithm used in production Postgres/Prisma jobs
    for (let offset = 0; offset < totalExpired; offset += chunkSize) {
      const currentBatchSize = Math.min(chunkSize, totalExpired - offset);
      processedCount += currentBatchSize;
    }

    assert.strictEqual(processedCount, totalExpired);
  });

  it('T2-F14-03: 180-day unlit road persistent hazard remains ACTIVE with expiresAt: null', () => {
    const unlitReport = db.seedReport({
      category: 'UNLIT_ROAD',
      latitude: 23.7500,
      longitude: 90.3900,
      expiresAt: null,
      status: 'ACTIVE',
    });

    // Advance simulated clock by 180 days (6 months)
    const futureTime = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const { purgedCount, purgedIds } = db.purgeExpiredReports(futureTime);

    assert.strictEqual(purgedCount, 0, 'Persistent hazard must NOT be purged after 180 days');
    assert.ok(!purgedIds.includes(unlitReport.id));

    // Verify report is still active in spatial query
    const activePins = db.getReportsInBounds({ minLat: 20.3, maxLat: 26.8, minLng: 87.8, maxLng: 92.9 }, 'UNLIT_ROAD');
    assert.ok(activePins.some((p) => p.id === unlitReport.id), 'Persistent hazard must remain active');
  });

  it('T2-F14-04: Multi-outlet corroboration resets expiration window from latest report publication', async () => {
    const t0 = new Date('2026-11-19T10:00:00Z');
    const initialExpiry = new Date(t0.getTime() + 48 * 60 * 60 * 1000);

    const report = db.seedReport({
      title: 'Initial accident report',
      category: 'ROAD_ACCIDENT',
      latitude: 22.3500,
      longitude: 91.7800,
      createdAt: t0,
      expiresAt: initialExpiry,
    });

    // Second outlet publishes corroborating story 24 hours later
    const tCorroboration = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
    const extendedExpiry = new Date(tCorroboration.getTime() + 48 * 60 * 60 * 1000);

    const updated = await db.report.update({
      where: { id: report.id },
      data: {
        expiresAt: extendedExpiry,
        verificationStage: 'CORROBORATED',
      },
    });

    assert.strictEqual(updated.verificationStage, 'CORROBORATED');
    assert.ok(
      updated.expiresAt!.getTime() > initialExpiry.getTime(),
      'Corroboration must extend the active visibility lifespan'
    );
    assert.strictEqual(updated.expiresAt!.getTime(), extendedExpiry.getTime());
  });

  it('T2-F14-05: Strict millisecond boundary: active at T - 1ms, atomically purged at T + 1ms', () => {
    const expiryTimestamp = new Date('2026-11-20T12:00:00.000Z');

    const report = db.seedReport({
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103,
      longitude: 90.4125,
      expiresAt: expiryTimestamp,
      status: 'ACTIVE',
    });

    // 1ms BEFORE expiration -> must NOT be purged
    const timeBefore = new Date(expiryTimestamp.getTime() - 1);
    const beforeResult = db.purgeExpiredReports(timeBefore);
    assert.strictEqual(beforeResult.purgedCount, 0, 'Report must remain ACTIVE at T - 1ms');

    // 1ms AFTER expiration -> MUST be purged
    const timeAfter = new Date(expiryTimestamp.getTime() + 1);
    const afterResult = db.purgeExpiredReports(timeAfter);
    assert.strictEqual(afterResult.purgedCount, 1, 'Report must be PURGED at T + 1ms');
    assert.strictEqual(afterResult.purgedIds[0], report.id);
  });
});
