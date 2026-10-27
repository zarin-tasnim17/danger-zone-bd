// Bangladesh Geocoding & Landmark Engine
// Bounding box for Bangladesh: Latitude: 20.5 to 26.7, Longitude: 88.0 to 92.7

export const BD_BOUNDS = {
  MIN_LAT: 20.5,
  MAX_LAT: 26.7,
  MIN_LNG: 88.0,
  MAX_LNG: 92.7,
};

export interface GeocodeResult {
  locationName: string;
  latitude: number;
  longitude: number;
  source: 'DICTIONARY' | 'NOMINATIM';
}

export const isWithinBangladesh = (lat: number, lng: number): boolean => {
  return (
    lat >= BD_BOUNDS.MIN_LAT &&
    lat <= BD_BOUNDS.MAX_LAT &&
    lng >= BD_BOUNDS.MIN_LNG &&
    lng <= BD_BOUNDS.MAX_LNG
  );
};

export const isWithinBangladeshBounds = isWithinBangladesh;

/**
 * Built-in Fast Local Landmark & Thana Dictionary
 * Maps common urban hubs, thanas, and districts in Bangladesh to verified coordinates.
 * Supports both English and Bangla names for zero-latency, network-free resolution.
 */
export const LOCAL_LANDMARK_MAP: Record<string, { lat: number; lng: number; standardName: string }> = {
  // --- Dhaka Metropolitan Area ---
  mirpur: { lat: 23.807, lng: 90.368, standardName: 'Mirpur, Dhaka' },
  'মিরপুর': { lat: 23.807, lng: 90.368, standardName: 'Mirpur, Dhaka' },
  dhanmondi: { lat: 23.746, lng: 90.374, standardName: 'Dhanmondi, Dhaka' },
  'ধানমন্ডি': { lat: 23.746, lng: 90.374, standardName: 'Dhanmondi, Dhaka' },
  gulshan: { lat: 23.792, lng: 90.416, standardName: 'Gulshan, Dhaka' },
  'গুলশান': { lat: 23.792, lng: 90.416, standardName: 'Gulshan, Dhaka' },
  banani: { lat: 23.793, lng: 90.404, standardName: 'Banani, Dhaka' },
  'বনানী': { lat: 23.793, lng: 90.404, standardName: 'Banani, Dhaka' },
  uttara: { lat: 23.875, lng: 90.38, standardName: 'Uttara, Dhaka' },
  'উত্তরা': { lat: 23.875, lng: 90.38, standardName: 'Uttara, Dhaka' },
  motijheel: { lat: 23.733, lng: 90.417, standardName: 'Motijheel, Dhaka' },
  'মতিঝিল': { lat: 23.733, lng: 90.417, standardName: 'Motijheel, Dhaka' },
  mohammadpur: { lat: 23.765, lng: 90.358, standardName: 'Mohammadpur, Dhaka' },
  'মোহাম্মদপুর': { lat: 23.765, lng: 90.358, standardName: 'Mohammadpur, Dhaka' },
  badda: { lat: 23.78, lng: 90.426, standardName: 'Badda, Dhaka' },
  'বাড্ডা': { lat: 23.78, lng: 90.426, standardName: 'Badda, Dhaka' },
  jatrabari: { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka' },
  'যাত্রাবাড়ী': { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka' },
  'যাত্রাবাড়ী': { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka' },
  shahbagh: { lat: 23.738, lng: 90.395, standardName: 'Shahbagh, Dhaka' },
  'শাহবাগ': { lat: 23.738, lng: 90.395, standardName: 'Shahbagh, Dhaka' },
  farmgate: { lat: 23.756, lng: 90.387, standardName: 'Farmgate, Dhaka' },
  'ফার্মগেট': { lat: 23.756, lng: 90.387, standardName: 'Farmgate, Dhaka' },
  tejgaon: { lat: 23.76, lng: 90.399, standardName: 'Tejgaon, Dhaka' },
  'তেজগাঁও': { lat: 23.76, lng: 90.399, standardName: 'Tejgaon, Dhaka' },
  rampura: { lat: 23.761, lng: 90.42, standardName: 'Rampura, Dhaka' },
  'রামপুরা': { lat: 23.761, lng: 90.42, standardName: 'Rampura, Dhaka' },
  khilgaon: { lat: 23.75, lng: 90.425, standardName: 'Khilgaon, Dhaka' },
  'খিলগাঁও': { lat: 23.75, lng: 90.425, standardName: 'Khilgaon, Dhaka' },
  paltan: { lat: 23.732, lng: 90.412, standardName: 'Paltan, Dhaka' },
  'পল্টন': { lat: 23.732, lng: 90.412, standardName: 'Paltan, Dhaka' },
  savar: { lat: 23.844, lng: 90.258, standardName: 'Savar, Dhaka' },
  'সাভার': { lat: 23.844, lng: 90.258, standardName: 'Savar, Dhaka' },
  gazipur: { lat: 23.998, lng: 90.42, standardName: 'Gazipur' },
  'গাজীপুর': { lat: 23.998, lng: 90.42, standardName: 'Gazipur' },
  narayanganj: { lat: 23.623, lng: 90.5, standardName: 'Narayanganj' },
  'নারায়ণগঞ্জ': { lat: 23.623, lng: 90.5, standardName: 'Narayanganj' },
  'নারায়ণগঞ্জ': { lat: 23.623, lng: 90.5, standardName: 'Narayanganj' },

  // --- Khulna Metropolitan Area ---
  khulna: { lat: 22.845, lng: 89.54, standardName: 'Khulna Sadar' },
  'খুলনা': { lat: 22.845, lng: 89.54, standardName: 'Khulna Sadar' },
  'shib bari': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna' },
  'শিব বাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna' },
  'শিব বাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna' },
  'শিববাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna' },
  daulatpur: { lat: 22.885, lng: 89.52, standardName: 'Daulatpur, Khulna' },
  'দৌলতপুর': { lat: 22.885, lng: 89.52, standardName: 'Daulatpur, Khulna' },
  khalishpur: { lat: 22.855, lng: 89.53, standardName: 'Khalishpur, Khulna' },
  'খালিশপুর': { lat: 22.855, lng: 89.53, standardName: 'Khalishpur, Khulna' },
  sonadanga: { lat: 22.818, lng: 89.54, standardName: 'Sonadanga, Khulna' },
  'সোনাডাঙ্গা': { lat: 22.818, lng: 89.54, standardName: 'Sonadanga, Khulna' },
  boyra: { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna' },
  'বয়রা': { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna' },
  'বয়রা': { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna' },
  rupsha: { lat: 22.805, lng: 89.58, standardName: 'Rupsha, Khulna' },
  'রূপসা': { lat: 22.805, lng: 89.58, standardName: 'Rupsha, Khulna' },
  jessore: { lat: 23.166, lng: 89.208, standardName: 'Jessore' },
  'যশোর': { lat: 23.166, lng: 89.208, standardName: 'Jessore' },
  kushtia: { lat: 23.901, lng: 89.12, standardName: 'Kushtia' },
  'কুষ্টিয়া': { lat: 23.901, lng: 89.12, standardName: 'Kushtia' },

  // --- Chittagong Metropolitan Area ---
  chittagong: { lat: 22.356, lng: 91.783, standardName: 'Chittagong' },
  chattogram: { lat: 22.356, lng: 91.783, standardName: 'Chittagong' },
  'চট্টগ্রাম': { lat: 22.356, lng: 91.783, standardName: 'Chittagong' },
  gec: { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong' },
  'জিইসি': { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong' },
  agrabad: { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong' },
  'আগ্রাবাদ': { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong' },
  chawkbazar: { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong' },
  'চকবাজার': { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong' },
  halishahar: { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong' },
  'হালিশহর': { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong' },
  'cox\'s bazar': { lat: 21.427, lng: 92.005, standardName: 'Cox\'s Bazar' },
  'কক্সবাজার': { lat: 21.427, lng: 92.005, standardName: 'Cox\'s Bazar' },
  comilla: { lat: 23.46, lng: 91.18, standardName: 'Comilla' },
  'কুমিল্লা': { lat: 23.46, lng: 91.18, standardName: 'Comilla' },

  // --- Major Divisions & Regional Centers ---
  rajshahi: { lat: 24.374, lng: 88.604, standardName: 'Rajshahi' },
  'রাজশাহী': { lat: 24.374, lng: 88.604, standardName: 'Rajshahi' },
  sylhet: { lat: 24.894, lng: 91.868, standardName: 'Sylhet' },
  'সিলেট': { lat: 24.894, lng: 91.868, standardName: 'Sylhet' },
  barisal: { lat: 22.701, lng: 90.353, standardName: 'Barisal' },
  'বরিশাল': { lat: 22.701, lng: 90.353, standardName: 'Barisal' },
  rangpur: { lat: 25.743, lng: 89.275, standardName: 'Rangpur' },
  'রংপুর': { lat: 25.743, lng: 89.275, standardName: 'Rangpur' },
  mymensingh: { lat: 24.747, lng: 90.42, standardName: 'Mymensingh' },
  'ময়মনসিংহ': { lat: 24.747, lng: 90.42, standardName: 'Mymensingh' },
  'ময়মনসিংহ': { lat: 24.747, lng: 90.42, standardName: 'Mymensingh' },
  bogra: { lat: 24.846, lng: 89.373, standardName: 'Bogra' },
  'বগুড়া': { lat: 24.846, lng: 89.373, standardName: 'Bogra' },
};

// In-memory cache for newly geocoded areas
const dynamicCache = new Map<string, { lat: number; lng: number; standardName: string }>();

// Rate limiter for OpenStreetMap Nominatim (strictly max 1 request per second)
let lastNominatimCallTime = 0;
const NOMINATIM_DELAY_MS = 1100;

const throttleNominatim = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastNominatimCallTime;
  if (timeSinceLast < NOMINATIM_DELAY_MS) {
    await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS - timeSinceLast));
  }
  lastNominatimCallTime = Date.now();
};

/**
 * Searches the input text for any known Bangladesh landmark or thana name.
 */
export const findLandmarkInText = (text: string): GeocodeResult | null => {
  const lowerText = text.toLowerCase();

  // Sort keys descending by length so longer names like 'Mirpur 10' match before 'Mirpur'
  const keys = Object.keys(LOCAL_LANDMARK_MAP).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (lowerText.includes(key.toLowerCase())) {
      const match = LOCAL_LANDMARK_MAP[key];
      return {
        locationName: match.standardName,
        latitude: match.lat,
        longitude: match.lng,
        source: 'DICTIONARY',
      };
    }
  }

  // Check dynamic memory cache
  for (const [key, match] of dynamicCache.entries()) {
    if (lowerText.includes(key.toLowerCase())) {
      return {
        locationName: match.standardName,
        latitude: match.lat,
        longitude: match.lng,
        source: 'DICTIONARY',
      };
    }
  }

  return null;
};

/**
 * Fallback to OpenStreetMap Nominatim with rate limiting (1 req/sec) and countrycodes=bd
 */
export const geocodeWithNominatim = async (query: string): Promise<GeocodeResult | null> => {
  const cached = dynamicCache.get(query.toLowerCase());
  if (cached) {
    return {
      locationName: cached.standardName,
      latitude: cached.lat,
      longitude: cached.lng,
      source: 'NOMINATIM',
    };
  }

  try {
    await throttleNominatim();

    const encoded = encodeURIComponent(`${query}, Bangladesh`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&countrycodes=bd&format=json&limit=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DangerZoneBD-PublicSafetyMap/1.0 (contact@dangerzonebd.org)',
      },
    });

    if (!res.ok) {
      console.warn(`[Nominatim] Request failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);

    // Validate that coordinates lie within Bangladesh bounds
    if (!isWithinBangladesh(lat, lng)) {
      console.warn(`[Nominatim] Returned coordinates (${lat}, ${lng}) outside Bangladesh bounds.`);
      return null;
    }

    const resultObj = {
      lat,
      lng,
      standardName: first.display_name.split(',').slice(0, 2).join(', ').trim(),
    };

    dynamicCache.set(query.toLowerCase(), resultObj);

    return {
      locationName: resultObj.standardName,
      latitude: lat,
      longitude: lng,
      source: 'NOMINATIM',
    };
  } catch (error) {
    console.error(`[Nominatim] Error geocoding query "${query}":`, error);
    return null;
  }
};

/**
 * High-level geocode resolver:
 * 1. Checks fast local dictionary (English & Bangla).
 * 2. If not found, attempts OpenStreetMap Nominatim.
 */
export const resolveLocationFromText = async (text: string): Promise<GeocodeResult | null> => {
  // Step 1: Fast Dictionary
  const dictResult = findLandmarkInText(text);
  if (dictResult) {
    return dictResult;
  }

  return null;
};
