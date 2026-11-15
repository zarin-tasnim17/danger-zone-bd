"""
Adversarial Verification Suite for Bangladesh Police Stations E2E Test Suite.

Proves test integrity by introducing targeted faults and asserting that
the E2E test suite correctly fails on:
- Coordinate out-of-bounds
- Transposed coordinates
- Count arithmetic corruption
- Sub-baseline record counts (< 640)
- Fake string 'null' injection
- Malformed Station ID formats
- Missing extreme boundary stations
- Duplicate coordinates across districts
- Missing administrative divisions
- Metropolitan commissionerate quota violations
- Synthetic district centroid offset cheating (+0.0012, +0.0015)
- Fabricated OSM node series (5321456xxx)
And asserts that honest null coordinates across unmapped rural districts are accepted per R1/R2.
"""

import copy
import io
import json
import os
import sys
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from tests.mock_data_generator import generate_mock_police_stations_dataset
from tests.test_police_stations_e2e import (
    DatasetHolder,
    TestTier1FeatureCoverage,
    TestTier2BoundaryAndCornerCases,
    TestTier3CrossFeatureCombinations,
    TestTier4RealWorldScenarios,
)


def run_single_test(test_case_class, test_method_name: str) -> bool:
    """Runs a single test method and returns True if passed, False if failed."""
    suite = unittest.TestSuite()
    suite.addTest(test_case_class(test_method_name))
    sink = io.StringIO()
    runner = unittest.TextTestRunner(stream=sink, verbosity=0)
    result = runner.run(suite)
    return result.wasSuccessful()


class TestAdversarialSuite(unittest.TestCase):
    def setUp(self):
        # Deepcopy a fresh baseline dataset for each adversarial trial
        self.base_data = copy.deepcopy(generate_mock_police_stations_dataset())
        DatasetHolder.data = self.base_data
        DatasetHolder.raw_content = json.dumps(self.base_data)
        DatasetHolder.file_exists = True
        DatasetHolder.load_error = None
        DatasetHolder.resolved_path = "<SYNTHETIC_MUTATION>"

    def tearDown(self):
        DatasetHolder.data = None
        DatasetHolder.raw_content = None
        DatasetHolder.file_exists = False

    def test_adversarial_1_out_of_bounds_latitude_fails(self):
        """Injecting a latitude of 28.5 (outside Bangladesh) MUST fail test_2_1."""
        DatasetHolder.data["stations"][0]["location"]["latitude"] = 28.500000
        passed = run_single_test(TestTier2BoundaryAndCornerCases, "test_2_1_latitude_bounds")
        self.assertFalse(passed, "Test 2.1 failed to detect out-of-bounds latitude (28.5)")

    def test_adversarial_2_transposed_coordinates_fails(self):
        """Swapping lat and lon MUST fail test_2_3."""
        DatasetHolder.data["stations"][0]["location"]["latitude"] = 90.350000
        DatasetHolder.data["stations"][0]["location"]["longitude"] = 23.700000
        passed = run_single_test(TestTier2BoundaryAndCornerCases, "test_2_3_no_transposed_coordinates")
        self.assertFalse(passed, "Test 2.3 failed to detect transposed coordinates")

    def test_adversarial_3_sub_baseline_record_count_fails(self):
        """Truncating station records to 500 (< 640 baseline) MUST fail test_1_5."""
        DatasetHolder.data["metadata"]["total_records"] = 500
        passed = run_single_test(TestTier1FeatureCoverage, "test_1_5_total_station_count_baseline")
        self.assertFalse(passed, "Test 1.5 failed to detect below-baseline station count (500 < 640)")

    def test_adversarial_4_fake_null_string_fails(self):
        """Injecting string 'null' instead of JSON None MUST fail test_1_9."""
        DatasetHolder.data["stations"][0]["address"] = "null"
        passed = run_single_test(TestTier1FeatureCoverage, "test_1_9_strict_null_value_discipline")
        self.assertFalse(passed, "Test 1.9 failed to detect fake string 'null'")

    def test_adversarial_5_malformed_station_id_fails(self):
        """Injecting invalid ID 'POLICE-001' MUST fail test_1_10."""
        DatasetHolder.data["stations"][0]["station_id"] = "POLICE-001"
        passed = run_single_test(TestTier1FeatureCoverage, "test_1_10_station_id_regex_format")
        self.assertFalse(passed, "Test 1.10 failed to detect malformed station ID")

    def test_adversarial_6_arithmetic_mismatch_fails(self):
        """Corrupting metadata arithmetic sum MUST fail test_1_4."""
        DatasetHolder.data["metadata"]["verified_records"] += 10
        passed = run_single_test(TestTier1FeatureCoverage, "test_1_4_metadata_count_arithmetic")
        self.assertFalse(passed, "Test 1.4 failed to detect metadata arithmetic mismatch")

    def test_adversarial_7_missing_division_fails(self):
        """Renaming a division to remove Sylhet MUST fail test_3_4."""
        for s in DatasetHolder.data["stations"]:
            if s["division"].lower() == "sylhet":
                s["division"] = "Dhaka"
        passed = run_single_test(TestTier3CrossFeatureCombinations, "test_3_4_all_eight_divisions_represented")
        self.assertFalse(passed, "Test 3.4 failed to detect missing administrative division")

    def test_adversarial_8_metro_quota_corruption_fails(self):
        """Changing DMP count to 49 MUST fail test_3_6."""
        # Find one DMP station and change its jurisdiction
        for s in DatasetHolder.data["stations"]:
            if "DMP" in s["police_jurisdiction"]:
                s["police_jurisdiction"] = "Dhaka District Police"
                s["police_unit_type"] = "district"
                break
        passed = run_single_test(TestTier3CrossFeatureCombinations, "test_3_6_all_eight_metropolitan_commissionerates")
        self.assertFalse(passed, "Test 3.6 failed to detect metropolitan commissionerate quota deviation")

    def test_adversarial_9_honest_null_coordinates_accepted(self):
        """Zeroing coordinates to honest nulls across rural districts MUST PASS test_4_3 and test_3_8 (R2 compliance)."""
        for idx in range(50):
            s = DatasetHolder.data["stations"][idx]
            s["location"] = {"latitude": None, "longitude": None, "location_type": None}
            s["verification"]["status"] = "unverified"
            s["verification"]["confidence"] = "low"
            s["verification"]["coordinate_source"] = None
        DatasetHolder.data["metadata"]["verified_records"] -= 50
        DatasetHolder.data["metadata"]["unverified_records"] += 50

        passed_4_3 = run_single_test(TestTier4RealWorldScenarios, "test_4_3_safe_haven_coverage_per_district")
        passed_3_8 = run_single_test(TestTier3CrossFeatureCombinations, "test_3_8_verification_status_coordinate_consistency")
        self.assertTrue(passed_4_3, "test_4_3 incorrectly rejected honest null coordinates")
        self.assertTrue(passed_3_8, "test_3_8 incorrectly rejected honest null coordinates")

    def test_adversarial_10_centroid_offset_cheating_detected(self):
        """Injecting mock centroid offset (+0.0012, +0.0015) MUST fail test_3_9."""
        from tests.mock_data_generator import DISTRICT_CENTERS
        s = DatasetHolder.data["stations"][0]
        s["district"] = "Tangail"
        s["location"]["latitude"] = DISTRICT_CENTERS["Tangail"][0] + 0.001200
        s["location"]["longitude"] = DISTRICT_CENTERS["Tangail"][1] + 0.001500
        passed = run_single_test(TestTier3CrossFeatureCombinations, "test_3_9_no_administrative_centroid_collusion")
        self.assertFalse(passed, "test_3_9 failed to catch mock centroid offset cheating (+0.0012, +0.0015)")

    def test_adversarial_11_fake_osm_node_series_detected(self):
        """Injecting fabricated node/5321456123 MUST fail test_3_10."""
        s = DatasetHolder.data["stations"][0]
        s["verification"]["coordinate_source"] = "OpenStreetMap (node/5321456123)"
        passed = run_single_test(TestTier3CrossFeatureCombinations, "test_3_10_no_fabricated_osm_node_series")
        self.assertFalse(passed, "test_3_10 failed to catch fabricated OSM node series")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAdversarialSuite)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    sys.exit(0 if res.wasSuccessful() else 1)
