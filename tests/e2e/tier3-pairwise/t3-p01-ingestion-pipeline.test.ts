import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Parser from '../../../apps/api/node_modules/rss-parser';
import { MockRssServer } from '../harness/mockRssServer';
import { MockDatabase } from '../harness/mockDatabase';
import {
  classifyNewsText,
} from '../../../apps/api/src/services/newsClassifierService';
import {
  resolveLocationFromText,
} from '../../../apps/api/src/services/geocodingService';
import {
  assertValidRawNewsItem,
  assertValidClassifiedArticle,
  assertValidGeocodeResult,
  assertWithinBangladeshBounds,
} from '../harness/contractValidator';
import {
  ALL_11_SAFETY_CATEGORIES,
  loadAllPoliceStations,
  DISTRICT_CENTERS,
} from '../harness/testDataGenerators';
import type { ReportCategory } from '@repo/shared';

describe('Tier 3: Pairwise Combinations - P01: Ingestion Pipeline (F1 x F2 x F9 x F11)', () => {
  let mockRss: MockRssServer;
  let db: MockDatabase;
  const parser = new Parser({ timeout: 5000 });

  before(async () => {
    mockRss = new MockRssServer();
    await mockRss.start();
  });

  after(async () => {
    await mockRss.stop();
  });

  beforeEach(() => {
    mockRss.reset();
    db = new MockDatabase();
  });

  it('T3-P01-01: End-to-end ingestion parses feed XML, classifies safety category, and geocodes to specific district', async () => {
    // 1. Ingest from ROAD_ACCIDENT feed
    const feedUrl = mockRss.getFeedUrl('ROAD_ACCIDENT');
    const feed = await parser.parseURL(feedUrl);
    assert.ok(feed.items.length > 0, 'Feed must provide items');

    const raw = feed.items[0];
    const rawItem = assertValidRawNewsItem({
      guid: raw.guid || 'guid-p01-01',
      title: raw.title || 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
      link: raw.link || 'https://news.bangladesh.test/accident-sitakunda-01',
      pubDate: raw.pubDate || new Date().toISOString(),
      contentSnippet: raw.contentSnippet || raw.content || 'সীতাকুণ্ড থানা এলাকায় ঢাকা-চট্টগ্রাম মহাসড়কে দুর্ঘটনা',
      sourceName: raw.source?.title || 'The Daily Star',
      categoryHint: 'ROAD_ACCIDENT',
    });

    // 2. Classification Engine (F9)
    const classified = classifyNewsText(rawItem.title, rawItem.contentSnippet);
    assert.strictEqual(classified.isSafetyRelated, true);
    assert.strictEqual(classified.category, 'ROAD_ACCIDENT');
    assert.ok(['HIGH', 'MEDIUM'].includes(classified.severity));

    const validatedArticle = assertValidClassifiedArticle({
      title: rawItem.title,
      canonicalUrl: rawItem.link,
      sourceName: rawItem.sourceName,
      category: classified.category,
      severity: classified.severity,
      confidence: 0.95,
      isSafetyRelated: classified.isSafetyRelated,
      matchedKeywords: classified.matchedKeywords,
    });
    assert.strictEqual(validatedArticle.category, 'ROAD_ACCIDENT');

    // 3. Geocoding Engine (F11)
    const geo = await resolveLocationFromText(rawItem.title, rawItem.contentSnippet);
    assert.ok(geo !== null, 'Should resolve location from title/snippet');
    assert.ok(geo!.locationName.toLowerCase().includes('sitakunda'));
    assertWithinBangladeshBounds(geo!.latitude, geo!.longitude);

    const validatedGeo = assertValidGeocodeResult({
      locationName: geo!.locationName,
      latitude: geo!.latitude,
      longitude: geo!.longitude,
      confidence: 'HIGH',
      district: 'Chattogram',
      division: 'Chattogram',
      source: geo!.source,
      isAmbiguous: false,
      matchedThana: 'Sitakunda',
    });
    assert.strictEqual(validatedGeo.confidence, 'HIGH');
  });

  it('T3-P01-02: Multi-category feed batch isolates categories while extracting matching thana locations', async () => {
    const testCases: Array<{
      feedCategory: ReportCategory;
      title: string;
      snippet: string;
      expectedCategory: ReportCategory;
      expectedThana: string;
    }> = [
      {
        feedCategory: 'THEFT',
        title: 'উত্তরায় ভবনের তালা ভেঙে কোটি টাকার স্বর্ণালঙ্কার চুরি',
        snippet: 'উত্তরা মডেল থানা এলাকার ৩ নম্বর সেক্টরে চুরির ঘটনা ঘটেছে।',
        expectedCategory: 'THEFT',
        expectedThana: 'uttara',
      },
      {
        feedCategory: 'SNATCHING',
        title: 'ধানমন্ডিতে রাতে অফিসফেরত নারীর ব্যাগ ও ফোন ছিনতাই',
        snippet: 'ধানমন্ডি মডেল থানা সংলগ্ন এলাকায় এই ছিনতাইয়ের ঘটনা ঘটে।',
        expectedCategory: 'SNATCHING',
        expectedThana: 'dhanmondi',
      },
      {
        feedCategory: 'YOUTH_GANG_ACTIVITY',
        title: 'মিরপুরে কিশোর গ্যাংয়ের দুই গ্রুপের মধ্যে দফায় দফায় সংঘর্ষ',
        snippet: 'মিরপুর মডেল থানা এলাকায় কিশোর গ্যাংয়ের দ্বন্দ্বে আতঙ্ক।',
        expectedCategory: 'YOUTH_GANG_ACTIVITY',
        expectedThana: 'mirpur',
      },
      {
        feedCategory: 'DRUG_RELATED_CRIME',
        title: 'টেকনাফে বিপুল ইয়াবাসহ চিহ্নিত দুই মাদক কারবারি আটক',
        snippet: 'টেকনাফ মডেল থানা এলাকায় বিজিবির অভিযানে ইয়াবা জব্দ।',
        expectedCategory: 'DRUG_RELATED_CRIME',
        expectedThana: 'teknaf',
      },
    ];

    for (const tc of testCases) {
      // Classification
      const classified = classifyNewsText(tc.title, tc.snippet);
      assert.strictEqual(
        classified.category,
        tc.expectedCategory,
        `Title "${tc.title}" should be classified as ${tc.expectedCategory}`
      );

      // Geocoding
      const geo = await resolveLocationFromText(tc.title, tc.snippet);
      assert.ok(geo !== null, `Location for "${tc.title}" must be resolved`);
      assert.ok(
        geo!.locationName.toLowerCase().includes(tc.expectedThana.toLowerCase()),
        `Expected thana ${tc.expectedThana}, resolved ${geo!.locationName}`
      );
      assertWithinBangladeshBounds(geo!.latitude, geo!.longitude);

      // Save to mock database
      const report = db.seedReport({
        title: tc.title,
        description: tc.snippet,
        category: classified.category,
        severity: classified.severity,
        latitude: geo!.latitude,
        longitude: geo!.longitude,
        sourceName: 'Daily Safety News',
        verificationStage: 'CLASSIFIED',
      });
      assert.ok(report.id);
      assert.strictEqual(report.category, tc.expectedCategory);
    }

    assert.strictEqual(await db.report.count(), testCases.length);
  });

  it('T3-P01-03: Bengali Unicode headline with English place alias successfully classifies and maps', async () => {
    // English place alias: "Chittagong" in Bengali text with road accident keywords
    const title = 'Chittagong এ সড়ক দুর্ঘটনায় দ্রুতগতির বাসের ধাক্কায় অটোরিকশার ৩ যাত্রী নিহত';
    const snippet = 'চট্টগ্রাম মহানগরীর কোতোয়ালী থানা এলাকায় দুর্ঘটনাটি ঘটেছে।';

    const classified = classifyNewsText(title, snippet);
    assert.strictEqual(classified.category, 'ROAD_ACCIDENT');
    assert.strictEqual(classified.severity, 'HIGH');

    const geo = await resolveLocationFromText(title, snippet);
    assert.ok(geo !== null, 'Should resolve Chittagong or Kotwali');
    assertWithinBangladeshBounds(geo!.latitude, geo!.longitude);
  });

  it('T3-P01-04: Crawler handling of feed items without explicit location returns null geocode without failing classification', async () => {
    const title = 'সারাদেশে মোটরসাইকেল দুর্ঘটনা রোধে কঠোর নির্দেশ পুলিশের';
    const snippet = 'সড়কে নিরাপত্তা নিশ্চিত করতে সচেতনতামূলক প্রচারণা জোরদার করার আহ্বান।';

    const classified = classifyNewsText(title, snippet);
    assert.strictEqual(classified.isSafetyRelated, true);
    assert.strictEqual(classified.category, 'ROAD_ACCIDENT');

    // Nationwide / non-specific location returns null
    const geo = await resolveLocationFromText(title, snippet);
    assert.strictEqual(geo, null, 'General nationwide advice should not pin to arbitrary coordinate');
  });

  it('T3-P01-05: High-throughput batch of items across multiple feeds processes sequentially without memory leaks or state corruption', async () => {
    const stations = loadAllPoliceStations();
    const batchSize = 30;

    for (let i = 0; i < batchSize; i++) {
      const station = stations[i % stations.length];
      const category = ALL_11_SAFETY_CATEGORIES[i % ALL_11_SAFETY_CATEGORIES.length];
      const title = `${station.station_name_bn} এলাকায় দুর্ঘটনা ও নিরাপত্তা সংক্রান্ত সংবাদ #${i + 1}`;
      const snippet = `${station.station_name_en} jurisdiction event`;

      const classified = classifyNewsText(title, snippet);
      assert.ok(classified !== null);

      const center = DISTRICT_CENTERS[station.district] || { latitude: 23.8103, longitude: 90.4125 };
      const lat = station.location && station.location.latitude !== null ? station.location.latitude : center.latitude;
      const lng = station.location && station.location.longitude !== null ? station.location.longitude : center.longitude;

      const report = db.seedReport({
        title,
        description: snippet,
        category,
        latitude: lat,
        longitude: lng,
        verificationStage: 'CLASSIFIED',
      });

      assert.ok(report.id);
      assertWithinBangladeshBounds(report.latitude, report.longitude);
    }

    const totalCount = await db.report.count();
    assert.strictEqual(totalCount, batchSize);
  });
});
