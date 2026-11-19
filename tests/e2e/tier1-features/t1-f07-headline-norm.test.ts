import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanIncidentTitle } from '../harness/contractValidator';
import {
  extractSignificantTokens,
  calculateStorySimilarity,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 1: Feature Coverage - F07: Headline Normalization & Title Matching', () => {
  it('T1-F07-01: Bengali Double Dari (॥) and En-dash (–) are stripped cleanly by cleanIncidentTitle', () => {
    const rawHeadline = 'মিরপুরে সড়ক দুর্ঘটনা ॥ বাস চাপায় পথচারী নিহত – বিস্তারিত আসছে';
    const cleaned = cleanIncidentTitle(rawHeadline);

    assert.ok(!cleaned.includes('॥'), 'Must strip Bengali Double Dari (॥)');
    assert.ok(!cleaned.includes('–'), 'Must strip En-dash (–)');
    assert.ok(cleaned.includes('মিরপুরে সড়ক দুর্ঘটনা'));
    assert.ok(cleaned.includes('বাস চাপায় পথচারী নিহত'));
  });

  it('T1-F07-02: Media outlet suffixes and publisher credits are pruned from title headlines', () => {
    const titleWithOutlet1 = 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে নিহত ৩ - The Daily Star';
    const titleWithOutlet2 = 'উত্তরায় মধ্যরাতে সশস্ত্র ডাকাতি | প্রথম আলো';
    const titleWithPrefix = '[Google News BD Theft] মিরপুরে স্বর্ণালঙ্কার চুরি';

    assert.strictEqual(
      cleanIncidentTitle(titleWithOutlet1),
      'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে নিহত ৩'
    );
    assert.strictEqual(
      cleanIncidentTitle(titleWithOutlet2),
      'উত্তরায় মধ্যরাতে সশস্ত্র ডাকাতি'
    );
    assert.ok(
      cleanIncidentTitle(titleWithPrefix).includes('মিরপুরে স্বর্ণালঙ্কার চুরি'),
      'Must strip [Google News] prefix'
    );
  });

  it('T1-F07-03: Bengali digits (০-৯) are converted to canonical Western digits (0-9)', () => {
    const title = 'গাজীপুরে সংঘর্ষে ৫ জন নিহত ও ১২ জন আহত';
    const tokens = extractSignificantTokens(title);

    assert.ok(tokens.has('5'), 'Must convert Bengali ৫ to Western 5');
    assert.ok(tokens.has('12'), 'Must convert Bengali ১২ to Western 12');
  });

  it('T1-F07-04: Grammatical inflections and case suffixes are stemmed in Bengali tokens', () => {
    const title = 'বাসের সঙ্গে ট্রাকের মুখোমুখি সংঘর্ষ';
    const tokens = extractSignificantTokens(title);

    // Stemmed case inflections: 'বাসের' -> 'বাস' / 'bus', 'ট্রাকের' -> 'ট্রাক' / 'truck'
    assert.ok(tokens.has('bus') || tokens.has('বাস'), 'Must stem and identify bus');
    assert.ok(tokens.has('truck') || tokens.has('ট্রাক'), 'Must stem and identify truck');
    assert.ok(tokens.has('collision') || tokens.has('সংঘর্ষ'), 'Must extract collision concept');
  });

  it('T1-F07-05: Bilingual headline normalization bridges English and Bangla reports into shared canonical concept tokens', () => {
    const banglaHeadline = 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত';
    const englishHeadline = '3 killed in bus-truck collision in Sitakunda - Daily Star';

    const tokensBn = extractSignificantTokens(banglaHeadline);
    const tokensEn = extractSignificantTokens(englishHeadline);

    // Common concepts bridged: 3, truck, bus, collision, killed
    const sharedConcepts = ['3', 'truck', 'bus', 'collision', 'killed'];
    for (const c of sharedConcepts) {
      assert.ok(
        tokensBn.has(c),
        `Bangla headline tokens should include canonical concept "${c}"`
      );
      assert.ok(
        tokensEn.has(c),
        `English headline tokens should include canonical concept "${c}"`
      );
    }

    const similarity = calculateStorySimilarity(banglaHeadline, englishHeadline);
    assert.strictEqual(
      similarity.isDuplicate,
      true,
      'Bilingual reports of the same incident must be recognized as duplicate stories'
    );
    assert.ok(similarity.score >= 0.35, 'Similarity score should be substantial');
  });
});
