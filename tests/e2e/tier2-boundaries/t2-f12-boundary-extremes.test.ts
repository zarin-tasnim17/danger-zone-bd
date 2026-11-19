import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import { isForeignIncident } from '../../../apps/api/src/services/internationalIncidentFilter';

describe('Tier 2: Boundary & Corner Cases - F12: Bangladesh Boundary Validation Extremes', () => {
  it('T2-F12-01: Exact perimeter coordinates on sovereign boundary box pass validation', () => {
    // 4 corners of BANGLADESH_BOUNDS [20.3, 26.8], [87.8, 92.9]
    const corners = [
      { lat: BANGLADESH_BOUNDS.minLat, lng: BANGLADESH_BOUNDS.minLng }, // Southwest
      { lat: BANGLADESH_BOUNDS.minLat, lng: BANGLADESH_BOUNDS.maxLng }, // Southeast
      { lat: BANGLADESH_BOUNDS.maxLat, lng: BANGLADESH_BOUNDS.minLng }, // Northwest
      { lat: BANGLADESH_BOUNDS.maxLat, lng: BANGLADESH_BOUNDS.maxLng }, // Northeast
    ];

    for (const c of corners) {
      assert.strictEqual(
        isWithinBangladesh(c.lat, c.lng),
        true,
        `Corner [${c.lat}, ${c.lng}] must pass boundary validation`
      );
    }
  });

  it('T2-F12-02: Coordinates 0.0001 degree outside sovereign envelope strictly fail boundary validation', () => {
    const outsidePoints = [
      { lat: BANGLADESH_BOUNDS.minLat - 0.0001, lng: 90.0, desc: 'South of minLat' },
      { lat: BANGLADESH_BOUNDS.maxLat + 0.0001, lng: 90.0, desc: 'North of maxLat' },
      { lat: 23.5, lng: BANGLADESH_BOUNDS.minLng - 0.0001, desc: 'West of minLng' },
      { lat: 23.5, lng: BANGLADESH_BOUNDS.maxLng + 0.0001, desc: 'East of maxLng' },
    ];

    for (const pt of outsidePoints) {
      assert.strictEqual(
        isWithinBangladesh(pt.lat, pt.lng),
        false,
        `${pt.desc} [${pt.lat}, ${pt.lng}] must be rejected`
      );
    }
  });

  it('T2-F12-03: Swapped latitude and longitude coordinates are cleanly detected and rejected', () => {
    // Dhaka is [lat: 23.8103, lng: 90.4125]. Swapped is [90.4125, 23.8103]
    const swappedLat = 90.4125;
    const swappedLng = 23.8103;

    assert.strictEqual(
      isWithinBangladesh(swappedLat, swappedLng),
      false,
      'Swapped [90.4125, 23.8103] must fail Bangladesh validation'
    );
  });

  it('T2-F12-04: Transboundary enclave and neighbouring border stories are filtered by international filter', () => {
    // Stories mentioning Indian border towns or enclaves outside BD sovereign territory
    const foreignReports = [
      { title: 'কলকাতায় বাস দুর্ঘটনায় ৩ জনের মৃত্যু', body: 'ভারতের পশ্চিমবঙ্গে এই ঘটনা ঘটে।' },
      { title: 'ত্রিপুরায় মাদকসহ এক পাচারকারী আটক', body: 'বিএসএফের অভিযানে আটক।' },
      { title: 'আসামে ট্রেন লাইনচ্যুত হয়ে হতাহত বহু', body: 'গুয়াহাটির কাছে এই দুর্ঘটনা ঘটে।' },
    ];

    for (const r of foreignReports) {
      const foreignCheck = isForeignIncident(r.title, r.body);
      assert.strictEqual(
        foreignCheck.isForeign,
        true,
        `Cross-border foreign story "${r.title}" must be identified as foreign`
      );
    }
  });

  it('T2-F12-05: Non-numeric and extreme float values (NaN, Infinity, -Infinity, null) fail validation gracefully', () => {
    const maliciousValues = [
      [NaN, 90.0],
      [23.5, NaN],
      [Infinity, 90.0],
      [23.5, Infinity],
      [-Infinity, 90.0],
      [null as any, 90.0],
      [23.5, undefined as any],
    ];

    for (const [lat, lng] of maliciousValues) {
      assert.strictEqual(
        isWithinBangladesh(lat, lng),
        false,
        `Input [${lat}, ${lng}] must fail validation without error`
      );
    }
  });
});
