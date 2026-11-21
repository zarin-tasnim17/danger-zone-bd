import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_LANDMARK_MAP,
  findLandmarkInText,
  resolveLocationFromText,
} from '../../../apps/api/src/services/geocodingService';

describe('Tier 1: Feature Coverage - F03: Landmark Map Thana Precision', () => {
  it('T1-F03-01: Major Dhaka urban thanas in LOCAL_LANDMARK_MAP are explicitly tagged with adminLevel: "THANA"', () => {
    const dhakaThanas = [
      'mirpur',
      'মিরপুর',
      'dhanmondi',
      'ধানমন্ডি',
      'gulshan',
      'গুলশান',
      'uttara',
      'উত্তরা',
      'banani',
      'বনানী',
      'motijheel',
      'মতিঝিল',
      'mohammadpur',
      'মোহাম্মদপুর',
      'badda',
      'বাড্ডা',
      'khilgaon',
      'খিলগাঁও',
    ];

    for (const thana of dhakaThanas) {
      const entry = LOCAL_LANDMARK_MAP[thana];
      assert.ok(entry, `Urban thana "${thana}" must exist in LOCAL_LANDMARK_MAP`);
      assert.strictEqual(
        entry.adminLevel,
        'THANA',
        `Urban thana "${thana}" must have adminLevel: "THANA", found: ${entry.adminLevel}`
      );
    }
  });

  it('T1-F03-02: Regional metropolitan thanas across Bangladesh are tagged with adminLevel: "THANA"', () => {
    const regionalThanas = [
      'panchlaish',
      'পাঁচলাইশ',
      'patenga',
      'পতেঙ্গা',
      'boalia',
      'বোয়ালিয়া',
      'khalishpur',
      'খালিশপুর',
    ];

    for (const thana of regionalThanas) {
      const entry = LOCAL_LANDMARK_MAP[thana];
      assert.ok(entry, `Regional thana "${thana}" must exist in LOCAL_LANDMARK_MAP`);
      assert.strictEqual(
        entry.adminLevel,
        'THANA',
        `Regional thana "${thana}" must have adminLevel: "THANA", found: ${entry.adminLevel}`
      );
    }
  });

  it('T1-F03-03: Geocoding urban thana mentions returns UPAZILA precision, strictly not EXACT', async () => {
    const testCases = [
      { text: 'মিরপুর ১০ নম্বরে দুই পক্ষের সংঘর্ষে আহত ৪', thana: 'Mirpur' },
      { text: 'ধানমন্ডিতে গভীর রাতে মোটরসাইকেল ছিনতাই', thana: 'Dhanmondi' },
      { text: 'উত্তরায় দ্রুতগতির বাসের ধাক্কায় পথচারী নিহত', thana: 'Uttara' },
      { text: 'গুলশানে বহুতল ভবনে অগ্নিকাণ্ড', thana: 'Gulshan' },
      { text: 'পাঁচলাইশে ছিনতাইকারীর ছুরিকাঘাতে যুবক আহত', thana: 'Panchlaish' },
    ];

    for (const tc of testCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Failed to resolve location for: "${tc.text}"`);
      assert.strictEqual(
        res.locationPrecision,
        'UPAZILA',
        `Urban thana in "${tc.text}" must have locationPrecision: 'UPAZILA', got '${res.locationPrecision}' (must not default to EXACT)`
      );
    }
  });

  it('T1-F03-04: District-level landmark mentions return DISTRICT precision', async () => {
    const districtTestCases = [
      { text: 'ফরিদপুরে তীব্র শীত ও ঘন কুয়াশায় বিপর্যস্ত জনজীবন', expectedDistrict: 'Faridpur' },
      { text: 'কুমিল্লায় বাস ও কাভার্ডভ্যানের সংঘর্ষে নিহত ২', expectedDistrict: 'Cumilla' },
      { text: 'নোয়াখালীতে আধিপত্য বিস্তার নিয়ে সংঘর্ষ', expectedDistrict: 'Noakhali' },
      { text: 'সিলেটে ভারী বৃষ্টিতে নিম্নাঞ্চল প্লাবিত', expectedDistrict: 'Sylhet' },
    ];

    for (const tc of districtTestCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Failed to resolve district for: "${tc.text}"`);
      assert.strictEqual(
        res.locationPrecision,
        'DISTRICT',
        `District-level text "${tc.text}" should return DISTRICT precision, got: ${res.locationPrecision}`
      );
    }
  });

  it('T1-F03-05: Prevention of EXACT precision defaults across all dictionary landmark queries', () => {
    const sampleKeys = [
      'mirpur', 'dhanmondi', 'gulshan', 'uttara', 'motijheel',
      'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal',
      'savar', 'gazipur', 'narayanganj', 'tangail', 'feni',
    ];

    for (const key of sampleKeys) {
      const res = findLandmarkInText(`ঘটনাটি ঘটেছে ${key} এলাকায়`);
      if (res) {
        assert.notStrictEqual(
          res.locationPrecision,
          'EXACT',
          `Landmark "${key}" must not resolve to 'EXACT' precision without street-level coordinates!`
        );
        assert.ok(
          res.locationPrecision === 'UPAZILA' || res.locationPrecision === 'DISTRICT',
          `Landmark "${key}" precision must be UPAZILA or DISTRICT, got: ${res.locationPrecision}`
        );
      }
    }
  });
});
