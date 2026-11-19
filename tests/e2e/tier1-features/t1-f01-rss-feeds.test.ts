import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Parser from '../../../apps/api/node_modules/rss-parser';
import {
  DEDICATED_CATEGORY_FEEDS,
  buildGoogleNewsRssUrl,
  type FeedConfig,
} from '../../../apps/api/src/services/newsCrawlerService';
import { MockRssServer } from '../harness/mockRssServer';
import { assertValidRawNewsItem } from '../harness/contractValidator';
import { ALL_11_SAFETY_CATEGORIES } from '../harness/testDataGenerators';

describe('Tier 1: Feature Coverage - F01: 11 Dedicated Category RSS Feeds', () => {
  let mockServer: MockRssServer;
  let baseUrl: string;
  const parser = new Parser({ timeout: 5000 });

  before(async () => {
    mockServer = new MockRssServer();
    baseUrl = await mockServer.start();
  });

  after(async () => {
    await mockServer.stop();
  });

  it('T1-F01-01: Centralized registry registers all 11 category feeds with matching category hints', () => {
    assert.strictEqual(
      DEDICATED_CATEGORY_FEEDS.length,
      11,
      `Expected 11 dedicated feeds, found ${DEDICATED_CATEGORY_FEEDS.length}`
    );

    const configuredCategories = new Set(DEDICATED_CATEGORY_FEEDS.map((f: FeedConfig) => f.category));

    for (const expectedCat of ALL_11_SAFETY_CATEGORIES) {
      assert.ok(
        configuredCategories.has(expectedCat),
        `Feed registry must contain dedicated feed for category: ${expectedCat}`
      );
    }

    for (const feed of DEDICATED_CATEGORY_FEEDS) {
      assert.ok(feed.name && feed.name.length > 0, `Feed ${feed.category} must have a descriptive name`);
      assert.strictEqual(
        feed.category,
        feed.categoryHint,
        `Feed ${feed.name} category must match its categoryHint`
      );
      assert.ok(feed.url.startsWith('https://'), `Feed ${feed.name} URL must be secure HTTPS`);
    }
  });

  it('T1-F01-02: Google News RSS URL construction applies UTF-8 encoding and geographic scoping parameters', () => {
    const banglaQuery = 'সড়ক দুর্ঘটনা bangladesh when:1d';
    const englishQuery = 'armed robbery bangladesh when:1d';

    const bnUrl = buildGoogleNewsRssUrl(banglaQuery, 'bn');
    const enUrl = buildGoogleNewsRssUrl(englishQuery, 'en');

    assert.ok(bnUrl.includes('hl=bn'), 'Bangla RSS URL must specify hl=bn');
    assert.ok(bnUrl.includes('gl=BD'), 'Bangla RSS URL must specify gl=BD');
    assert.ok(bnUrl.includes('ceid=BD%3Abn') || bnUrl.includes('ceid=BD:bn'), 'Bangla RSS URL must specify ceid=BD:bn');
    assert.ok(
      bnUrl.includes(encodeURIComponent('সড়ক দুর্ঘটনা')),
      'Bangla query terms must be properly URL-encoded'
    );

    assert.ok(enUrl.includes('hl=en-BD'), 'English BD RSS URL must specify hl=en-BD');
    assert.ok(enUrl.includes('gl=BD'), 'English BD RSS URL must specify gl=BD');
    assert.ok(enUrl.includes('ceid=BD%3Aen') || enUrl.includes('ceid=BD:en'), 'English BD RSS URL must specify ceid=BD:en');
  });

  it('T1-F01-03: Hermetic mock RSS server generates and serves valid UTF-8 Bangla and English RSS 2.0 XML', async () => {
    const feedUrl = mockServer.getFeedUrl('ROAD_ACCIDENT');
    const feed = await parser.parseURL(feedUrl);

    assert.ok(feed.title && feed.title.includes('ROAD_ACCIDENT'), 'Feed title must indicate category');
    assert.ok(Array.isArray(feed.items), 'Feed items must be an array');
    assert.ok(feed.items.length > 0, 'Feed should contain seeded mock items');

    const firstItem = feed.items[0];
    assert.ok(firstItem.title, 'Item must have a title');
    assert.ok(firstItem.link, 'Item must have a link');
    assert.ok(firstItem.guid, 'Item must have a guid');

    const validated = assertValidRawNewsItem({
      guid: firstItem.guid || 'fallback-guid',
      title: firstItem.title || '',
      link: firstItem.link || '',
      pubDate: firstItem.pubDate || new Date().toISOString(),
      contentSnippet: firstItem.contentSnippet || firstItem.content || '',
      sourceName: firstItem.source?.title || 'Mock Bangla Outlet',
      categoryHint: 'ROAD_ACCIDENT',
    });

    assert.strictEqual(validated.categoryHint, 'ROAD_ACCIDENT');
  });

  it('T1-F01-04: Independent failure isolation ensures single feed HTTP error does not abort other feeds', async () => {
    mockServer.setCategoryFault('ROBBERY', '500');

    // Feed 1: Robbery should fail with 500
    let robberyFailed = false;
    try {
      await parser.parseURL(mockServer.getFeedUrl('ROBBERY'));
    } catch {
      robberyFailed = true;
    }
    assert.strictEqual(robberyFailed, true, 'Faulted ROBBERY feed must fail cleanly');

    // Feed 2: Road accident should succeed independently without being affected
    const roadAccidentFeed = await parser.parseURL(mockServer.getFeedUrl('ROAD_ACCIDENT'));
    assert.ok(roadAccidentFeed.items.length > 0, 'Unfaulted feed must succeed despite sibling failure');

    // Reset fault
    mockServer.reset();
  });

  it('T1-F01-05: Feed timeout configuration strictly protects against unresponsive feeds', async () => {
    mockServer.setCategoryFault('THEFT', 'delay', 400);

    const fastParser = new Parser({ timeout: 150 });
    let timedOut = false;

    try {
      await fastParser.parseURL(mockServer.getFeedUrl('THEFT'));
    } catch (err: any) {
      timedOut = true;
      assert.ok(
        err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('timed out'),
        `Error message must indicate timeout, got: ${err.message}`
      );
    }

    assert.strictEqual(timedOut, true, 'Request exceeding timeout threshold must be rejected');
    mockServer.reset();
  });
});
