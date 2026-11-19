import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNewsText,
} from '../../../apps/api/src/services/newsClassifierService';
import { ALL_11_SAFETY_CATEGORIES } from '../harness/testDataGenerators';
import type { ReportCategory } from '@repo/shared';

describe('Tier 1: Feature Coverage - F09: 11-Category Classification Engine', () => {
  it('T1-F09-01: Accurately classifies distinct incident text across all 11 primary safety categories', () => {
    const samples: Record<ReportCategory, { title: string; summary: string }> = {
      THEFT: {
        title: 'মিরপুরে ফ্ল্যাটের তালা ভেঙে স্বর্ণালঙ্কার ও নগদ টাকা চুরি',
        summary: 'চোর চক্র রাতের আঁধারে আলমারি ভেঙে মূল্যবান জিনিসপত্র stolen করে।',
      },
      ROBBERY: {
        title: 'উত্তরায় মধ্যরাতে সিন্দুক ভেঙে সশস্ত্র ডাকাতি',
        summary: 'অস্ত্রধারী ডাকাত দল নৈশপ্রহরীকে বেঁধে লুটপাট চালায়।',
      },
      THEFT_ROBBERY: {
        title: 'ধানমন্ডিতে গভীর রাতে চুরি ও ডাকাতির ঘটনায় মামলা',
        summary: 'বাসার তালা ভেঙে চুরি ও লুণ্ঠনের ঘটনা ঘটে।',
      },
      SNATCHING: {
        title: 'ফার্মগেটে পথচারীর মোবাইল ও হ্যান্ডব্যাগ ছিনতাই',
        summary: 'দ্রুতগতির মোটরসাইকেলে এসে snatcher ব্যাগ টান দিয়ে পালিয়ে যায়।',
      },
      ARMED_ASSAULT: {
        title: 'মোহাম্মদপুরে দুর্বৃত্তদের ছুরিকাঘাতে যুবক গুরুতর আহত',
        summary: 'ধারালো ছুরি দিয়ে কুপিয়ে জখম করে পালিয়ে যায় হামলাকারীরা।',
      },
      SNATCHING_ARMED_ASSAULT: {
        title: 'যাত্রাবাড়ীতে ছিনতাইকালে বাধা দেওয়ায় পথচারীকে কুপিয়ে জখম',
        summary: 'ছিনতাই ও সশস্ত্র হামলা চালিয়ে সর্বস্ব লুটে নেয়।',
      },
      EXTORTION: {
        title: 'টঙ্গীতে ব্যবসায়ীর কাছে ৫ লাখ টাকা চাঁদা দাবি না পেয়ে হামলা',
        summary: 'চিহ্নিত চাঁদাবাজ চক্র extortion ও চাঁদা চেয়ে হুমকি দেয়।',
      },
      YOUTH_GANG_ACTIVITY: {
        title: 'মিরপুর ১০ নম্বরে কিশোর গ্যাংয়ের দুই গ্রুপের মধ্যে মহড়া ও ধাওয়া',
        summary: 'এলাকায় আতঙ্ক ছড়াতে teen gang ও কিশোর অপরাধী দলের তৎপরতা বৃদ্ধি।',
      },
      DRUG_RELATED_CRIME: {
        title: 'টেকনাফে বিপুল পরিমাণ ইয়াবা ও ফেনসিডিলসহ মাদক কারবারি আটক',
        summary: 'বিজিবির অভিযানে বিপুল narcotics ও yaba ট্যাবলেট উদ্ধার।',
      },
      UNLIT_ROAD: {
        title: 'কেরানীগঞ্জে ভাঙা রাস্তায় সড়ক বাতি নেই রাতে চলাচলে চরম ঝুঁকি',
        summary: 'অন্ধকার সড়ক ও বিপজ্জনক গর্তে pothole hazard তৈরি হয়েছে।',
      },
      ROAD_ACCIDENT: {
        title: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
        summary: 'ঢাকা-চট্টগ্রাম মহাসড়কে বাস উল্টে deadly crash ঘটে।',
      },
      // Aliases mapped into categories
      MUGGING: { title: 'ছিনতাই', summary: 'snatching' },
      DACOITY: { title: 'ডাকাতি', summary: 'robbery' },
      THEFT_DACOITY: { title: 'চুরি ডাকাতি', summary: 'theft robbery' },
      TEEN_GANG: { title: 'কিশোর গ্যাং', summary: 'teen gang' },
      TEEN_GANG_ARMED_ASSAULT: { title: 'কিশোর গ্যাং অস্ত্র', summary: 'teen gang assault' },
      DRUG_ACTIVITY: { title: 'মাদক কারবারি', summary: 'drugs' },
    };

    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      const sample = samples[cat];
      const result = classifyNewsText(sample.title, sample.summary);

      assert.strictEqual(
        result.isSafetyRelated,
        true,
        `Article for ${cat} must be flagged as safety related`
      );
      assert.strictEqual(
        result.category,
        cat,
        `Expected category ${cat}, received ${result.category}`
      );
    }
  });

  it('T1-F09-02: Correctly detects compound safety combination categories (THEFT_ROBBERY, SNATCHING_ARMED_ASSAULT)', () => {
    // 1. Theft + Robbery combination
    const trText = 'ব্যবসায়ীর বাড়িতে চুরি ও ডাকাতি, স্বর্ণালঙ্কার লুণ্ঠন';
    const trResult = classifyNewsText(trText);
    assert.strictEqual(trResult.category, 'THEFT_ROBBERY');

    // 2. Snatching + Armed Assault combination (both categories present)
    const saText = 'মিরপুরে ছিনতাই ও ছুরিকাঘাতে পথচারী রক্তাক্ত, মোবাইল ছিনতাই';
    const saResult = classifyNewsText(saText);
    assert.strictEqual(saResult.category, 'SNATCHING_ARMED_ASSAULT');
  });

  it('T1-F09-03: Resolves vehicular collision vs violent political faction clash correctly', () => {
    // Vehicular collision with vehicles mentioned
    const crashText = 'ঢাকা-সিলেট মহাসড়কে বাস ও পিকআপের মুখোমুখি সংঘর্ষে নিহত ২';
    const crashResult = classifyNewsText(crashText);
    assert.strictEqual(
      crashResult.category,
      'ROAD_ACCIDENT',
      'Traffic crash must resolve to ROAD_ACCIDENT despite "সংঘর্ষ" keyword'
    );

    // Political/factional violent clash
    const clashText = 'রাজশাহীতে রাজনৈতিক দুই পক্ষের মধ্যে রক্তক্ষয়ী সংঘর্ষ ও ককটেল বিস্ফোরণ';
    const clashResult = classifyNewsText(clashText);
    assert.strictEqual(
      clashResult.category,
      'ARMED_ASSAULT',
      'Violent factional clash must resolve to ARMED_ASSAULT'
    );
  });

  it('T1-F09-04: Assigns severity levels (HIGH, MEDIUM, LOW) based on casualty and weapon indicators', () => {
    // High severity: Fatalities or firearms
    const highText = 'সড়ক দুর্ঘটনায় বাসের মুখোমুখি সংঘর্ষে ৩ জন নিহত ও লাশ উদ্ধার';
    const highResult = classifyNewsText(highText);
    assert.strictEqual(highResult.severity, 'HIGH', 'Incidents with fatalities must be HIGH severity');

    // Medium/Low severity: Property theft without violence
    const minorTheft = 'দোকানের ক্যাশবাক্স থেকে টাকা চুরি হয়েছে';
    const minorResult = classifyNewsText(minorTheft);
    assert.ok(
      minorResult.severity === 'MEDIUM' || minorResult.severity === 'LOW',
      'Non-violent property crime should be MEDIUM or LOW severity'
    );
  });

  it('T1-F09-05: Non-safety benign or general news articles return isSafetyRelated: false', () => {
    const benignHeadlines = [
      'বাংলাদেশ ক্রিকেট দলের নতুন অধিনায়ক ঘোষণা',
      'ঢাকা আন্তর্জাতিক বাণিজ্য মেলায় ক্রেতাদের উপচে পড়া ভিড়',
      'আজকের আবহাওয়া পূর্বাভাস ও তাপমাত্রা বৃদ্ধির সম্ভাবনা',
      'শেয়ারবাজারে সূচক ঊর্ধ্বমুখী, লেনদেন বৃদ্ধি',
    ];

    for (const headline of benignHeadlines) {
      const result = classifyNewsText(headline);
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Benign news headline should not be classified as safety related: "${headline}"`
      );
    }
  });
});
