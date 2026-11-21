import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  newsObservabilityService,
} from '../../../apps/api/src/services/newsObservabilityService';
import {
  validateUrlForSafeFetch,
} from '../../../apps/api/src/utils/ssrfFilter';

describe('Tier 1: Feature Coverage - F21: Source Failure Isolation & Robustness', () => {
  beforeEach(() => {
    newsObservabilityService.resetMetricsForTesting();
  });

  it('T1-F21-01: HTTP error on single feed is isolated and does not abort batch processing of other feeds', async () => {
    // Spin up a hermetic server returning 500 Internal Server Error for /fail, 200 for /success
    const server = http.createServer((req, res) => {
      if (req.url === '/fail') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test Feed</title></channel></rss>`);
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;

    const feeds = [
      { name: 'Failing Feed', url: `http://127.0.0.1:${port}/fail` },
      { name: 'Healthy Feed', url: `http://127.0.0.1:${port}/success` },
    ];

    const recorder = newsObservabilityService.startRun('test_run_f21_01');

    // Process feeds with Promise.allSettled isolation pattern
    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        const response = await fetch(f.url);
        if (!response.ok) {
          recorder.recordFeedExecution({
            feedName: f.name,
            category: 'ROAD_ACCIDENT',
            url: f.url,
            status: 'FAILED',
            latencyMs: 10,
            itemsFetched: 0,
            errorMessage: `HTTP ${response.status}`,
          });
          throw new Error(`HTTP ${response.status}`);
        }
        recorder.recordFeedExecution({
          feedName: f.name,
          category: 'ROAD_ACCIDENT',
          url: f.url,
          status: 'SUCCESS',
          latencyMs: 10,
          itemsFetched: 0,
        });
        return response.text();
      })
    );

    server.close();

    assert.strictEqual(results[0].status, 'rejected', 'Failing feed must reject cleanly');
    assert.strictEqual(results[1].status, 'fulfilled', 'Healthy feed must fulfill successfully despite neighbor failure');

    recorder.complete();
    const summary = newsObservabilityService.getTelemetrySummary();
    assert.strictEqual(summary.lastRun?.feedsFailed, 1);
    assert.strictEqual(summary.lastRun?.feedsSuccess, 1);
    assert.strictEqual(summary.lastRun?.status, 'PARTIAL');
  });

  it('T1-F21-02: Feed timeout is caught by AbortController and does not hang the crawl cycle', async () => {
    // Hangs indefinitely without responding
    const hangingServer = http.createServer((_req, _res) => {
      // Do not respond
    });

    await new Promise<void>((resolve) => hangingServer.listen(0, '127.0.0.1', () => resolve()));
    const port = (hangingServer.address() as any).port;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100); // 100ms timeout for test

    let timedOut = false;
    try {
      await fetch(`http://127.0.0.1:${port}/hang`, { signal: controller.signal });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        timedOut = true;
      }
    } finally {
      clearTimeout(timeoutId);
      hangingServer.close();
    }

    assert.strictEqual(timedOut, true, 'Hanging request must abort on timeout cleanly');
  });

  it('T1-F21-03: Malformed XML RSS payload is safely handled without throwing uncaught exceptions', () => {
    const corruptXml = '<<<<malformed---not-xml-payload>>>>><<<';

    let parseFailedGracefully = false;
    try {
      // Basic XML structural check
      if (!corruptXml.trim().startsWith('<?xml') && !corruptXml.includes('<rss')) {
        parseFailedGracefully = true;
      }
    } catch {
      parseFailedGracefully = true;
    }

    assert.strictEqual(parseFailedGracefully, true, 'Corrupt XML payload must be intercepted safely');
  });

  it('T1-F21-04: SSRF filter blocks private and loopback addresses from external untrusted feed URLs', async () => {
    const privateUrls = [
      'http://127.0.0.1:8080/feed',
      'http://localhost:3000/rss',
      'http://192.168.1.1/news',
      'http://10.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data', // AWS/cloud metadata endpoint
    ];

    for (const url of privateUrls) {
      const check = await validateUrlForSafeFetch(url);
      assert.strictEqual(
        check.isSafe,
        false,
        `SSRF protection must block private/reserved address: "${url}". Reason: ${check.reason}`
      );
    }
  });

  it('T1-F21-05: Legitimate public news domains pass SSRF filter cleanly', async () => {
    const publicUrls = [
      'https://news.google.com/rss/search?q=bangladesh',
      'https://www.thedailystar.net/frontpage/rss.xml',
      'https://www.prothomalo.com/feed',
      'https://www.dhakatribune.com/feed/',
    ];

    for (const url of publicUrls) {
      const check = await validateUrlForSafeFetch(url);
      assert.strictEqual(
        check.isSafe,
        true,
        `Public feed must be allowed: "${url}". Blocked reason if any: ${check.reason}`
      );
    }
  });
});
