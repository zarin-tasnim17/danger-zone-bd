import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';

describe('Tier 1: Feature Coverage - F07: Arrest & Detainee Disqualification Expansion', () => {
  it('T1-F07-01: Disqualifies standalone Bengali "[Place] এ [Criminal Type] আটক/গ্রেফতার" reports', () => {
    const standaloneArrestHeadlines = [
      'সাভারে আন্তঃজেলা ডাকাত দলের ৩ সদস্য আটক',
      'টঙ্গীতে শীর্ষ সন্ত্রাসী ও চাঁদাবাজ গ্রেফতার',
      'কুমিল্লায় বিপুল পরিমাণ ফেনসিডিলসহ মাদক কারবারি গ্রেফতার',
      'যাত্রাবাড়ীতে অস্ত্রসহ চিহ্নিত ছিনতাইকারী আটক',
      'মিরপুরে চোর চক্রের মূলহোতাসহ গ্রেফতার ৪',
    ];

    for (const headline of standaloneArrestHeadlines) {
      const result = classifyNewsText(headline, 'পুলিশ অভিযান চালিয়ে আসামিদের গ্রেফতার করে আদালতে সোপর্দ করেছে।');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Headline "${headline}" is a standalone arrest follow-up and must have isSafetyRelated: false`
      );
      assert.ok(
        result.disqualifiedReason === 'ARREST_FOLLOWUP' || result.disqualifiedReason !== undefined,
        `Expected disqualifiedReason for "${headline}", got: ${result.disqualifiedReason}`
      );
    }
  });

  it('T1-F07-02: Disqualifies standalone English arrest and detention updates', () => {
    const englishArrestHeadlines = [
      'Three robbers arrested in Savar by DB police',
      'Fugitive accused in robbery case nabbed from Sylhet',
      'Two drug peddlers held with yaba pills in Cox\'s Bazar',
      'Police arrest top extortionist in Tongi',
    ];

    for (const headline of englishArrestHeadlines) {
      const result = classifyNewsText(headline, 'Police produced the arrested suspects before the court.');
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `English arrest headline "${headline}" must have isSafetyRelated: false`
      );
    }
  });

  it('T1-F07-03: Active violent confrontation during arrest is NOT disqualified and qualifies as active incident', () => {
    const activeConfrontationCases = [
      'সাভারে গ্রেফতার অভিযানে পুলিশের সঙ্গে ডাকাতদের বন্দুকযুদ্ধ, গুলিবিদ্ধ ২',
      'টঙ্গীতে গ্রেফতারকালে পুলিশের ওপর ককটেল হামলা',
      'Police come under gunfire during arrest drive in Teknaf',
    ];

    for (const headline of activeConfrontationCases) {
      const result = classifyNewsText(headline, 'সংঘর্ষে পুলিশ সদস্যসহ বেশ কয়েকজন আহত হন।');
      assert.strictEqual(
        result.isSafetyRelated,
        true,
        `Active confrontation during arrest "${headline}" must remain isSafetyRelated: true`
      );
    }
  });

  it('T1-F07-04: Genuine in-progress crimes are never falsely disqualified by arrest keyword mentions', () => {
    const activeCrimes = [
      'মিরপুরে সোনার দোকানে দুর্ধর্ষ ডাকাতি, পালানোর সময় বাধা দিলে গুলি',
      'যাত্রাবাড়ীতে ছিনতাইকালে পথচারীকে কুপিয়ে জখম',
      'Armed clash between two rival groups leaves 5 injured in Bogura',
    ];

    for (const headline of activeCrimes) {
      const result = classifyNewsText(headline);
      assert.strictEqual(
        result.isSafetyRelated,
        true,
        `Genuine active crime "${headline}" must have isSafetyRelated: true`
      );
    }
  });

  it('T1-F07-05: Retrospective suspect remand and judicial custody updates are disqualified', () => {
    const judicialUpdates = [
      'সাবেক মন্ত্রী হত্যা মামলায় ৩ দিনের রিমান্ডে',
      'গ্রেফতারকৃত ডাকাত সদস্যদের কারাগারে পাঠানোর নির্দেশ আদালতের',
      'Suspects in murder case sent to jail upon completion of remand',
    ];

    for (const headline of judicialUpdates) {
      const result = classifyNewsText(headline);
      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Remand/jail update "${headline}" must have isSafetyRelated: false`
      );
    }
  });
});
