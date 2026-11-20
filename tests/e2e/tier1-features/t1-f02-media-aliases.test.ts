import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  resolveLocationFromText,
  normalizeBengali,
} from '../../../apps/api/src/services/geocodingService';

interface UpazilaRecord {
  id: string;
  nameEn: string;
  nameBn: string;
  districtEn: string;
  districtBn: string;
  divisionEn: string;
  divisionBn: string;
  latitude: number;
  longitude: number;
  aliasesEn?: string[];
  aliasesBn?: string[];
}

function loadUpazilas(): UpazilaRecord[] {
  const jsonPath = path.resolve(__dirname, '../../../apps/api/src/data/bangladesh_upazilas.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw);
}

describe('Tier 1: Feature Coverage - F02: Standard Media Upazila Aliases', () => {
  const upazilas = loadUpazilas();

  it('T1-F02-01: Chakaria upazila record includes media spelling variant "চকরিয়া" in aliasesBn', () => {
    const chakaria = upazilas.find(
      (u) => u.nameEn.toLowerCase() === 'chakaria' || u.id === 'coxsbazar-chakaria'
    );

    assert.ok(chakaria, 'Chakaria upazila must exist in bangladesh_upazilas.json');
    assert.ok(
      Array.isArray(chakaria.aliasesBn) && chakaria.aliasesBn.length > 0,
      'Chakaria upazila must have aliasesBn configured'
    );

    const hasMediaVariant = chakaria.aliasesBn.some((a) =>
      normalizeBengali(a).includes(normalizeBengali('চকরিয়া'))
    );

    assert.ok(
      hasMediaVariant,
      `Expected Chakaria aliasesBn to contain media variant "চকরিয়া", found: ${JSON.stringify(chakaria.aliasesBn)}`
    );
  });

  it('T1-F02-02: News headlines with media spelling "চকরিয়া" resolve to Chakaria in Cox\'s Bazar', async () => {
    const headlines = [
      'চকরিয়ায় দুই বাসের মুখোমুখি সংঘর্ষে চালকসহ নিহত ৩',
      'কক্সবাজারের চকরিয়া উপজেলায় সড়ক দুর্ঘটনায় আহত ৫',
      'চকরিয়া থানায় নতুন ভারপ্রাপ্ত কর্মকর্তার যোগদান',
    ];

    for (const headline of headlines) {
      const res = await resolveLocationFromText(headline);
      assert.ok(res !== null, `Expected location resolution for headline: "${headline}"`);
      assert.strictEqual(
        res.district,
        "Cox's Bazar",
        `Headline "${headline}" should resolve to Cox's Bazar district, got: ${res.district}`
      );
      assert.ok(
        res.latitude >= 21.3 && res.latitude <= 21.9,
        `Expected Chakaria latitude in [21.3, 21.9], got: ${res.latitude}`
      );
      assert.ok(
        res.longitude >= 91.9 && res.longitude <= 92.3,
        `Expected Chakaria longitude in [91.9, 92.3], got: ${res.longitude}`
      );
    }
  });

  it('T1-F02-03: Media variants with decomposed or alternate Bengali characters resolve accurately', async () => {
    const testCases = [
      {
        text: 'ব্রাহ্মণবাড়িয়ায় ট্রেনের ধাক্কায় অটোরিকশা দুমড়েমুচড়ে নিহত ২',
        allowedDistricts: ['Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'],
      },
      {
        text: 'ব্রাহ্মণবাড়িয়ায় সংঘর্ষের ঘটনায় থমথমে পরিস্থিতি',
        allowedDistricts: ['Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'],
      },
      {
        text: 'বগুড়ায় যাত্রীবাহী বাস খাদে পড়ে আহত ১৫',
        allowedDistricts: ['Bogura', 'Bogra', 'বগুড়া'],
      },
      {
        text: 'বগুড়ায় ট্রাকচাপায় মোটরসাইকেল আরোহী নিহত',
        allowedDistricts: ['Bogura', 'Bogra', 'বগুড়া'],
      },
    ];

    for (const tc of testCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Failed to resolve location for: "${tc.text}"`);
      assert.ok(
        tc.allowedDistricts.includes(res.district || '') ||
        tc.allowedDistricts.includes(res.locationName || ''),
        `Expected district in [${tc.allowedDistricts.join(', ')}] for text "${tc.text}", got: "${res.district}"`
      );
    }
  });

  it('T1-F02-04: Traditional and historical English media aliases resolve to correct district and upazila', async () => {
    const testCases = [
      {
        text: 'Violent clash in Chittagong port area leaves two injured',
        allowedDistricts: ['Chattogram', 'Chittagong'],
      },
      {
        text: 'Road mishap in Comilla claims three lives on highway',
        allowedDistricts: ['Cumilla', 'Comilla'],
      },
      {
        text: 'Drug smuggling ring busted in Jessore border',
        allowedDistricts: ['Jashore', 'Jessore'],
      },
      {
        text: 'Highway robbery thwarted in Bogra bypass',
        allowedDistricts: ['Bogura', 'Bogra'],
      },
    ];

    for (const tc of testCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Failed to resolve English alias for: "${tc.text}"`);
      assert.ok(
        tc.allowedDistricts.includes(res.district || '') ||
        tc.allowedDistricts.includes(res.locationName || ''),
        `Expected district in [${tc.allowedDistricts.join(', ')}] for "${tc.text}", got: "${res.district}"`
      );
    }
  });

  it('T1-F02-05: Headlines with Sadar upazila variations resolve to UPAZILA precision', async () => {
    const testCases = [
      { text: 'কক্সবাজার সদর এলাকায় গ্যাস সিলিন্ডার বিস্ফোরণ', expectedDistrict: "Cox's Bazar" },
      { text: 'ফেনী সদর উপজেলায় পানিতে ডুবে শিশুর মৃত্যু', expectedDistrict: 'Feni' },
      { text: 'দিনাজপুর সদরে ট্রাকচাপায় পথচারী নিহত', expectedDistrict: 'Dinajpur' },
      { text: 'পাবনা সদরে দুই পক্ষের রক্তক্ষয়ী সংঘর্ষ', expectedDistrict: 'Pabna' },
    ];

    for (const tc of testCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Failed to resolve Sadar upazila for: "${tc.text}"`);
      assert.strictEqual(res.district, tc.expectedDistrict);
      assert.ok(
        res.locationPrecision === 'UPAZILA' || res.locationPrecision === 'EXACT',
        `Expected UPAZILA or EXACT precision for Sadar upazila in "${tc.text}", got: ${res.locationPrecision}`
      );
    }
  });
});
