import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
} from '@repo/shared';
import {
  DISTRICT_CENTERS,
  ALL_8_DIVISIONS,
} from '../harness/testDataGenerators';
import { haversineDistance } from '../harness/geoUtils';
import { resolveLocationFromText, LOCAL_LANDMARK_MAP } from '../../../apps/api/src/services/geocodingService';

interface UpazilaRecord {
  id: string;
  nameEn: string;
  nameBn: string;
  districtEn: string;
  districtBn: string;
  divisionEn: string;
  divisionBn: string;
  latitude: number;
  longitude: number;
  aliasesEn?: string[];
  aliasesBn?: string[];
}

function loadUpazilas(): UpazilaRecord[] {
  const jsonPath = path.resolve(__dirname, '../../../apps/api/src/data/bangladesh_upazilas.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw);
}

describe('Tier 1: Feature Coverage - F01: Upazila Dataset Coordinate Regeneration', () => {
  const upazilas = loadUpazilas();
  const SAVAR_COORDS = { lat: 23.8583, lng: 90.2667 };
  const DHAKA_CENTER = { lat: 23.8103, lng: 90.4125 };

  it('T1-F01-01: Cox\'s Bazar upazilas have authentic coordinates and no Savar/Dhaka fallbacks', () => {
    const coxUpazilas = upazilas.filter(
      (u) => u.districtEn.toLowerCase() === "cox's bazar" || u.districtBn.includes('কক্সবাজার')
    );

    assert.ok(
      coxUpazilas.length >= 8,
      `Expected at least 8 upazilas in Cox's Bazar district, found ${coxUpazilas.length}`
    );

    for (const upazila of coxUpazilas) {
      // Must be within Cox's Bazar latitude/longitude envelope: Lat ~20.6-21.95, Lng ~91.8-92.45
      assert.ok(
        upazila.latitude >= 20.6 && upazila.latitude <= 21.95,
        `Cox's Bazar upazila "${upazila.nameEn}" latitude ${upazila.latitude} out of bounds [20.6, 21.95]`
      );
      assert.ok(
        upazila.longitude >= 91.8 && upazila.longitude <= 92.45,
        `Cox's Bazar upazila "${upazila.nameEn}" longitude ${upazila.longitude} out of bounds [91.8, 92.45]`
      );

      // Distance to Savar must be at least 250 km
      const distToSavar = haversineDistance(
        upazila.latitude,
        upazila.longitude,
        SAVAR_COORDS.lat,
        SAVAR_COORDS.lng
      );
      assert.ok(
        distToSavar > 250000,
        `Cox's Bazar upazila "${upazila.nameEn}" is only ${(distToSavar / 1000).toFixed(1)} km from Savar. Suspected fallback!`
      );

      // Distance to Dhaka centroid must be at least 250 km
      const distToDhaka = haversineDistance(
        upazila.latitude,
        upazila.longitude,
        DHAKA_CENTER.lat,
        DHAKA_CENTER.lng
      );
      assert.ok(
        distToDhaka > 250000,
        `Cox's Bazar upazila "${upazila.nameEn}" is only ${(distToDhaka / 1000).toFixed(1)} km from Dhaka center. Suspected fallback!`
      );
    }
  });

  it('T1-F01-02: All 8 Divisional headquarters have authentic coordinates in their respective jurisdictions', async () => {
    const divisionalHeadquarters = [
      { name: 'Dhaka', division: 'Dhaka', expectedLat: 23.8103, expectedLng: 90.4125 },
      { name: 'Chattogram', division: 'Chattogram', expectedLat: 22.3569, expectedLng: 91.7832 },
      { name: 'Rajshahi', division: 'Rajshahi', expectedLat: 24.3745, expectedLng: 88.6042 },
      { name: 'Khulna', division: 'Khulna', expectedLat: 22.8456, expectedLng: 89.5403 },
      { name: 'Barishal', division: 'Barishal', expectedLat: 22.7010, expectedLng: 90.3535 },
      { name: 'Sylhet', division: 'Sylhet', expectedLat: 24.8949, expectedLng: 91.8687 },
      { name: 'Rangpur', division: 'Rangpur', expectedLat: 25.7439, expectedLng: 89.2752 },
      { name: 'Mymensingh', division: 'Mymensingh', expectedLat: 24.7471, expectedLng: 90.4203 },
    ];

    for (const hq of divisionalHeadquarters) {
      // 1. Verify in LOCAL_LANDMARK_MAP
      const landmarkKey = hq.name.toLowerCase();
      const landmark = LOCAL_LANDMARK_MAP[landmarkKey];
      assert.ok(landmark, `Divisional HQ "${hq.name}" must be registered in LOCAL_LANDMARK_MAP`);

      const distLandmark = haversineDistance(
        landmark.lat,
        landmark.lng,
        hq.expectedLat,
        hq.expectedLng
      );
      assert.ok(
        distLandmark <= 25000,
        `Landmark "${hq.name}" is ${(distLandmark / 1000).toFixed(1)} km from expected center. Expected <= 25 km.`
      );

      // 2. Geocoding resolution test
      const res = await resolveLocationFromText(`${hq.name} শহরে বড় ধরনের সমাবেশ`);
      assert.ok(res !== null, `Expected geocoding resolution for ${hq.name}`);

      const distResolved = haversineDistance(
        res.latitude,
        res.longitude,
        hq.expectedLat,
        hq.expectedLng
      );
      assert.ok(
        distResolved <= 35000,
        `Geocoding for "${hq.name}" resolved to (${res.latitude}, ${res.longitude}), ${(distResolved / 1000).toFixed(1)} km from expected center.`
      );

      // Non-Dhaka HQs must NOT fall back to Savar
      if (hq.division !== 'Dhaka') {
        const distToSavar = haversineDistance(
          res.latitude,
          res.longitude,
          SAVAR_COORDS.lat,
          SAVAR_COORDS.lng
        );
        assert.ok(
          distToSavar > 80000,
          `Divisional HQ "${hq.name}" in ${hq.division} resolved suspiciously close to Savar (${(distToSavar / 1000).toFixed(1)} km)`
        );
      }
    }
  });

  it('T1-F01-03: Dataset contains 495 validated upazilas, all strictly within Bangladesh sovereign bounds', () => {
    assert.strictEqual(
      upazilas.length,
      495,
      `Expected exactly 495 upazilas in bangladesh_upazilas.json, found ${upazilas.length}`
    );

    for (const u of upazilas) {
      assert.ok(u.id && u.id.trim().length > 0, `Upazila missing id: ${JSON.stringify(u)}`);
      assert.ok(u.nameEn && u.nameEn.trim().length > 0, `Upazila missing nameEn: ${u.id}`);
      assert.ok(u.nameBn && u.nameBn.trim().length > 0, `Upazila missing nameBn: ${u.id}`);
      assert.ok(u.districtEn && u.districtEn.trim().length > 0, `Upazila missing districtEn: ${u.id}`);
      assert.ok(u.divisionEn && u.divisionEn.trim().length > 0, `Upazila missing divisionEn: ${u.id}`);

      assert.ok(
        isWithinBangladesh(u.latitude, u.longitude),
        `Upazila "${u.nameEn}" (${u.districtEn}) coordinates (${u.latitude}, ${u.longitude}) out of Bangladesh bounds`
      );
    }
  });

  it('T1-F01-04: Every upazila coordinate is within realistic proximity (<= 90 km) of its parent district centroid', () => {
    for (const u of upazilas) {
      const distCenter = DISTRICT_CENTERS[u.districtEn];
      if (!distCenter) {
        continue;
      }

      const distMeters = haversineDistance(
        u.latitude,
        u.longitude,
        distCenter.latitude,
        distCenter.longitude
      );

      // No upazila center in Bangladesh is more than 90 km from its district centroid
      assert.ok(
        distMeters <= 90000,
        `Upazila "${u.nameEn}" in district "${u.districtEn}" is ${(distMeters / 1000).toFixed(1)} km from district center. Exceeds 90 km limit!`
      );
    }
  });

  it('T1-F01-05: Geocoding Cox\'s Bazar localities resolves authentic coordinates (lat < 22.0), not Savar/Dhaka', async () => {
    const testCases = [
      { text: 'কক্সবাজার সদর এলাকায় দুই পক্ষের সংঘর্ষ', expectedUpazila: 'Cox\'s Bazar Sadar', maxLat: 21.6 },
      { text: 'টেকনাফে বিপুল পরিমাণ মাদক উদ্ধার', expectedUpazila: 'Teknaf', maxLat: 21.2 },
      { text: 'উখিয়ায় রোহিঙ্গা ক্যাম্পে অগ্নিকাণ্ড', expectedUpazila: 'Ukhiya', maxLat: 21.4 },
      { text: 'মহেশখালীতে গভীর রাতে গোলাগুলি', expectedUpazila: 'Maheshkhali', maxLat: 21.7 },
    ];

    for (const tc of testCases) {
      const res = await resolveLocationFromText(tc.text);
      assert.ok(res !== null, `Expected location resolution for "${tc.text}"`);
      assert.ok(
        res.latitude < tc.maxLat && res.latitude > 20.6,
        `Resolved latitude ${res.latitude} for "${tc.text}" must be < ${tc.maxLat} and > 20.6 (Cox's Bazar area)`
      );
      assert.ok(
        res.longitude > 91.8 && res.longitude < 92.5,
        `Resolved longitude ${res.longitude} for "${tc.text}" must be within Cox's Bazar bounds`
      );

      const distToSavar = haversineDistance(res.latitude, res.longitude, SAVAR_COORDS.lat, SAVAR_COORDS.lng);
      assert.ok(
        distToSavar > 250000,
        `Resolution for "${tc.text}" mapped suspiciously close to Savar (${(distToSavar / 1000).toFixed(1)} km)`
      );
    }
  });
});
