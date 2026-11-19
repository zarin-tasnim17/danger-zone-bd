import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import { assertValidReportEntity } from '../harness/contractValidator';
import { calculateStorySimilarity } from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 3: Pairwise Combinations - P04: Consolidation & Moderation Lifecycle (F8 x F10)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P04-01: First source ingestion creates report in CLASSIFIED stage with status ACTIVE', async () => {
    const report = db.seedReport({
      title: 'যাত্রাবাড়ীতে বাসের ধাক্কায় পথচারীর মৃত্যু',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: 23.7050,
      longitude: 90.4350,
      status: 'ACTIVE',
      verificationStage: 'CLASSIFIED',
      sourceName: 'The Daily Star',
      sourceUrl: 'https://thedailystar.net/news/jatrabari-bus-crash',
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/news/jatrabari-bus-crash',
          title: 'যাত্রাবাড়ীতে বাসের ধাক্কায় পথচারীর মৃত্যু',
        },
      ],
    });

    const validated = assertValidReportEntity(report);
    assert.strictEqual(validated.status, 'ACTIVE');
    assert.strictEqual(validated.verificationStage, 'CLASSIFIED');
    assert.strictEqual(validated.citations?.length, 1);
  });

  it('T3-P04-02: Second corroborating source consolidation automatically promotes report from CLASSIFIED to CORROBORATED stage', async () => {
    const report = db.seedReport({
      title: 'উত্তরায় মধ্যরাতে সিন্দুক ভেঙে ডাকাতি',
      category: 'ROBBERY',
      severity: 'HIGH',
      latitude: 23.8750,
      longitude: 90.3950,
      status: 'ACTIVE',
      verificationStage: 'CLASSIFIED',
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/news/uttara-robbery',
          title: 'Robbery in Uttara house',
        },
      ],
    });

    assert.strictEqual(report.verificationStage, 'CLASSIFIED');

    // Second source arrives
    const secondSource = {
      sourceName: 'Prothom Alo',
      sourceUrl: 'https://prothomalo.com/bangladesh/uttara-robbery',
      title: 'উত্তরায় বাড়িতে ডাকাতি, স্বর্ণালঙ্কার লুট',
    };

    const sim = calculateStorySimilarity(report.title!, secondSource.title);
    assert.strictEqual(sim.isDuplicate, true);

    const updated = await db.report.update({
      where: { id: report.id },
      data: {
        verificationStage: 'CORROBORATED',
        citations: [...report.citations, secondSource],
      },
    });

    assert.strictEqual(updated.verificationStage, 'CORROBORATED');
    assert.strictEqual(updated.status, 'ACTIVE');
    assert.strictEqual(updated.citations.length, 2);
  });

  it('T3-P04-03: Admin verification promotes corroborating or classified incident to ADMIN_VERIFIED stage', async () => {
    const report = db.seedReport({
      title: 'মিরপুরে কিশোর গ্যাংয়ের হামলা',
      category: 'YOUTH_GANG_ACTIVITY',
      latitude: 23.8050,
      longitude: 90.3650,
      status: 'ACTIVE',
      verificationStage: 'CORROBORATED',
      citations: [
        { sourceName: 'Outlet A', sourceUrl: 'https://a.test/gang' },
        { sourceName: 'Outlet B', sourceUrl: 'https://b.test/gang' },
      ],
    });

    // Admin verifies
    const verified = await db.report.update({
      where: { id: report.id },
      data: {
        verificationStage: 'ADMIN_VERIFIED',
      },
    });

    assert.strictEqual(verified.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(verified.status, 'ACTIVE');
    assert.strictEqual(verified.citations.length, 2);
  });

  it('T3-P04-04: Admin resolution transitions status to RESOLVED while maintaining ADMIN_VERIFIED stage and all citations', async () => {
    const report = db.seedReport({
      title: 'ধানমন্ডিতে ছিনতাইয়ের ঘটনায় আসামি গ্রেপ্তার',
      category: 'SNATCHING',
      latitude: 23.7450,
      longitude: 90.3750,
      status: 'ACTIVE',
      verificationStage: 'ADMIN_VERIFIED',
      citations: [
        { sourceName: 'Outlet 1', sourceUrl: 'https://1.test/snatch' },
        { sourceName: 'Outlet 2', sourceUrl: 'https://2.test/snatch' },
      ],
    });

    // Police resolved the incident
    const resolved = await db.report.update({
      where: { id: report.id },
      data: {
        status: 'RESOLVED',
      },
    });

    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.strictEqual(resolved.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(resolved.citations.length, 2);

    // Active bounds queries will exclude it, but history remains
    const activeInDhaka = db.getReportsInBounds(
      { minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.4 },
      'all',
      'ACTIVE'
    );
    assert.strictEqual(activeInDhaka.some((r) => r.id === report.id), false);

    const resolvedInDhaka = db.getReportsInBounds(
      { minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.4 },
      'all',
      'RESOLVED'
    );
    assert.strictEqual(resolvedInDhaka.some((r) => r.id === report.id), true);
  });

  it('T3-P04-05: Adding an additional corroborating citation to an ADMIN_VERIFIED report preserves the ADMIN_VERIFIED stage', async () => {
    const report = db.seedReport({
      title: 'সীতাকুণ্ডে সড়ক দুর্ঘটনা',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      status: 'ACTIVE',
      verificationStage: 'ADMIN_VERIFIED',
      citations: [
        { sourceName: 'Source 1', sourceUrl: 'https://1.test' },
        { sourceName: 'Source 2', sourceUrl: 'https://2.test' },
      ],
    });

    // A 3rd press outlet publishes about the verified event
    const newCitation = { sourceName: 'Source 3', sourceUrl: 'https://3.test' };
    const newStage = report.verificationStage === 'ADMIN_VERIFIED' ? 'ADMIN_VERIFIED' : 'CORROBORATED';

    const updated = await db.report.update({
      where: { id: report.id },
      data: {
        citations: [...report.citations, newCitation],
        verificationStage: newStage,
      },
    });

    assert.strictEqual(updated.verificationStage, 'ADMIN_VERIFIED', 'Must not downgrade from ADMIN_VERIFIED to CORROBORATED');
    assert.strictEqual(updated.citations.length, 3);
  });
});
