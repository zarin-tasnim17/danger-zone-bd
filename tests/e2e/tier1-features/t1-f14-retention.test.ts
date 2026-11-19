import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { BANGLADESH_BOUNDS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F14: Active Pin Retention Lifecycles', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F14-01: ROAD_ACCIDENT and THEFT incidents enforce strict 48-hour active map lifespan', () => {
    const accidentHours = db.getNewsCategoryLifespanHours('ROAD_ACCIDENT');
    const theftHours = db.getNewsCategoryLifespanHours('THEFT');

    assert.strictEqual(accidentHours, 48, 'ROAD_ACCIDENT lifespan must be 48 hours');
    assert.strictEqual(theftHours, 48, 'THEFT lifespan must be 48 hours');

    const baseTime = new Date('2026-11-19T10:00:00Z');
    const accidentExpiry = db.calculateReportExpiry('ROAD_ACCIDENT', baseTime);
    assert.ok(accidentExpiry !== null);
    assert.strictEqual(
      accidentExpiry.getTime() - baseTime.getTime(),
      48 * 60 * 60 * 1000,
      'Expiry date must be exactly 48 hours in future'
    );
  });

  it('T1-F14-02: YOUTH_GANG_ACTIVITY and DRUG_RELATED_CRIME enforce 96-hour active hotspot retention', () => {
    const gangHours = db.getNewsCategoryLifespanHours('YOUTH_GANG_ACTIVITY');
    const drugHours = db.getNewsCategoryLifespanHours('DRUG_RELATED_CRIME');

    assert.strictEqual(gangHours, 96, 'YOUTH_GANG_ACTIVITY lifespan must be 96 hours');
    assert.strictEqual(drugHours, 96, 'DRUG_RELATED_CRIME lifespan must be 96 hours');

    const baseTime = new Date('2026-11-19T10:00:00Z');
    const gangExpiry = db.calculateReportExpiry('YOUTH_GANG_ACTIVITY', baseTime);
    assert.ok(gangExpiry !== null);
    assert.strictEqual(
      gangExpiry.getTime() - baseTime.getTime(),
      96 * 60 * 60 * 1000,
      'Gang hotspot expiry must be exactly 96 hours in future'
    );
  });

  it('T1-F14-03: UNLIT_ROAD hazard reports apply persistent hazard logic with null expiration', () => {
    const unlitHours = db.getNewsCategoryLifespanHours('UNLIT_ROAD');
    assert.strictEqual(unlitHours, null, 'UNLIT_ROAD lifespan must be null (persistent hazard logic)');

    const unlitExpiry = db.calculateReportExpiry('UNLIT_ROAD');
    assert.strictEqual(unlitExpiry, null, 'UNLIT_ROAD calculateReportExpiry must return null');

    const unlitReport = db.seedReport({
      category: 'UNLIT_ROAD',
      latitude: 23.75,
      longitude: 90.39,
      expiresAt: null,
      status: 'ACTIVE',
    });

    assert.strictEqual(unlitReport.expiresAt, null, 'Report expiresAt must remain null');
  });

  it('T1-F14-04: Automated retention decay purge routine atomically transitions expired active reports to PURGED', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    const expiredTime = new Date('2026-11-19T10:00:00Z'); // 2 hours ago
    const futureTime = new Date('2026-11-20T12:00:00Z');  // 24 hours in future

    // Seed 2 expired accident reports
    const exp1 = db.seedReport({
      category: 'ROAD_ACCIDENT',
      latitude: 23.81,
      longitude: 90.41,
      expiresAt: expiredTime,
      status: 'ACTIVE',
    });
    const exp2 = db.seedReport({
      category: 'THEFT',
      latitude: 23.82,
      longitude: 90.42,
      expiresAt: expiredTime,
      status: 'ACTIVE',
    });

    // Seed 1 active unexpired report
    const activeFuture = db.seedReport({
      category: 'YOUTH_GANG_ACTIVITY',
      latitude: 23.83,
      longitude: 90.43,
      expiresAt: futureTime,
      status: 'ACTIVE',
    });

    // Seed 1 persistent hazard (null expiry)
    const persistent = db.seedReport({
      category: 'UNLIT_ROAD',
      latitude: 23.84,
      longitude: 90.44,
      expiresAt: null,
      status: 'ACTIVE',
    });

    // Execute retention decay routine
    const purgeResult = db.purgeExpiredReports(now);

    assert.strictEqual(purgeResult.purgedCount, 2, 'Must purge exactly the 2 expired reports');
    assert.ok(purgeResult.purgedIds.includes(exp1.id));
    assert.ok(purgeResult.purgedIds.includes(exp2.id));

    // Verify active map query excludes purged reports
    const activePins = db.getReportsInBounds(BANGLADESH_BOUNDS, 'all', 'ACTIVE');
    assert.strictEqual(activePins.length, 2, 'Active map should contain only 2 unexpired/persistent reports');
    const activeIds = activePins.map((p) => p.id);
    assert.ok(activeIds.includes(activeFuture.id));
    assert.ok(activeIds.includes(persistent.id));
  });

  it('T1-F14-05: Historical records of purged reports remain intact in database for audit and analysis', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 10000);

    const report = db.seedReport({
      category: 'ROAD_ACCIDENT',
      latitude: 22.35,
      longitude: 91.78,
      expiresAt: past,
      status: 'ACTIVE',
    });

    db.purgeExpiredReports(now);

    // Verify the record is still in database with status PURGED
    const inDb = await db.report.findUnique({ where: { id: report.id } });
    assert.ok(inDb !== null, 'Purged record must remain in database');
    assert.strictEqual(inDb!.status, 'PURGED');
    assert.strictEqual(inDb!.category, 'ROAD_ACCIDENT');
  });
});
