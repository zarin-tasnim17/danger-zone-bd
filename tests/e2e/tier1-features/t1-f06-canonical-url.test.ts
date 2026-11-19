import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCanonicalUrl } from '../harness/contractValidator';

describe('Tier 1: Feature Coverage - F06: URL Canonicalization & Tracking Stripping', () => {
  it('T1-F06-01: Tracking query parameters (utm_*, ref, fbclid, gclid) are stripped cleanly', () => {
    const rawUrl = 'https://thedailystar.net/news/bangladesh/accident-101?utm_source=facebook&utm_medium=social&utm_campaign=breaking&ref=feed&fbclid=IwAR3xyz&gclid=987abc';
    const canonical = normalizeCanonicalUrl(rawUrl);

    assert.ok(!canonical.includes('utm_source'), 'Must strip utm_source');
    assert.ok(!canonical.includes('utm_medium'), 'Must strip utm_medium');
    assert.ok(!canonical.includes('utm_campaign'), 'Must strip utm_campaign');
    assert.ok(!canonical.includes('ref='), 'Must strip ref parameter');
    assert.ok(!canonical.includes('fbclid='), 'Must strip fbclid parameter');
    assert.ok(!canonical.includes('gclid='), 'Must strip gclid parameter');
    assert.strictEqual(canonical, 'https://thedailystar.net/news/bangladesh/accident-101');
  });

  it('T1-F06-02: Protocol is standardized to HTTPS and domain is lowercased', () => {
    const rawUrl = 'http://NEWS.ProthomAlo.COM/bangladesh/crime/snatching';
    const canonical = normalizeCanonicalUrl(rawUrl);

    assert.ok(canonical.startsWith('https://'), 'Canonical URL must standardize to https://');
    assert.ok(canonical.includes('prothomalo.com'), 'Canonical domain must be lowercase');
    assert.strictEqual(canonical, 'https://news.prothomalo.com/bangladesh/crime/snatching');
  });

  it('T1-F06-03: Subdomain www. is cleanly removed from canonical URL', () => {
    const rawUrl = 'https://www.dhakapost.com/national/accident-reported';
    const canonical = normalizeCanonicalUrl(rawUrl);

    assert.ok(!canonical.includes('://www.'), 'Canonical URL must strip www. subdomain');
    assert.strictEqual(canonical, 'https://dhakapost.com/national/accident-reported');
  });

  it('T1-F06-04: Trailing slash is stripped while preserving root slash /', () => {
    const pathUrl = 'https://kalerkantho.com/online/national/2026/11/19/road-crash/';
    const canonicalPath = normalizeCanonicalUrl(pathUrl);
    assert.strictEqual(canonicalPath, 'https://kalerkantho.com/online/national/2026/11/19/road-crash');

    const rootUrl = 'https://samakal.com/';
    const canonicalRoot = normalizeCanonicalUrl(rootUrl);
    assert.strictEqual(canonicalRoot, 'https://samakal.com/');
  });

  it('T1-F06-05: Non-tracking functional query parameters and encoded slugs are preserved', () => {
    const rawUrl = 'https://ittefaq.com.bd/view.php?article_id=98721&page=1&utm_source=twitter';
    const canonical = normalizeCanonicalUrl(rawUrl);

    assert.ok(canonical.includes('article_id=98721'), 'Must preserve essential article identifier');
    assert.ok(canonical.includes('page=1'), 'Must preserve pagination parameters');
    assert.ok(!canonical.includes('utm_source'), 'Must strip utm_source');
    assert.strictEqual(canonical, 'https://ittefaq.com.bd/view.php?article_id=98721&page=1');
  });
});
