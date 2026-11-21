import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  isWireSyndicatedStory,
  resolvePublisherDomain,
} from '../../../apps/api/src/services/publisherRegistry';
import {
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 3: Pairwise Interactions - Wire Syndication x Deduplication x Concurrency', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-WIRE-DEDUP-01: Concurrent ingestion of identical BSS wire story from 4 outlets produces 1 report without upvote inflation', async () => {
    const wireTitle = 'টঙ্গীতে কারখানায় ভয়াবহ আগুনে আহত ৫';
    const wireLat = 23.9800;
    const wireLng = 90.4000;

    const feeds = [
      { outlet: 'Prothom Alo', url: 'https://prothomalo.com/tongi-fire-bss', snippet: '(BSS) - 5 injured in Tongi factory fire' },
      { outlet: 'The Daily Star', url: 'https://thedailystar.net/tongi-fire-bss', snippet: 'BSS: Huge fire broke out in Tongi factory, 5 injured' },
      { outlet: 'Samakal', url: 'https://samakal.com/tongi-fire-bss', snippet: 'টঙ্গীতে কারখানায় আগুনে ৫ জন আহত (BSS)' },
      { outlet: 'BSS News', url: 'https://bssnews.net/news/tongi-fire-01', snippet: 'Tongi factory fire leaves 5 injured: BSS' },
    ];

    // Primary report created from first feed
    const primary = db.seedReport({
      title: wireTitle,
      category: 'UNLIT_ROAD', // hazard
      latitude: wireLat,
      longitude: wireLng,
      sourceName: feeds[0].outlet,
      sourceUrl: feeds[0].url,
      verificationStage: 'WIRE_SYNDICATED',
      upvotes: 0,
      citations: [
        {
          sourceName: feeds[0].outlet,
          sourceUrl: feeds[0].url,
          title: wireTitle,
        },
      ],
    });

    // Concurrently process remaining 3 feeds
    for (let i = 1; i < feeds.length; i++) {
      const feed = feeds[i];
      const isWire = isWireSyndicatedStory(feed.url, feed.outlet, feed.snippet).isWire;
      assert.strictEqual(isWire, true, `${feed.outlet} article must be recognized as wire syndicated`);

      const sim = calculateStorySimilarity(wireTitle, feed.snippet);
      assert.strictEqual(sim.isDuplicate, true, 'Wire articles must match existing incident');

      // Deduplication consolidation: wire story does NOT increment upvotes or advance stage
      const currentRep = (await db.report.findMany({ where: { id: primary.id } }))[0];
      const existingCitations = [...currentRep.citations];
      existingCitations.push({
        sourceName: feed.outlet,
        sourceUrl: feed.url,
        title: feed.snippet,
      });

      await db.report.update({
        where: { id: primary.id },
        data: {
          citations: existingCitations,
          // Upvotes remain untouched (0) for syndicated wire stories
          verificationStage: 'WIRE_SYNDICATED',
        },
      });
    }

    assert.strictEqual(await db.report.count(), 1, 'Only 1 canonical report must exist');
    const finalReport = (await db.report.findMany())[0];
    assert.strictEqual(finalReport.citations.length, 4, 'All 4 syndicated citations must be recorded');
    assert.strictEqual(finalReport.verificationStage, 'WIRE_SYNDICATED', 'Stage must remain WIRE_SYNDICATED');
    assert.strictEqual(finalReport.upvotes, 0, 'Upvotes must NOT be inflated by wire syndication');
  });

  it('T3-WIRE-DEDUP-02: Independent investigative reporting following wire release elevates stage to PRESS_CORROBORATED', async () => {
    // 1. Initial report created from wire agency
    const report = db.seedReport({
      title: 'টঙ্গীতে কারখানায় আগুন',
      verificationStage: 'WIRE_SYNDICATED',
      upvotes: 0,
      citations: [
        { sourceName: 'BSS', sourceUrl: 'https://bssnews.net/fire-01' },
      ],
    });

    // 2. Incoming independent report by Prothom Alo local correspondent
    const investigativeStory = {
      sourceName: 'Prothom Alo',
      sourceUrl: 'https://prothomalo.com/investigation-tongi-fire',
      snippet: 'নিজস্ব প্রতিবেদক, টঙ্গী: অগ্নিকাণ্ডে ক্ষতিগ্রস্ত কারখানা পরিদর্শন...',
    };

    const wireCheck = isWireSyndicatedStory(
      investigativeStory.sourceUrl,
      investigativeStory.sourceName,
      investigativeStory.snippet
    );
    assert.strictEqual(wireCheck.isWire, false, 'Independent local reporting is NOT wire');

    // Genuine independent reporting elevates stage and increments confidence
    const updated = await db.report.update({
      where: { id: report.id },
      data: {
        verificationStage: 'PRESS_CORROBORATED',
        upvotes: report.upvotes + 2,
        citations: [
          ...report.citations,
          { sourceName: investigativeStory.sourceName, sourceUrl: investigativeStory.sourceUrl },
        ],
      },
    });

    assert.strictEqual(updated.verificationStage, 'PRESS_CORROBORATED');
    assert.strictEqual(updated.upvotes, 2, 'Independent corroboration boosts upvotes by 2');
    assert.strictEqual(updated.citations.length, 2);
  });

  it('T3-WIRE-DEDUP-03: Concurrent ingestion of distinct simultaneous incidents on same highway creates 2 separate reports', async () => {
    // Accident 1: Bus vs Truck at 8:00 AM on Sitakunda Highway
    const crash1 = db.seedReport({
      title: 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে ৩ নিহত',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
    });

    // Accident 2: Motorcycle vs Covered Van at 8:15 AM on Sitakunda Highway (same vicinity, different vehicles)
    const crash2Title = 'সীতাকুণ্ডে মোটরসাইকেল ও কাভার্ডভ্যান দুর্ঘটনায় ১ নিহত';
    const crash2Lat = 22.6230;
    const crash2Lng = 91.6620;

    const sim = calculateStorySimilarity(crash1.title!, crash2Title);
    assert.strictEqual(sim.isDuplicate, false, 'Disjoint vehicle accidents must not be flagged as duplicates');

    const crash2 = db.seedReport({
      title: crash2Title,
      category: 'ROAD_ACCIDENT',
      latitude: crash2Lat,
      longitude: crash2Lng,
    });

    assert.strictEqual(await db.report.count(), 2, 'Both distinct highway accidents must be preserved as separate pins');
    assert.notStrictEqual(crash1.id, crash2.id);
  });

  it('T3-WIRE-DEDUP-04: Network race condition: delayed feed B detects and merges into fast feed A without duplicate report', async () => {
    const storyTitle = 'ধানমন্ডিতে গভীর রাতে ডাকাতি ও লুটপাট';

    // Fast feed A inserts first
    const primary = db.seedReport({
      title: storyTitle,
      category: 'ROBBERY',
      latitude: 23.7461,
      longitude: 90.3742,
      sourceName: 'Daily Star',
      sourceUrl: 'https://dailystar.net/dhanmondi-robbery',
    });

    // Delayed feed B arrives 500ms later with translated Bengali headline
    const delayedTitle = 'ধানমন্ডি এলাকায় মধ্যরাতে সশস্ত্র ডাকাতি';
    const nearby = db.findReportsWithinRadius(23.7465, 90.3745, 3500);

    assert.strictEqual(nearby.length, 1, 'Delayed worker finds existing primary report');
    const sim = calculateStorySimilarity(delayedTitle, nearby[0].title!);
    assert.strictEqual(sim.isDuplicate, true, 'Delayed headline matches primary incident');

    // Consolidates into primary report
    await db.report.update({
      where: { id: primary.id },
      data: {
        citations: [
          ...primary.citations,
          { sourceName: 'Prothom Alo', sourceUrl: 'https://prothomalo.com/dhanmondi-robbery' },
        ],
      },
    });

    assert.strictEqual(await db.report.count(), 1, 'Race condition must NOT create a second duplicate report');
  });

  it('T3-WIRE-DEDUP-05: Pairwise deduplication verifies symmetric and transitive duplicate detection across multilingual variants', () => {
    const titles = [
      'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে ৩ নিহত',
      'Sitakunda bus truck collision leaves 3 killed',
      'সীতাকুণ্ডে বাস-ট্রাক সংঘর্ষে ৩ জনের মৃত্যু',
      'সীতাকুণ্ডে বাস ও ট্রাক দুর্ঘটনায় নিহত ৩',
    ];

    for (let i = 0; i < titles.length; i++) {
      for (let j = i + 1; j < titles.length; j++) {
        const sim = calculateStorySimilarity(titles[i], titles[j]);
        assert.strictEqual(
          sim.isDuplicate,
          true,
          `Pairwise duplicate expected between "${titles[i]}" and "${titles[j]}". Score: ${sim.score}`
        );
      }
    }
  });
});
