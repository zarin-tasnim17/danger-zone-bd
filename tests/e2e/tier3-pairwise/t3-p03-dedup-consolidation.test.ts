import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  normalizeCanonicalUrl,
  cleanIncidentTitle,
  assertValidReportEntity,
} from '../harness/contractValidator';
import {
  calculateStorySimilarity,
  extractSignificantTokens,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 3: Pairwise Combinations - P03: Deduplication & Consolidation (F6 x F7 x F8)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P03-01: Reports with tracking UTM parameters from same outlet resolve to identical canonical URLs and are rejected as duplicates', () => {
    const rawUrl1 = 'https://thedailystar.net/news/bangladesh/accident-202?utm_source=facebook&utm_medium=social&ref=fbclid';
    const rawUrl2 = 'https://www.thedailystar.net/news/bangladesh/accident-202/?utm_campaign=breaking&fbclid=abc123xyz';

    const canonical1 = normalizeCanonicalUrl(rawUrl1);
    const canonical2 = normalizeCanonicalUrl(rawUrl2);

    assert.strictEqual(
      canonical1,
      canonical2,
      'Both tracking URLs must normalize to identical canonical representation'
    );
    assert.strictEqual(canonical1, 'https://thedailystar.net/news/bangladesh/accident-202');

    // Seed first article
    db.seedArticle({
      guid: 'guid-outlet-001',
      title: 'সীতাকুণ্ডে সড়ক দুর্ঘটনায় ৩ জনের মৃত্যু',
      sourceUrl: canonical1,
      sourceName: 'The Daily Star',
      category: 'ROAD_ACCIDENT',
    });

    const isUrlDuplicate = canonical1 === canonical2;
    assert.strictEqual(isUrlDuplicate, true, 'Second article with same canonical URL must be rejected');
  });

  it('T3-P03-02: Bilingual headlines from two different outlets with publisher suffixes are normalized and consolidated into a single incident', async () => {
    // Outlet A (The Daily Star - English with publisher suffix)
    const rawHeadlineA = '3 killed, 10 injured in Sitakunda bus-truck collision - The Daily Star';
    // Outlet B (Prothom Alo - Bangla with publisher suffix)
    const rawHeadlineB = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে ৩ জন নিহত | প্রথম আলো';

    const cleanA = cleanIncidentTitle(rawHeadlineA);
    const cleanB = cleanIncidentTitle(rawHeadlineB);

    assert.strictEqual(cleanA, '3 killed, 10 injured in Sitakunda bus-truck collision');
    assert.ok(!cleanB.includes('প্রথম আলো'));

    // Check cross-lingual story similarity
    const sim = calculateStorySimilarity(cleanA, cleanB);
    assert.strictEqual(sim.isDuplicate, true, 'Bilingual headlines describing same event must be recognized as duplicate');
    assert.ok(sim.sharedTokens.length >= 2, 'Should share core tokens (e.g. truck, bus, killed, sitakunda)');

    // Initial report seeded from Outlet A
    const report = db.seedReport({
      title: cleanA,
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      sourceName: 'The Daily Star',
      sourceUrl: normalizeCanonicalUrl('https://thedailystar.net/news/sitakunda-crash?utm_source=rss'),
      verificationStage: 'CLASSIFIED',
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/news/sitakunda-crash',
          title: cleanA,
        },
      ],
    });

    assert.strictEqual(await db.report.count(), 1);

    // Incoming report from Outlet B: Consolidate
    const consolidated = await db.report.update({
      where: { id: report.id },
      data: {
        verificationStage: 'CORROBORATED',
        citations: [
          ...report.citations,
          {
            sourceName: 'Prothom Alo',
            sourceUrl: normalizeCanonicalUrl('https://prothomalo.com/bangladesh/sitakunda-crash?ref=feed'),
            title: cleanB,
          },
        ],
      },
    });

    assert.strictEqual(await db.report.count(), 1, 'Consolidation preserves single report record');
    assert.strictEqual(consolidated.citations.length, 2);
    assert.strictEqual(consolidated.verificationStage, 'CORROBORATED');
  });

  it('T3-P03-03: Articles describing distinct incidents in same district are NOT falsely consolidated', () => {
    // Both in Dhaka, but one is a robbery and the other is a road accident
    const titleAccident = 'উত্তরায় বাসের ধাক্কায় মোটরসাইকেল আরোহী নিহত';
    const titleRobbery = 'উত্তরায় জুয়েলারি দোকানে সশস্ত্র ডাকাতির চেষ্টা';

    const sim = calculateStorySimilarity(titleAccident, titleRobbery);
    assert.strictEqual(
      sim.isDuplicate,
      false,
      'Distinct events in same district must NOT be identified as duplicate'
    );
  });

  it('T3-P03-04: Canonical URL stripping plus headline stemming allows 3 distinct news outlets to merge into 1 incident with 3 citations', async () => {
    const outlets = [
      {
        source: 'The Daily Star',
        rawUrl: 'https://www.thedailystar.net/news/bangladesh/farmgate-snatching?utm_source=fb&ref=123',
        headline: 'Snatching in Farmgate, money looted - The Daily Star',
      },
      {
        source: 'Dhaka Post',
        rawUrl: 'https://dhakapost.com/national/farmgate-snatching/?ref=twitter&utm_medium=cpc',
        headline: 'ফার্মগেটে ছিনতাইয়ের ঘটনায় টাকা লুণ্ঠন | ঢাকা পোস্ট',
      },
      {
        source: 'Bangla Tribune',
        rawUrl: 'https://www.banglatribune.com/crime/farmgate-snatching?fbclid=xyz987',
        headline: 'ফার্মগেটে ছিনতাইকালে টাকা লুট – বাংলা ট্রিবিউন',
      },
    ];

    // Seed report from outlet 0
    const primary = db.seedReport({
      title: cleanIncidentTitle(outlets[0].headline),
      category: 'SNATCHING',
      latitude: 23.7580,
      longitude: 90.3890,
      sourceName: outlets[0].source,
      sourceUrl: normalizeCanonicalUrl(outlets[0].rawUrl),
      verificationStage: 'CLASSIFIED',
      citations: [
        {
          sourceName: outlets[0].source,
          sourceUrl: normalizeCanonicalUrl(outlets[0].rawUrl),
          title: cleanIncidentTitle(outlets[0].headline),
        },
      ],
    });

    // Ingest outlets 1 and 2
    for (let i = 1; i < outlets.length; i++) {
      const cleaned = cleanIncidentTitle(outlets[i].headline);
      const canonical = normalizeCanonicalUrl(outlets[i].rawUrl);

      // Verify similarity to primary
      const sim = calculateStorySimilarity(cleaned, primary.title!);
      assert.strictEqual(sim.isDuplicate, true, `Outlet ${outlets[i].source} should match primary incident`);

      // Add citation
      primary.citations.push({
        sourceName: outlets[i].source,
        sourceUrl: canonical,
        title: cleaned,
      });
      primary.verificationStage = 'CORROBORATED';
    }

    const updated = await db.report.update({
      where: { id: primary.id },
      data: {
        citations: primary.citations,
        verificationStage: primary.verificationStage,
      },
    });

    assert.strictEqual(await db.report.count(), 1);
    assert.strictEqual(updated.citations.length, 3);
    assert.strictEqual(updated.verificationStage, 'CORROBORATED');

    const validated = assertValidReportEntity(updated);
    assert.strictEqual(validated.citations?.length, 3);
    for (const citation of validated.citations!) {
      assert.ok(!citation.sourceUrl.includes('utm_'));
      assert.ok(!citation.sourceUrl.includes('fbclid'));
      assert.ok(!citation.sourceUrl.includes('://www.'));
    }
  });

  it('T3-P03-05: Extreme variations in whitespace, double dari, en-dash, and URL tracking parameters preserve consolidation fidelity', () => {
    const rawHeadlineComplex = '  [Google News BD Theft]  মিরপুরে স্বর্ণালঙ্কার চুরি   ॥   বাসা থেকে ৫০ ভরি সোনা লুটের অভিযোগ   – বিস্তারিত  |  The Daily Star  ';
    const cleaned = cleanIncidentTitle(rawHeadlineComplex);

    assert.ok(!cleaned.includes('॥'));
    assert.ok(!cleaned.includes('–'));
    assert.ok(!cleaned.includes('The Daily Star'));
    assert.ok(!cleaned.includes('[Google News'));
    assert.ok(!cleaned.includes('   ')); // No multi-whitespace
    assert.ok(cleaned.includes('মিরপুরে স্বর্ণালঙ্কার চুরি'));

    const tokens = extractSignificantTokens(cleaned);
    assert.ok(tokens.has('চুরি') || tokens.has('theft'));
    assert.ok(tokens.has('mirpur') || tokens.has('মিরপুর'));
  });
});
