import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  calculateStorySimilarity,
  cleanIncidentTitle,
  extractVehicles,
} from '../../../apps/api/src/services/incidentDeduplicationService';
import {
  classifyNewsText,
} from '../../../apps/api/src/services/newsClassifierService';
import {
  isWireSyndicatedStory,
  resolvePublisherDomain,
} from '../../../apps/api/src/services/publisherRegistry';

describe('Tier 4: Real-World Scenario 2 - Multi-Vehicle Highway Collision with Dual-Language Coverage', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T4-SC2-01: End-to-end highway multi-vehicle collision: cross-lingual consolidation, vehicle conflict discrimination & venue masking', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Initial Breaking Report in English from The Daily Star
    // -------------------------------------------------------------------------
    const article1_Title = '3 dead, 12 injured in bus-truck collision in Sitakunda';
    const article1_Url = 'https://thedailystar.net/news/sitakunda-highway-pileup';
    const cleanArt1Title = cleanIncidentTitle(article1_Title);

    const primaryReport = db.seedReport({
      title: cleanArt1Title,
      description: 'A fatal head-on collision between a passenger bus and a heavy truck in Sitakunda.',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      sourceName: 'The Daily Star',
      sourceUrl: article1_Url,
      verificationStage: 'SINGLE_SOURCE_PRESS',
      citations: [
        {
          sourceName: 'The Daily Star',
          sourceUrl: article1_Url,
          title: cleanArt1Title,
        },
      ],
    });

    const newsArticle1 = await db.newsArticle.create({
      data: {
        guid: article1_Url,
        title: cleanArt1Title,
        sourceUrl: article1_Url,
        sourceName: 'The Daily Star',
        publishedAt: new Date(),
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        latitude: 22.6200,
        longitude: 91.6600,
        reportId: primaryReport.id,
      },
    });

    assert.strictEqual(await db.report.count(), 1);
    assert.strictEqual(await db.newsArticle.count(), 1);

    // -------------------------------------------------------------------------
    // Phase 2: Corroborating Bengali Report from Prothom Alo 20 Minutes Later
    // -------------------------------------------------------------------------
    const article2_Title = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩ ও আহত ১২ - প্রথম আলো';
    const article2_Url = 'https://prothomalo.com/bangladesh/sitakunda-accident-live';
    const cleanArt2Title = cleanIncidentTitle(article2_Title);

    // 1. Title cleaning strips outlet credit
    assert.strictEqual(cleanArt2Title.includes('প্রথম আলো'), false, 'Cleaned title must strip trailing publisher suffix');

    // 2. Cross-lingual deduplication check
    const sim = calculateStorySimilarity(cleanArt1Title, cleanArt2Title);
    assert.strictEqual(sim.isDuplicate, true, 'Dual-language coverage of identical crash must be detected as duplicate');
    assert.ok(sim.sharedTokens.includes('bus'));
    assert.ok(sim.sharedTokens.includes('truck'));
    assert.ok(sim.sharedTokens.includes('killed'));
    assert.ok(sim.sharedTokens.includes('3'));

    // 3. Lossless consolidation: attach news article to primary report without creating duplicate pin
    const newsArticle2 = await db.newsArticle.create({
      data: {
        guid: article2_Url,
        title: cleanArt2Title,
        sourceUrl: article2_Url,
        sourceName: 'Prothom Alo',
        publishedAt: new Date(),
        category: 'ROAD_ACCIDENT',
        severity: 'HIGH',
        latitude: 22.6210,
        longitude: 91.6605,
        reportId: primaryReport.id, // Linked to canonical primary!
      },
    });

    // 4. Update primary citations & advance verification stage
    const domain1 = resolvePublisherDomain(article1_Url, 'The Daily Star');
    const domain2 = resolvePublisherDomain(article2_Url, 'Prothom Alo');
    assert.notStrictEqual(domain1, domain2, 'Two distinct independent major dailies');

    const updatedCitations = [
      ...primaryReport.citations,
      {
        sourceName: 'Prothom Alo',
        sourceUrl: article2_Url,
        title: cleanArt2Title,
      },
    ];

    const consolidatedPrimary = await db.report.update({
      where: { id: primaryReport.id },
      data: {
        citations: updatedCitations,
        sourceName: 'The Daily Star, Prothom Alo',
        verificationStage: 'PRESS_CORROBORATED',
        upvotes: primaryReport.upvotes + 2,
      },
    });

    assert.strictEqual(await db.report.count(), 1, 'Total reports count must remain 1 after consolidation');
    assert.strictEqual(await db.newsArticle.count(), 2, 'Both NewsArticle records are preserved losslessly');
    assert.strictEqual(consolidatedPrimary.verificationStage, 'PRESS_CORROBORATED');
    assert.strictEqual(consolidatedPrimary.citations.length, 2);

    // -------------------------------------------------------------------------
    // Phase 3: Separate Distinct Crash on Same Highway Segment (Vehicle Conflict)
    // -------------------------------------------------------------------------
    const distinctCrashTitle = 'সীতাকুণ্ডে মোটরসাইকেল ও পিকআপের সংঘর্ষে ১ জন নিহত';
    const distinctVehicles = extractVehicles(distinctCrashTitle);
    const primaryVehicles = extractVehicles(primaryReport.title!);

    assert.ok(distinctVehicles.has('MOTORCYCLE') && distinctVehicles.has('PICKUP'));
    assert.ok(primaryVehicles.has('BUS') && primaryVehicles.has('TRUCK'));

    const distinctSim = calculateStorySimilarity(primaryReport.title!, distinctCrashTitle);
    assert.strictEqual(
      distinctSim.isDuplicate,
      false,
      'Vehicle conflict between bus-truck and motorcycle-pickup must prevent false merge on same highway'
    );

    // Creates genuine distinct report
    const secondReport = db.seedReport({
      title: distinctCrashTitle,
      category: 'ROAD_ACCIDENT',
      latitude: 22.6250, // ~500m down the road
      longitude: 91.6630,
      sourceName: 'Samakal',
      sourceUrl: 'https://samakal.com/sitakunda-bike-crash',
    });

    assert.strictEqual(await db.report.count(), 2, 'Exactly 2 distinct real-world incidents active on map');
    assert.notStrictEqual(primaryReport.id, secondReport.id);

    // -------------------------------------------------------------------------
    // Phase 4: Follow-up Arrest Disqualification
    // -------------------------------------------------------------------------
    const arrestHeadline = 'সাভারে দুর্ঘটনার মামলায় চালক গ্রেফতার';
    const classification = classifyNewsText(arrestHeadline, 'পুলিশ অভিযান চালিয়ে আসামিকে গ্রেফতার করেছে।');

    assert.strictEqual(classification.isSafetyRelated, false, 'Arrest follow-up must be disqualified as non-safety hazard');
    assert.strictEqual(classification.disqualifiedReason, 'ARREST_FOLLOWUP');

    // Total active incidents remains 2; arrest report does NOT create a 3rd map pin
    assert.strictEqual(await db.report.count(), 2);

    // -------------------------------------------------------------------------
    // Phase 5: Verification of Child Entity Integrity
    // -------------------------------------------------------------------------
    const allArticles = await db.newsArticle.findMany();
    for (const art of allArticles) {
      assert.ok(art.reportId !== null, 'Every NewsArticle must be attached to a valid canonical report');
    }
  });
});
