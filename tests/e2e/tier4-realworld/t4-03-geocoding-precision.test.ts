import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findLandmarkInText,
  resolveLocationFromText,
  getAdminPriority,
  stripDateline,
  maskTransitDepartures,
  maskHospitalPhrases,
  LOCAL_LANDMARK_MAP,
} from '../../../apps/api/src/services/geocodingService';
import { assertWithinBangladeshBounds } from '../harness/contractValidator';

describe('Tier 4: Real-World Ingestion - F03: Geocoding Precision & Disambiguation', () => {
  it('T4-03-01: Administrative hierarchy ranks locality / thana over generic district centroid', async () => {
    // When a headline mentions both a district and a specific thana/locality,
    // the system must resolve to the specific thana coordinates, NEVER the broad district centroid.
    const hierarchyPairs = [
      {
        title: 'গাজীপুরের টঙ্গীতে ছিনতাইকালে পথচারীকে ছুরিকাঘাত',
        expectedLocation: 'Tongi, Gazipur',
        disallowedLocation: 'Gazipur',
        expectedLat: 23.8974,
        expectedLng: 90.4024,
      },
      {
        title: 'কুমিল্লার চৌদ্দগ্রামে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৪',
        expectedLocation: 'Chauddagram',
        disallowedLocation: 'Cumilla',
        districtCheck: 'Cumilla',
      },
      {
        title: 'ঢাকার মিরপুরে গভীর রাতে ফ্ল্যাটে তালা ভেঙে কোটি টাকার স্বর্ণালঙ্কার চুরি',
        expectedLocation: 'Mirpur, Dhaka',
        disallowedLocation: 'Dhaka',
        expectedLat: 23.807,
        expectedLng: 90.368,
      },
      {
        title: 'চট্টগ্রামের সীতাকুণ্ডে লরি ও বাসের মুখোমুখি সংঘর্ষে আহত ১০',
        expectedLocation: 'Sitakunda, Chittagong',
        disallowedLocation: 'Chittagong',
        expectedLat: 22.6158,
        expectedLng: 91.6606,
      },
      {
        title: 'সিলেটের ওসমানীনগরে ট্রাকচাপায় পথচারী নিহত',
        expectedLocation: 'Osmaninagar',
        disallowedLocation: 'Sylhet',
        districtCheck: 'Sylhet',
      },
      {
        title: 'খুলনার খালিশপুরে দুই পক্ষের মধ্যে সংঘর্ষ ও ককটেল বিস্ফোরণ',
        expectedLocation: 'Khalishpur, Khulna',
        disallowedLocation: 'Khulna',
        expectedLat: 22.855,
        expectedLng: 89.53,
      },
    ];

    for (const pair of hierarchyPairs) {
      const geo = await resolveLocationFromText(pair.title);
      assert.ok(geo !== null, `Must resolve geocode for "${pair.title}"`);

      // Verify the location name points to the specific locality / thana
      assert.ok(
        geo.locationName.toLowerCase().includes(pair.expectedLocation.toLowerCase()),
        `Expected thana "${pair.expectedLocation}", got "${geo.locationName}" for title "${pair.title}"`
      );

      // Verify it did NOT resolve to the generic district centroid alone
      if (pair.expectedLat && pair.expectedLng) {
        assert.strictEqual(
          geo.latitude,
          pair.expectedLat,
          `Latitude for ${pair.expectedLocation} must match thana coordinate ${pair.expectedLat}, got ${geo.latitude}`
        );
        assert.strictEqual(
          geo.longitude,
          pair.expectedLng,
          `Longitude for ${pair.expectedLocation} must match thana coordinate ${pair.expectedLng}, got ${geo.longitude}`
        );
      }

      assertWithinBangladeshBounds(geo.latitude, geo.longitude);
    }
  });

  it('T4-03-02: Transit departure origin points are neutralized in favor of actual crash scenes', async () => {
    // When buses/trains are en route from City A to City B, City A is merely the departure point.
    // The crash scene in City B or Thana X must receive the pin, NOT the departure origin.
    const transitTestCases = [
      {
        title: 'বগুড়ায় ঢাকা থেকে ছেড়ে আসা যাত্রীবাহী বাস খাদে পড়ে নিহত ৩',
        expectedPlace: 'Bogura',
        forbiddenOrigin: 'Dhaka',
      },
      {
        title: 'সিরাজগঞ্জে চট্টগ্রাম থেকে আসা পণ্যবাহী ট্রাক উল্টে আহত ২',
        expectedPlace: 'Sirajganj',
        forbiddenOrigin: 'Chittagong',
      },
      {
        title: 'Chauddagram: Bus departed from Chittagong crashes on highway',
        expectedPlace: 'Chauddagram',
        forbiddenOrigin: 'Chittagong',
      },
      {
        title: 'Bus traveling from Rajshahi crashes in Pabna, 2 injured',
        expectedPlace: 'Pabna',
        forbiddenOrigin: 'Rajshahi',
      },
    ];

    for (const tc of transitTestCases) {
      const geo = await resolveLocationFromText(tc.title);
      assert.ok(geo !== null, `Must resolve geocode for transit story: "${tc.title}"`);

      const lowerLoc = geo.locationName.toLowerCase();
      const expectedPlace = tc.expectedPlace.toLowerCase();
      const isPlaceMatched =
        lowerLoc.includes(expectedPlace) ||
        (expectedPlace === 'bogura' && lowerLoc.includes('bogra')) ||
        (expectedPlace === 'bogra' && lowerLoc.includes('bogura'));
      assert.ok(
        isPlaceMatched,
        `Crash scene must resolve to "${tc.expectedPlace}", but got "${geo.locationName}"`
      );

      // Must not be the departure origin
      assert.ok(
        !lowerLoc.startsWith(tc.forbiddenOrigin.toLowerCase()),
        `Must not resolve to departure origin "${tc.forbiddenOrigin}". Got: "${geo.locationName}"`
      );

      assertWithinBangladeshBounds(geo.latitude, geo.longitude);
    }
  });

  it('T4-03-03: Secondary hospital and medical venue mentions are demoted in favor of incident locations', async () => {
    // When crash/crime victims are rushed to major medical centers (e.g. DMCH, CMCH),
    // the pin must be placed at the incident site, NOT the hospital city.
    const hospitalTestCases = [
      {
        title: 'কেরানীগঞ্জে সড়ক দুর্ঘটনায় আহত যুবককে ঢামেক হাসপাতালে নেওয়া হলে চিকিৎসক মৃত ঘোষণা করেন',
        expectedScene: 'Keraniganj',
        disallowedHospital: 'Dhaka Medical',
      },
      {
        title: 'ফেনীতে সংঘর্ষে আহত ব্যক্তিকে চট্টগ্রাম মেডিকেল কলেজ হাসপাতালে ভর্তি',
        expectedScene: 'Feni',
        disallowedHospital: 'Chittagong Medical',
      },
      {
        title: 'Road accident in Narayanganj; victim rushed to Dhaka Medical College Hospital',
        expectedScene: 'Narayanganj',
        disallowedHospital: 'Dhaka Medical',
      },
    ];

    for (const tc of hospitalTestCases) {
      const geo = await resolveLocationFromText(tc.title);
      assert.ok(geo !== null, `Must resolve location for "${tc.title}"`);

      const lowerLoc = geo.locationName.toLowerCase();
      assert.ok(
        lowerLoc.includes(tc.expectedScene.toLowerCase()),
        `Scene must resolve to incident location "${tc.expectedScene}", got "${geo.locationName}"`
      );

      assertWithinBangladeshBounds(geo.latitude, geo.longitude);
    }
  });

  it('T4-03-04: Journalism dateline bureau prefixes are stripped from snippets to prevent bureau city hijacking', async () => {
    // Reporting agency datelines (e.g. "Dhaka, Nov 19 - ", "ঢাকা, ১৯ নভেম্বর - ") must not
    // cause Dhaka to hijack incidents that occurred in other districts.
    const datelineStories = [
      {
        title: 'মহাসড়কে ট্রাক উল্টে চালক নিহত, আহত ২',
        snippet: 'ঢাকা, ১৯ নভেম্বর (ইউএনবি) - নাটোরের সিংড়ায় ট্রাক উল্টে চালক নিহত হয়েছেন।',
        expectedPlace: 'Singra',
      },
      {
        title: 'Fatal bus crash on highway leaves four dead',
        snippet: 'Dhaka, Nov 19 (UNB) - At least four passengers were killed when a bus plunged into a canal in Bogura.',
        expectedPlace: 'Bogura',
      },
      {
        title: 'দোকানের তালা ভেঙে কোটি টাকার মালামাল চুরি',
        snippet: 'স্টাফ রিপোর্টার, ঢাকা: সোমবার ভোরে টঙ্গী বাজারে বড় ধরনের চুরির ঘটনা ঘটেছে।',
        expectedPlace: 'Tongi',
      },
    ];

    for (const story of datelineStories) {
      const geo = await resolveLocationFromText(story.title, story.snippet);
      assert.ok(geo !== null, `Must resolve geocode for story with dateline`);

      const lowerLoc = geo.locationName.toLowerCase();
      const expectedPlace = story.expectedPlace.toLowerCase();
      const isPlaceMatched =
        lowerLoc.includes(expectedPlace) ||
        (expectedPlace === 'bogura' && lowerLoc.includes('bogra')) ||
        (expectedPlace === 'bogra' && lowerLoc.includes('bogura'));
      assert.ok(
        isPlaceMatched,
        `Expected scene "${story.expectedPlace}", but dateline caused hijacking to "${geo.locationName}"`
      );

      assertWithinBangladeshBounds(geo.latitude, geo.longitude);
    }
  });

  it('T4-03-05: Broad district names without thanas safely fall back to district centroid within sovereign bounds', async () => {
    const broadDistrictHeadlines = [
      { text: 'কুড়িগ্রামের দুর্গম চরাঞ্চলে সংঘর্ষে আহত ৫', expected: 'Kurigram' },
      { text: 'ঝালকাঠিতে নিয়ন্ত্রণ হারিয়ে যাত্রীবাহী বাস খালে', expected: 'Jhalokati' },
      { text: 'মেহেরপুরে মোটরসাইকেল দুর্ঘটনায় দুই আরোহী নিহত', expected: 'Meherpur' },
    ];

    for (const item of broadDistrictHeadlines) {
      const geo = await resolveLocationFromText(item.text);
      assert.ok(geo !== null, `Must resolve district fallback for "${item.text}"`);

      assert.ok(
        geo.locationName.toLowerCase().includes(item.expected.toLowerCase()),
        `Expected district centroid "${item.expected}", got "${geo.locationName}"`
      );

      assertWithinBangladeshBounds(geo.latitude, geo.longitude);
    }
  });

  it('T4-03-06: Transit destinations, connecting highway corridors, and multi-city routes do not hijack incident scene', async () => {
    // 1. Transit destination suffix in Bengali (-গামী)
    const bnDestFeni = await resolveLocationFromText('ফেনীতে ঢাকাগামী বাস উল্টে নিহত ৩');
    assert.ok(bnDestFeni !== null);
    assert.ok(
      bnDestFeni.locationName.toLowerCase().includes('feni'),
      `Expected scene Feni, got ${bnDestFeni.locationName}`
    );

    const bnDestBogura = await resolveLocationFromText('বগুড়ায় চট্টগ্রামগামী বাস উল্টে নিহত ৩');
    assert.ok(bnDestBogura !== null);
    assert.ok(
      bnDestBogura.locationName.toLowerCase().includes('bogura') ||
        bnDestBogura.locationName.toLowerCase().includes('bogra'),
      `Expected scene Bogura, got ${bnDestBogura.locationName}`
    );

    // 2. Transit destination in English ("bound for")
    const enDestCtg = await resolveLocationFromText('Bus bound for Chittagong crashes in Feni');
    assert.ok(enDestCtg !== null);
    assert.ok(
      enDestCtg.locationName.toLowerCase().includes('feni'),
      `Expected scene Feni, got ${enDestCtg.locationName}`
    );

    // 3. Connecting highway corridor in Bengali ("ঢাকা-চট্টগ্রাম মহাসড়কে")
    const bnHwyFeni = await resolveLocationFromText('ফেনীতে ঢাকা-চট্টগ্রাম মহাসড়কে বাস উল্টে নিহত ৩');
    assert.ok(bnHwyFeni !== null);
    assert.ok(
      bnHwyFeni.locationName.toLowerCase().includes('feni'),
      `Expected scene Feni on highway, got ${bnHwyFeni.locationName}`
    );

    // 4. Connecting highway corridor in English ("Dhaka-Chittagong highway")
    const enHwyFeni = await resolveLocationFromText('Fatal bus crash in Feni on Dhaka-Chittagong highway');
    assert.ok(enHwyFeni !== null);
    assert.ok(
      enHwyFeni.locationName.toLowerCase().includes('feni'),
      `Expected scene Feni on highway, got ${enHwyFeni.locationName}`
    );

    // 5. Multi-city transit route ("ঢাকা থেকে কক্সবাজারগামী")
    const multiRoute = await resolveLocationFromText('কুমিল্লায় ঢাকা থেকে কক্সবাজারগামী বাসের ধাক্কায় নিহত ২');
    assert.ok(multiRoute !== null);
    assert.ok(
      multiRoute.locationName.toLowerCase().includes('cumilla') ||
        multiRoute.locationName.toLowerCase().includes('comilla'),
      `Expected scene Cumilla, got ${multiRoute.locationName}`
    );

    // 6. Secondary district referral hospital suppression ("কুমিল্লা মেডিকেল কলেজ হাসপাতাল")
    const referralHosp = await resolveLocationFromText('ফেনীতে সড়ক দুর্ঘটনায় আহতদের কুমিল্লা মেডিকেল কলেজ হাসপাতালে ভর্তি করা হয়েছে');
    assert.ok(referralHosp !== null);
    assert.ok(
      referralHosp.locationName.toLowerCase().includes('feni'),
      `Expected scene Feni despite referral to Cumilla medical college, got ${referralHosp.locationName}`
    );
  });
});
