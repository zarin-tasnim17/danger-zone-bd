import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Parser from '../../../apps/api/node_modules/rss-parser';
import {
  DEDICATED_CATEGORY_FEEDS,
  DEDICATED_CATEGORY_FEEDS_EN,
  DEDICATED_CATEGORY_FEEDS_BN,
  PUBLIC_NEWS_FEEDS,
  buildGoogleNewsRssUrl,
  processAndIngestNewsItems,
  type FeedConfig,
} from '../../../apps/api/src/services/newsCrawlerService';
import { ALL_11_SAFETY_CATEGORIES } from '../harness/testDataGenerators';
import { MockRssServer } from '../harness/mockRssServer';
import type { ReportCategory } from '@repo/shared';

describe('Tier 4: Real-World Ingestion & Dual-Language Feeds - F01: Crawler Queries & Coverage', () => {
  let mockServer: MockRssServer;
  const parser = new Parser({ timeout: 5000 });

  before(async () => {
    mockServer = new MockRssServer();
    await mockServer.start();
  });

  after(async () => {
    await mockServer.stop();
  });

  it('T4-01-01: Dual-language registry exposes 22 dedicated feeds across all 11 categories (11 EN + 11 BN)', () => {
    // 1. Backward compatibility: DEDICATED_CATEGORY_FEEDS contains 11 primary category feeds
    assert.strictEqual(
      DEDICATED_CATEGORY_FEEDS.length,
      11,
      `Expected 11 legacy primary category feeds, found ${DEDICATED_CATEGORY_FEEDS.length}`
    );

    // 2. English feeds
    assert.strictEqual(
      DEDICATED_CATEGORY_FEEDS_EN.length,
      11,
      `Expected 11 dedicated English feeds, found ${DEDICATED_CATEGORY_FEEDS_EN.length}`
    );

    // 3. Bengali feeds
    assert.strictEqual(
      DEDICATED_CATEGORY_FEEDS_BN.length,
      11,
      `Expected 11 dedicated Bengali feeds, found ${DEDICATED_CATEGORY_FEEDS_BN.length}`
    );

    // 4. Combined public feeds
    assert.strictEqual(
      PUBLIC_NEWS_FEEDS.length,
      22,
      `Expected 22 public news feeds, found ${PUBLIC_NEWS_FEEDS.length}`
    );

    // Verify all 11 categories are present in both English and Bengali feeds
    const enCategories = new Set(DEDICATED_CATEGORY_FEEDS_EN.map((f: FeedConfig) => f.category));
    const bnCategories = new Set(DEDICATED_CATEGORY_FEEDS_BN.map((f: FeedConfig) => f.category));

    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      assert.ok(enCategories.has(cat), `English feeds must contain category: ${cat}`);
      assert.ok(bnCategories.has(cat), `Bengali feeds must contain category: ${cat}`);
    }

    // Verify category matches categoryHint across all 22 feeds
    for (const feed of PUBLIC_NEWS_FEEDS) {
      assert.strictEqual(
        feed.category,
        feed.categoryHint,
        `Feed ${feed.name} category must match its categoryHint`
      );
      assert.ok(feed.url.startsWith('https://'), `Feed ${feed.name} URL must be secure HTTPS`);
    }
  });

  it('T4-01-02: English RSS feeds include mandatory query-level negative exclusions (-court -bail -verdict -remand -corruption -politics)', () => {
    const requiredExclusions = ['court', 'bail', 'verdict', 'remand', 'corruption', 'politics'];

    for (const feed of DEDICATED_CATEGORY_FEEDS_EN) {
      const decodedUrl = decodeURIComponent(feed.url);

      // Verify Google News RSS parameters for English Bangladesh
      assert.ok(
        feed.url.includes('hl=en-BD'),
        `English feed ${feed.name} must specify hl=en-BD in URL`
      );
      assert.ok(
        feed.url.includes('gl=BD'),
        `English feed ${feed.name} must specify gl=BD in URL`
      );
      assert.ok(
        feed.url.includes('ceid=BD%3Aen') || feed.url.includes('ceid=BD:en'),
        `English feed ${feed.name} must specify ceid=BD:en in URL`
      );

      // Verify each negative exclusion
      for (const exclusion of requiredExclusions) {
        assert.ok(
          decodedUrl.includes(`-${exclusion}`),
          `English feed "${feed.name}" must contain query exclusion -${exclusion}`
        );
      }

      // Verify freshness constraint
      assert.ok(
        decodedUrl.includes('when:1d'),
        `English feed "${feed.name}" must contain freshness window constraint when:1d`
      );
    }
  });

  it('T4-01-03: Bengali RSS feeds include mandatory query-level negative exclusions (-আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি)', () => {
    const requiredBnExclusions = ['আদালত', 'জামিন', 'রিমান্ড', 'দুদক', 'দুর্নীতি', 'রাজনীতি'];

    for (const feed of DEDICATED_CATEGORY_FEEDS_BN) {
      const decodedUrl = decodeURIComponent(feed.url);

      // Verify Google News RSS parameters for Bengali
      assert.ok(
        feed.url.includes('hl=bn'),
        `Bengali feed ${feed.name} must specify hl=bn in URL`
      );
      assert.ok(
        feed.url.includes('gl=BD'),
        `Bengali feed ${feed.name} must specify gl=BD in URL`
      );
      assert.ok(
        feed.url.includes('ceid=BD%3Abn') || feed.url.includes('ceid=BD:bn'),
        `Bengali feed ${feed.name} must specify ceid=BD:bn in URL`
      );

      // Verify each negative exclusion in Bengali
      for (const exclusion of requiredBnExclusions) {
        assert.ok(
          decodedUrl.includes(`-${exclusion}`),
          `Bengali feed "${feed.name}" must contain query exclusion -${exclusion}`
        );
      }

      // Verify freshness constraint
      assert.ok(
        decodedUrl.includes('when:1d'),
        `Bengali feed "${feed.name}" must contain freshness window constraint when:1d`
      );
    }
  });

  it('T4-01-04: Feed decoupling strictly prevents categoryHint from bypassing non-safety article admission', async () => {
    // Non-safety article (court proceeding / political rhetoric) presented on a THEFT feed
    const nonSafetyItems = [
      {
        guid: 'test-decouple-01',
        title: 'হাইকোর্টে সাবেক মন্ত্রীর জামিন আবেদন শুনানি স্থগিত',
        link: 'https://news.test/court-bail-01',
        pubDate: new Date().toISOString(),
        contentSnippet: 'আদালতের আদেশে জামিন শুনানি পিছিয়েছে।',
        sourceName: 'Daily Bangla',
        categoryHint: 'THEFT' as ReportCategory, // Feed categoryHint should NOT force admission!
      },
      {
        guid: 'test-decouple-02',
        title: 'দুদকের মামলায় সাবেক মেয়রের অবৈধ সম্পদের হিসাব তলব',
        link: 'https://news.test/acc-graft-02',
        pubDate: new Date().toISOString(),
        contentSnippet: 'দুর্নীতি দমন কমিশন জ্ঞাত আয়বহির্ভূত সম্পদ তদন্ত করছে।',
        sourceName: 'The Daily Star',
        categoryHint: 'ROBBERY' as ReportCategory, // Feed categoryHint should NOT force admission!
      },
      {
        guid: 'test-decouple-03',
        title: 'সংবাদ সম্মেলনে রাজপথে সরকার পতনের নতুন কর্মসূচি ঘোষণা',
        link: 'https://news.test/political-03',
        pubDate: new Date().toISOString(),
        contentSnippet: 'প্রেস ব্রিফিংয়ে ৭ দফা দাবি পেশ করে নেতৃবৃন্দ।',
        sourceName: 'Prothom Alo',
        categoryHint: 'ARMED_ASSAULT' as ReportCategory, // Feed categoryHint should NOT force admission!
      },
    ];

    const result = await processAndIngestNewsItems(nonSafetyItems);

    // None of these should be ingested into the live map! All must be skipped!
    assert.strictEqual(
      result.ingested,
      0,
      `Expected 0 ingested items for non-safety news with categoryHint, got ${result.ingested}`
    );
    assert.strictEqual(
      result.skipped,
      3,
      `Expected all 3 non-safety items to be skipped, got ${result.skipped}`
    );
  });

  it('T4-01-05: Hermetic mock RSS server generates and serves feeds across all categories without error', async () => {
    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      const feedUrl = mockServer.getFeedUrl(cat);
      const parsedFeed = await parser.parseURL(feedUrl);

      assert.ok(parsedFeed.title, `Feed for ${cat} must have a title`);
      assert.ok(Array.isArray(parsedFeed.items), `Feed for ${cat} must have an items array`);
      assert.ok(parsedFeed.items.length > 0, `Feed for ${cat} must contain seeded items`);
    }
  });
});
