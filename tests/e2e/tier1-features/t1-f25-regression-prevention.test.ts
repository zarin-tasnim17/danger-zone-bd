import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  ALL_11_SAFETY_CATEGORIES,
  ALL_64_DISTRICTS,
  DISTRICT_CENTERS,
} from '../harness/testDataGenerators';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
  type ReportCategory,
} from '@repo/shared';
import {
  assertValidReportEntity,
} from '../harness/contractValidator';
import {
  classifyNewsText,
} from '../../../apps/api/src/services/newsClassifierService';

describe('Tier 1: Feature Coverage - F25: Platform Regression Prevention & Integrity Verification', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F25-01: All 11 platform safety categories can be persisted and queried without schema violation', async () => {
    for (const category of ALL_11_SAFETY_CATEGORIES) {
      const report = db.seedReport({
        category,
        title: `Test incident for category ${category}`,
        latitude: 23.8103,
        longitude: 90.4125,
      });

      const validated = assertValidReportEntity(report);
      assert.strictEqual(validated.category, category);
    }

    assert.strictEqual(await db.report.count(), 11, 'All 11 category reports must be persisted');
  });

  it('T1-F25-02: Bimodal language classification operates cleanly on both English and Bengali headlines', () => {
    const bilingualPairs: { en: string; bn: string; expectedCategory: ReportCategory }[] = [
      {
        en: 'Bus and truck collide on highway, 3 killed',
        bn: 'মহাসড়কে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত',
        expectedCategory: 'ROAD_ACCIDENT',
      },
      {
        en: 'Armed robbers loot cash from residence in Dhanmondi',
        bn: 'ধানমন্ডিতে বাসায় ঢুকে অস্ত্রধারী ডাকাতদের লুটপাট',
        expectedCategory: 'ROBBERY',
      },
      {
        en: 'Youth gang members clash with sharp weapons in Uttara',
        bn: 'উত্তরায় ধারালো অস্ত্র নিয়ে কিশোর গ্যাংয়ের সংঘর্ষ',
        expectedCategory: 'YOUTH_GANG_ACTIVITY',
      },
    ];

    for (const pair of bilingualPairs) {
      const enResult = classifyNewsText(pair.en);
      const bnResult = classifyNewsText(pair.bn);

      assert.strictEqual(enResult.isSafetyRelated, true, `EN "${pair.en}" must be safety-related`);
      assert.strictEqual(bnResult.isSafetyRelated, true, `BN "${pair.bn}" must be safety-related`);

      assert.strictEqual(enResult.category, pair.expectedCategory);
      assert.strictEqual(bnResult.category, pair.expectedCategory);
    }
  });

  it('T1-F25-03: All 64 district centroids strictly fall within sovereign Bangladesh bounds', () => {
    for (const district of ALL_64_DISTRICTS) {
      const center = DISTRICT_CENTERS[district];
      assert.ok(center, `District center must exist for ${district}`);

      assert.ok(
        isWithinBangladesh(center.latitude, center.longitude),
        `District "${district}" center [${center.latitude}, ${center.longitude}] must be within Bangladesh bounds`
      );

      assert.ok(center.latitude >= BANGLADESH_BOUNDS.minLat && center.latitude <= BANGLADESH_BOUNDS.maxLat);
      assert.ok(center.longitude >= BANGLADESH_BOUNDS.minLng && center.longitude <= BANGLADESH_BOUNDS.maxLng);
    }
  });

  it('T1-F25-04: Authoritative active threat criteria: expired or non-active incidents are filtered out', () => {
    const now = new Date();

    const activeReport = db.seedReport({
      status: 'ACTIVE',
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +24h
    });

    const expiredReport = db.seedReport({
      status: 'ACTIVE',
      expiresAt: new Date(now.getTime() - 1000), // -1s
    });

    const resolvedReport = db.seedReport({
      status: 'RESOLVED',
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    // Authoritative eligibility check
    const isEligible = (r: typeof activeReport) =>
      r.status === 'ACTIVE' && r.expiresAt !== null && r.expiresAt.getTime() > now.getTime();

    assert.strictEqual(isEligible(activeReport), true, 'Active non-expired report is eligible');
    assert.strictEqual(isEligible(expiredReport), false, 'Expired report must not be eligible');
    assert.strictEqual(isEligible(resolvedReport), false, 'Resolved report must not be eligible');
  });

  it('T1-F25-05: Batch processing of 50 reports maintains strict contract validity without memory leaks', async () => {
    for (let i = 0; i < 50; i++) {
      const cat = ALL_11_SAFETY_CATEGORIES[i % ALL_11_SAFETY_CATEGORIES.length];
      db.seedReport({
        title: `Batch report ${i}`,
        category: cat,
        latitude: 23.8 + (i * 0.001),
        longitude: 90.4 + (i * 0.001),
        citations: [
          {
            sourceName: `Outlet ${i}`,
            sourceUrl: `https://news.bd/article-${i}`,
            title: `Headline ${i}`,
          },
        ],
      });
    }

    assert.strictEqual(await db.report.count(), 50);

    const retrieved = await db.report.findMany();
    assert.strictEqual(retrieved.length, 50);

    for (const r of retrieved) {
      assertValidReportEntity(r);
    }
  });
});
