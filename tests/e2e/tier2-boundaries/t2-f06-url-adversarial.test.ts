import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCanonicalUrl } from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - F06: Adversarial URL Canonicalization', () => {
  it('T2-F06-01: 50 repeated, duplicated, and nested UTM parameters are all stripped completely', () => {
    let url = 'https://thedailystar.net/news/bangladesh/accident-report?id=123';
    for (let i = 0; i < 50; i++) {
      url += `&utm_source=campaign_${i}&utm_medium=medium_${i}&utm_campaign=ad_${i}`;
    }
    url += '&ref=social&fbclid=987xyz&gclid=123abc';

    const canonical = normalizeCanonicalUrl(url);
    assert.ok(!canonical.includes('utm_source'), 'All utm_source parameters must be stripped');
    assert.ok(!canonical.includes('utm_medium'), 'All utm_medium parameters must be stripped');
    assert.ok(!canonical.includes('utm_campaign'), 'All utm_campaign parameters must be stripped');
    assert.ok(!canonical.includes('ref='), 'ref must be stripped');
    assert.ok(!canonical.includes('fbclid'), 'fbclid must be stripped');
    assert.ok(!canonical.includes('gclid'), 'gclid must be stripped');
    assert.strictEqual(canonical, 'https://thedailystar.net/news/bangladesh/accident-report?id=123');
  });

  it('T2-F06-02: Double percent-encoded path and query characters are preserved safely without corruption', () => {
    const rawUrl = 'https://prothomalo.com/bangladesh/%2520special%252Farticle?slug=%25E0%25A6%25AC%25E0%25A6%25BE%25E0%25A6%25B8';
    const canonical = normalizeCanonicalUrl(rawUrl);

    assert.ok(canonical.startsWith('https://prothomalo.com/bangladesh/'));
    assert.ok(canonical.includes('%2520special%252Farticle'), 'Double percent encoding must not be corrupted');
    assert.ok(canonical.includes('slug='), 'Query parameter slug must be preserved');
  });

  it('T2-F06-03: Mixed-case schemes (hTTp://, HtTps://) and mixed-case domains standardize to lowercase https://', () => {
    const mixedUrl1 = 'hTtp://NEWSPAPER.DhakaPost.COM/crime/theft';
    const canonical1 = normalizeCanonicalUrl(mixedUrl1);
    assert.strictEqual(canonical1, 'https://newspaper.dhakapost.com/crime/theft');

    const mixedUrl2 = 'HTTPS://WWW.KalerKantho.COM/news/accident/';
    const canonical2 = normalizeCanonicalUrl(mixedUrl2);
    assert.strictEqual(canonical2, 'https://kalerkantho.com/news/accident');
  });

  it('T2-F06-04: Punycode IDN internationalized domain names (xn--...) handled without throwing exceptions', () => {
    // Punycode for বাংলা domain
    const punycodeUrl = 'https://xn--54b8cd9a.com/bangladesh/news-item?utm_source=feed';
    const canonical = normalizeCanonicalUrl(punycodeUrl);

    assert.ok(canonical.startsWith('https://xn--54b8cd9a.com/bangladesh/news-item'));
    assert.ok(!canonical.includes('utm_source'), 'Tracking query param must be stripped from Punycode domain URL');
  });

  it('T2-F06-05: Query parameters inside fragment hash or complex matrix parameters do not break URL parsing', () => {
    const fragmentUrl = 'https://samakal.com/online/incident#section?utm_source=twitter';
    const canonical = normalizeCanonicalUrl(fragmentUrl);

    // URL parser treats anything after # as hash
    assert.ok(canonical.startsWith('https://samakal.com/online/incident'));
    const parsed = new URL(canonical);
    assert.strictEqual(parsed.hostname, 'samakal.com');
  });
});
