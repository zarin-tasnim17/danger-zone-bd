import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import { assertWithinBangladeshBounds } from '../harness/contractValidator';
import { isForeignIncident } from '../../../apps/api/src/services/internationalIncidentFilter';

describe('Tier 1: Feature Coverage - F12: Bangladesh Boundary Validation Alignment', () => {
  it('T1-F12-01: Southernmost frontier coordinates (Saint Martin, Teknaf) pass BANGLADESH_BOUNDS validation', () => {
    // Saint Martin's Island
    const saintMartinLat = 20.6272;
    const saintMartinLng = 92.3225;
    assert.strictEqual(
      isWithinBangladesh(saintMartinLat, saintMartinLng),
      true,
      'Saint Martin island must be within BANGLADESH_BOUNDS'
    );
    assertWithinBangladeshBounds(saintMartinLat, saintMartinLng);

    // Teknaf Thana
    const teknafLat = 20.8652;
    const teknafLng = 92.2985;
    assert.strictEqual(
      isWithinBangladesh(teknafLat, teknafLng),
      true,
      'Teknaf must be within BANGLADESH_BOUNDS'
    );
    assertWithinBangladeshBounds(teknafLat, teknafLng);
  });

  it('T1-F12-02: Northernmost frontier coordinates (Tetulia, Panchagarh) pass BANGLADESH_BOUNDS validation', () => {
    // Tetulia Thana
    const tetuliaLat = 26.6500;
    const tetuliaLng = 88.3500;
    assert.strictEqual(
      isWithinBangladesh(tetuliaLat, tetuliaLng),
      true,
      'Tetulia must be within BANGLADESH_BOUNDS'
    );
    assertWithinBangladeshBounds(tetuliaLat, tetuliaLng);

    // Banglabandha Zero Point
    const banglabandhaLat = 26.7000;
    const banglabandhaLng = 88.4000;
    assert.strictEqual(
      isWithinBangladesh(banglabandhaLat, banglabandhaLng),
      true,
      'Banglabandha must be within BANGLADESH_BOUNDS'
    );
  });

  it('T1-F12-03: Easternmost and westernmost frontier coordinates pass BANGLADESH_BOUNDS validation', () => {
    // Eastern frontier: Thanchi / Bandarban border
    const eastLat = 21.7500;
    const eastLng = 92.6500;
    assert.strictEqual(isWithinBangladesh(eastLat, eastLng), true);
    assertWithinBangladeshBounds(eastLat, eastLng);

    // Western frontier: Shibganj / Chapainawabganj
    const westLat = 24.6800;
    const westLng = 88.1500;
    assert.strictEqual(isWithinBangladesh(westLat, westLng), true);
    assertWithinBangladeshBounds(westLat, westLng);
  });

  it('T1-F12-04: Transboundary coordinates outside sovereign envelope fail validation with explicit contract assertion', () => {
    const foreignPoints: Array<{ name: string; lat: number; lng: number }> = [
      { name: 'Kolkata, India', lat: 22.5726, lng: 86.3639 },
      { name: 'Guwahati, India', lat: 26.1445, lng: 93.7744 },
      { name: 'Deep Bay of Bengal', lat: 19.5000, lng: 90.0000 },
      { name: 'Himalayan foothills', lat: 27.2000, lng: 88.5000 },
      { name: 'Equator', lat: 0.0, lng: 0.0 },
    ];

    for (const pt of foreignPoints) {
      assert.strictEqual(
        isWithinBangladesh(pt.lat, pt.lng),
        false,
        `Point "${pt.name}" [${pt.lat}, ${pt.lng}] must be rejected as outside Bangladesh`
      );
      assert.throws(
        () => assertWithinBangladeshBounds(pt.lat, pt.lng),
        /violate BANGLADESH_BOUNDS/
      );
    }
  });

  it('T1-F12-05: International incident filter strictly rejects news from overseas jurisdictions', () => {
    const foreignHeadlines = [
      'নিউইয়র্কে বন্দুকধারীর গুলিতে বাংলাদেশি যুবক নিহত',
      'কলকাতায় বাস ও ট্যাক্সির সংঘর্ষে আহত ১২',
      'সৌদি আরবে সড়ক দুর্ঘটনায় ৩ প্রবাসী বাংলাদেশির মৃত্যু',
      'লন্ডনে ছুরিকাঘাতে বাংলাদেশি বংশোদ্ভূত কিশোর আহত',
      'দিল্লিতে বিষাক্ত গ্যাসে বহু মানুষের প্রাণহানি',
    ];

    for (const headline of foreignHeadlines) {
      const res = isForeignIncident(headline);
      assert.strictEqual(
        res.isForeign,
        true,
        `Foreign incident must be identified and rejected: "${headline}"`
      );
    }
  });
});
