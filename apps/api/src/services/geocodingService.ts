import { isForeignIncident } from './internationalIncidentFilter';

// Bangladesh Geocoding & Landmark Engine
// Bounding box for Bangladesh: Latitude: 20.5 to 26.7, Longitude: 88.0 to 92.7

/**
 * Normalizes Bengali text to eliminate decomposed nukta mismatches (e.g. য+় vs য়, ড+় vs ড়)
 */
export function normalizeBengali(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/\u09af\u09bc/g, '\u09df') // য + ় -> য়
    .replace(/\u09a1\u09bc/g, '\u09dc') // ড + ় -> ড়
    .replace(/\u09a2\u09bc/g, '\u09dd'); // ঢ + ় -> ঢ়
}

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
  // ==========================================
  // ALL 64 DISTRICTS OF BANGLADESH
  // ==========================================

  // --- Dhaka Division (13 Districts) ---
  dhaka: { lat: 23.8103, lng: 90.4125, standardName: 'Dhaka' },
  'ঢাকা': { lat: 23.8103, lng: 90.4125, standardName: 'Dhaka' },
  gazipur: { lat: 23.998, lng: 90.42, standardName: 'Gazipur' },
  'গাজীপুর': { lat: 23.998, lng: 90.42, standardName: 'Gazipur' },
  narayanganj: { lat: 23.6238, lng: 90.5, standardName: 'Narayanganj' },
  'নারায়ণগঞ্জ': { lat: 23.6238, lng: 90.5, standardName: 'Narayanganj' },
  'নারায়ণগঞ্জ': { lat: 23.6238, lng: 90.5, standardName: 'Narayanganj' },
  tangail: { lat: 24.2513, lng: 89.9167, standardName: 'Tangail' },
  'টাঙ্গাইল': { lat: 24.2513, lng: 89.9167, standardName: 'Tangail' },
  narsingdi: { lat: 23.9197, lng: 90.7202, standardName: 'Narsingdi' },
  'নরসিংদী': { lat: 23.9197, lng: 90.7202, standardName: 'Narsingdi' },
  faridpur: { lat: 23.6071, lng: 89.8429, standardName: 'Faridpur' },
  'ফরিদপুর': { lat: 23.6071, lng: 89.8429, standardName: 'Faridpur' },
  gopalganj: { lat: 23.0051, lng: 89.8266, standardName: 'Gopalganj' },
  'গোপালগঞ্জ': { lat: 23.0051, lng: 89.8266, standardName: 'Gopalganj' },
  kishoreganj: { lat: 24.4449, lng: 90.7766, standardName: 'Kishoreganj' },
  'কিশোরগঞ্জ': { lat: 24.4449, lng: 90.7766, standardName: 'Kishoreganj' },
  manikganj: { lat: 23.8617, lng: 90.0003, standardName: 'Manikganj' },
  'মানিকগঞ্জ': { lat: 23.8617, lng: 90.0003, standardName: 'Manikganj' },
  munshiganj: { lat: 23.5422, lng: 90.5305, standardName: 'Munshiganj' },
  'মুন্সীগঞ্জ': { lat: 23.5422, lng: 90.5305, standardName: 'Munshiganj' },
  'মুন্সিগঞ্জ': { lat: 23.5422, lng: 90.5305, standardName: 'Munshiganj' },
  rajbari: { lat: 23.7574, lng: 89.6445, standardName: 'Rajbari' },
  'রাজবাড়ী': { lat: 23.7574, lng: 89.6445, standardName: 'Rajbari' },
  'রাজবাড়ী': { lat: 23.7574, lng: 89.6445, standardName: 'Rajbari' },
  madaripur: { lat: 23.1641, lng: 90.1897, standardName: 'Madaripur' },
  'মাদারীপুর': { lat: 23.1641, lng: 90.1897, standardName: 'Madaripur' },
  shariatpur: { lat: 23.2423, lng: 90.3542, standardName: 'Shariatpur' },
  'শরীয়তপুর': { lat: 23.2423, lng: 90.3542, standardName: 'Shariatpur' },
  'শরীয়তপুর': { lat: 23.2423, lng: 90.3542, standardName: 'Shariatpur' },

  // --- Chittagong Division (11 Districts) ---
  chittagong: { lat: 22.3569, lng: 91.7832, standardName: 'Chittagong' },
  chattogram: { lat: 22.3569, lng: 91.7832, standardName: 'Chittagong' },
  'চট্টগ্রাম': { lat: 22.3569, lng: 91.7832, standardName: 'Chittagong' },
  'cox\'s bazar': { lat: 21.4272, lng: 92.0058, standardName: 'Cox\'s Bazar' },
  'coxs bazar': { lat: 21.4272, lng: 92.0058, standardName: 'Cox\'s Bazar' },
  'কক্সবাজার': { lat: 21.4272, lng: 92.0058, standardName: 'Cox\'s Bazar' },
  cumilla: { lat: 23.4607, lng: 91.1809, standardName: 'Cumilla' },
  comilla: { lat: 23.4607, lng: 91.1809, standardName: 'Cumilla' },
  'কুমিল্লা': { lat: 23.4607, lng: 91.1809, standardName: 'Cumilla' },
  chandpur: { lat: 23.2333, lng: 90.6667, standardName: 'Chandpur' },
  'চাঁদপুর': { lat: 23.2333, lng: 90.6667, standardName: 'Chandpur' },
  feni: { lat: 23.0186, lng: 91.3966, standardName: 'Feni' },
  'ফেনী': { lat: 23.0186, lng: 91.3966, standardName: 'Feni' },
  noakhali: { lat: 22.8696, lng: 91.0993, standardName: 'Noakhali' },
  'নোয়াখালী': { lat: 22.8696, lng: 91.0993, standardName: 'Noakhali' },
  'নোয়াখালী': { lat: 22.8696, lng: 91.0993, standardName: 'Noakhali' },
  brahmanbaria: { lat: 23.9571, lng: 91.1119, standardName: 'Brahmanbaria' },
  'ব্রাহ্মণবাড়িয়া': { lat: 23.9571, lng: 91.1119, standardName: 'Brahmanbaria' },
  'ব্রাহ্মণবাড়িয়া': { lat: 23.9571, lng: 91.1119, standardName: 'Brahmanbaria' },
  lakshmipur: { lat: 22.9425, lng: 90.8412, standardName: 'Lakshmipur' },
  'লক্ষ্মীপুর': { lat: 22.9425, lng: 90.8412, standardName: 'Lakshmipur' },
  bandarban: { lat: 22.1953, lng: 92.2184, standardName: 'Bandarban' },
  'বান্দরবান': { lat: 22.1953, lng: 92.2184, standardName: 'Bandarban' },
  khagrachhari: { lat: 23.1193, lng: 91.9847, standardName: 'Khagrachhari' },
  'খাগড়াছড়ি': { lat: 23.1193, lng: 91.9847, standardName: 'Khagrachhari' },
  'খাগড়াছড়ি': { lat: 23.1193, lng: 91.9847, standardName: 'Khagrachhari' },
  rangamati: { lat: 22.6533, lng: 92.1753, standardName: 'Rangamati' },
  'রাঙ্গামাটি': { lat: 22.6533, lng: 92.1753, standardName: 'Rangamati' },
  'রাঙামাটি': { lat: 22.6533, lng: 92.1753, standardName: 'Rangamati' },

  // --- Rajshahi Division (8 Districts) ---
  rajshahi: { lat: 24.3745, lng: 88.6042, standardName: 'Rajshahi' },
  'রাজশাহী': { lat: 24.3745, lng: 88.6042, standardName: 'Rajshahi' },
  bogra: { lat: 24.8465, lng: 89.373, standardName: 'Bogra' },
  bogura: { lat: 24.8465, lng: 89.373, standardName: 'Bogra' },
  'বগুড়া': { lat: 24.8465, lng: 89.373, standardName: 'Bogra' },
  'বগুড়া': { lat: 24.8465, lng: 89.373, standardName: 'Bogra' },
  pabna: { lat: 24.0064, lng: 89.2372, standardName: 'Pabna' },
  'পাবনা': { lat: 24.0064, lng: 89.2372, standardName: 'Pabna' },
  sirajganj: { lat: 24.4534, lng: 89.7008, standardName: 'Sirajganj' },
  'সিরাজগঞ্জ': { lat: 24.4534, lng: 89.7008, standardName: 'Sirajganj' },
  naogaon: { lat: 24.7936, lng: 88.9318, standardName: 'Naogaon' },
  'নওগাঁ': { lat: 24.7936, lng: 88.9318, standardName: 'Naogaon' },
  natore: { lat: 24.4206, lng: 88.9324, standardName: 'Natore' },
  'নাটোর': { lat: 24.4206, lng: 88.9324, standardName: 'Natore' },
  chapainawabganj: { lat: 24.5965, lng: 88.2776, standardName: 'Chapainawabganj' },
  'চাঁপাইনবাবগঞ্জ': { lat: 24.5965, lng: 88.2776, standardName: 'Chapainawabganj' },
  'নবাবগঞ্জ': { lat: 24.5965, lng: 88.2776, standardName: 'Chapainawabganj' },
  joypurhat: { lat: 25.1015, lng: 89.0277, standardName: 'Joypurhat' },
  'জয়পুরহাট': { lat: 25.1015, lng: 89.0277, standardName: 'Joypurhat' },
  'জয়পুরহাট': { lat: 25.1015, lng: 89.0277, standardName: 'Joypurhat' },

  // --- Khulna Division (10 Districts) ---
  khulna: { lat: 22.8456, lng: 89.5403, standardName: 'Khulna' },
  'খুলনা': { lat: 22.8456, lng: 89.5403, standardName: 'Khulna' },
  jessore: { lat: 23.1664, lng: 89.2081, standardName: 'Jessore' },
  jashore: { lat: 23.1664, lng: 89.2081, standardName: 'Jessore' },
  'যশোর': { lat: 23.1664, lng: 89.2081, standardName: 'Jessore' },
  kushtia: { lat: 23.9013, lng: 89.1205, standardName: 'Kushtia' },
  'কুষ্টিয়া': { lat: 23.9013, lng: 89.1205, standardName: 'Kushtia' },
  'কুষ্টিয়া': { lat: 23.9013, lng: 89.1205, standardName: 'Kushtia' },
  satkhira: { lat: 22.7185, lng: 89.0705, standardName: 'Satkhira' },
  'সাতক্ষীরা': { lat: 22.7185, lng: 89.0705, standardName: 'Satkhira' },
  bagerhat: { lat: 22.6516, lng: 89.7859, standardName: 'Bagerhat' },
  'বাগেরহাট': { lat: 22.6516, lng: 89.7859, standardName: 'Bagerhat' },
  jhenaidah: { lat: 23.545, lng: 89.1726, standardName: 'Jhenaidah' },
  'ঝিনাইদহ': { lat: 23.545, lng: 89.1726, standardName: 'Jhenaidah' },
  magura: { lat: 23.4873, lng: 89.4198, standardName: 'Magura' },
  'মাগুরা': { lat: 23.4873, lng: 89.4198, standardName: 'Magura' },
  narail: { lat: 23.1725, lng: 89.5127, standardName: 'Narail' },
  'নড়াইল': { lat: 23.1725, lng: 89.5127, standardName: 'Narail' },
  'নড়াইল': { lat: 23.1725, lng: 89.5127, standardName: 'Narail' },
  chuadanga: { lat: 23.6402, lng: 88.8418, standardName: 'Chuadanga' },
  'চুয়াডাঙ্গা': { lat: 23.6402, lng: 88.8418, standardName: 'Chuadanga' },
  'চুয়াডাঙ্গা': { lat: 23.6402, lng: 88.8418, standardName: 'Chuadanga' },
  meherpur: { lat: 23.7622, lng: 88.6318, standardName: 'Meherpur' },
  'মেহেরপুর': { lat: 23.7622, lng: 88.6318, standardName: 'Meherpur' },

  // --- Barisal Division (6 Districts) ---
  barisal: { lat: 22.701, lng: 90.3535, standardName: 'Barisal' },
  barishal: { lat: 22.701, lng: 90.3535, standardName: 'Barisal' },
  'বরিশাল': { lat: 22.701, lng: 90.3535, standardName: 'Barisal' },
  patuakhali: { lat: 22.3596, lng: 90.3299, standardName: 'Patuakhali' },
  'পটুয়াখালী': { lat: 22.3596, lng: 90.3299, standardName: 'Patuakhali' },
  'পটুয়াখালী': { lat: 22.3596, lng: 90.3299, standardName: 'Patuakhali' },
  bhola: { lat: 22.6859, lng: 90.6482, standardName: 'Bhola' },
  'ভোলা': { lat: 22.6859, lng: 90.6482, standardName: 'Bhola' },
  pirojpur: { lat: 22.5841, lng: 89.972, standardName: 'Pirojpur' },
  'পিরোজপুর': { lat: 22.5841, lng: 89.972, standardName: 'Pirojpur' },
  barguna: { lat: 22.0953, lng: 90.077, standardName: 'Barguna' },
  'বরগুনা': { lat: 22.0953, lng: 90.077, standardName: 'Barguna' },
  jhalokati: { lat: 22.6406, lng: 90.1987, standardName: 'Jhalokati' },
  jhalakathi: { lat: 22.6406, lng: 90.1987, standardName: 'Jhalokati' },
  'ঝালকাঠি': { lat: 22.6406, lng: 90.1987, standardName: 'Jhalokati' },
  'ঝালকাঠী': { lat: 22.6406, lng: 90.1987, standardName: 'Jhalokati' },

  // --- Sylhet Division (4 Districts) ---
  sylhet: { lat: 24.8949, lng: 91.8687, standardName: 'Sylhet' },
  'সিলেট': { lat: 24.8949, lng: 91.8687, standardName: 'Sylhet' },
  moulvibazar: { lat: 24.4829, lng: 91.7774, standardName: 'Moulvibazar' },
  maulvibazar: { lat: 24.4829, lng: 91.7774, standardName: 'Moulvibazar' },
  'মৌলভীবাজার': { lat: 24.4829, lng: 91.7774, standardName: 'Moulvibazar' },
  habiganj: { lat: 24.3749, lng: 91.4155, standardName: 'Habiganj' },
  'হবিগঞ্জ': { lat: 24.3749, lng: 91.4155, standardName: 'Habiganj' },
  sunamganj: { lat: 25.0658, lng: 91.395, standardName: 'Sunamganj' },
  'সুনামগঞ্জ': { lat: 25.0658, lng: 91.395, standardName: 'Sunamganj' },

  // --- Rangpur Division (8 Districts) ---
  rangpur: { lat: 25.7439, lng: 89.2752, standardName: 'Rangpur' },
  'রংপুর': { lat: 25.7439, lng: 89.2752, standardName: 'Rangpur' },
  dinajpur: { lat: 25.6217, lng: 88.6355, standardName: 'Dinajpur' },
  'দিনাজপুর': { lat: 25.6217, lng: 88.6355, standardName: 'Dinajpur' },
  kurigram: { lat: 25.8054, lng: 89.6362, standardName: 'Kurigram' },
  'কুড়িগ্রাম': { lat: 25.8054, lng: 89.6362, standardName: 'Kurigram' },
  'কুড়িগ্রাম': { lat: 25.8054, lng: 89.6362, standardName: 'Kurigram' },
  gaibandha: { lat: 25.3288, lng: 89.5406, standardName: 'Gaibandha' },
  'গাইবান্ধা': { lat: 25.3288, lng: 89.5406, standardName: 'Gaibandha' },
  nilphamari: { lat: 25.9318, lng: 88.856, standardName: 'Nilphamari' },
  'নীলফামারী': { lat: 25.9318, lng: 88.856, standardName: 'Nilphamari' },
  lalmonirhat: { lat: 25.9923, lng: 89.2847, standardName: 'Lalmonirhat' },
  'লালমনিরহাট': { lat: 25.9923, lng: 89.2847, standardName: 'Lalmonirhat' },
  panchagarh: { lat: 26.3411, lng: 88.5542, standardName: 'Panchagarh' },
  'পঞ্চগড়': { lat: 26.3411, lng: 88.5542, standardName: 'Panchagarh' },
  'পঞ্চগড়': { lat: 26.3411, lng: 88.5542, standardName: 'Panchagarh' },
  thakurgaon: { lat: 26.0337, lng: 88.4617, standardName: 'Thakurgaon' },
  'ঠাকুরগাঁও': { lat: 26.0337, lng: 88.4617, standardName: 'Thakurgaon' },

  // --- Mymensingh Division (4 Districts) ---
  mymensingh: { lat: 24.7471, lng: 90.4203, standardName: 'Mymensingh' },
  'ময়মনসিংহ': { lat: 24.7471, lng: 90.4203, standardName: 'Mymensingh' },
  'ময়মনসিংহ': { lat: 24.7471, lng: 90.4203, standardName: 'Mymensingh' },
  jamalpur: { lat: 24.9375, lng: 89.9378, standardName: 'Jamalpur' },
  'জামালপুর': { lat: 24.9375, lng: 89.9378, standardName: 'Jamalpur' },
  netrokona: { lat: 24.8709, lng: 90.7279, standardName: 'Netrokona' },
  'নেত্রকোনা': { lat: 24.8709, lng: 90.7279, standardName: 'Netrokona' },
  'নেত্রকোণা': { lat: 24.8709, lng: 90.7279, standardName: 'Netrokona' },
  sherpur: { lat: 25.0205, lng: 90.0153, standardName: 'Sherpur' },
  'শেরপুর': { lat: 25.0205, lng: 90.0153, standardName: 'Sherpur' },

  // ==========================================
  // PROMINENT CRIME/ACCIDENT HUBS & THANAS
  // ==========================================

  // --- Coastal, Tourist & Frontier Spots ---
  kuakata: { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali' },
  'কুয়াকাটা': { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali' },
  'কুয়াকাটা': { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali' },
  teknaf: { lat: 20.8583, lng: 92.2981, standardName: 'Teknaf, Cox\'s Bazar' },
  'টেকনাফ': { lat: 20.8583, lng: 92.2981, standardName: 'Teknaf, Cox\'s Bazar' },
  ukhia: { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar' },
  'উখিয়া': { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar' },
  'উখিয়া': { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar' },
  sreemangal: { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar' },
  srimangal: { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar' },
  'শ্রীমঙ্গল': { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar' },
  'saint martin': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island' },
  'সেন্টমার্টিন': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island' },
  'সেন্ট মার্টিন': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island' },
  sajek: { lat: 23.3822, lng: 92.2938, standardName: 'Sajek, Rangamati' },
  'সাজেক': { lat: 23.3822, lng: 92.2938, standardName: 'Sajek, Rangamati' },
  jaflong: { lat: 25.1633, lng: 92.0167, standardName: 'Jaflong, Sylhet' },
  'জাফলং': { lat: 25.1633, lng: 92.0167, standardName: 'Jaflong, Sylhet' },

  // --- Dhaka Metropolitan Area Neighborhoods & Thanas ---
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
  ashulia: { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka' },
  'আশুলিয়া': { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka' },
  'আশুলিয়া': { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka' },
  tongi: { lat: 23.8974, lng: 90.4024, standardName: 'Tongi, Gazipur' },
  'টঙ্গী': { lat: 23.8974, lng: 90.4024, standardName: 'Tongi, Gazipur' },
  keraniganj: { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka' },
  'কেরানীগঞ্জ': { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka' },
  'কেরানিগঞ্জ': { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka' },

  // --- Chittagong Thanas & Industrial Belts ---
  gec: { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong' },
  'জিইসি': { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong' },
  agrabad: { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong' },
  'আগ্রাবাদ': { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong' },
  chawkbazar: { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong' },
  'চকবাজার': { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong' },
  halishahar: { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong' },
  'হালিশহর': { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong' },
  sitakunda: { lat: 22.6158, lng: 91.6606, standardName: 'Sitakunda, Chittagong' },
  'সীতাকুণ্ড': { lat: 22.6158, lng: 91.6606, standardName: 'Sitakunda, Chittagong' },
  mirsarai: { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong' },
  mirsharai: { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong' },
  'মীরসরাই': { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong' },
  hathazari: { lat: 22.5089, lng: 91.805, standardName: 'Hathazari, Chittagong' },
  'হাটহাজারী': { lat: 22.5089, lng: 91.805, standardName: 'Hathazari, Chittagong' },

  // --- Khulna Metropolitan Thanas ---
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

  // --- Major Transit, Highway & Port Hubs ---
  benapole: { lat: 23.0333, lng: 88.8917, standardName: 'Benapole, Jessore' },
  'বেনাপোল': { lat: 23.0333, lng: 88.8917, standardName: 'Benapole, Jessore' },
  mongla: { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat' },
  'মোংলা': { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat' },
  'মংলা': { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat' },
  bhairab: { lat: 24.0489, lng: 90.9856, standardName: 'Bhairab, Kishoreganj' },
  'ভৈরব': { lat: 24.0489, lng: 90.9856, standardName: 'Bhairab, Kishoreganj' },
  ishwardi: { lat: 24.1294, lng: 89.0683, standardName: 'Ishwardi, Pabna' },
  'ঈশ্বরদী': { lat: 24.1294, lng: 89.0683, standardName: 'Ishwardi, Pabna' },
  saidpur: { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari' },
  'সৈয়দপুর': { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari' },
  'সৈয়দপুর': { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari' },
  shombhugonj: { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh' },
  shambhuganj: { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh' },
  'শম্ভুগঞ্জ': { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh' },
  trishal: { lat: 24.5819, lng: 90.3956, standardName: 'Trishal, Mymensingh' },
  'ত্রিশাল': { lat: 24.5819, lng: 90.3956, standardName: 'Trishal, Mymensingh' },
  bhaluka: { lat: 24.375, lng: 90.3778, standardName: 'Bhaluka, Mymensingh' },
  'ভালুকা': { lat: 24.375, lng: 90.3778, standardName: 'Bhaluka, Mymensingh' },
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
  const cleanInput = normalizeBengali(text).toLowerCase();

  // Sort keys descending by length so longer names like 'Mirpur 10' match before 'Mirpur'
  const keys = Object.keys(LOCAL_LANDMARK_MAP).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const cleanKey = normalizeBengali(key).toLowerCase();

    // For English keys (letters, digits, spaces, hyphens, apostrophes), require word boundaries
    // so that words like "feni" won't match inside "defending", etc.
    if (/^[a-z0-9\s'-]+$/.test(cleanKey)) {
      const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(cleanInput)) {
        const match = LOCAL_LANDMARK_MAP[key];
        return {
          locationName: match.standardName,
          latitude: match.lat,
          longitude: match.lng,
          source: 'DICTIONARY',
        };
      }
    } else {
      // For Bengali: grammatical inflections are attached directly (e.g. ময়মনসিংহে, চাঁদপুরে, কুয়াকাটায়, সিলেটে)
      // substring matching is the linguistically correct approach.
      if (cleanInput.includes(cleanKey)) {
        const match = LOCAL_LANDMARK_MAP[key];
        return {
          locationName: match.standardName,
          latitude: match.lat,
          longitude: match.lng,
          source: 'DICTIONARY',
        };
      }
    }
  }

  // Check dynamic memory cache
  for (const [key, match] of dynamicCache.entries()) {
    const cleanKey = normalizeBengali(key).toLowerCase();
    if (cleanInput.includes(cleanKey)) {
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
 * Determines if a matched location in the text refers merely to a casualty's origin/residence
 * (e.g. "নিহতদের বাড়ি কক্সবাজারে", "গ্রামের বাড়ি চকরিয়ায়") rather than the actual incident scene.
 */
export function isVictimOriginContext(text: string, locationName: string): boolean {
  if (!text) return false;
  const normText = text.normalize('NFC').toLowerCase();
  const lowerLoc = locationName.toLowerCase();

  const originTerms = [
    'বাড়ি',
    'বাড়ি',
    'গ্রামের বাড়ি',
    'গ্রামের বাড়ি',
    'বাসিন্দা',
    'নিবাসী',
    'পৈতৃক',
    'স্বজন',
    'পরিবার',
    'লাশ',
    'মরদেহ',
    'দাফন',
  ];

  for (const term of originTerms) {
    const patternBefore = new RegExp(`(?:${term})[\\s\\S]{0,35}?(?:${lowerLoc})`, 'i');
    const patternAfter = new RegExp(`(?:${lowerLoc})[\\s\\S]{0,35}?(?:${term})`, 'i');
    if (patternBefore.test(normText) || patternAfter.test(normText)) {
      return true;
    }
  }

  return false;
}

/**
 * High-level domestic geocode resolver:
 * 1. Rejects international/foreign events (USA, Saudi, UK, Canada, India, etc.) -> returns null (pins nothing).
 * 2. Matches the headline first (highest confidence incident location).
 * 3. If checking snippet, ensures the location is an actual crash/crime scene and NOT a victim origin address.
 */
export const resolveLocationFromText = async (
  titleOrCombined: string,
  snippet?: string
): Promise<GeocodeResult | null> => {
  const title = titleOrCombined || '';
  const body = snippet || '';

  // 1. Universal Global Foreign Incident Filter:
  // If an incident happened in USA, Saudi Arabia, UK, Canada, India, etc., pin NOTHING in Bangladesh!
  const foreignCheck = isForeignIncident(title, body);
  if (foreignCheck.isForeign) {
    return null;
  }

  // 2. Headline Priority Match:
  // In professional journalism, the incident location is almost always in the headline
  const headlineMatch = findLandmarkInText(title);
  if (headlineMatch) {
    return headlineMatch;
  }

  // 3. Snippet inspection:
  // If body snippet is provided, ensure matched location is NOT merely the victim's hometown
  if (body) {
    const snippetMatch = findLandmarkInText(body);
    if (snippetMatch) {
      if (isVictimOriginContext(body, snippetMatch.locationName)) {
        // Matched location is victim's residence, NOT the accident location. Pin nothing!
        return null;
      }
      return snippetMatch;
    }
  } else if (!snippet) {
    // Single combined string fallback
    const combinedMatch = findLandmarkInText(titleOrCombined);
    if (combinedMatch) {
      if (isVictimOriginContext(titleOrCombined, combinedMatch.locationName)) {
        return null;
      }
      return combinedMatch;
    }
  }

  return null;
};
