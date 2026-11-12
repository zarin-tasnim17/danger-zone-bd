import { MAX_GPS_PROXIMITY_METERS, MAX_HARDWARE_GPS_ACCURACY_METERS } from "@repo/shared";

export interface HardwareGpsFix {
  lat: number;
  lng: number;
  accuracy: number;
}

export type GpsVerificationStatus =
  | "HARDWARE_VERIFIED"
  | "OUT_OF_RANGE"
  | "LOW_ACCURACY"
  | "UNAVAILABLE";

export interface HardwareGpsEvaluation {
  status: GpsVerificationStatus;
  isEligibleHardwareGps: boolean;
  isVerified: boolean;
  distanceMeters: number | null;
}

/** Calculates Haversine distance in meters between two WGS-84 coordinates. */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Evaluates whether an unmodified hardware geolocation fix supports <=200m proximity verification. */
export function evaluateHardwareGpsProximity(
  hardwareGps: HardwareGpsFix | null,
  pinLat: number,
  pinLng: number
): HardwareGpsEvaluation {
  if (!hardwareGps) {
    return {
      status: "UNAVAILABLE",
      isEligibleHardwareGps: false,
      isVerified: false,
      distanceMeters: null,
    };
  }

  const distanceMeters = calculateDistanceMeters(hardwareGps.lat, hardwareGps.lng, pinLat, pinLng);
  const isAccuracyValid =
    Number.isFinite(hardwareGps.accuracy) &&
    hardwareGps.accuracy >= 0 &&
    hardwareGps.accuracy <= MAX_HARDWARE_GPS_ACCURACY_METERS;

  if (!isAccuracyValid) {
    return {
      status: "LOW_ACCURACY",
      isEligibleHardwareGps: false,
      isVerified: false,
      distanceMeters,
    };
  }

  if (distanceMeters > MAX_GPS_PROXIMITY_METERS) {
    return {
      status: "OUT_OF_RANGE",
      isEligibleHardwareGps: true,
      isVerified: false,
      distanceMeters,
    };
  }

  return {
    status: "HARDWARE_VERIFIED",
    isEligibleHardwareGps: true,
    isVerified: true,
    distanceMeters,
  };
}

/** Builds device GPS telemetry headers only for verified, unmodified hardware fixes. */
export function buildHardwareGpsHeaders(
  hardwareGps: HardwareGpsFix | null,
  evaluation: HardwareGpsEvaluation
): Record<string, string> {
  if (!hardwareGps || !evaluation.isVerified) {
    return {};
  }

  return {
    "x-device-lat": hardwareGps.lat.toString(),
    "x-device-lng": hardwareGps.lng.toString(),
    "x-device-accuracy": Math.round(hardwareGps.accuracy).toString(),
    "x-gps-source": "hardware",
  };
}
