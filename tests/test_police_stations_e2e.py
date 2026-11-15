"""
Comprehensive E2E Opaque-Box Test Suite for Bangladesh Police Stations Geospatial Database.

Deliverable: bangladesh_police_stations.json
Architecture: 4-Tier Verification Suite (34 Test Cases)
- Tier 1: Feature Coverage (Schema & Mandatory Requirements) - 10 Test Cases
- Tier 2: Boundary & Corner Cases - 9 Test Cases
- Tier 3: Cross-Feature Combinations & Integrity - 10 Test Cases
- Tier 4: Real-World Scenarios (DangerZoneBD Integration) - 5 Test Cases

Execution:
    python tests/test_police_stations_e2e.py
    python -m unittest tests/test_police_stations_e2e.py
    python tests/test_police_stations_e2e.py --mock-test (Runs self-validation against synthetic dataset)

Zero external dependencies: Uses Python 3.15 standard library only (unittest, json, re, math, datetime).
"""

from datetime import datetime
import json
import math
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple
import unittest

# ---------------------------------------------------------------------------
# Path & Configuration Setup
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
DEFAULT_DELIVERABLE_PATH = os.path.join(PROJECT_ROOT, "bangladesh_police_stations.json")
DELIVERABLE_PATH = os.environ.get("BANGLADESH_POLICE_STATIONS_JSON_PATH", DEFAULT_DELIVERABLE_PATH)
USE_MOCK_DATA = os.environ.get("TEST_POLICE_STATIONS_MOCK", "0").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Canonical References & Taxonomy Constants
# ---------------------------------------------------------------------------
CANONICAL_DIVISIONS = {
    "dhaka", "chattogram", "rajshahi", "khulna", "barishal", "sylhet", "rangpur", "mymensingh"
}

DIVISION_ALIASES = {
    "chittagong": "chattogram",
    "barisal": "barishal",
}

CANONICAL_64_DISTRICTS = {
    # Dhaka Division (13)
    "dhaka", "gazipur", "narayanganj", "narsingdi", "tangail",
    "kishoreganj", "manikganj", "munshiganj", "faridpur", "gopalganj",
    "madaripur", "rajbari", "shariatpur",
    # Chattogram Division (11)
    "chattogram", "cox's bazar", "cumilla", "feni", "brahmanbaria",
    "noakhali", "lakshmipur", "chandpur", "rangamati", "khagrachhari", "bandarban",
    # Rajshahi Division (8)
    "rajshahi", "bogura", "pabna", "sirajganj", "naogaon",
    "natore", "chapainawabganj", "joypurhat",
    # Khulna Division (10)
    "khulna", "jashore", "satkhira", "bagerhat", "kushtia",
    "jhenaidah", "chuadanga", "magura", "meherpur", "narail",
    # Barishal Division (6)
    "barishal", "patuakhali", "bhola", "pirojpur", "barguna", "jhalakathi",
    # Sylhet Division (4)
    "sylhet", "moulvibazar", "habiganj", "sunamganj",
    # Rangpur Division (8)
    "rangpur", "dinajpur", "kurigram", "gaibandha", "nilphamari",
    "panchagarh", "thakurgaon", "lalmonirhat",
    # Mymensingh Division (4)
    "mymensingh", "jamalpur", "netrokona", "sherpur"
}

DISTRICT_ALIASES = {
    "chittagong": "chattogram",
    "comilla": "cumilla",
    "bogra": "bogura",
    "jessore": "jashore",
    "barisal": "barishal",
    "coxsbazar": "cox's bazar",
    "coxs bazar": "cox's bazar",
    "nawabganj": "chapainawabganj",
    "chapainababganj": "chapainawabganj",
    "jhalokati": "jhalakathi",
    "moulavibazar": "moulvibazar",
    "maulvibazar": "moulvibazar",
    "netrakona": "netrokona"
}

METROPOLITAN_COMMISSIONERATE_TARGETS = {
    "DMP": 50,
    "CMP": 16,
    "RMP": 12,
    "KMP": 8,
    "BMP": 4,
    "SMP": 6,
    "RPMP": 6,
    "GMP": 8,
}

# ---------------------------------------------------------------------------
# Geospatial Utility Functions
# ---------------------------------------------------------------------------
def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0088  # WGS84 mean Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def normalize_division(name: str) -> str:
    cleaned = name.strip().lower()
    return DIVISION_ALIASES.get(cleaned, cleaned)


def normalize_district(name: str) -> str:
    cleaned = name.strip().lower()
    return DISTRICT_ALIASES.get(cleaned, cleaned)


def identify_commissionerate(jurisdiction: str) -> Optional[str]:
    """Identifies metropolitan commissionerate code from police_jurisdiction string."""
    norm = jurisdiction.upper()
    for code in METROPOLITAN_COMMISSIONERATE_TARGETS:
        if code in norm:
            return code
    if "DHAKA METROPOLITAN" in norm:
        return "DMP"
    if "CHATTOGRAM METROPOLITAN" in norm or "CHITTAGONG METROPOLITAN" in norm:
        return "CMP"
    if "RAJSHAHI METROPOLITAN" in norm:
        return "RMP"
    if "KHULNA METROPOLITAN" in norm:
        return "KMP"
    if "BARISHAL METROPOLITAN" in norm or "BARISAL METROPOLITAN" in norm:
        return "BMP"
    if "SYLHET METROPOLITAN" in norm:
        return "SMP"
    if "RANGPUR METROPOLITAN" in norm:
        return "RPMP"
    if "GAZIPUR METROPOLITAN" in norm:
        return "GMP"
    return None


# ---------------------------------------------------------------------------
# Global Data Cache & Base Test Class
# ---------------------------------------------------------------------------
class DatasetHolder:
    raw_content: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    load_error: Optional[str] = None
    file_exists: bool = False
    resolved_path: str = DELIVERABLE_PATH

    @classmethod
    def load(cls, force_mock: bool = False) -> None:
        if not force_mock and (cls.data is not None or cls.load_error is not None):
            return

        use_mock = force_mock or os.environ.get("TEST_POLICE_STATIONS_MOCK", "0").lower() in ("1", "true", "yes")

        if use_mock:
            try:
                from tests.mock_data_generator import generate_mock_police_stations_dataset
                cls.data = generate_mock_police_stations_dataset()
                cls.raw_content = json.dumps(cls.data)
                cls.file_exists = True
                cls.load_error = None
                cls.resolved_path = "<SYNTHETIC_MOCK_DATASET>"
                return
            except Exception as e:
                cls.load_error = f"Failed to load synthetic mock dataset: {e}"
                return

        cls.file_exists = os.path.isfile(cls.resolved_path)
        if not cls.file_exists:
            cls.load_error = f"Primary deliverable file does not exist at '{cls.resolved_path}'"
            return

        try:
            with open(cls.resolved_path, "r", encoding="utf-8") as f:
                cls.raw_content = f.read()
            cls.data = json.loads(cls.raw_content)
        except Exception as e:
            cls.load_error = f"Failed to read/parse JSON at '{cls.resolved_path}': {e}"


class BasePoliceStationE2ETest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        DatasetHolder.load()

    def get_data(self) -> Dict[str, Any]:
        if not DatasetHolder.file_exists:
            self.fail(f"Deliverable file missing: {DatasetHolder.load_error}")
        if DatasetHolder.data is None:
            self.fail(f"Dataset parsing failure: {DatasetHolder.load_error}")
        return DatasetHolder.data

    def get_stations(self) -> List[Dict[str, Any]]:
        data = self.get_data()
        self.assertIn("stations", data, "Missing top-level 'stations' array in deliverable")
        self.assertIsInstance(data["stations"], list, "'stations' must be a JSON array")
        return data["stations"]

    def get_metadata(self) -> Dict[str, Any]:
        data = self.get_data()
        self.assertIn("metadata", data, "Missing top-level 'metadata' object in deliverable")
        self.assertIsInstance(data["metadata"], dict, "'metadata' must be a JSON object")
        return data["metadata"]


# ===========================================================================
# Tier 1: Feature Coverage (Schema & Mandatory Requirements)
# ===========================================================================
class TestTier1FeatureCoverage(BasePoliceStationE2ETest):
    """Tier 1: Feature Coverage & Strict Schema Enforcement (10 Test Cases)."""

    def test_1_1_file_existence_and_valid_json(self):
        """Test 1.1: Verify file existence and valid UTF-8 JSON syntax."""
        self.assertTrue(
            DatasetHolder.file_exists,
            f"Deliverable file '{DatasetHolder.resolved_path}' does not exist on disk."
        )
        self.assertIsNotNone(DatasetHolder.raw_content, "Deliverable file content is empty.")
        self.assertGreater(
            len(DatasetHolder.raw_content.strip()), 0,
            "Deliverable file has 0 bytes."
        )
        self.assertIsNone(DatasetHolder.load_error, f"JSON load error: {DatasetHolder.load_error}")
        self.assertIsNotNone(DatasetHolder.data, "Parsed JSON data is None.")

    def test_1_2_root_keys_metadata_and_stations(self):
        """Test 1.2: Root structure has exact keys 'metadata' and 'stations' (no rogue keys)."""
        data = self.get_data()
        root_keys = set(data.keys())
        expected_keys = {"metadata", "stations"}
        self.assertEqual(
            root_keys, expected_keys,
            f"Root object must contain exactly keys {expected_keys}, found {root_keys}"
        )

    def test_1_3_metadata_required_fields_and_types(self):
        """Test 1.3: Metadata contains all 11 required fields with correct data types."""
        metadata = self.get_metadata()
        required_fields = {
            "dataset_name": str,
            "country": str,
            "country_code": str,
            "coordinate_reference_system": str,
            "coordinate_format": str,
            "total_records": int,
            "verified_records": int,
            "partially_verified_records": int,
            "unverified_records": int,
            "research_date": str,
            "research_methodology": str,
        }

        for field, expected_type in required_fields.items():
            self.assertIn(field, metadata, f"Metadata missing mandatory field '{field}'")
            val = metadata[field]
            self.assertIsInstance(
                val, expected_type,
                f"Metadata field '{field}' must be of type {expected_type.__name__}, got {type(val).__name__}"
            )
            # Ensure boolean is not confused with int in Python
            if expected_type is int:
                self.assertNotIsInstance(
                    val, bool,
                    f"Metadata field '{field}' is a bool instead of integer"
                )

        self.assertEqual(metadata["country"], "Bangladesh", "Metadata country must be 'Bangladesh'")
        self.assertEqual(metadata["country_code"], "BD", "Metadata country_code must be 'BD'")
        crs = metadata["coordinate_reference_system"].upper()
        self.assertTrue(
            "EPSG:4326" in crs or "WGS84" in crs,
            f"CRS must reference EPSG:4326 or WGS84, got: '{metadata['coordinate_reference_system']}'"
        )

    def test_1_4_metadata_count_arithmetic(self):
        """Test 1.4: Metadata record count arithmetic: total == verified + partially_verified + unverified == len(stations)."""
        metadata = self.get_metadata()
        stations = self.get_stations()

        total = metadata["total_records"]
        verified = metadata["verified_records"]
        partially = metadata["partially_verified_records"]
        unverified = metadata["unverified_records"]

        self.assertEqual(
            total, verified + partially + unverified,
            f"Metadata arithmetic failed: total_records ({total}) != verified ({verified}) + partially ({partially}) + unverified ({unverified})"
        )
        self.assertEqual(
            total, len(stations),
            f"Metadata total_records ({total}) does not match actual stations array length ({len(stations)})"
        )

        actual_verified = sum(1 for s in stations if s.get("verification", {}).get("status") == "verified")
        actual_partially = sum(1 for s in stations if s.get("verification", {}).get("status") == "partially_verified")
        actual_unverified = sum(1 for s in stations if s.get("verification", {}).get("status") == "unverified")

        self.assertEqual(verified, actual_verified, "Metadata verified_records does not match actual count")
        self.assertEqual(partially, actual_partially, "Metadata partially_verified_records does not match actual count")
        self.assertEqual(unverified, actual_unverified, "Metadata unverified_records does not match actual count")

    def test_1_5_total_station_count_baseline(self):
        """Test 1.5: Total station count satisfies national operational baseline (total_records >= 640)."""
        metadata = self.get_metadata()
        total = metadata["total_records"]
        self.assertGreaterEqual(
            total, 640,
            f"Dataset station count ({total}) is below the national operational baseline of 640 stations."
        )
        self.assertLessEqual(
            total, 800,
            f"Dataset station count ({total}) exceeds realistic maximum bounds (800) for Bangladesh operational thanas."
        )

    def test_1_6_station_schema_required_fields(self):
        """Test 1.6: Station schema enforcement: every element contains all 10 required schema fields."""
        stations = self.get_stations()
        expected_keys = {
            "station_id", "station_name_en", "station_name_bn", "division", "district",
            "police_jurisdiction", "police_unit_type", "address", "location", "verification"
        }

        for idx, station in enumerate(stations):
            self.assertIsInstance(station, dict, f"Station record at index {idx} is not a JSON object")
            actual_keys = set(station.keys())
            missing = expected_keys - actual_keys
            self.assertEqual(
                missing, set(),
                f"Station record '{station.get('station_id', f'index_{idx}')}' missing mandatory keys: {missing}"
            )
            # Mandatory string types
            for field in ["station_id", "station_name_en", "division", "district", "police_jurisdiction", "police_unit_type"]:
                self.assertIsInstance(
                    station[field], str,
                    f"Station '{station.get('station_id')}' field '{field}' must be a non-empty string"
                )
                self.assertTrue(
                    len(station[field].strip()) > 0,
                    f"Station '{station.get('station_id')}' field '{field}' cannot be empty whitespace"
                )

    def test_1_7_location_object_schema(self):
        """Test 1.7: Location object schema: latitude, longitude, location_type."""
        stations = self.get_stations()
        expected_keys = {"latitude", "longitude", "location_type"}

        for station in stations:
            st_id = station.get("station_id", "UNKNOWN")
            loc = station.get("location")
            self.assertIsInstance(loc, dict, f"Station '{st_id}' location must be a JSON object")
            self.assertEqual(
                set(loc.keys()), expected_keys,
                f"Station '{st_id}' location must contain exactly keys {expected_keys}"
            )

            lat = loc["latitude"]
            lon = loc["longitude"]
            loc_type = loc["location_type"]

            if lat is not None:
                self.assertIsInstance(lat, (int, float), f"Station '{st_id}' latitude must be numeric or null")
                self.assertNotIsInstance(lat, bool, f"Station '{st_id}' latitude cannot be boolean")
            if lon is not None:
                self.assertIsInstance(lon, (int, float), f"Station '{st_id}' longitude must be numeric or null")
                self.assertNotIsInstance(lon, bool, f"Station '{st_id}' longitude cannot be boolean")
            if loc_type is not None:
                self.assertIsInstance(loc_type, str, f"Station '{st_id}' location_type must be string or null")

    def test_1_8_verification_object_schema(self):
        """Test 1.8: Verification object schema: status, confidence, official_source, coordinate_source, last_verified, notes."""
        stations = self.get_stations()
        expected_keys = {"status", "confidence", "official_source", "coordinate_source", "last_verified", "notes"}

        for station in stations:
            st_id = station.get("station_id", "UNKNOWN")
            ver = station.get("verification")
            self.assertIsInstance(ver, dict, f"Station '{st_id}' verification must be a JSON object")
            self.assertEqual(
                set(ver.keys()), expected_keys,
                f"Station '{st_id}' verification must contain exactly keys {expected_keys}"
            )

            self.assertIsInstance(ver["status"], str, f"Station '{st_id}' status must be string")
            self.assertIsInstance(ver["confidence"], str, f"Station '{st_id}' confidence must be string")
            self.assertIsInstance(ver["last_verified"], str, f"Station '{st_id}' last_verified must be string")

            for opt_str_field in ["official_source", "coordinate_source", "notes"]:
                val = ver[opt_str_field]
                if val is not None:
                    self.assertIsInstance(val, str, f"Station '{st_id}' field '{opt_str_field}' must be string or null")

    def test_1_9_strict_null_value_discipline(self):
        """Test 1.9: Strict null value type checks: no string 'null', 'N/A', or 'None' in place of genuine JSON null."""
        stations = self.get_stations()
        forbidden_placeholders = {"null", "none", "n/a", "na", "undefined", "[null]", "nil", "nan"}

        for station in stations:
            st_id = station.get("station_id", "UNKNOWN")

            # Check top-level optional fields
            for key in ["station_name_bn", "address"]:
                val = station[key]
                if isinstance(val, str):
                    self.assertNotIn(
                        val.strip().lower(), forbidden_placeholders,
                        f"Station '{st_id}' field '{key}' contains placeholder string '{val}' instead of JSON null"
                    )

            # Check location fields
            loc = station["location"]
            for key in ["location_type"]:
                val = loc[key]
                if isinstance(val, str):
                    self.assertNotIn(
                        val.strip().lower(), forbidden_placeholders,
                        f"Station '{st_id}' location.{key} contains placeholder string '{val}' instead of JSON null"
                    )

            # Check verification fields
            ver = station["verification"]
            for key in ["official_source", "coordinate_source", "notes"]:
                val = ver[key]
                if isinstance(val, str):
                    self.assertNotIn(
                        val.strip().lower(), forbidden_placeholders,
                        f"Station '{st_id}' verification.{key} contains placeholder string '{val}' instead of JSON null"
                    )

    def test_1_10_station_id_regex_format(self):
        """Test 1.10: Station ID regex format: matches ^BD-PS-[0-9]{4}$."""
        stations = self.get_stations()
        id_pattern = re.compile(r"^BD-PS-[0-9]{4}$")

        for station in stations:
            st_id = station.get("station_id", "")
            self.assertTrue(
                bool(id_pattern.match(st_id)),
                f"Station ID '{st_id}' does not match required regex pattern '^BD-PS-[0-9]{{4}}$'"
            )


# ===========================================================================
# Tier 2: Boundary & Corner Cases
# ===========================================================================
class TestTier2BoundaryAndCornerCases(BasePoliceStationE2ETest):
    """Tier 2: Boundary Value Analysis & Corner Cases (9 Test Cases)."""

    def test_2_1_latitude_bounds(self):
        """Test 2.1: Coordinate bounding box boundaries: all non-null latitudes strictly between 20.3000 and 26.8000 N."""
        stations = self.get_stations()
        MIN_LAT = 20.3000
        MAX_LAT = 26.8000

        for station in stations:
            st_id = station["station_id"]
            lat = station["location"]["latitude"]
            if lat is not None:
                self.assertGreaterEqual(
                    lat, MIN_LAT,
                    f"Station '{st_id}' ({station['station_name_en']}) latitude {lat} is south of Bangladesh boundary ({MIN_LAT})"
                )
                self.assertLessEqual(
                    lat, MAX_LAT,
                    f"Station '{st_id}' ({station['station_name_en']}) latitude {lat} is north of Bangladesh boundary ({MAX_LAT})"
                )

    def test_2_2_longitude_bounds(self):
        """Test 2.2: Coordinate bounding box boundaries: all non-null longitudes strictly between 87.8000 and 92.9000 E."""
        stations = self.get_stations()
        MIN_LON = 87.8000
        MAX_LON = 92.9000

        for station in stations:
            st_id = station["station_id"]
            lon = station["location"]["longitude"]
            if lon is not None:
                self.assertGreaterEqual(
                    lon, MIN_LON,
                    f"Station '{st_id}' ({station['station_name_en']}) longitude {lon} is west of Bangladesh boundary ({MIN_LON})"
                )
                self.assertLessEqual(
                    lon, MAX_LON,
                    f"Station '{st_id}' ({station['station_name_en']}) longitude {lon} is east of Bangladesh boundary ({MAX_LON})"
                )

    def test_2_3_no_transposed_coordinates(self):
        """Test 2.3: Inverted/transposed coordinate detection: ensure no latitude > 80 or longitude in 20s (swapped lat/lon)."""
        stations = self.get_stations()
        for station in stations:
            st_id = station["station_id"]
            lat = station["location"]["latitude"]
            lon = station["location"]["longitude"]

            if lat is not None and lon is not None:
                self.assertLess(
                    lat, 80.0,
                    f"Station '{st_id}' has swapped coordinates! Latitude {lat} appears to be a longitude value."
                )
                self.assertGreater(
                    lon, 30.0,
                    f"Station '{st_id}' has swapped coordinates! Longitude {lon} appears to be a latitude value."
                )
                self.assertLess(
                    lat, lon,
                    f"Station '{st_id}' latitude ({lat}) must be numerically less than longitude ({lon}) in Bangladesh."
                )

    def test_2_4_extreme_territorial_boundary_stations(self):
        """Test 2.4: Extreme territorial boundaries: verify presence of northernmost, southernmost, westernmost, and easternmost stations."""
        stations = self.get_stations()

        # Northernmost: Tetulia (Panchagarh District, Rangpur Division)
        found_north = any(
            "tetulia" in s["station_name_en"].lower() and
            normalize_district(s["district"]) == "panchagarh"
            for s in stations
        )
        self.assertTrue(found_north, "Extreme boundary station missing: Tetulia Police Station in Panchagarh (Northernmost)")

        # Southernmost: Teknaf or Saint Martin (Cox's Bazar District, Chattogram Division)
        found_south = any(
            ("teknaf" in s["station_name_en"].lower() or "saint martin" in s["station_name_en"].lower() or "st. martin" in s["station_name_en"].lower()) and
            normalize_district(s["district"]) == "cox's bazar"
            for s in stations
        )
        self.assertTrue(found_south, "Extreme boundary station missing: Teknaf/Saint Martin Police Station in Cox's Bazar (Southernmost)")

        # Westernmost: Shibganj (Chapainawabganj District, Rajshahi Division)
        found_west = any(
            "shibganj" in s["station_name_en"].lower() and
            normalize_district(s["district"]) == "chapainawabganj"
            for s in stations
        )
        self.assertTrue(found_west, "Extreme boundary station missing: Shibganj Police Station in Chapainawabganj (Westernmost)")

        # Easternmost: Thanchi or Ruma (Bandarban District, Chattogram Division)
        found_east = any(
            ("thanchi" in s["station_name_en"].lower() or "ruma" in s["station_name_en"].lower()) and
            normalize_district(s["district"]) == "bandarban"
            for s in stations
        )
        self.assertTrue(found_east, "Extreme boundary station missing: Thanchi/Ruma Police Station in Bandarban (Easternmost)")

    def test_2_5_no_zero_or_negative_coordinates(self):
        """Test 2.5: Zero/negative/extreme coordinate check: no (0, 0) or negative latitudes/longitudes."""
        stations = self.get_stations()
        for station in stations:
            st_id = station["station_id"]
            lat = station["location"]["latitude"]
            lon = station["location"]["longitude"]

            if lat is not None:
                self.assertGreater(lat, 0.0, f"Station '{st_id}' latitude must be strictly positive, found {lat}")
            if lon is not None:
                self.assertGreater(lon, 0.0, f"Station '{st_id}' longitude must be strictly positive, found {lon}")
            if lat is not None and lon is not None:
                self.assertFalse(
                    lat == 0.0 and lon == 0.0,
                    f"Station '{st_id}' has invalid Null Island coordinates (0.0, 0.0)"
                )

    def test_2_6_location_type_enum(self):
        """Test 2.6: Location type enum validation: location_type in ['station_premises', 'main_entrance', None]."""
        stations = self.get_stations()
        allowed_types = {"station_premises", "main_entrance"}

        for station in stations:
            st_id = station["station_id"]
            loc_type = station["location"]["location_type"]
            if loc_type is not None:
                self.assertIn(
                    loc_type, allowed_types,
                    f"Station '{st_id}' location_type '{loc_type}' not in allowed enum {allowed_types}"
                )

    def test_2_7_verification_status_enum(self):
        """Test 2.7: Verification status enum validation: status in ['verified', 'partially_verified', 'unverified']."""
        stations = self.get_stations()
        allowed_statuses = {"verified", "partially_verified", "unverified"}

        for station in stations:
            st_id = station["station_id"]
            status = station["verification"]["status"]
            self.assertIn(
                status, allowed_statuses,
                f"Station '{st_id}' verification status '{status}' not in allowed set {allowed_statuses}"
            )

    def test_2_8_confidence_level_enum(self):
        """Test 2.8: Confidence level enum validation: confidence in ['high', 'medium', 'low']."""
        stations = self.get_stations()
        allowed_confidence = {"high", "medium", "low"}

        for station in stations:
            st_id = station["station_id"]
            confidence = station["verification"]["confidence"]
            self.assertIn(
                confidence, allowed_confidence,
                f"Station '{st_id}' confidence '{confidence}' not in allowed set {allowed_confidence}"
            )

    def test_2_9_iso_date_format_validation(self):
        """Test 2.9: Date format validation: last_verified matches ISO date format YYYY-MM-DD."""
        metadata = self.get_metadata()
        stations = self.get_stations()

        # Validate metadata research_date
        try:
            datetime.strptime(metadata["research_date"], "%Y-%m-%d")
        except ValueError:
            self.fail(f"Metadata research_date '{metadata['research_date']}' is not a valid ISO date YYYY-MM-DD")

        # Validate every station's last_verified date
        for station in stations:
            st_id = station["station_id"]
            date_str = station["verification"]["last_verified"]
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                # Ensure date is reasonable (not in the distant future or prior to 2000)
                self.assertGreaterEqual(dt.year, 2020, f"Station '{st_id}' last_verified year {dt.year} is too old")
            except ValueError:
                self.fail(f"Station '{st_id}' last_verified '{date_str}' is not a valid ISO date YYYY-MM-DD")


# ===========================================================================
# Tier 3: Cross-Feature Combinations & Integrity
# ===========================================================================
class TestTier3CrossFeatureCombinations(BasePoliceStationE2ETest):
    """Tier 3: Pairwise Combinatorial & Referential Integrity (8 Test Cases)."""

    def test_3_1_unique_station_ids(self):
        """Test 3.1: Unique station IDs: zero duplicates in station_id."""
        stations = self.get_stations()
        ids = [s["station_id"] for s in stations]
        unique_ids = set(ids)

        if len(ids) != len(unique_ids):
            seen = set()
            duplicates = [x for x in ids if x in seen or seen.add(x)]
            self.fail(f"Found {len(duplicates)} duplicate station IDs in deliverable: {duplicates[:10]}")

    def test_3_2_coordinate_uniqueness_across_districts(self):
        """Test 3.2: Coordinate uniqueness: zero identical (lat, lon) pairs across different administrative districts."""
        stations = self.get_stations()
        coord_to_station: Dict[Tuple[float, float], Dict[str, Any]] = {}

        for station in stations:
            lat = station["location"]["latitude"]
            lon = station["location"]["longitude"]
            if lat is not None and lon is not None:
                # Round to 5 decimal places (~1 meter precision)
                coord_key = (round(lat, 5), round(lon, 5))
                district = normalize_district(station["district"])

                if coord_key in coord_to_station:
                    prev_station = coord_to_station[coord_key]
                    prev_district = normalize_district(prev_station["district"])
                    self.assertEqual(
                        district, prev_district,
                        f"Suspicious duplicate coordinates {coord_key} found in two different districts: "
                        f"'{station['station_id']}' ({station['district']}) and '{prev_station['station_id']}' ({prev_station['district']})"
                    )
                else:
                    coord_to_station[coord_key] = station

    def test_3_3_station_name_uniqueness_within_district(self):
        """Test 3.3: Name and jurisdiction consistency: station names must be unique within any single district."""
        stations = self.get_stations()
        district_station_names: Dict[str, Set[str]] = {}

        for station in stations:
            st_id = station["station_id"]
            district = normalize_district(station["district"])
            name = station["station_name_en"].strip().lower()

            if district not in district_station_names:
                district_station_names[district] = set()

            self.assertNotIn(
                name, district_station_names[district],
                f"Duplicate station name '{station['station_name_en']}' detected within district '{station['district']}' (station '{st_id}')"
            )
            district_station_names[district].add(name)

    def test_3_4_all_eight_divisions_represented(self):
        """Test 3.4: All 8 Divisions represented: Dhaka, Chattogram, Rajshahi, Khulna, Barishal, Sylhet, Rangpur, Mymensingh."""
        stations = self.get_stations()
        observed_divisions = {normalize_division(s["division"]) for s in stations}

        missing_divisions = CANONICAL_DIVISIONS - observed_divisions
        self.assertEqual(
            missing_divisions, set(),
            f"Dataset does not cover all 8 divisions. Missing: {missing_divisions}"
        )

    def test_3_5_all_sixty_four_districts_represented(self):
        """Test 3.5: All 64 Districts represented: check that every official district has >= 3 operational stations."""
        stations = self.get_stations()
        district_counts: Dict[str, int] = {}

        for station in stations:
            d = normalize_district(station["district"])
            district_counts[d] = district_counts.get(d, 0) + 1

        observed_districts = set(district_counts.keys())
        missing_districts = CANONICAL_64_DISTRICTS - observed_districts
        self.assertEqual(
            missing_districts, set(),
            f"Dataset does not cover all 64 districts. Missing: {missing_districts}"
        )

        for district in CANONICAL_64_DISTRICTS:
            count = district_counts.get(district, 0)
            self.assertGreaterEqual(
                count, 3,
                f"District '{district}' has only {count} operational police stations (expected at least 3)."
            )

    def test_3_6_all_eight_metropolitan_commissionerates(self):
        """Test 3.6: All 8 Metropolitan Commissionerates represented: DMP, CMP, RMP, KMP, BMP, SMP, RPMP, GMP totaling exactly 110."""
        stations = self.get_stations()
        metro_stations = [
            s for s in stations
            if s.get("police_unit_type", "").lower() == "metropolitan" or identify_commissionerate(s.get("police_jurisdiction", "")) is not None
        ]

        self.assertEqual(
            len(metro_stations), 110,
            f"Total metropolitan police stations nationwide must equal exactly 110, found {len(metro_stations)}"
        )

        commissionerate_counts: Dict[str, int] = {code: 0 for code in METROPOLITAN_COMMISSIONERATE_TARGETS}
        for s in metro_stations:
            code = identify_commissionerate(s.get("police_jurisdiction", ""))
            if code and code in commissionerate_counts:
                commissionerate_counts[code] += 1

        for code, expected_count in METROPOLITAN_COMMISSIONERATE_TARGETS.items():
            actual = commissionerate_counts[code]
            self.assertEqual(
                actual, expected_count,
                f"Metropolitan commissionerate '{code}' expected {expected_count} stations, found {actual}"
            )

    def test_3_7_railway_police_grp_representation(self):
        """Test 3.7: Railway Police (GRP) representation: verified presence of railway police stations with police_unit_type == 'railway'."""
        stations = self.get_stations()
        grp_stations = [
            s for s in stations
            if s.get("police_unit_type", "").lower() == "railway" or "railway" in s.get("police_jurisdiction", "").lower()
        ]

        self.assertGreaterEqual(
            len(grp_stations), 15,
            f"Expected at least 15 Railway Police (GRP) stations in national dataset, found {len(grp_stations)}"
        )

        # Verify key railway transport hubs
        names = [s["station_name_en"].lower() for s in grp_stations]
        has_dhaka_railway = any("kamalapur" in n or "dhaka" in n for n in names)
        self.assertTrue(has_dhaka_railway, "Primary railway station (Kamalapur/Dhaka Railway) missing from GRP stations")

    def test_3_8_verification_status_coordinate_consistency(self):
        """Test 3.8: Verification status consistency: unlocated stations must have appropriate unverified/partially_verified status; verified stations must have valid coordinates and source."""
        stations = self.get_stations()

        for station in stations:
            st_id = station["station_id"]
            lat = station["location"]["latitude"]
            lon = station["location"]["longitude"]
            loc_type = station["location"]["location_type"]
            status = station["verification"]["status"]
            confidence = station["verification"]["confidence"]
            coord_src = station["verification"]["coordinate_source"]

            if lat is None or lon is None:
                self.assertIsNone(lat, f"Station '{st_id}' latitude must be null when longitude is null")
                self.assertIsNone(lon, f"Station '{st_id}' longitude must be null when latitude is null")
                self.assertIsNone(loc_type, f"Station '{st_id}' location_type must be null when coordinates are null")
                self.assertIsNone(coord_src, f"Station '{st_id}' coordinate_source must be null when coordinates are null")
                self.assertIn(
                    status, {"unverified", "partially_verified"},
                    f"Station '{st_id}' has null coordinates but status is '{status}' (must be 'unverified' or 'partially_verified')"
                )
                if status == "unverified":
                    self.assertEqual(
                        confidence, "low",
                        f"Station '{st_id}' has unverified status but confidence is '{confidence}' (expected 'low')"
                    )
                elif status == "partially_verified":
                    self.assertIn(
                        confidence, {"low", "medium"},
                        f"Station '{st_id}' has partially_verified status but confidence is '{confidence}' (expected 'low' or 'medium')"
                    )
            elif status == "verified":
                self.assertIsNotNone(
                    lat, f"Station '{st_id}' is marked 'verified' but latitude is None"
                )
                self.assertIsNotNone(
                    lon, f"Station '{st_id}' is marked 'verified' but longitude is None"
                )
                self.assertIsNotNone(
                    loc_type, f"Station '{st_id}' is marked 'verified' but location_type is None"
                )
                self.assertEqual(
                    confidence, "high",
                    f"Station '{st_id}' is marked 'verified' but confidence is '{confidence}' (expected 'high')"
                )
                self.assertIsNotNone(
                    coord_src,
                    f"Station '{st_id}' is marked 'verified' but coordinate_source is None"
                )

    def test_3_9_no_administrative_centroid_collusion(self):
        """Test 3.9: Anti-Cheat Verification: Ensure no station coordinates are manufactured using synthetic district centroid offsets (R2 prohibition on centroids)."""
        stations = self.get_stations()
        from tests.mock_data_generator import DISTRICT_CENTERS

        suspicious_matches = []
        for s in stations:
            lat = s["location"]["latitude"]
            lon = s["location"]["longitude"]
            if lat is not None and lon is not None:
                district = s["district"]
                for center_dist, (c_lat, c_lon) in DISTRICT_CENTERS.items():
                    if abs(lat - c_lat) < 1e-5 and abs(lon - c_lon) < 1e-5:
                        suspicious_matches.append(f"Station '{s['station_id']}' matches exact centroid of {center_dist}")
                    elif abs(lat - c_lat - 0.0012) < 1e-4 and abs(lon - c_lon - 0.0015) < 1e-4:
                        suspicious_matches.append(f"Station '{s['station_id']}' matches fixed mock offset (+0.0012, +0.0015) of {center_dist}")

        self.assertEqual(
            suspicious_matches, [],
            f"Detected {len(suspicious_matches)} stations using prohibited administrative centroid coordinates or mock offsets: {suspicious_matches[:5]}"
        )

    def test_3_10_no_fabricated_osm_node_series(self):
        """Test 3.10: Anti-Cheat Verification: Ensure no stations cite known fabricated OSM node sequences (node/5321456xxx) (R3)."""
        stations = self.get_stations()
        fabricated_nodes = []
        for s in stations:
            src = s["verification"]["coordinate_source"]
            if src and "5321456" in src:
                fabricated_nodes.append(f"Station '{s['station_id']}': {src}")

        self.assertEqual(
            fabricated_nodes, [],
            f"Detected {len(fabricated_nodes)} stations citing fabricated OSM node sequence (5321456xxx): {fabricated_nodes[:5]}"
        )


# ===========================================================================
# Tier 4: Real-World Scenarios (DangerZoneBD Integration)
# ===========================================================================
class TestTier4RealWorldScenarios(BasePoliceStationE2ETest):
    """Tier 4: DangerZoneBD Integration & Real-World Workloads (5 Test Cases)."""

    def test_4_1_spatial_proximity_querying(self):
        """Test 4.1: Spatial Proximity Querying: Verify proximity calculation on valid coordinates without crashing, and check urban proximity where verified stations exist."""
        stations = self.get_stations()
        valid_stations = [
            s for s in stations
            if s["location"]["latitude"] is not None and s["location"]["longitude"] is not None
        ]
        self.assertGreater(len(valid_stations), 0, "No stations with valid coordinates found for proximity query")

        # 1. Benchmark incident point in Dhaka where verified station premises exist on OSM:
        dhaka_valid = [s for s in valid_stations if normalize_district(s["district"]) == "dhaka"]
        if dhaka_valid:
            dhaka_center = (23.7381, 90.3957)  # Dhaka Shahbagh / TSC
            distances = [
                haversine_distance_km(dhaka_center[0], dhaka_center[1], s["location"]["latitude"], s["location"]["longitude"])
                for s in dhaka_valid
            ]
            min_dist = min(distances)
            self.assertLessEqual(
                min_dist, 5.0,
                f"Dhaka benchmark nearest station is {min_dist:.2f} km away (> 5.0 km limit)"
            )

        # 2. Multi-point algorithm verification: ensure haversine calculation executes across national benchmark points
        benchmark_points = [
            ("Dhaka Center (Shahbagh)", 23.7381, 90.3957),
            ("Chattogram Center (Agrabad)", 22.3274, 91.8124),
            ("Sylhet Center (Zinda Bazar)", 24.8949, 91.8687),
        ]
        for name, lat, lon in benchmark_points:
            distances = [
                (haversine_distance_km(lat, lon, s["location"]["latitude"], s["location"]["longitude"]), s)
                for s in valid_stations
            ]
            min_dist, nearest_st = min(distances, key=lambda x: x[0])
            self.assertIsInstance(min_dist, float, f"Proximity distance for '{name}' must be float")
            self.assertGreater(min_dist, 0.0, f"Distance to nearest station from '{name}' must be positive")

    def test_4_2_safe_zone_ingestion_pipeline(self):
        """Test 4.2: Safe Zone Ingestion Pipeline: Parse all records into DangerZoneBD SafeZoneItem interface with zero errors."""
        stations = self.get_stations()
        ingested_items = []

        for idx, s in enumerate(stations):
            try:
                safe_zone_item = {
                    "id": str(s["station_id"]),
                    "name": str(s["station_name_en"]),
                    "nameBn": s["station_name_bn"] if s["station_name_bn"] is not None else None,
                    "type": "POLICE_STATION",
                    "latitude": float(s["location"]["latitude"]) if s["location"]["latitude"] is not None else None,
                    "longitude": float(s["location"]["longitude"]) if s["location"]["longitude"] is not None else None,
                    "address": s["address"] if s["address"] is not None else None,
                    "status": str(s["verification"]["status"]),
                    "jurisdiction": str(s["police_jurisdiction"]),
                    "division": str(s["division"]),
                    "district": str(s["district"])
                }
                ingested_items.append(safe_zone_item)
            except Exception as e:
                self.fail(f"Ingestion pipeline threw an exception on station at index {idx} ('{s.get('station_id')}'): {e}")

        self.assertEqual(len(ingested_items), len(stations), "Ingested item count does not match station count")
        # Ensure all types match
        for item in ingested_items:
            self.assertEqual(item["type"], "POLICE_STATION")
            self.assertTrue(len(item["id"]) > 0)
            self.assertTrue(len(item["name"]) > 0)

    def test_4_3_safe_haven_coverage_per_district(self):
        """Test 4.3: Safe Route Obstacle/Waypoint Avoidance: Ensure safe haven resolution succeeds for located stations and gracefully handles unlocated districts without manufacturing coordinates (R2)."""
        stations = self.get_stations()
        district_stations: Dict[str, List[Dict[str, Any]]] = {}

        for s in stations:
            d = normalize_district(s["district"])
            if d not in district_stations:
                district_stations[d] = []
            district_stations[d].append(s)

        # 1. Roster completeness: Every canonical district must have operational station records (R2)
        for district in CANONICAL_64_DISTRICTS:
            self.assertIn(district, district_stations, f"District '{district}' missing from dataset roster")
            self.assertGreaterEqual(
                len(district_stations[district]), 1,
                f"District '{district}' has 0 operational stations recorded"
            )

        # 2. Inspect coordinates per district: enforce R2 without penalizing honest nulls
        districts_with_coords = 0
        total_located_stations = 0

        for district, st_list in district_stations.items():
            located = [s for s in st_list if s["location"]["latitude"] is not None and s["location"]["longitude"] is not None]
            unlocated = [s for s in st_list if s["location"]["latitude"] is None or s["location"]["longitude"] is None]

            if len(located) > 0:
                districts_with_coords += 1
                total_located_stations += len(located)
                for s in located:
                    lat = s["location"]["latitude"]
                    lon = s["location"]["longitude"]
                    self.assertTrue(
                        20.3 <= lat <= 26.8,
                        f"Station '{s['station_id']}' in '{district}' has latitude {lat} outside Bangladesh bounds"
                    )
                    self.assertTrue(
                        87.8 <= lon <= 92.9,
                        f"Station '{s['station_id']}' in '{district}' has longitude {lon} outside Bangladesh bounds"
                    )

            # All unlocated stations must strictly adhere to R1/R2 null discipline
            for s in unlocated:
                self.assertIsNone(
                    s["location"]["latitude"],
                    f"Station '{s['station_id']}' unlocated record must have null latitude"
                )
                self.assertIsNone(
                    s["location"]["longitude"],
                    f"Station '{s['station_id']}' unlocated record must have null longitude"
                )
                self.assertIsNone(
                    s["location"]["location_type"],
                    f"Station '{s['station_id']}' unlocated record must have null location_type"
                )
                self.assertIsNone(
                    s["verification"]["coordinate_source"],
                    f"Station '{s['station_id']}' unlocated record must have null coordinate_source"
                )
                self.assertIn(
                    s["verification"]["status"], {"unverified", "partially_verified"},
                    f"Unlocated station '{s['station_id']}' status must be 'unverified' or 'partially_verified', got '{s['verification']['status']}'"
                )

        # 3. National dataset must contain verified safe havens without requiring 100% rural saturation
        self.assertGreater(
            districts_with_coords, 0,
            "Dataset contains 0 districts with verified coordinates. Safe haven routing impossible!"
        )
        self.assertGreater(
            total_located_stations, 0,
            "Dataset contains 0 located stations nationwide."
        )

    def test_4_4_urban_vs_rural_station_density(self):
        """Test 4.4: High-density Urban vs Rural Station Distribution: Verify urban density (DMP == 50, Dhaka District >= 50) and rural distribution."""
        stations = self.get_stations()

        # DMP stations
        dmp_stations = [s for s in stations if identify_commissionerate(s.get("police_jurisdiction", "")) == "DMP"]
        self.assertEqual(len(dmp_stations), 50, f"Dhaka Metropolitan Police must have exactly 50 stations, got {len(dmp_stations)}")

        # Dhaka District total (DMP + Dhaka District Police)
        dhaka_district_stations = [s for s in stations if normalize_district(s["district"]) == "dhaka"]
        self.assertGreaterEqual(
            len(dhaka_district_stations), 50,
            f"Dhaka District total stations expected >= 50, found {len(dhaka_district_stations)}"
        )

        # Average stations per district nationwide >= 3
        districts_present = {normalize_district(s["district"]) for s in stations}
        avg_density = len(stations) / len(districts_present)
        self.assertGreaterEqual(
            avg_density, 3.0,
            f"Average station density across districts ({avg_density:.1f}) is below expected minimum"
        )

    def test_4_5_offline_fallback_null_coordinate_tolerance(self):
        """Test 4.5: Offline Fallback Readiness: Missing coordinate records degrade gracefully without throwing runtime null pointer exceptions."""
        stations = self.get_stations()

        # Simulate spatial bounding box filtering: should not raise TypeError when lat/lon is None
        def safe_bbox_filter(station_list, min_lat, min_lon, max_lat, max_lon):
            return [
                s for s in station_list
                if s["location"]["latitude"] is not None and
                   s["location"]["longitude"] is not None and
                   min_lat <= s["location"]["latitude"] <= max_lat and
                   min_lon <= s["location"]["longitude"] <= max_lon
            ]

        try:
            results = safe_bbox_filter(stations, 23.0, 90.0, 24.0, 91.0)
            self.assertIsInstance(results, list)
        except Exception as e:
            self.fail(f"Spatial bounding box filtering failed with exception: {e}")

        # Simulate textual query fallback on unverified / null coordinate stations
        def text_search_filter(station_list, query):
            q = query.lower()
            return [
                s for s in station_list
                if q in s["station_name_en"].lower() or
                   q in s["district"].lower() or
                   q in s["police_jurisdiction"].lower()
            ]

        try:
            dhaka_results = text_search_filter(stations, "dhaka")
            self.assertGreater(len(dhaka_results), 0, "Text search fallback returned zero results for 'dhaka'")
        except Exception as e:
            self.fail(f"Textual search fallback failed with exception: {e}")


# ---------------------------------------------------------------------------
# Test Runner & Self-Test Verification Entrypoint
# ---------------------------------------------------------------------------
def run_self_verification() -> bool:
    """Runs the 34 test cases against the synthetic mock dataset to verify test suite logic."""
    print("=" * 70)
    print("RUNNING E2E TEST SUITE SELF-VERIFICATION (Synthetic Mock Dataset)")
    print("=" * 70)
    os.environ["TEST_POLICE_STATIONS_MOCK"] = "1"
    DatasetHolder.load(force_mock=True)

    suite = unittest.TestSuite()
    suite.addTest(unittest.defaultTestLoader.loadTestsFromTestCase(TestTier1FeatureCoverage))
    suite.addTest(unittest.defaultTestLoader.loadTestsFromTestCase(TestTier2BoundaryAndCornerCases))
    suite.addTest(unittest.defaultTestLoader.loadTestsFromTestCase(TestTier3CrossFeatureCombinations))
    suite.addTest(unittest.defaultTestLoader.loadTestsFromTestCase(TestTier4RealWorldScenarios))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    print("\nSelf-Verification Summary:")
    print(f"Tests run: {result.testsRun}, Errors: {len(result.errors)}, Failures: {len(result.failures)}")
    return result.wasSuccessful()


if __name__ == "__main__":
    if "--mock-test" in sys.argv:
        success = run_self_verification()
        sys.exit(0 if success else 1)

    DatasetHolder.load()
    unittest.main()
