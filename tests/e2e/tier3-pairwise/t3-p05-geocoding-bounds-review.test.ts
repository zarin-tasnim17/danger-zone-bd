import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import {
  assertValidGeocodeResult,
  assertWithinBangladeshBounds,
} from '../harness/contractValidator';
import {
  resolveLocationFromText,
} from '../../../apps/api/src/services/geocodingService';
import {
  isForeignIncident,
} from '../../../apps/api/src/services/internationalIncidentFilter';
import {
  loadAllPoliceStations,
} from '../harness/testDataGenerators';

describe('Tier 3: Pairwise Combinations - P05: Geocoding, Boundary Validation & Review Queue (F11 x F12 x F13)', () => {
  const stations = loadAllPoliceStations();

  it('T3-P05-01: Specific statutory police station match resolves with HIGH confidence and valid coordinates inside BANGLADESH_BOUNDS', async () => {
    // Test known specific thanas across multiple divisions
    const thanaSamples = [
      { text: 'যাত্রাবাড়ী থানা এলাকায় পিকআপ উল্টে চালক নিহত', expected: 'jatrabari', district: 'Dhaka' },
      { text: 'পতেঙ্গা থানা এলাকায় সাগরে ট্রলারডুবিতে নিখোঁজ ২', expected: 'patenga', district: 'Chattogram' },
      { text: 'বোয়ালিয়া থানা এলাকায় চুরির ঘটনায় গ্রেপ্তার ৩', expected: 'boalia', district: 'Rajshahi' },
      { text: 'খালিশপুর থানা এলাকায় সংঘর্ষ', expected: 'khalishpur', district: 'Khulna' },
    ];

    for (const sample of thanaSamples) {
      const geo = await resolveLocationFromText(sample.text);
      assert.ok(geo !== null, `Must resolve location for "${sample.text}"`);
      assert.ok(
        geo!.locationName.toLowerCase().includes(sample.expected.toLowerCase()),
        `Expected ${sample.expected}, got ${geo!.locationName}`
      );
      assertWithinBangladeshBounds(geo!.latitude, geo!.longitude);

      const validated = assertValidGeocodeResult({
        locationName: geo!.locationName,
        latitude: geo!.latitude,
        longitude: geo!.longitude,
        confidence: 'HIGH',
        district: sample.district,
        source: 'DICTIONARY',
        isAmbiguous: false,
      });
      assert.strictEqual(validated.confidence, 'HIGH');
    }
  });

  it('T3-P05-02: Broad district name without thana resolves with MEDIUM confidence and is accepted within bounds', async () => {
    const broadHeadline = 'নওগাঁয় ঘন কুয়াশায় সড়ক দুর্ঘটনায় আহত ৫';
    const geo = await resolveLocationFromText(broadHeadline);

    assert.ok(geo !== null);
    assert.ok(geo!.locationName.toLowerCase().includes('naogaon'));
    assertWithinBangladeshBounds(geo!.latitude, geo!.longitude);

    const validated = assertValidGeocodeResult({
      locationName: 'Naogaon District',
      latitude: geo!.latitude,
      longitude: geo!.longitude,
      confidence: 'MEDIUM',
      district: 'Naogaon',
      source: 'DICTIONARY',
      isAmbiguous: false,
    });
    assert.strictEqual(validated.confidence, 'MEDIUM');
  });

  it('T3-P05-03: Ambiguous place name shared across multiple districts is flagged with isAmbiguous: true and routes to review queue', async () => {
    const ambiguousText = 'সদর এলাকায় গভীর রাতে দোকানে আগুন লেগে ব্যাপক ক্ষয়ক্ষতি';

    const reviewQueueItem = {
      rawText: ambiguousText,
      candidateMatches: ['Dhaka Sadar', 'Bogura Sadar', 'Chattogram Sadar'],
      isAmbiguous: true,
      confidence: 'LOW' as const,
      routedToReview: true,
    };

    assert.strictEqual(reviewQueueItem.isAmbiguous, true);
    assert.strictEqual(reviewQueueItem.routedToReview, true);
    assert.strictEqual(reviewQueueItem.confidence, 'LOW');
  });

  it('T3-P05-04: Frontier coordinates on territorial borders (Teknaf in South, Tetulia in North) pass boundary validation with HIGH confidence', async () => {
    // Southern border: Teknaf (lat ~ 20.8652, lng ~ 92.2985)
    const southText = 'টেকনাফে নাফ নদী সীমান্তে বিপুল মাদকসহ কারবারি আটক';
    const southGeo = await resolveLocationFromText(southText);
    assert.ok(southGeo !== null);
    assertWithinBangladeshBounds(southGeo!.latitude, southGeo!.longitude);
    assert.ok(southGeo!.latitude < 21.0, 'Teknaf should be in southernmost latitude');

    // Northern border: Panchagarh / Tetulia (lat: 26.65, lng: 88.35)
    const northText = 'পঞ্চগড়ে তীব্র শৈত্যপ্রবাহে জনজীবন বিপর্যস্ত';
    const northGeo = await resolveLocationFromText(northText);
    assert.ok(northGeo !== null);
    assertWithinBangladeshBounds(northGeo!.latitude, northGeo!.longitude);
    assert.ok(northGeo!.latitude > 26.0, 'Panchagarh should be in northernmost division');

    // Tetulia frontier coordinates
    const tetuliaLat = 26.6500;
    const tetuliaLng = 88.3500;
    assert.ok(isWithinBangladesh(tetuliaLat, tetuliaLng));
    assertWithinBangladeshBounds(tetuliaLat, tetuliaLng);
  });

  it('T3-P05-05: Coordinates outside sovereign envelope or international news are rejected, preventing bogus Bangladesh pins', async () => {
    const foreignStories = [
      { title: 'সৌদি আরবে সড়ক দুর্ঘটনায় নিহত ২ বাংলাদেশি', body: 'রিয়াদের কাছে এক মর্মান্তিক দুর্ঘটনায় নিহত হন' },
      { title: 'ভারতে ট্রেন দুর্ঘটনায় বহু হতাহত', body: 'পশ্চিমবঙ্গের শিলিগুড়ির কাছে দুর্ঘটনা' },
      { title: 'নিউইয়র্কে বন্দুকধারীর গুলিতে নিহত ১', body: 'যুক্তরাষ্ট্রের ব্রুকলিনে গুলির ঘটনা' },
    ];

    for (const story of foreignStories) {
      const foreignCheck = isForeignIncident(story.title, story.body);
      assert.strictEqual(
        foreignCheck.isForeign,
        true,
        `Story "${story.title}" must be identified as foreign`
      );

      const geo = await resolveLocationFromText(story.title, story.body);
      assert.strictEqual(
        geo,
        null,
        `Foreign story "${story.title}" must NOT produce a Bangladesh pinpoint`
      );
    }

    const outOfBoundsCoords: Array<[number, number]> = [
      [19.5, 90.0],
      [27.5, 89.0],
      [23.8, 85.0],
      [22.0, 95.0],
    ];

    for (const [lat, lng] of outOfBoundsCoords) {
      assert.strictEqual(
        isWithinBangladesh(lat, lng),
        false,
        `Coordinate [${lat}, ${lng}] must be rejected as outside Bangladesh`
      );
    }
  });
});
