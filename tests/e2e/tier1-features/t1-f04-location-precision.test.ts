import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocationFromText,
  findLandmarkInText,
} from '../../../apps/api/src/services/geocodingService';
import { LOCATION_PRECISIONS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F04: Truthful Location Precision Enforcement', () => {
  it('T1-F04-01: Resolved results strictly adhere to standard precision tiers [EXACT, UPAZILA, DISTRICT, AMBIGUOUS]', async () => {
    const testPhrases = [
      'মিরপুরে ছিনতাইকালে হাতেনাতে আটক',
      'সিলেটে ভারী বর্ষণে নিম্নাঞ্চল প্লাবিত',
      'কালীগঞ্জে বাস উল্টে আহত ১৫',
      'চট্টগ্রামে ছাত্রদলের মিছিলে পুলিশের লাঠিচার্জ',
    ];

    const allowedPrecisions = new Set(LOCATION_PRECISIONS);

    for (const phrase of testPhrases) {
      const res = await resolveLocationFromText(phrase);
      assert.ok(res !== null, `Expected result for "${phrase}"`);
      assert.ok(
        allowedPrecisions.has(res.locationPrecision as any),
        `Precision "${res.locationPrecision}" for "${phrase}" is not a recognized tier`
      );
    }
  });

  it('T1-F04-02: Broad district-only mentions resolve strictly to DISTRICT precision, never EXACT', async () => {
    const districtPhrases = [
      'খুলনা জেলায় তীব্র শীতে হাসপাতালগুলোতে রোগীর চাপ বাড়ছে',
      'রংপুর জেলায় পরিবহন ধর্মঘটে সাধারণ যাত্রীদের চরম ভোগান্তি',
      'গোপালগঞ্জে তীব্র শীতে জনজীবন বিপর্যস্ত',
      'মাদারীপুরে ঘন কুয়াশায় নৌযান চলাচল বন্ধ',
    ];

    for (const phrase of districtPhrases) {
      const res = await resolveLocationFromText(phrase);
      assert.ok(res !== null, `Expected resolution for "${phrase}"`);
      assert.strictEqual(
        res.locationPrecision,
        'DISTRICT',
        `District-level event "${phrase}" must resolve to 'DISTRICT' precision, got '${res.locationPrecision}'`
      );
      assert.ok(
        res.district && res.district.length > 0,
        `Expected valid district name for "${phrase}"`
      );
    }
  });

  it('T1-F04-03: Thana and upazila mentions resolve to UPAZILA precision, never defaulting to EXACT', async () => {
    const upazilaPhrases = [
      'সাভারে ঢাকা-আরিচা মহাসড়কে দুই বাসের সংঘর্ষ',
      'হাতিয়ায় ট্রলারডুবির ঘটনায় উদ্ধার অভিযান অব্যাহত',
      'টেকনাফে বিপুল পরিমাণ ক্রিস্টাল মেথ আইস জব্দ',
      'মিরপুর ১০ নম্বরে যানজটে দীর্ঘ অপেক্ষা',
    ];

    for (const phrase of upazilaPhrases) {
      const res = await resolveLocationFromText(phrase);
      assert.ok(res !== null, `Expected resolution for "${phrase}"`);
      assert.strictEqual(
        res.locationPrecision,
        'UPAZILA',
        `Upazila-level mention "${phrase}" must resolve to 'UPAZILA' precision, got '${res.locationPrecision}'`
      );
    }
  });

  it('T1-F04-04: Homonym upazilas without district context resolve truthfully to AMBIGUOUS precision', async () => {
    const homonymPhrases = [
      'কালীগঞ্জে দুই বাসের মুখোমুখি সংঘর্ষ', // Gazipur vs Lalmonirhat vs Jhenaidah vs Satkhira
      'শিবগঞ্জে রাতে ডাকাতির চেষ্টা', // Bogura vs Chapainawabganj
      'পীরগঞ্জে অগ্নিকাণ্ডে ৮টি দোকান ভস্মীভূত', // Rangpur vs Thakurgaon
      'কোম্পানীগঞ্জে ডাকাত দলের হামলায় আহত ৩', // Noakhali vs Sylhet
      'লোহাগাড়ায় সংঘর্ষ', // Chattogram vs Narail
      'কচুয়ায় চুরি', // Chandpur vs Bagerhat
      'ফুলবাড়ীতে বিক্ষোভ', // Dinajpur vs Kurigram
      'শেরপুরে সংঘর্ষ', // Bogura vs Sherpur
      'নবাবগঞ্জে সংঘর্ষ', // Dhaka vs Dinajpur
      'দুর্গাপুরে অগ্নিকাণ্ড', // Rajshahi vs Netrokona
    ];

    for (const phrase of homonymPhrases) {
      const res = await resolveLocationFromText(phrase);
      assert.ok(res !== null, `Expected result for homonym phrase "${phrase}"`);
      assert.strictEqual(
        res.locationPrecision,
        'AMBIGUOUS',
        `Homonym mention without qualifying district in "${phrase}" must resolve to 'AMBIGUOUS', got '${res.locationPrecision}'`
      );
    }
  });

  it('T1-F04-05: Homonym upazilas with qualifying district context resolve unambiguously to UPAZILA precision', async () => {
    const qualifiedPhrases = [
      { text: 'গাজীপুরের কালীগঞ্জে দুই বাসের মুখোমুখি সংঘর্ষ', expectedDistricts: ['gazipur'] },
      { text: 'বগুড়ার শিবগঞ্জে রাতে ডাকাতির চেষ্টা', expectedDistricts: ['bogura', 'bogra'] },
      { text: 'রংপুরের পীরগঞ্জে অগ্নিকাণ্ডে দোকান ভস্মীভূত', expectedDistricts: ['rangpur'] },
      { text: 'নোয়াখালীর কোম্পানীগঞ্জে ডাকাত দলের হামলায় আহত', expectedDistricts: ['noakhali'] },
      { text: 'বগুড়ার শেরপুরে সংঘর্ষ', expectedDistricts: ['bogura', 'bogra'] },
      { text: 'চট্টগ্রামের লোহাগাড়ায় সংঘর্ষ', expectedDistricts: ['chattogram', 'chittagong'] },
      { text: 'দিনাজপুরের ফুলবাড়ীতে বিক্ষোভ', expectedDistricts: ['dinajpur'] },
    ];

    for (const item of qualifiedPhrases) {
      const res = await resolveLocationFromText(item.text);
      assert.ok(res !== null, `Expected resolution for qualified homonym: "${item.text}"`);
      assert.strictEqual(
        res.locationPrecision,
        'UPAZILA',
        `Qualified homonym "${item.text}" should resolve to UPAZILA precision, got '${res.locationPrecision}'`
      );
      const actualDistrictLower = (res.district || '').toLowerCase();
      assert.ok(
        item.expectedDistricts.some((d) => actualDistrictLower.includes(d)),
        `Expected district in [${item.expectedDistricts.join(', ')}] for "${item.text}", got: "${res.district}"`
      );
    }
  });
});
