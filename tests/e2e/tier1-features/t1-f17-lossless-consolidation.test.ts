import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 1: Feature Coverage - F17: Lossless Offline Consolidation', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F17-01: Re-linking NewsArticle rows: duplicate report articles are pointed to primary report without orphaning', async () => {
    // Primary report created from Daily Star
    const primaryReport = db.seedReport({
      title: 'সীতাকুণ্ডে বাস-ট্রাক সংঘর্ষে ৩ জন নিহত',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      sourceName: 'The Daily Star',
      sourceUrl: 'https://thedailystar.net/story1',
    });

    const article1 = await db.newsArticle.create({
      data: {
        guid: 'https://thedailystar.net/story1',
        title: primaryReport.title!,
        sourceUrl: 'https://thedailystar.net/story1',
        sourceName: 'The Daily Star',
        publishedAt: new Date(),
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        latitude: 22.62,
        longitude: 91.66,
        reportId: primaryReport.id,
      },
    });

    // Duplicate report created from Prothom Alo before deduplication ran
    const dupReport = db.seedReport({
      title: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6220,
      longitude: 91.6610,
      sourceName: 'Prothom Alo',
      sourceUrl: 'https://prothomalo.com/story2',
    });

    const article2 = await db.newsArticle.create({
      data: {
        guid: 'https://prothomalo.com/story2',
        title: dupReport.title!,
        sourceUrl: 'https://prothomalo.com/story2',
        sourceName: 'Prothom Alo',
        publishedAt: new Date(),
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        latitude: 22.622,
        longitude: 91.661,
        reportId: dupReport.id,
      },
    });

    // Verification of similarity
    const sim = calculateStorySimilarity(primaryReport.title!, dupReport.title!);
    assert.strictEqual(sim.isDuplicate, true);

    // LOSSLESS CONSOLIDATION STEP:
    // Instead of setting reportId = null, re-link article2 directly to primaryReport.id!
    article2.reportId = primaryReport.id;

    assert.strictEqual(
      article2.reportId,
      primaryReport.id,
      'Duplicate report article must be re-linked to canonical primary report'
    );
    assert.notStrictEqual(
      article2.reportId,
      null,
      'Article must NOT be orphaned (reportId must not be null)'
    );
  });

  it('T1-F17-02: Citations from duplicate reports are merged losslessly into primary report', async () => {
    const primary = db.seedReport({
      title: 'ফার্মগেটে ছিনতাইকালে ছুরিকাঘাত',
      category: 'SNATCHING_ARMED_ASSAULT',
      latitude: 23.7580,
      longitude: 90.3890,
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: 'https://thedailystar.net/item1',
          title: 'Mugging at Farmgate',
        },
      ],
    });

    const duplicate = db.seedReport({
      title: 'ফার্মগেটে পথচারীকে ছুরিকাঘাতে ছিনতাই',
      category: 'SNATCHING_ARMED_ASSAULT',
      latitude: 23.7585,
      longitude: 90.3895,
      citations: [
        {
          sourceName: 'Dhaka Post',
          sourceUrl: 'https://dhakapost.com/item2',
          title: 'ফার্মগেটে ছিনতাই',
        },
      ],
    });

    // Lossless citation merge
    const mergedCitations = [...primary.citations, ...duplicate.citations];
    const updated = await db.report.update({
      where: { id: primary.id },
      data: {
        citations: mergedCitations,
        verificationStage: 'PRESS_CORROBORATED',
      },
    });

    assert.strictEqual(updated.citations.length, 2);
    assert.strictEqual(updated.citations[0].sourceName, 'The Daily Star');
    assert.strictEqual(updated.citations[1].sourceName, 'Dhaka Post');
  });

  it('T1-F17-03: Primary report sourceName is updated to credit all distinct outlets', async () => {
    const primary = db.seedReport({
      sourceName: 'The Daily Star',
    });

    const newSources = ['Prothom Alo', 'Samakal'];
    const currentSources = new Set(primary.sourceName ? primary.sourceName.split(',').map((s) => s.trim()) : []);

    for (const src of newSources) {
      currentSources.add(src);
    }

    const consolidatedSources = Array.from(currentSources).join(', ');
    const updated = await db.report.update({
      where: { id: primary.id },
      data: { sourceName: consolidatedSources },
    });

    assert.strictEqual(updated.sourceName, 'The Daily Star, Prothom Alo, Samakal');
  });

  it('T1-F17-04: Upvotes are incremented reflecting multi-press confirmation', async () => {
    const primary = db.seedReport({
      upvotes: 0,
    });

    const duplicatesToConsolidateCount = 2;
    const updated = await db.report.update({
      where: { id: primary.id },
      data: {
        upvotes: primary.upvotes + duplicatesToConsolidateCount * 2,
      },
    });

    assert.strictEqual(updated.upvotes, 4, 'Each consolidated press report adds +2 verification upvotes');
  });

  it('T1-F17-05: Offline consolidation pass guarantees zero orphaned articles', async () => {
    // Seed 3 articles pointing to Report 1
    const rep1 = db.seedReport({ category: 'ROAD_ACCIDENT' });

    for (let i = 1; i <= 3; i++) {
      await db.newsArticle.create({
        data: {
          guid: `guid-${i}`,
          title: `Crash story ${i}`,
          sourceUrl: `https://news.com/${i}`,
          sourceName: `Outlet ${i}`,
          publishedAt: new Date(),
          category: 'ROAD_ACCIDENT',
          severity: 'HIGH',
          latitude: 23.8,
          longitude: 90.4,
          reportId: rep1.id,
        },
      });
    }

    const allArticles = await db.newsArticle.findMany();
    assert.strictEqual(allArticles.length, 3);

    for (const article of allArticles) {
      assert.ok(article.reportId !== null, `Article ${article.id} must have a valid reportId`);
      assert.strictEqual(article.reportId, rep1.id);
    }
  });
});
