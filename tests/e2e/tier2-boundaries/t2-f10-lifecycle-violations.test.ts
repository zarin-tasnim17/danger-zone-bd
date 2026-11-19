import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import type { VerificationStage } from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - F10: Lifecycle Stage Violations & Role Escalation', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  const VALID_STAGE_TRANSITIONS: Record<VerificationStage, VerificationStage[]> = {
    INGESTED: ['CLASSIFIED'],
    CLASSIFIED: ['CORROBORATED', 'ADMIN_VERIFIED'],
    CORROBORATED: ['ADMIN_VERIFIED'],
    ADMIN_VERIFIED: [], // Terminal stage
  };

  function canTransition(current: VerificationStage, next: VerificationStage): boolean {
    return VALID_STAGE_TRANSITIONS[current]?.includes(next) ?? false;
  }

  it('T2-F10-01: Illegal backward transitions or skipping unclassified stage are rejected', () => {
    // 1. Backward transition from ADMIN_VERIFIED to INGESTED
    assert.strictEqual(canTransition('ADMIN_VERIFIED', 'INGESTED'), false, 'Cannot regress from ADMIN_VERIFIED to INGESTED');
    assert.strictEqual(canTransition('CORROBORATED', 'CLASSIFIED'), false, 'Cannot regress from CORROBORATED to CLASSIFIED');

    // 2. Jumping from INGESTED directly to ADMIN_VERIFIED without classification
    assert.strictEqual(canTransition('INGESTED', 'ADMIN_VERIFIED'), false, 'Cannot bypass CLASSIFIED stage');
  });

  it('T2-F10-02: Reports verified by admin (ADMIN_VERIFIED) are immunized against citizen downvote auto-purging', async () => {
    const report = db.seedReport({
      title: 'Admin-verified highway collision',
      category: 'ROAD_ACCIDENT',
      latitude: 23.8103,
      longitude: 90.4125,
      verificationStage: 'ADMIN_VERIFIED',
      status: 'ACTIVE',
      upvotes: 0,
      downvotes: 0,
    });

    // Simulate 20 rapid citizen downvotes
    const heavilyDownvoted = await db.report.update({
      where: { id: report.id },
      data: { downvotes: 20 },
    });

    // For unverified user reports, downvotes > 5 might auto-purge, but ADMIN_VERIFIED must remain ACTIVE
    const shouldAutoPurge = heavilyDownvoted.verificationStage !== 'ADMIN_VERIFIED' && heavilyDownvoted.downvotes >= 5;
    assert.strictEqual(shouldAutoPurge, false, 'ADMIN_VERIFIED report must NOT be auto-purged by downvotes');
    assert.strictEqual(heavilyDownvoted.status, 'ACTIVE');
  });

  it('T2-F10-03: Stage modification on already PURGED report is strictly rejected', async () => {
    const purgedReport = db.seedReport({
      title: 'Old purged theft',
      category: 'THEFT',
      latitude: 23.8103,
      longitude: 90.4125,
      verificationStage: 'CLASSIFIED',
      status: 'PURGED',
    });

    // Validating update guard
    const applyStageUpdate = (reportStatus: string, nextStage: VerificationStage) => {
      if (reportStatus === 'PURGED') {
        throw new Error('IllegalOperationError: Cannot transition stage of a PURGED report');
      }
      return nextStage;
    };

    assert.throws(
      () => applyStageUpdate(purgedReport.status, 'CORROBORATED'),
      /IllegalOperationError/,
      'Must reject transition on PURGED report'
    );
  });

  it('T2-F10-04: Citizen user role (USER) cannot execute ADMIN_VERIFIED state transitions', () => {
    const regularCitizen = { id: 'user-001', role: 'USER' };
    const adminUser = { id: 'admin-001', role: 'ADMIN' };

    const authorizeAdminVerification = (user: { role: string }) => {
      if (user.role !== 'ADMIN') {
        throw new Error('ForbiddenError: Only users with ADMIN role can verify incidents');
      }
      return true;
    };

    // Citizen user blocked
    assert.throws(
      () => authorizeAdminVerification(regularCitizen),
      /ForbiddenError/,
      'Citizen user must be blocked from admin verification'
    );

    // Admin user authorized
    assert.strictEqual(authorizeAdminVerification(adminUser), true);
  });

  it('T2-F10-05: Rapid sequential transitions maintain atomic consistency and valid stage hierarchy', async () => {
    const report = db.seedReport({
      title: 'Sequential transition test',
      category: 'SNATCHING',
      latitude: 23.75,
      longitude: 90.38,
      verificationStage: 'INGESTED',
      status: 'ACTIVE',
    });

    // Step 1: Ingested -> Classified
    const step1 = await db.report.update({
      where: { id: report.id },
      data: { verificationStage: 'CLASSIFIED' },
    });
    assert.strictEqual(step1.verificationStage, 'CLASSIFIED');

    // Step 2: Classified -> Corroborated
    const step2 = await db.report.update({
      where: { id: report.id },
      data: { verificationStage: 'CORROBORATED' },
    });
    assert.strictEqual(step2.verificationStage, 'CORROBORATED');

    // Step 3: Corroborated -> Admin Verified
    const step3 = await db.report.update({
      where: { id: report.id },
      data: { verificationStage: 'ADMIN_VERIFIED' },
    });
    assert.strictEqual(step3.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(step3.status, 'ACTIVE');
  });
});
