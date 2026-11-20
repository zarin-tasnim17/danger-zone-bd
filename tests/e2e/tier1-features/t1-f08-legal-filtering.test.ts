import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';

describe('Tier 1: Feature Coverage - F08: Legal & Administrative Follow-up Filtering', () => {
  it('T1-F08-01: Filters out standalone lawsuit and case filing follow-up reports (মামলা দায়ের)', () => {
    const caseFilingHeadlines = [
      'মিরপুরে যুবদল নেতার ওপর হামলার ঘটনায় মামলা দায়ের',
      'চট্টগ্রামে সাংবাদিক লাঞ্ছিতের ঘটনায় থানায় মামলা দায়ের হয়েছে',
      'সাভারে ছিনতাইয়ের ঘটনায় অজ্ঞাতনামা আসামিদের বিরুদ্ধে মামলা দায়ের',
      'Case filed over murder of trader in Bogura',
    ];

    for (const headline of caseFilingHeadlines) {
      const result = classifyNewsText(headline, 'ভুক্তভোগীর পরিবারের পক্ষ থেকে মামলা দায়ের করা হয়েছে।');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Headline "${headline}" reporting legal case filing should be filtered out with isSafetyRelated: false`
      );
    }
  });

  it('T1-F08-02: Filters out administrative probe and inquiry committee formation reports (তদন্ত কমিটি)', () => {
    const probeCommitteeHeadlines = [
      'লঞ্চডুবির ঘটনায় তিন সদস্যের তদন্ত কমিটি গঠন',
      'হাসপাতালে অগ্নিকাণ্ডের ঘটনায় ৫ সদস্যের তদন্ত কমিটি',
      'রেল দুর্ঘটনার কারণ অনুসন্ধানে তদন্ত কমিটি গঠন করেছে রেলওয়ে',
      'Probe committee formed over hospital fire incident in Dhaka',
    ];

    for (const headline of probeCommitteeHeadlines) {
      const result = classifyNewsText(headline, 'কমিটিকে আগামী ৩ কার্যদিবসের মধ্যে প্রতিবেদন দাখিল করতে বলা হয়েছে।');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Administrative probe committee report "${headline}" must have isSafetyRelated: false`
      );
    }
  });

  it('T1-F08-03: Filters out interrogation and questioning updates without active violence (জিজ্ঞাসাবাদ)', () => {
    const interrogationHeadlines = [
      'গ্রেফতারকৃত আসামিদের রিমান্ডে জিজ্ঞাসাবাদ করা হচ্ছে',
      'ঘটনার সাথে জড়িত সন্দেহে আটক দুইজনকে জিজ্ঞাসাবাদ',
      'Suspects interrogated by DB police over heist in Uttara',
    ];

    for (const headline of interrogationHeadlines) {
      const result = classifyNewsText(headline, 'পুলিশ জানিয়েছে জিজ্ঞাসাবাদে গুরুত্বপূর্ণ তথ্য পাওয়া গেছে।');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Interrogation update "${headline}" must have isSafetyRelated: false`
      );
    }
  });

  it('T1-F08-04: Filters out General Diary (GD) filings without ongoing active threat (জিডি)', () => {
    const gdHeadlines = [
      'নিখোঁজের ঘটনায় রমনা থানায় সাধারণ ডায়েরি (জিডি)',
      'হুমকির ঘটনায় থানায় জিডি করেছেন শিক্ষক',
      'GD filed with police station over missing college student',
    ];

    for (const headline of gdHeadlines) {
      const result = classifyNewsText(headline, 'থানায় একটি সাধারণ ডায়েরি বা জিডি অন্তর্ভুক্ত করা হয়েছে।');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `General Diary report "${headline}" must have isSafetyRelated: false`
      );
    }
  });

  it('T1-F08-05: Real-time violent incidents with incidental legal mentions remain qualifying active incidents', () => {
    const activeThreatWithLegalMention = [
      {
        title: 'যাত্রাবাড়ীতে ছিনতাইকালে পথচারীকে কুপিয়ে জখম',
        summary: 'ছিনতাইকারীরা সর্বস্ব লুটে নিয়ে পালিয়ে যায়, থানায় অভিযোগ দায়ের করা হয়েছে।',
      },
      {
        title: 'উত্তরায় মধ্যরাতে দোকানে সশস্ত্র ডাকাতি',
        summary: 'অস্ত্রধারীরা লুটপাট চালায়, ঘটনাস্থলে পুলিশ পৌঁছেছে।',
      },
    ];

    for (const tc of activeThreatWithLegalMention) {
      const result = classifyNewsText(tc.title, tc.summary);
      assert.strictEqual(
        result.isSafetyRelated,
        true,
        `Active violent incident "${tc.title}" must NOT be disqualified by incidental legal mention in summary`
      );
    }
  });
});
