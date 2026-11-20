import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSignificantTokens,
  calculateStorySimilarity,
  cleanIncidentTitle,
  extractVehicles,
} from '../../../apps/api/src/services/incidentDeduplicationService';

describe('Tier 1: Feature Coverage - F13: Cross-Lingual Concept & Entity Dictionary Expansion', () => {
  it('T1-F13-01: Vehicle synonyms in Bengali map directly to canonical English tokens', () => {
    // Test vehicles: bus, truck, pickup, cng, motorcycle, nosimon, ambulance
    const testCases: [string, string][] = [
      ['সীতাকুণ্ডে বাসের ধাক্কা', 'bus'],
      ['মহাসড়কে ট্রাকের সাথে সংঘর্ষ', 'truck'],
      ['পিকআপভ্যান উল্টে দুর্ঘটনা', 'pickup'],
      ['সিএনজি ও অটোরিকশার সংঘর্ষ', 'cng'],
      ['মোটরসাইকেল আরোহী নিহত', 'motorcycle'],
      ['নসিমনের ধাক্কায় পথচারী আহত', 'nosimon'],
      ['অ্যাম্বুলেন্সের মুখোমুখি সংঘর্ষ', 'ambulance'],
    ];

    for (const [phrase, expectedConcept] of testCases) {
      const tokens = extractSignificantTokens(phrase);
      assert.ok(
        tokens.has(expectedConcept),
        `Tokens from "${phrase}" must contain canonical concept "${expectedConcept}". Got: ${Array.from(tokens).join(', ')}`
      );
    }
  });

  it('T1-F13-02: Crime, violence, and casualty concepts bridge across Bengali and English', () => {
    const harmCases: [string, string][] = [
      ['বাসের ধাক্কায় ৩ জন নিহত', 'killed'],
      ['সংঘর্ষে ৫ জন আহত', 'injured'],
      ['ব্যাংক ডাকাতির ঘটনায় এলাকায় আতঙ্ক', 'robbery'],
      ['মোবাইল ছিনতাইয়ের সময় ছুরিকাঘাত', 'snatching'],
      ['ছুরিকাঘাতে যুবক নিহত', 'stabbing'],
      ['গুলিবিদ্ধ হয়ে যুবক আহত', 'gunfire'],
      ['দোকানে অগ্নিসংযোগ ও ভাঙচুর', 'arson'],
      ['কিশোর গ্যাংয়ের মহড়া', 'teengang'],
      ['দোকানে চাঁদাবাজি ও মারধরের অভিযোগ', 'extortion'],
    ];

    for (const [phrase, expectedConcept] of harmCases) {
      const tokens = extractSignificantTokens(phrase);
      assert.ok(
        tokens.has(expectedConcept),
        `Tokens from "${phrase}" must include "${expectedConcept}". Extracted: ${Array.from(tokens).join(', ')}`
      );
    }
  });

  it('T1-F13-03: Bengali numerals are normalized to digits matching English counts', () => {
    const bnCountHeadline = 'মিরপুরে সড়ক দুর্ঘটনায় ২ জন নিহত ও ৪ জন আহত';
    const enCountHeadline = '2 killed and 4 injured in road crash in Mirpur';

    const bnTokens = extractSignificantTokens(bnCountHeadline);
    const enTokens = extractSignificantTokens(enCountHeadline);

    assert.ok(bnTokens.has('2'), 'Bengali numeral ২ must normalize to digit 2');
    assert.ok(bnTokens.has('4'), 'Bengali numeral ৪ must normalize to digit 4');
    assert.ok(enTokens.has('2'), 'English headline must extract digit 2');
    assert.ok(enTokens.has('4'), 'English headline must extract digit 4');
  });

  it('T1-F13-04: Cross-language matching identifies identical road crash reported by Bengali and English outlets', () => {
    const bengaliTitle = 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩';
    const englishTitle = '3 killed as bus, truck collide head-on in Sitakunda';

    const sim = calculateStorySimilarity(bengaliTitle, englishTitle);

    assert.strictEqual(
      sim.isDuplicate,
      true,
      'Cross-lingual headlines for identical incident must be identified as duplicate'
    );
    assert.ok(sim.score >= 0.25, `Similarity score should be >= 0.25, got ${sim.score}`);

    // Must share cross-lingual concepts
    const shared = new Set(sim.sharedTokens);
    assert.ok(shared.has('bus'), 'Must share canonical concept: bus');
    assert.ok(shared.has('truck'), 'Must share canonical concept: truck');
    assert.ok(shared.has('killed'), 'Must share canonical concept: killed');
  });

  it('T1-F13-05: Disjoint vehicle entities trigger vehicle conflict penalty preventing false merges', () => {
    // Bus vs Truck crash on Sitakunda highway
    const busTruckCrash = 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষ';
    // Motorcycle vs Pickup crash on the same Sitakunda highway
    const bikePickupCrash = 'সীতাকুণ্ডে মোটরসাইকেল ও পিকআপের সংঘর্ষ';

    const vehicles1 = extractVehicles(busTruckCrash);
    const vehicles2 = extractVehicles(bikePickupCrash);

    assert.ok(vehicles1.has('BUS') && vehicles1.has('TRUCK'));
    assert.ok(vehicles2.has('MOTORCYCLE') && vehicles2.has('PICKUP'));

    const sim = calculateStorySimilarity(busTruckCrash, bikePickupCrash);

    // Vehicle conflict must prevent false merge even though location (Sitakunda) and action (collision) match
    assert.strictEqual(
      sim.isDuplicate,
      false,
      'Disjoint vehicle accident on same highway must NOT be flagged as duplicate'
    );
  });
});
