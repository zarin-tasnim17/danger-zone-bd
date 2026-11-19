import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';
import { assertValidReportEntity } from '../harness/contractValidator';
import type { ReportCategory } from '@repo/shared';

describe('Tier 3: Pairwise Combinations - P06: Classification & Retention Lifecycles (F9 x F14)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P06-01: Articles classified as ROAD_ACCIDENT or THEFT receive exactly 48-hour active lifespan', () => {
    const now = new Date('2026-11-19T12:00:00Z');

    // Test ROAD_ACCIDENT
    const accidentText = 'যাত্রাবাড়ীতে বাসের ধাক্কায় রিকশাচালক নিহত';
    const accidentClassified = classifyNewsText(accidentText);
    assert.strictEqual(accidentClassified.category, 'ROAD_ACCIDENT');

    const accidentExpiry = db.calculateReportExpiry(accidentClassified.category, now);
    assert.ok(accidentExpiry !== null);
    const accidentDurationHours = (accidentExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(accidentDurationHours, 48, 'ROAD_ACCIDENT active lifespan must be exactly 48 hours');

    // Test THEFT
    const theftText = 'মিরপুরে বাসা থেকে স্বর্ণালঙ্কার ও নগদ অর্থ চুরি';
    const theftClassified = classifyNewsText(theftText);
    assert.strictEqual(theftClassified.category, 'THEFT');

    const theftExpiry = db.calculateReportExpiry(theftClassified.category, now);
    assert.ok(theftExpiry !== null);
    const theftDurationHours = (theftExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(theftDurationHours, 48, 'THEFT active lifespan must be exactly 48 hours');
  });

  it('T3-P06-02: Articles classified as YOUTH_GANG_ACTIVITY or DRUG_RELATED_CRIME receive 96-hour active hotspot retention', () => {
    const now = new Date('2026-11-19T12:00:00Z');

    // Test YOUTH_GANG_ACTIVITY
    const gangText = 'মোহাম্মদপুরে কিশোর গ্যাংয়ের দুই পক্ষের মধ্যে সংঘর্ষ';
    const gangClassified = classifyNewsText(gangText);
    assert.strictEqual(gangClassified.category, 'YOUTH_GANG_ACTIVITY');

    const gangExpiry = db.calculateReportExpiry(gangClassified.category, now);
    assert.ok(gangExpiry !== null);
    const gangDurationHours = (gangExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(gangDurationHours, 96, 'YOUTH_GANG_ACTIVITY active lifespan must be 96 hours');

    // Test DRUG_RELATED_CRIME
    const drugText = 'কক্সবাজারে বিপুল ইয়াবাসহ চিহ্নিত মাদক কারবারি আটক';
    const drugClassified = classifyNewsText(drugText);
    assert.strictEqual(drugClassified.category, 'DRUG_RELATED_CRIME');

    const drugExpiry = db.calculateReportExpiry(drugClassified.category, now);
    assert.ok(drugExpiry !== null);
    const drugDurationHours = (drugExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(drugDurationHours, 96, 'DRUG_RELATED_CRIME active lifespan must be 96 hours');
  });

  it('T3-P06-03: Articles classified as UNLIT_ROAD receive persistent hazard retention (expiresAt: null)', () => {
    const unlitText = 'কেরানীগঞ্জে ভাঙা রাস্তায় সড়ক বাতি নেই, রাতের আঁধারে বাড়ছে দুর্ঘটনা';
    const unlitClassified = classifyNewsText(unlitText);
    assert.strictEqual(unlitClassified.category, 'UNLIT_ROAD');

    const unlitExpiry = db.calculateReportExpiry(unlitClassified.category, new Date());
    assert.strictEqual(unlitExpiry, null, 'UNLIT_ROAD persistent hazards must have expiresAt: null');

    const seeded = db.seedReport({
      title: unlitText,
      category: unlitClassified.category,
      latitude: 23.6800,
      longitude: 90.3500,
      expiresAt: null,
    });
    assert.strictEqual(seeded.expiresAt, null);

    const validated = assertValidReportEntity(seeded);
    assert.strictEqual(validated.expiresAt, null);
  });

  it('T3-P06-04: Compound categories (THEFT_ROBBERY and SNATCHING_ARMED_ASSAULT) receive appropriate crime lifespan (72 hours)', () => {
    const now = new Date('2026-11-19T12:00:00Z');

    const theftRobberyExpiry = db.calculateReportExpiry('THEFT_ROBBERY', now);
    assert.ok(theftRobberyExpiry !== null);
    const trHours = (theftRobberyExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(trHours, 72);

    const snatchAssaultExpiry = db.calculateReportExpiry('SNATCHING_ARMED_ASSAULT', now);
    assert.ok(snatchAssaultExpiry !== null);
    const saHours = (snatchAssaultExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60);
    assert.strictEqual(saHours, 72);
  });

  it('T3-P06-05: Progressive time advancement purges accidents at 48h while preserving gangs at 96h and unlit roads persistently', async () => {
    const t0 = new Date('2026-11-19T00:00:00Z');

    const accidentReport = db.seedReport({
      title: 'সড়ক দুর্ঘটনা',
      category: 'ROAD_ACCIDENT',
      latitude: 23.7,
      longitude: 90.4,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
    });

    const gangReport = db.seedReport({
      title: 'কিশোর গ্যাং সংঘর্ষ',
      category: 'YOUTH_GANG_ACTIVITY',
      latitude: 23.8,
      longitude: 90.3,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 96 * 3600 * 1000),
    });

    const unlitReport = db.seedReport({
      title: 'অন্ধকার ভাঙা রাস্তা',
      category: 'UNLIT_ROAD',
      latitude: 23.6,
      longitude: 90.5,
      createdAt: t0,
      expiresAt: null,
    });

    // At t0 + 24 hours: all 3 remain ACTIVE
    const t24 = new Date(t0.getTime() + 24 * 3600 * 1000);
    const purge24 = db.purgeExpiredReports(t24);
    assert.strictEqual(purge24.purgedCount, 0);

    // At t0 + 49 hours: accidentReport expires and is purged
    const t49 = new Date(t0.getTime() + 49 * 3600 * 1000);
    const purge49 = db.purgeExpiredReports(t49);
    assert.strictEqual(purge49.purgedCount, 1);
    assert.strictEqual(purge49.purgedIds[0], accidentReport.id);

    const acc = await db.report.findUnique({ where: { id: accidentReport.id } });
    const gng = await db.report.findUnique({ where: { id: gangReport.id } });
    const unl = await db.report.findUnique({ where: { id: unlitReport.id } });

    assert.strictEqual(acc?.status, 'PURGED');
    assert.strictEqual(gng?.status, 'ACTIVE');
    assert.strictEqual(unl?.status, 'ACTIVE');

    // At t0 + 97 hours: gangReport expires and is purged
    const t97 = new Date(t0.getTime() + 97 * 3600 * 1000);
    const purge97 = db.purgeExpiredReports(t97);
    assert.strictEqual(purge97.purgedCount, 1);
    assert.strictEqual(purge97.purgedIds[0], gangReport.id);

    const gngAfter = await db.report.findUnique({ where: { id: gangReport.id } });
    const unlAfter = await db.report.findUnique({ where: { id: unlitReport.id } });
    assert.strictEqual(gngAfter?.status, 'PURGED');
    assert.strictEqual(unlAfter?.status, 'ACTIVE', 'Persistent UNLIT_ROAD must remain ACTIVE');
  });
});
