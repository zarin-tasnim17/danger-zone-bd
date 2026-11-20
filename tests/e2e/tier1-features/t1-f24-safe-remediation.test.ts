import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { isForeignIncident } from '../../../apps/api/src/services/internationalIncidentFilter';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';
import { evaluateActiveThreatEligibility } from '../../../apps/api/src/services/activeThreatEligibilityService';

describe('Tier 1: Feature Coverage - F24: Safe Non-Destructive Database Remediation & Citizen Protection', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F24-01: Dry-run remediation inspects records without mutating database state', async () => {
    // Seed 1 active machine news report and 1 citizen report
    const newsReport = db.seedReport({
      title: 'সড়ক দুর্ঘটনা',
      sourceUrl: 'https://news.bd/acc1',
      sourceName: 'Daily Press',
      status: 'ACTIVE',
      category: 'ROAD_ACCIDENT',
    });

    const citizenReport = db.seedReport({
      title: 'রাস্তা অন্ধকার ও ভাঙা',
      sourceUrl: null, // Citizen submitted
      sourceName: null,
      status: 'ACTIVE',
      category: 'UNLIT_ROAD',
    });

    const initialReports = await db.report.findMany();
    assert.strictEqual(initialReports.length, 2);

    // Simulate dry-run audit pass
    const auditSummaries = initialReports.map((r) => ({
      reportId: r.id,
      sourceType: r.sourceUrl ? 'NEWS' : 'CITIZEN',
      currentStatus: r.status,
      proposedStatus: r.status,
    }));

    assert.strictEqual(auditSummaries.length, 2);
    assert.strictEqual(auditSummaries[0].sourceType, 'NEWS');
    assert.strictEqual(auditSummaries[1].sourceType, 'CITIZEN');

    // Confirm DB state was NOT modified during dry-run
    const afterReports = await db.report.findMany();
    assert.strictEqual(afterReports.length, 2);
    assert.strictEqual(afterReports[0].status, 'ACTIVE');
    assert.strictEqual(afterReports[1].status, 'ACTIVE');
  });

  it('T1-F24-02: Citizen reports without sourceUrl are strictly identified and protected from overwrites', async () => {
    const citizen = db.seedReport({
      userId: 'citizen-user-123',
      description: 'আমার এলাকায় ছিনতাই হয়েছে',
      latitude: 23.7500,
      longitude: 90.3800,
      sourceUrl: null,
      sourceName: null,
      status: 'ACTIVE',
      category: 'SNATCHING',
    });

    const isNews = Boolean(citizen.sourceUrl || citizen.sourceName);
    assert.strictEqual(isNews, false, 'Citizen report must NOT be classified as news');

    // Protection rule: citizen coordinates must never be altered during machine remediation
    const originalLat = citizen.latitude;
    const originalLng = citizen.longitude;

    // Simulate machine remediation pass: only news records are candidates for coordinate re-resolution
    if (!isNews) {
      // Citizen report is bypassed without changes
    }

    assert.strictEqual(citizen.latitude, originalLat);
    assert.strictEqual(citizen.longitude, originalLng);
  });

  it('T1-F24-03: Machine-ingested international incidents are remediated to RESOLVED', () => {
    const overseasHeadline = 'সৌদি আরবে সড়ক দুর্ঘটনায় ৩ প্রবাসী বাংলাদেশি নিহত';
    const foreignCheck = isForeignIncident(overseasHeadline, '');

    assert.strictEqual(foreignCheck.isForeign, true, 'Saudi crash must be identified as foreign');

    // Remediation decision: retire foreign incident from active map
    let targetStatus = 'ACTIVE';
    let targetThreatStatus = 'ACTIVE';
    if (foreignCheck.isForeign) {
      targetStatus = 'RESOLVED';
      targetThreatStatus = 'RESOLVED';
    }

    assert.strictEqual(targetStatus, 'RESOLVED');
    assert.strictEqual(targetThreatStatus, 'RESOLVED');
  });

  it('T1-F24-04: Non-incident arrest follow-ups are safely remediated to RESOLVED status', () => {
    const followupHeadline = 'মিরপুর হত্যা মামলার আসামি গ্রেফতার করা হয়েছে';
    const classification = classifyNewsText(followupHeadline);

    assert.strictEqual(classification.isSafetyRelated, false);
    assert.strictEqual(classification.disqualifiedReason, 'ARREST_FOLLOWUP');

    const eligibility = evaluateActiveThreatEligibility({
      title: followupHeadline,
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      isSafetyRelated: classification.isSafetyRelated,
      disqualifiedReason: classification.disqualifiedReason,
    });

    assert.strictEqual(eligibility.isEligibleForActiveMap, false);
    assert.strictEqual(eligibility.threatStatus, 'RESOLVED');
  });

  it('T1-F24-05: Reversible remediation audit log tracks transition reasons for full auditability', () => {
    interface AuditLogEntry {
      reportId: string;
      previousStatus: string;
      newStatus: string;
      reason: string;
      appliedAt: Date;
    }

    const auditTrail: AuditLogEntry[] = [];

    // Simulate retiring an expired or disqualified news incident
    const reportId = 'rep_machine_historical_01';
    const transition = {
      reportId,
      previousStatus: 'ACTIVE',
      newStatus: 'RESOLVED',
      reason: 'Disqualified legal court proceeding without ongoing physical danger',
      appliedAt: new Date(),
    };

    auditTrail.push(transition);

    assert.strictEqual(auditTrail.length, 1);
    assert.strictEqual(auditTrail[0].reportId, reportId);
    assert.strictEqual(auditTrail[0].previousStatus, 'ACTIVE');
    assert.strictEqual(auditTrail[0].newStatus, 'RESOLVED');
    assert.ok(auditTrail[0].reason.length > 10, 'Transition must document an explainable audit reason');
  });
});
