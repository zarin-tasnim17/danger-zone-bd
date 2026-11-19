import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNewsText } from '../../../apps/api/src/services/newsClassifierService';

describe('Tier 2: Boundary & Corner Cases - F09: Classification Ambiguities & Code-Switching', () => {
  it('T2-F09-01: Disclaimers and non-incident statements do not falsely classify into active crimes', () => {
    // Normal peaceful news or non-incident reports
    const result = classifyNewsText('রাজধানীতে আজ কোনো অপ্রীতিকর ঘটনা ঘটেনি', 'আইনশৃঙ্খলা পরিস্থিতি স্বাভাবিক রয়েছে।');

    // Should not match violent categories
    assert.strictEqual(result.isSafetyRelated, false, 'Non-incident statement should have isSafetyRelated: false');
  });

  it('T2-F09-02: Sports and cultural metaphorical headlines without real crimes do not map to violent assault', () => {
    const sportsTitle = 'বিশ্বকাপ ফুটবলে মাঠে মুখোমুখি লড়াইয়ে মুখোমুখি ব্রাজিল ও আর্জেন্টিনা';
    const result = classifyNewsText(sportsTitle, 'স্টেডিয়ামে ভক্তদের উল্লাস, কোনো বিশৃঙ্খলা নেই।');

    // Must not be misclassified as ARMED_ASSAULT
    assert.notStrictEqual(result.category, 'ARMED_ASSAULT', 'Sports match must not classify as ARMED_ASSAULT');
  });

  it('T2-F09-03: Multi-hazard compound story (armed clash causing vehicular crash) resolves to dominant category', () => {
    const compoundStory = 'আওয়ামী লীগ ও বিএনপির সংঘর্ষে ককটেল ও গুলিবিদ্ধ হয়ে নিহত ১';
    const result = classifyNewsText(compoundStory, 'উভয় পক্ষের অস্ত্রধারীদের মধ্যে ধাওয়া-পাল্টাধাওয়া।');

    assert.strictEqual(result.isSafetyRelated, true);
    assert.strictEqual(result.category, 'ARMED_ASSAULT', 'Political factional violence must resolve to ARMED_ASSAULT');
    assert.strictEqual(result.severity, 'HIGH');
  });

  it('T2-F09-04: Fatal terms without criminal/hazard keywords (natural deaths) return isSafetyRelated: false', () => {
    const naturalDeath = 'হাসপাতালে চিকিৎসাধীন অবস্থায় বৃদ্ধের স্বাভাবিক মৃত্যু';
    const result = classifyNewsText(naturalDeath, 'বার্ধক্যজনিত জটিলতায় তার মৃত্যু হয়।');

    assert.strictEqual(result.isSafetyRelated, false, 'Natural death without crime/accident keywords must be non-safety related');
  });

  it('T2-F09-05: Transliterated code-switching headline (Banglish) maps to canonical safety category', () => {
    const banglishHeadline = 'Mirpur 10 e boro dhoroner dacoity and robbery hoise';
    const result = classifyNewsText(banglishHeadline, 'Shop owner tied up and gold stolen');

    assert.strictEqual(result.isSafetyRelated, true);
    assert.ok(
      result.category === 'ROBBERY' || result.category === 'THEFT_ROBBERY',
      `Banglish dacoity/robbery headline must resolve to ROBBERY or THEFT_ROBBERY, got ${result.category}`
    );
  });
});
