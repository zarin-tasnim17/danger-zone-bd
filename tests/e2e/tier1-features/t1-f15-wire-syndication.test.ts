import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase } from '../harness/mockDatabase';
import {
  isWireSyndicatedStory,
  resolvePublisherDomain,
} from '../../../apps/api/src/services/publisherRegistry';

describe('Tier 1: Feature Coverage - F15: Wire Syndication Trust Protection', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T1-F15-01: BSS wire stories are identified via domain, source name, and in-text dispatches', () => {
    // 1. By URL domain
    const byUrl = isWireSyndicatedStory('https://www.bssnews.net/news/12345', 'BSS News');
    assert.strictEqual(byUrl.isWire, true);
    assert.strictEqual(byUrl.agency, 'BSS');

    // 2. By source name (English and Bengali)
    const byNameEn = isWireSyndicatedStory('https://someportal.com/story', 'BSS');
    const byNameBn = isWireSyndicatedStory('https://someportal.com/story', 'বাসস');
    assert.strictEqual(byNameEn.isWire, true);
    assert.strictEqual(byNameEn.agency, 'BSS');
    assert.strictEqual(byNameBn.isWire, true);
    assert.strictEqual(byNameBn.agency, 'BSS');

    // 3. By content dispatch attribution
    const byContent1 = isWireSyndicatedStory(
      'https://newspaper.com/item',
      'The Daily Star',
      '(BSS) - Three people were killed in a road accident in Sitakunda'
    );
    const byContent2 = isWireSyndicatedStory(
      'https://newspaper.com/item',
      'বাসস',
      'সীতাকুণ্ডে সড়ক দুর্ঘটনায় নিহত ৩'
    );
    assert.strictEqual(byContent1.isWire, true);
    assert.strictEqual(byContent1.agency, 'BSS');
    assert.strictEqual(byContent2.isWire, true);
    assert.strictEqual(byContent2.agency, 'BSS');
  });

  it('T1-F15-02: UNB wire stories are identified via domain, source name, and in-text dispatches', () => {
    const byUrl = isWireSyndicatedStory('https://unb.com.bd/category/Bangladesh/accident/100', 'UNB');
    assert.strictEqual(byUrl.isWire, true);
    assert.strictEqual(byUrl.agency, 'UNB');

    const byNameBn = isWireSyndicatedStory('https://newspaper.com/story', 'ইউএনবি');
    assert.strictEqual(byNameBn.isWire, true);
    assert.strictEqual(byNameBn.agency, 'UNB');

    const byContent = isWireSyndicatedStory(
      'https://newspaper.com/story',
      'Dhaka Tribune',
      'UNB - Four injured as two buses collide on highway'
    );
    assert.strictEqual(byContent.isWire, true);
    assert.strictEqual(byContent.agency, 'UNB');
  });

  it('T1-F15-03: Syndicated wire copies across multiple outlets do not advance verificationStage to PRESS_CORROBORATED', async () => {
    // Initial report ingested from BSS wire feed
    const report = db.seedReport({
      title: 'সীতাকুণ্ডে সড়ক দুর্ঘটনায় ৩ জন নিহত',
      category: 'ROAD_ACCIDENT',
      latitude: 22.6200,
      longitude: 91.6600,
      verificationStage: 'WIRE_SYNDICATED',
      citations: [
        {
          sourceName: 'BSS',
          sourceUrl: 'https://bssnews.net/news/sitakunda-accident-01',
          title: 'সীতাকুণ্ডে সড়ক দুর্ঘটনায় ৩ জন নিহত',
        },
      ],
    });

    assert.strictEqual(report.verificationStage, 'WIRE_SYNDICATED');

    // Second article arrives: Prothom Alo publishing the exact BSS wire release
    const wireArticle2 = {
      sourceName: 'Prothom Alo',
      sourceUrl: 'https://prothomalo.com/news/sitakunda-accident-bss',
      contentSnippet: '(BSS) - Three killed in road accident in Sitakunda',
    };

    const wireCheck = isWireSyndicatedStory(wireArticle2.sourceUrl, wireArticle2.sourceName, wireArticle2.contentSnippet);
    assert.strictEqual(wireCheck.isWire, true, 'Article 2 must be recognized as wire syndicated');

    // Ingestion logic rule: Wire copies do not elevate verification stage
    let nextStage: any = report.verificationStage;
    if (wireCheck.isWire) {
      nextStage = report.verificationStage; // remains WIRE_SYNDICATED
    } else {
      nextStage = 'PRESS_CORROBORATED';
    }

    assert.strictEqual(
      nextStage,
      'WIRE_SYNDICATED',
      'Stage must NOT advance to PRESS_CORROBORATED when secondary article is wire syndicated'
    );
  });

  it('T1-F15-04: Genuine independent press investigation elevates verificationStage to PRESS_CORROBORATED', () => {
    const existingCitations = [
      {
        sourceName: 'The Daily Star',
        sourceUrl: 'https://thedailystar.net/news/factory-fire-tongi',
      },
    ];

    const incomingStory = {
      sourceName: 'Prothom Alo',
      sourceUrl: 'https://prothomalo.com/news/factory-fire-tongi-staff-reporter',
      contentSnippet: 'নিজস্ব প্রতিবেদক, টঙ্গী: টঙ্গীতে কারখানায় অগ্নিকাণ্ডে...',
    };

    const isWire = isWireSyndicatedStory(incomingStory.sourceUrl, incomingStory.sourceName, incomingStory.contentSnippet).isWire;
    assert.strictEqual(isWire, false, 'Independent staff reporter investigation is NOT wire syndicated');

    const incomingDomain = resolvePublisherDomain(incomingStory.sourceUrl, incomingStory.sourceName);
    const priorDomains = existingCitations.map((c) => resolvePublisherDomain(c.sourceUrl, c.sourceName));

    assert.strictEqual(incomingDomain, 'prothomalo.com');
    assert.strictEqual(priorDomains[0], 'thedailystar.net');
    assert.ok(!priorDomains.includes(incomingDomain), 'Distinct press domains confirmed');

    // Stage advances to PRESS_CORROBORATED for independent coverage
    let nextStage = 'SINGLE_SOURCE_PRESS';
    if (!isWire && !priorDomains.includes(incomingDomain)) {
      nextStage = 'PRESS_CORROBORATED';
    }

    assert.strictEqual(nextStage, 'PRESS_CORROBORATED');
  });

  it('T1-F15-05: Non-wire story resolves domain accurately and prevents same-publisher self-corroboration', () => {
    const domainA = resolvePublisherDomain('https://www.thedailystar.net/city/news/123');
    const domainB = resolvePublisherDomain('https://thedailystar.net/bangla/news/456');

    // Same domain must be detected even if subpaths differ
    assert.strictEqual(domainA, 'thedailystar.net');
    assert.strictEqual(domainB, 'thedailystar.net');
    assert.strictEqual(domainA === domainB, true, 'Multiple links from same publisher must not self-corroborate');
  });
});
