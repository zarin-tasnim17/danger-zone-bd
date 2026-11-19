import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Parser from '../../../apps/api/node_modules/rss-parser';
import {
  buildGoogleNewsRssUrl,
} from '../../../apps/api/src/services/newsCrawlerService';
import { MockRssServer } from '../harness/mockRssServer';

describe('Tier 2: Boundary & Corner Cases - F01: RSS Faults & Adversarial Feeds', () => {
  let mockServer: MockRssServer;
  let customServer: http.Server;
  let customBaseUrl: string;
  const parser = new Parser({ timeout: 5000 });

  before(async () => {
    mockServer = new MockRssServer();
    await mockServer.start();

    // Dedicated custom server for raw HTTP edge cases (malformed, massive, flapping)
    customServer = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url.includes('/malformed-xml')) {
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
        res.end('<?xml version="1.0"?><rss><channel><title>Broken<item><title>Unclosed');
        return;
      }

      if (url.includes('/empty-channel')) {
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
        res.end('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Empty Feed</title><link>http://test</link><description>No Items</description></channel></rss>');
        return;
      }

      if (url.includes('/massive-feed')) {
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
        res.write('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Massive Feed</title>');
        // Emit 500 items to simulate heavy payload (~250KB)
        for (let i = 0; i < 500; i++) {
          res.write(`<item><title>Heavy News Item ${i} with detailed report</title><link>http://test/${i}</link><guid>g-${i}</guid><pubDate>${new Date().toUTCString()}</pubDate><description>Repeated long content text describing incident number ${i}</description></item>`);
        }
        res.end('</channel></rss>');
        return;
      }

      if (url.includes('/flapping-503')) {
        const count = (customServer as any).flappingCount = ((customServer as any).flappingCount || 0) + 1;
        if (count % 2 === 1) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('503 Service Unavailable');
        } else {
          res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
          res.end('<?xml version="1.0"?><rss version="2.0"><channel><title>Recovered</title><item><title>Recovered Item</title><link>http://test/rec</link><guid>rec-1</guid></item></channel></rss>');
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      customServer.listen(0, '127.0.0.1', () => {
        const addr = customServer.address() as AddressInfo;
        customBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await mockServer.stop();
    await new Promise<void>((resolve) => customServer.close(() => resolve()));
  });

  it('T2-F01-01: Malformed and truncated XML feed handled gracefully without uncaught process crash', async () => {
    let failed = false;
    try {
      await parser.parseURL(`${customBaseUrl}/malformed-xml`);
    } catch (err: any) {
      failed = true;
      assert.ok(err, 'Parser must throw handleable error on malformed XML');
    }
    assert.strictEqual(failed, true, 'Malformed feed must be rejected safely');
  });

  it('T2-F01-02: Valid RSS feed with empty channel (0 items) parses cleanly into empty array', async () => {
    const feed = await parser.parseURL(`${customBaseUrl}/empty-channel`);
    assert.strictEqual(feed.title, 'Empty Feed');
    assert.ok(Array.isArray(feed.items), 'feed.items must be an array');
    assert.strictEqual(feed.items.length, 0, 'feed.items must be empty');
  });

  it('T2-F01-03: Heavy multi-item RSS feed parses within resource boundaries without memory exhaustion', async () => {
    const feed = await parser.parseURL(`${customBaseUrl}/massive-feed`);
    assert.strictEqual(feed.title, 'Massive Feed');
    assert.strictEqual(feed.items.length, 500, 'All 500 items must be parsed');
    assert.strictEqual(feed.items[0].guid, 'g-0');
    assert.strictEqual(feed.items[499].guid, 'g-499');
  });

  it('T2-F01-04: Flapping 503 Service Unavailable recovers on subsequent request without poisoning state', async () => {
    // 1st request -> 503
    let request1Failed = false;
    try {
      await parser.parseURL(`${customBaseUrl}/flapping-503`);
    } catch {
      request1Failed = true;
    }
    assert.strictEqual(request1Failed, true, 'First tick must fail on 503');

    // 2nd request -> 200 Recovered
    const recoveredFeed = await parser.parseURL(`${customBaseUrl}/flapping-503`);
    assert.strictEqual(recoveredFeed.title, 'Recovered');
    assert.strictEqual(recoveredFeed.items.length, 1);
    assert.strictEqual(recoveredFeed.items[0].title, 'Recovered Item');
  });

  it('T2-F01-05: Decomposed Bengali Unicode query parameters (NFD nuktas) encode safely into Google News URL', () => {
    // Decomposed nuktas: ড (\u09a1) + ় (\u09bc) instead of precomposed ড় (\u09dc)
    const decomposedBangla = '\u09b8\u09a1\u09bc\u0995 \u09a6\u09c1\u09b0\u09cd\u0998\u099f\u09a8\u09be';
    const url = buildGoogleNewsRssUrl(decomposedBangla, 'bn');

    assert.ok(url.startsWith('https://news.google.com/rss/search?q='));
    assert.ok(url.includes('hl=bn'));
    assert.ok(url.includes('gl=BD'));
    assert.ok(url.includes('ceid=BD:bn') || url.includes('ceid=BD%3Abn'));

    // URL must be parseable by standard URL parser without throwing
    const parsed = new URL(url);
    const queryParam = parsed.searchParams.get('q');
    assert.ok(queryParam && queryParam.length > 0, 'Query param q must be preserved');
  });
});
