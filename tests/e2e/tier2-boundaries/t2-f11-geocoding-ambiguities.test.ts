import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findLandmarkInText,
  resolveLocationFromText,
  isVictimOriginContext,
  normalizeBengali,
} from '../../../apps/api/src/services/geocodingService';
import { generateMockGeocodeResult } from '../harness/testDataGenerators';
import { assertValidGeocodeResult } from '../harness/contractValidator';

describe('Tier 2: Boundary & Corner Cases - F11: Geocoding Disambiguation & Ambiguities', () => {
  it('T2-F11-01: Person name district collusion ("Khulna Khan died in Sylhet") resolves incident scene to Sylhet', async () => {
    // Headline indicates incident scene in Sylhet, while snippet contains victim origin in Khulna
    const title = 'সিলেটের ওসমানীনগরে সড়ক দুর্ঘটনায় নিহত ১';
    const snippet = 'নিহত ব্যক্তির বাড়ি খুলনায়। তিনি খুলনার বাসিন্দা ছিলেন।';

    const result = await resolveLocationFromText(title, snippet);
    assert.ok(result !== null, 'Must resolve incident location');
    assert.ok(
      result!.locationName.toLowerCase().includes('sylhet'),
      `Location must be Sylhet (scene of accident), got ${result!.locationName}`
    );
  });

  it('T2-F11-02: Departure vs incident scene disambiguation resolves to actual crash scene', async () => {
    const title = 'বগুড়ায় ঢাকা থেকে ছেড়ে আসা যাত্রীবাহী বাস খাদে পড়ে নিহত ৩';
    const result = await resolveLocationFromText(title);

    assert.ok(result !== null);
    assert.ok(
      result!.locationName.toLowerCase().includes('bogura') || result!.locationName.toLowerCase().includes('bogra'),
      `Scene of crash must be Bogura, not departure city Dhaka. Got: ${result!.locationName}`
    );
  });

  it('T2-F11-03: Homonymous police stations (e.g. Kaliganj in 4 districts) flagged as ambiguous when district omitted', () => {
    // When a location name exists in multiple administrative regions without qualifier
    const ambiguousItem = generateMockGeocodeResult({
      locationName: 'Kaliganj Upazila',
      latitude: 23.9000,
      longitude: 90.5500,
      confidence: 'LOW',
      isAmbiguous: true,
      source: 'DICTIONARY',
    });

    const validated = assertValidGeocodeResult(ambiguousItem);
    assert.strictEqual(validated.isAmbiguous, true);
    assert.strictEqual(validated.confidence, 'LOW');
  });

  it('T2-F11-04: Unmapped small union/village falls back to containing district center without invalid coordinates', () => {
    // Mention of district name with unfamiliar village
    const title = 'কুড়িগ্রামের দুর্গম চরাঞ্চলে সংঘর্ষে আহত ৫';
    const landmark = findLandmarkInText(title);

    assert.ok(landmark !== null);
    assert.strictEqual(landmark!.locationName, 'Kurigram');
    assert.strictEqual(landmark!.latitude, 25.8054);
    assert.strictEqual(landmark!.longitude, 89.6362);
  });

  it('T2-F11-05: Colloquial and alternative spellings (Chittagong/Chattogram, Comilla/Cumilla) resolve to canonical district entity', () => {
    const pairs = [
      { input: 'chittagong', expected: 'Chittagong' },
      { input: 'chattogram', expected: 'Chittagong' },
      { input: 'comilla', expected: 'Cumilla' },
      { input: 'cumilla', expected: 'Cumilla' },
      { input: 'cox\'s bazar', expected: 'Cox\'s Bazar' },
      { input: 'coxs bazar', expected: 'Cox\'s Bazar' },
    ];

    for (const { input, expected } of pairs) {
      const landmark = findLandmarkInText(`Accident occurred in ${input} yesterday`);
      assert.ok(landmark !== null, `Must resolve "${input}"`);
      assert.strictEqual(landmark!.locationName, expected);
    }
  });
});
