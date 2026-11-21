import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  maskArrestAndCaseVenue,
  resolveLocationFromText,
} from '../../../apps/api/src/services/geocodingService';

describe('Tier 1: Feature Coverage - F05: Secondary Locative Venue Masking', () => {
  it('T1-F05-01: maskArrestAndCaseVenue cleanly strips locative arrest and detainee phrases', () => {
    const testCases = [
      {
        input: 'মিরপুরে ছিনতাইয়ের ঘটনায় গাজীপুরে গ্রেফতার ২',
        shouldNotContain: 'গাজীপুর',
      },
      {
        input: 'সাভারে চুরির ঘটনায় টঙ্গীতে আটক ৩',
        shouldNotContain: 'টঙ্গী',
      },
      {
        input: 'পলাতক আসামি ফেনীতে গ্রেপ্তার হয়েছে',
        shouldNotContain: 'ফেনী',
      },
      {
        input: 'বগুড়ার আদালতে তোলা হয়েছে আসামিকে',
        shouldNotContain: 'বগুড়া',
      },
    ];

    for (const tc of testCases) {
      const masked = maskArrestAndCaseVenue(tc.input);
      assert.ok(
        !masked.includes(tc.shouldNotContain),
        `Expected "${tc.input}" masked output to NOT contain "${tc.shouldNotContain}", got: "${masked}"`
      );
    }
  });

  it('T1-F05-02: Bengali dual-location crime and arrest headlines prioritize incident scene over arrest venue', async () => {
    const dualLocationCases = [
      {
        text: 'মিরপুরে ছিনতাইয়ের ঘটনায় গাজীপুরে গ্রেফতার ২',
        expectedDistrict: 'Dhaka',
        forbiddenDistrict: 'Gazipur',
      },
      {
        text: 'সাভারে স্বর্ণের দোকানে ডাকাতি, নরসিংদীতে আটক ৪',
        expectedDistrict: 'Dhaka',
        forbiddenDistrict: 'Narsingdi',
      },
      {
        text: 'ফেনীতে বিএনপি নেতার ওপর হামলা, চট্টগ্রামে মামলার আসামি গ্রেফতার',
        expectedDistrict: 'Feni',
        forbiddenDistrict: 'Chattogram',
      },
    ];

    for (const tc of dualLocationCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Expected location resolution for "${tc.text}"`);
      assert.strictEqual(
        res.district,
        tc.expectedDistrict,
        `Headline "${tc.text}" should resolve to incident location district '${tc.expectedDistrict}', got '${res.district}'`
      );
      assert.notStrictEqual(
        res.district,
        tc.forbiddenDistrict,
        `Headline "${tc.text}" must NOT resolve to secondary arrest venue '${tc.forbiddenDistrict}'`
      );
    }
  });

  it('T1-F05-03: English dual-location headlines prioritize crime scene over arrest location', async () => {
    const englishCases = [
      {
        text: 'Two arrested in Gazipur over robbery in Dhanmondi',
        expectedDistrict: 'Dhaka',
        forbiddenDistrict: 'Gazipur',
      },
      {
        text: 'Fugitive held in Sylhet after murder in Sunamganj',
        expectedDistrict: 'Sunamganj',
        forbiddenDistrict: 'Sylhet',
      },
      {
        text: 'Robber nabbed from Bogra following armed heist in Sirajganj',
        expectedDistrict: 'Sirajganj',
        forbiddenDistrict: 'Bogra',
      },
    ];

    for (const tc of englishCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Expected resolution for "${tc.text}"`);
      assert.strictEqual(
        res.district,
        tc.expectedDistrict,
        `Expected incident district '${tc.expectedDistrict}' for "${tc.text}", got '${res.district}'`
      );
      assert.notStrictEqual(
        res.district,
        tc.forbiddenDistrict,
        `Must not resolve to arrest location '${tc.forbiddenDistrict}' for "${tc.text}"`
      );
    }
  });

  it('T1-F05-04: Court and trial venues are masked from overriding original crime location', async () => {
    const courtCases = [
      {
        text: 'ফেনীতে গাড়িবহরে হামলার ঘটনায় কুমিল্লা আদালতে অভিযোগপত্র দাখিল',
        expectedDistrict: 'Feni',
        forbiddenDistrict: 'Cumilla',
      },
      {
        text: 'সাভারে শ্রমিক নিহতের ঘটনায় ঢাকা জজ কোর্টে মামলা',
        expectedDistrict: 'Dhaka',
      },
    ];

    for (const tc of courtCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Expected location resolution for "${tc.text}"`);
      assert.strictEqual(
        res.district,
        tc.expectedDistrict,
        `Headline "${tc.text}" should resolve to incident scene '${tc.expectedDistrict}', got '${res.district}'`
      );
      if (tc.forbiddenDistrict) {
        assert.notStrictEqual(
          res.district,
          tc.forbiddenDistrict,
          `Court venue '${tc.forbiddenDistrict}' should be masked for "${tc.text}"`
        );
      }
    }
  });

  it('T1-F05-05: Standalone arrest headlines without crime scene do not resolve to a false active incident location', async () => {
    const standaloneArrests = [
      'টঙ্গীতে মাদক কারবারি গ্রেফতার',
      'সাভারে ২ ডাকাত আটক',
      'গাজীপুরে গ্রেফতার ৩',
    ];

    for (const text of standaloneArrests) {
      const masked = maskArrestAndCaseVenue(text);
      // The masked string should strip the arrest place mention
      assert.ok(
        !masked.includes('টঙ্গী') && !masked.includes('সাভার') && !masked.includes('গাজীপুর'),
        `Expected arrest locations to be stripped from standalone arrest: "${text}", got: "${masked}"`
      );
    }
  });

  it('T1-F05-06: Unpunctuated headlines cleanly isolate locative arrest venue without erasing crime scene', async () => {
    const unpunctuatedCases = [
      {
        text: 'নরসিংদীতে ছিনতাই গাজীপুরে গ্রেফতার ২',
        expectedDistrict: 'Narsingdi',
        forbiddenDistrict: 'Gazipur',
      },
      {
        text: 'কুমিল্লায় ডাকাতি চট্টগ্রামে আটক ৩',
        expectedDistrict: 'Cumilla',
        forbiddenDistrict: 'Chattogram',
      },
      {
        text: 'ঢাকায় খুন সিলেটে গ্রেপ্তার ১',
        expectedDistrict: 'Dhaka',
        forbiddenDistrict: 'Sylhet',
      },
      {
        text: 'নরসিংদীতে ছিনতাইয়ের পর গাজীপুরে গ্রেফতার ২',
        expectedDistrict: 'Narsingdi',
        forbiddenDistrict: 'Gazipur',
      },
    ];

    for (const tc of unpunctuatedCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Expected location resolution for unpunctuated "${tc.text}"`);
      assert.strictEqual(
        res.district,
        tc.expectedDistrict,
        `Headline "${tc.text}" should resolve to crime district '${tc.expectedDistrict}', got '${res.district}'`
      );
      assert.notStrictEqual(
        res.district,
        tc.forbiddenDistrict,
        `Headline "${tc.text}" must NOT resolve to secondary arrest venue '${tc.forbiddenDistrict}'`
      );
    }
  });
});
