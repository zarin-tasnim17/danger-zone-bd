import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { assertValidReportEntity } from '../harness/contractValidator';
import { BANGLADESH_BOUNDS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F10: Dual-Status Moderation Lifecycle', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F10-01: Newly ingested news articles initialize with verificationStage INGESTED or CLASSIFIED', () => {
    const report = db.seedReport({
      category: 'THEFT',
      latitude: 23.8103,
      longitude: 90.4125,
      verificationStage: 'CLASSIFIED',
      status: 'ACTIVE',
    });

    const validated = assertValidReportEntity(report);
    assert.ok(
      validated.verificationStage === 'INGESTED' || validated.verificationStage === 'CLASSIFIED',
      `Initial verification stage must be INGESTED or CLASSIFIED, got ${validated.verificationStage}`
    );
    assert.strictEqual(validated.status, 'ACTIVE', 'Initial report status must be ACTIVE');
  });

  it('T1-F10-02: Multi-outlet corroboration advances stage to CORROBORATED while keeping status ACTIVE', async () => {
    const report = db.seedReport({
      category: 'ROAD_ACCIDENT',
      latitude: 22.3569,
      longitude: 91.7832,
      verificationStage: 'CLASSIFIED',
      status: 'ACTIVE',
    });

    // Corroboration event occurs
    const updated = await db.report.update({
      where: { id: report.id },
      data: { verificationStage: 'CORROBORATED' },
    });

    assert.strictEqual(updated.verificationStage, 'CORROBORATED');
    assert.strictEqual(updated.status, 'ACTIVE', 'Status must remain ACTIVE for map rendering');
  });

  it('T1-F10-03: Admin verification promotes stage to ADMIN_VERIFIED', async () => {
    const report = db.seedReport({
      category: 'ARMED_ASSAULT',
      latitude: 24.3745,
      longitude: 88.6042,
      verificationStage: 'CORROBORATED',
      status: 'ACTIVE',
    });

    // Admin verifies incident
    const verified = await db.report.update({
      where: { id: report.id },
      data: { verificationStage: 'ADMIN_VERIFIED' },
    });

    assert.strictEqual(verified.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(verified.status, 'ACTIVE');
  });

  it('T1-F10-04: PostGIS spatial bounding box queries return ACTIVE reports across all lifecycle stages', () => {
    // Seed reports with different lifecycle stages in Dhaka
    db.seedReport({
      id: 'rep-ingested',
      category: 'SNATCHING',
      latitude: 23.80,
      longitude: 90.40,
      verificationStage: 'INGESTED',
      status: 'ACTIVE',
    });
    db.seedReport({
      id: 'rep-classified',
      category: 'THEFT',
      latitude: 23.81,
      longitude: 90.41,
      verificationStage: 'CLASSIFIED',
      status: 'ACTIVE',
    });
    db.seedReport({
      id: 'rep-corroborated',
      category: 'ROAD_ACCIDENT',
      latitude: 23.82,
      longitude: 90.42,
      verificationStage: 'CORROBORATED',
      status: 'ACTIVE',
    });
    db.seedReport({
      id: 'rep-admin-verified',
      category: 'ROBBERY',
      latitude: 23.83,
      longitude: 90.43,
      verificationStage: 'ADMIN_VERIFIED',
      status: 'ACTIVE',
    });
    // Inactive report (should be excluded)
    db.seedReport({
      id: 'rep-purged',
      category: 'THEFT',
      latitude: 23.81,
      longitude: 90.41,
      verificationStage: 'ADMIN_VERIFIED',
      status: 'PURGED',
    });

    const activeInDhaka = db.getReportsInBounds(
      { minLat: 23.70, minLng: 90.30, maxLat: 23.90, maxLng: 90.50 },
      'all',
      'ACTIVE'
    );

    assert.strictEqual(activeInDhaka.length, 4, 'Must return all 4 ACTIVE reports regardless of stage');
    const stages = new Set(activeInDhaka.map((r) => r.verificationStage));
    assert.ok(stages.has('INGESTED'));
    assert.ok(stages.has('CLASSIFIED'));
    assert.ok(stages.has('CORROBORATED'));
    assert.ok(stages.has('ADMIN_VERIFIED'));
  });

  it('T1-F10-05: Admin moderation resolution transitions status to RESOLVED while preserving audit history', async () => {
    const report = db.seedReport({
      category: 'UNLIT_ROAD',
      latitude: 23.74,
      longitude: 90.38,
      status: 'ACTIVE',
      verificationStage: 'ADMIN_VERIFIED',
    });

    // Admin resolves road hazard
    const resolved = await db.report.update({
      where: { id: report.id },
      data: { status: 'RESOLVED' },
    });

    assert.strictEqual(resolved.status, 'RESOLVED');

    // Report must not appear in ACTIVE map queries
    const activeReports = db.getReportsInBounds(BANGLADESH_BOUNDS, 'all', 'ACTIVE');
    assert.ok(!activeReports.some((r) => r.id === report.id), 'RESOLVED report must not appear on active map');

    // But record must still exist in DB for audit trail
    const inDb = await db.report.findUnique({ where: { id: report.id } });
    assert.ok(inDb !== null, 'Report must be preserved in database');
    assert.strictEqual(inDb!.status, 'RESOLVED');
  });
});
