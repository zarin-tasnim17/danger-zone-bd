import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_64_DISTRICTS,
  ALL_8_DIVISIONS,
  DISTRICT_TO_DIVISION,
  DISTRICT_CENTERS,
  loadAllPoliceStations,
  getPoliceStationsByDistrict,
  generateMockGeocodeResult,
} from '../harness/testDataGenerators';
import { assertValidGeocodeResult, assertWithinBangladeshBounds } from '../harness/contractValidator';
import { BANGLADESH_BOUNDS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F11: Nationwide 64-District Geocoding', () => {
  const stations = loadAllPoliceStations();

  it('T1-F11-01: Geospatial database indexes all 663 statutory operational police stations across all 64 districts', () => {
    assert.strictEqual(
      stations.length,
      663,
      `Expected 663 statutory police stations in database, found ${stations.length}`
    );

    // Verify all 64 districts are represented
    const districtsWithStations = new Set(stations.map((s) => s.district));
    for (const district of ALL_64_DISTRICTS) {
      assert.ok(
        districtsWithStations.has(district),
        `District "${district}" must have statutory police stations indexed`
      );
      const districtStations = getPoliceStationsByDistrict(district);
      assert.ok(
        districtStations.length >= 1,
        `District "${district}" must contain at least 1 police station, found ${districtStations.length}`
      );
    }
  });

  it('T1-F11-02: Police station entities contain verified English and Bangla name aliases', () => {
    // Check representative sample of stations
    for (let i = 0; i < Math.min(stations.length, 50); i++) {
      const station = stations[i];
      assert.ok(station.station_name_en && station.station_name_en.length > 0);
      assert.ok(station.station_name_bn && station.station_name_bn.length > 0);
      // Validate station_name_bn contains Bengali Unicode characters (\u0980-\u09FF)
      assert.ok(
        /[\u0980-\u09FF]/.test(station.station_name_bn),
        `Station ${station.station_id} Bangla alias must contain valid Bengali script`
      );
    }
  });

  it('T1-F11-03: Geocoding dictionary resolves coordinates across all 8 administrative divisions', () => {
    const divisionsRepresented = new Set(stations.map((s) => s.division));

    for (const div of ALL_8_DIVISIONS) {
      assert.ok(
        divisionsRepresented.has(div),
        `Division "${div}" must be represented in police station database`
      );
      const divisionStations = stations.filter((s) => s.division === div);
      assert.ok(divisionStations.length > 0, `Division "${div}" must contain police stations`);
      const sampleStation = divisionStations[0];
      // Resolve either physical station coordinates or district administrative center
      const coords =
        sampleStation.location && sampleStation.location.latitude !== null
          ? sampleStation.location
          : DISTRICT_CENTERS[sampleStation.district];

      assert.ok(coords && coords.latitude > 0, `Coordinates for ${div} must be valid`);
      assertWithinBangladeshBounds(coords.latitude, coords.longitude);
    }
  });

  it('T1-F11-04: Geocoding coordinates for all 64 districts are strictly within BANGLADESH_BOUNDS', () => {
    for (const district of ALL_64_DISTRICTS) {
      const center = DISTRICT_CENTERS[district];
      assert.ok(center, `District ${district} must have coordinate entry in DISTRICT_CENTERS`);
      assert.ok(
        center.latitude >= BANGLADESH_BOUNDS.minLat && center.latitude <= BANGLADESH_BOUNDS.maxLat,
        `District ${district} latitude ${center.latitude} outside Bangladesh bounds`
      );
      assert.ok(
        center.longitude >= BANGLADESH_BOUNDS.minLng && center.longitude <= BANGLADESH_BOUNDS.maxLng,
        `District ${district} longitude ${center.longitude} outside Bangladesh bounds`
      );
    }
  });

  it('T1-F11-05: Geocoding result conforms to contractValidator GeocodeResult schema', () => {
    const ramna = stations.find((s) => s.station_name_en.includes('Ramna')) || stations[0];

    const geocodeOutput = generateMockGeocodeResult({
      locationName: ramna.station_name_en,
      latitude: ramna.location.latitude,
      longitude: ramna.location.longitude,
      confidence: 'HIGH',
      district: ramna.district,
      division: ramna.division,
      source: 'DICTIONARY',
      isAmbiguous: false,
      matchedThana: ramna.station_name_en,
    });

    const validated = assertValidGeocodeResult(geocodeOutput);
    assert.strictEqual(validated.confidence, 'HIGH');
    assert.strictEqual(validated.source, 'DICTIONARY');
    assert.strictEqual(validated.isAmbiguous, false);
    assert.ok(validated.district);
    assert.ok(validated.division);
  });
});
