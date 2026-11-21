import { isForeignIncident } from './internationalIncidentFilter';
import upazilasData from '../data/bangladesh_upazilas.json';

export interface UpazilaRecord {
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

const ALL_UPAZILAS: UpazilaRecord[] = upazilasData as UpazilaRecord[];

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
  district?: string;
  upazila?: string;
  division?: string;
  locationPrecision: 'EXACT' | 'UPAZILA' | 'DISTRICT' | 'AMBIGUOUS';
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
export interface LandmarkEntry {
  lat: number;
  lng: number;
  standardName: string;
  adminLevel?: 'LOCALITY' | 'THANA' | 'DISTRICT' | 'DIVISION' | 'HOSPITAL';
}

export const LOCAL_LANDMARK_MAP: Record<string, LandmarkEntry> = {
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
  kuakata: { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali', adminLevel: 'THANA' },
  'কুয়াকাটা': { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali', adminLevel: 'THANA' },
  'কুয়াকাটা': { lat: 21.8211, lng: 90.1206, standardName: 'Kuakata, Patuakhali', adminLevel: 'THANA' },
  teknaf: { lat: 20.8583, lng: 92.2981, standardName: 'Teknaf, Cox\'s Bazar', adminLevel: 'THANA' },
  'টেকনাফ': { lat: 20.8583, lng: 92.2981, standardName: 'Teknaf, Cox\'s Bazar', adminLevel: 'THANA' },
  ukhia: { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar', adminLevel: 'THANA' },
  'উখিয়া': { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar', adminLevel: 'THANA' },
  'উখিয়া': { lat: 21.2858, lng: 92.1466, standardName: 'Ukhia, Cox\'s Bazar', adminLevel: 'THANA' },
  chakaria: { lat: 21.4272, lng: 92.0858, standardName: 'Chakaria, Cox\'s Bazar', adminLevel: 'THANA' },
  'চকরিয়া': { lat: 21.4272, lng: 92.0858, standardName: 'Chakaria, Cox\'s Bazar', adminLevel: 'THANA' },
  'চকোরিয়া': { lat: 21.4272, lng: 92.0858, standardName: 'Chakaria, Cox\'s Bazar', adminLevel: 'THANA' },
  'চকোরিয়া': { lat: 21.4272, lng: 92.0858, standardName: 'Chakaria, Cox\'s Bazar', adminLevel: 'THANA' },
  sreemangal: { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar', adminLevel: 'THANA' },
  srimangal: { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar', adminLevel: 'THANA' },
  'শ্রীমঙ্গল': { lat: 24.3065, lng: 91.7296, standardName: 'Sreemangal, Moulvibazar', adminLevel: 'THANA' },
  'saint martin': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island', adminLevel: 'THANA' },
  'সেন্টমার্টিন': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island', adminLevel: 'THANA' },
  'সেন্ট মার্টিন': { lat: 20.6272, lng: 92.3225, standardName: 'Saint Martin\'s Island', adminLevel: 'THANA' },
  sajek: { lat: 23.3822, lng: 92.2938, standardName: 'Sajek, Rangamati', adminLevel: 'THANA' },
  'সাজেক': { lat: 23.3822, lng: 92.2938, standardName: 'Sajek, Rangamati', adminLevel: 'THANA' },
  jaflong: { lat: 25.1633, lng: 92.0167, standardName: 'Jaflong, Sylhet', adminLevel: 'THANA' },
  'জাফলং': { lat: 25.1633, lng: 92.0167, standardName: 'Jaflong, Sylhet', adminLevel: 'THANA' },

  // --- Dhaka Metropolitan Area Neighborhoods & Thanas ---
  mirpur: { lat: 23.807, lng: 90.368, standardName: 'Mirpur, Dhaka', adminLevel: 'THANA' },
  'মিরপুর': { lat: 23.807, lng: 90.368, standardName: 'Mirpur, Dhaka', adminLevel: 'THANA' },
  dhanmondi: { lat: 23.746, lng: 90.374, standardName: 'Dhanmondi, Dhaka', adminLevel: 'THANA' },
  'ধানমন্ডি': { lat: 23.746, lng: 90.374, standardName: 'Dhanmondi, Dhaka', adminLevel: 'THANA' },
  gulshan: { lat: 23.792, lng: 90.416, standardName: 'Gulshan, Dhaka', adminLevel: 'THANA' },
  'গুলশান': { lat: 23.792, lng: 90.416, standardName: 'Gulshan, Dhaka', adminLevel: 'THANA' },
  banani: { lat: 23.793, lng: 90.404, standardName: 'Banani, Dhaka', adminLevel: 'THANA' },
  'বনানী': { lat: 23.793, lng: 90.404, standardName: 'Banani, Dhaka', adminLevel: 'THANA' },
  uttara: { lat: 23.875, lng: 90.38, standardName: 'Uttara, Dhaka', adminLevel: 'THANA' },
  'উত্তরা': { lat: 23.875, lng: 90.38, standardName: 'Uttara, Dhaka', adminLevel: 'THANA' },
  motijheel: { lat: 23.733, lng: 90.417, standardName: 'Motijheel, Dhaka', adminLevel: 'THANA' },
  'মতিঝিল': { lat: 23.733, lng: 90.417, standardName: 'Motijheel, Dhaka', adminLevel: 'THANA' },
  mohammadpur: { lat: 23.765, lng: 90.358, standardName: 'Mohammadpur, Dhaka', adminLevel: 'THANA' },
  'মোহাম্মদপুর': { lat: 23.765, lng: 90.358, standardName: 'Mohammadpur, Dhaka', adminLevel: 'THANA' },
  badda: { lat: 23.78, lng: 90.426, standardName: 'Badda, Dhaka', adminLevel: 'THANA' },
  'বাড্ডা': { lat: 23.78, lng: 90.426, standardName: 'Badda, Dhaka', adminLevel: 'THANA' },
  jatrabari: { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka', adminLevel: 'THANA' },
  'যাত্রাবাড়ী': { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka', adminLevel: 'THANA' },
  'যাত্রাবাড়ী': { lat: 23.711, lng: 90.434, standardName: 'Jatrabari, Dhaka', adminLevel: 'THANA' },
  shahbagh: { lat: 23.738, lng: 90.395, standardName: 'Shahbagh, Dhaka', adminLevel: 'THANA' },
  'শাহবাগ': { lat: 23.738, lng: 90.395, standardName: 'Shahbagh, Dhaka', adminLevel: 'THANA' },
  farmgate: { lat: 23.756, lng: 90.387, standardName: 'Farmgate, Dhaka', adminLevel: 'THANA' },
  'ফার্মগেট': { lat: 23.756, lng: 90.387, standardName: 'Farmgate, Dhaka', adminLevel: 'THANA' },
  tejgaon: { lat: 23.76, lng: 90.399, standardName: 'Tejgaon, Dhaka', adminLevel: 'THANA' },
  'তেজগাঁও': { lat: 23.76, lng: 90.399, standardName: 'Tejgaon, Dhaka', adminLevel: 'THANA' },
  rampura: { lat: 23.761, lng: 90.42, standardName: 'Rampura, Dhaka', adminLevel: 'THANA' },
  'রামপুরা': { lat: 23.761, lng: 90.42, standardName: 'Rampura, Dhaka', adminLevel: 'THANA' },
  khilgaon: { lat: 23.75, lng: 90.425, standardName: 'Khilgaon, Dhaka', adminLevel: 'THANA' },
  'খিলগাঁও': { lat: 23.75, lng: 90.425, standardName: 'Khilgaon, Dhaka', adminLevel: 'THANA' },
  paltan: { lat: 23.732, lng: 90.412, standardName: 'Paltan, Dhaka', adminLevel: 'THANA' },
  'পল্টন': { lat: 23.732, lng: 90.412, standardName: 'Paltan, Dhaka', adminLevel: 'THANA' },
  savar: { lat: 23.844, lng: 90.258, standardName: 'Savar, Dhaka', adminLevel: 'THANA' },
  'সাভার': { lat: 23.844, lng: 90.258, standardName: 'Savar, Dhaka', adminLevel: 'THANA' },
  ashulia: { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka', adminLevel: 'THANA' },
  'আশুলিয়া': { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka', adminLevel: 'THANA' },
  'আশুলিয়া': { lat: 23.9015, lng: 90.3275, standardName: 'Ashulia, Dhaka', adminLevel: 'THANA' },
  tongi: { lat: 23.8974, lng: 90.4024, standardName: 'Tongi, Gazipur', adminLevel: 'THANA' },
  'টঙ্গী': { lat: 23.8974, lng: 90.4024, standardName: 'Tongi, Gazipur', adminLevel: 'THANA' },
  keraniganj: { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka', adminLevel: 'THANA' },
  'কেরানীগঞ্জ': { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka', adminLevel: 'THANA' },
  'কেরানিগঞ্জ': { lat: 23.6811, lng: 90.3475, standardName: 'Keraniganj, Dhaka', adminLevel: 'THANA' },

  // --- Chittagong Thanas & Industrial Belts ---
  gec: { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong', adminLevel: 'THANA' },
  'জিইসি': { lat: 22.359, lng: 91.821, standardName: 'GEC Circle, Chittagong', adminLevel: 'THANA' },
  agrabad: { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong', adminLevel: 'THANA' },
  'আগ্রাবাদ': { lat: 22.327, lng: 91.812, standardName: 'Agrabad, Chittagong', adminLevel: 'THANA' },
  chawkbazar: { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong', adminLevel: 'THANA' },
  'চকবাজার': { lat: 22.358, lng: 91.841, standardName: 'Chawkbazar, Chittagong', adminLevel: 'THANA' },
  halishahar: { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong', adminLevel: 'THANA' },
  'হালিশহর': { lat: 22.324, lng: 91.782, standardName: 'Halishahar, Chittagong', adminLevel: 'THANA' },
  sitakunda: { lat: 22.6158, lng: 91.6606, standardName: 'Sitakunda, Chittagong', adminLevel: 'THANA' },
  'সীতাকুণ্ড': { lat: 22.6158, lng: 91.6606, standardName: 'Sitakunda, Chittagong', adminLevel: 'THANA' },
  mirsarai: { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong', adminLevel: 'THANA' },
  mirsharai: { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong', adminLevel: 'THANA' },
  'মীরসরাই': { lat: 22.7711, lng: 91.575, standardName: 'Mirsarai, Chittagong', adminLevel: 'THANA' },
  hathazari: { lat: 22.5089, lng: 91.805, standardName: 'Hathazari, Chittagong', adminLevel: 'THANA' },
  'হাটহাজারী': { lat: 22.5089, lng: 91.805, standardName: 'Hathazari, Chittagong', adminLevel: 'THANA' },

  // --- Khulna Metropolitan Thanas ---
  'shib bari': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna', adminLevel: 'THANA' },
  'শিব বাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna', adminLevel: 'THANA' },
  'শিব বাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna', adminLevel: 'THANA' },
  'শিববাড়ি': { lat: 22.825, lng: 89.553, standardName: 'Shib Bari, Khulna', adminLevel: 'THANA' },
  daulatpur: { lat: 22.885, lng: 89.52, standardName: 'Daulatpur, Khulna', adminLevel: 'THANA' },
  'দৌলতপুর': { lat: 22.885, lng: 89.52, standardName: 'Daulatpur, Khulna', adminLevel: 'THANA' },
  khalishpur: { lat: 22.855, lng: 89.53, standardName: 'Khalishpur, Khulna', adminLevel: 'THANA' },
  'খালিশপুর': { lat: 22.855, lng: 89.53, standardName: 'Khalishpur, Khulna', adminLevel: 'THANA' },
  sonadanga: { lat: 22.818, lng: 89.54, standardName: 'Sonadanga, Khulna', adminLevel: 'THANA' },
  'সোনাডাঙ্গা': { lat: 22.818, lng: 89.54, standardName: 'Sonadanga, Khulna', adminLevel: 'THANA' },
  boyra: { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna', adminLevel: 'THANA' },
  'বয়রা': { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna', adminLevel: 'THANA' },
  'বয়রা': { lat: 22.835, lng: 89.538, standardName: 'Boyra, Khulna', adminLevel: 'THANA' },
  rupsha: { lat: 22.805, lng: 89.58, standardName: 'Rupsha, Khulna', adminLevel: 'THANA' },
  'রূপসা': { lat: 22.805, lng: 89.58, standardName: 'Rupsha, Khulna', adminLevel: 'THANA' },

  // --- Major Transit, Highway & Port Hubs ---
  benapole: { lat: 23.0333, lng: 88.8917, standardName: 'Benapole, Jessore', adminLevel: 'THANA' },
  'বেনাপোল': { lat: 23.0333, lng: 88.8917, standardName: 'Benapole, Jessore', adminLevel: 'THANA' },
  mongla: { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat', adminLevel: 'THANA' },
  'মোংলা': { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat', adminLevel: 'THANA' },
  'মংলা': { lat: 22.4897, lng: 89.6053, standardName: 'Mongla, Bagerhat', adminLevel: 'THANA' },
  bhairab: { lat: 24.0489, lng: 90.9856, standardName: 'Bhairab, Kishoreganj', adminLevel: 'THANA' },
  'ভৈরব': { lat: 24.0489, lng: 90.9856, standardName: 'Bhairab, Kishoreganj', adminLevel: 'THANA' },
  ishwardi: { lat: 24.1294, lng: 89.0683, standardName: 'Ishwardi, Pabna', adminLevel: 'THANA' },
  'ঈশ্বরদী': { lat: 24.1294, lng: 89.0683, standardName: 'Ishwardi, Pabna', adminLevel: 'THANA' },
  saidpur: { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari', adminLevel: 'THANA' },
  'সৈয়দপুর': { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari', adminLevel: 'THANA' },
  'সৈয়দপুর': { lat: 25.7785, lng: 88.8917, standardName: 'Saidpur, Nilphamari', adminLevel: 'THANA' },
  shombhugonj: { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh', adminLevel: 'THANA' },
  shambhuganj: { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh', adminLevel: 'THANA' },
  'শম্ভুগঞ্জ': { lat: 24.7505, lng: 90.435, standardName: 'Shombhugonj, Mymensingh', adminLevel: 'THANA' },
  trishal: { lat: 24.5819, lng: 90.3956, standardName: 'Trishal, Mymensingh', adminLevel: 'THANA' },
  'ত্রিশাল': { lat: 24.5819, lng: 90.3956, standardName: 'Trishal, Mymensingh', adminLevel: 'THANA' },
  bhaluka: { lat: 24.375, lng: 90.3778, standardName: 'Bhaluka, Mymensingh', adminLevel: 'THANA' },
  'ভালুকা': { lat: 24.375, lng: 90.3778, standardName: 'Bhaluka, Mymensingh', adminLevel: 'THANA' },

  // --- Prominent Accident & Crime Hub Thanas Across Districts ---
  chauddagram: { lat: 23.2186, lng: 91.3093, standardName: 'Chauddagram, Cumilla', adminLevel: 'THANA' },
  'চৌদ্দগ্রাম': { lat: 23.2186, lng: 91.3093, standardName: 'Chauddagram, Cumilla', adminLevel: 'THANA' },
  singra: { lat: 24.5028, lng: 89.1458, standardName: 'Singra, Natore', adminLevel: 'THANA' },
  'সিংড়া': { lat: 24.5028, lng: 89.1458, standardName: 'Singra, Natore', adminLevel: 'THANA' },
  'সিংড়া': { lat: 24.5028, lng: 89.1458, standardName: 'Singra, Natore', adminLevel: 'THANA' },
  osmaninagar: { lat: 24.7397, lng: 91.7877, standardName: 'Osmaninagar, Sylhet', adminLevel: 'THANA' },
  'osmani nagar': { lat: 24.7397, lng: 91.7877, standardName: 'Osmaninagar, Sylhet', adminLevel: 'THANA' },
  'ওসমানীনগর': { lat: 24.7397, lng: 91.7877, standardName: 'Osmaninagar, Sylhet', adminLevel: 'THANA' },
  'ওসমানী নগর': { lat: 24.7397, lng: 91.7877, standardName: 'Osmaninagar, Sylhet', adminLevel: 'THANA' },
  golapganj: { lat: 24.8624, lng: 92.0211, standardName: 'Golapganj, Sylhet', adminLevel: 'THANA' },
  'গোলাপগঞ্জ': { lat: 24.8624, lng: 92.0211, standardName: 'Golapganj, Sylhet', adminLevel: 'THANA' },
  boalia: { lat: 24.3686, lng: 88.5997, standardName: 'Boalia, Rajshahi', adminLevel: 'THANA' },
  'বোয়ালিয়া': { lat: 24.3686, lng: 88.5997, standardName: 'Boalia, Rajshahi', adminLevel: 'THANA' },
  patenga: { lat: 22.2543, lng: 91.8023, standardName: 'Patenga, Chittagong', adminLevel: 'THANA' },
  'পতেঙ্গা': { lat: 22.2543, lng: 91.8023, standardName: 'Patenga, Chittagong', adminLevel: 'THANA' },

  // --- Major Hospitals & Medical College Centers (Secondary Medical Venues) ---
  dmch: { lat: 23.7258, lng: 90.3976, standardName: 'Dhaka Medical College Hospital', adminLevel: 'HOSPITAL' },
  'ঢামেক': { lat: 23.7258, lng: 90.3976, standardName: 'Dhaka Medical College Hospital', adminLevel: 'HOSPITAL' },
  'ঢামেক হাসপাতাল': { lat: 23.7258, lng: 90.3976, standardName: 'Dhaka Medical College Hospital', adminLevel: 'HOSPITAL' },
  'ঢাকা মেডিকেল': { lat: 23.7258, lng: 90.3976, standardName: 'Dhaka Medical College Hospital', adminLevel: 'HOSPITAL' },
  'ঢাকা মেডিকেল কলেজ হাসপাতাল': { lat: 23.7258, lng: 90.3976, standardName: 'Dhaka Medical College Hospital', adminLevel: 'HOSPITAL' },
  cmch: { lat: 22.3584, lng: 91.8286, standardName: 'Chittagong Medical College Hospital', adminLevel: 'HOSPITAL' },
  'চমেক': { lat: 22.3584, lng: 91.8286, standardName: 'Chittagong Medical College Hospital', adminLevel: 'HOSPITAL' },
  'চমেক হাসপাতাল': { lat: 22.3584, lng: 91.8286, standardName: 'Chittagong Medical College Hospital', adminLevel: 'HOSPITAL' },
  'চট্টগ্রাম মেডিকেল': { lat: 22.3584, lng: 91.8286, standardName: 'Chittagong Medical College Hospital', adminLevel: 'HOSPITAL' },
  'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল': { lat: 22.3584, lng: 91.8286, standardName: 'Chittagong Medical College Hospital', adminLevel: 'HOSPITAL' },
  'পঙ্গু হাসপাতাল': { lat: 23.7712, lng: 90.3695, standardName: 'NITOR (Pangu Hospital), Dhaka', adminLevel: 'HOSPITAL' },
  nitor: { lat: 23.7712, lng: 90.3695, standardName: 'NITOR (Pangu Hospital), Dhaka', adminLevel: 'HOSPITAL' },
  'সোহরাওয়ার্দী হাসপাতাল': { lat: 23.7698, lng: 90.3705, standardName: 'Suhrawardy Hospital, Dhaka', adminLevel: 'HOSPITAL' },
  'ওসমানী মেডিকেল': { lat: 24.8988, lng: 91.8596, standardName: 'Osmani Medical College Hospital, Sylhet', adminLevel: 'HOSPITAL' },
  'ওসমানী মেডিকেল কলেজ হাসপাতাল': { lat: 24.8988, lng: 91.8596, standardName: 'Osmani Medical College Hospital, Sylhet', adminLevel: 'HOSPITAL' },
};

// Augment LOCAL_LANDMARK_MAP with authoritative statutory police stations across all 64 districts
try {
  const fs = require('fs');
  const path = require('path');
  const possiblePaths = [
    path.resolve(process.cwd(), 'bangladesh_police_stations.json'),
    path.resolve(__dirname, '../../../../bangladesh_police_stations.json'),
    path.resolve(__dirname, '../../../bangladesh_police_stations.json'),
    path.resolve(__dirname, '../../bangladesh_police_stations.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(content.stations)) {
        for (const st of content.stations) {
          if (!st.location?.latitude || !st.location?.longitude) continue;
          const lat = st.location.latitude;
          const lng = st.location.longitude;
          const standardName = `${st.station_name_en.replace(/\s+(?:Thana|Model Thana|Police Station)$/i, '')}, ${st.district}`;

          const enBase = st.station_name_en.toLowerCase().trim();
          const enShort = enBase.replace(/\s+(?:thana|model thana|police station)$/i, '').trim();
          if (enBase && !LOCAL_LANDMARK_MAP[enBase]) {
            LOCAL_LANDMARK_MAP[enBase] = { lat, lng, standardName, adminLevel: 'THANA' };
          }
          if (enShort && !LOCAL_LANDMARK_MAP[enShort]) {
            LOCAL_LANDMARK_MAP[enShort] = { lat, lng, standardName, adminLevel: 'THANA' };
          }

          if (st.station_name_bn) {
            const bnNorm = normalizeBengali(st.station_name_bn).toLowerCase().trim();
            const bnShort = bnNorm.replace(/\s+(?:থানা|মডেল থানা|পুলিশ ফাঁড়ি|পুলিশ স্টেশন)$/, '').trim();
            if (bnNorm && !LOCAL_LANDMARK_MAP[bnNorm]) {
              LOCAL_LANDMARK_MAP[bnNorm] = { lat, lng, standardName, adminLevel: 'THANA' };
            }
            if (bnShort && !LOCAL_LANDMARK_MAP[bnShort]) {
              LOCAL_LANDMARK_MAP[bnShort] = { lat, lng, standardName, adminLevel: 'THANA' };
            }
          }
        }
      }
      break;
    }
  }
} catch {
  // Graceful fallback to static dictionary
}

// In-memory cache for newly geocoded areas
const dynamicCache = new Map<string, { lat: number; lng: number; standardName: string; locationPrecision?: 'EXACT' | 'UPAZILA' | 'DISTRICT' | 'AMBIGUOUS' }>();

// All 64 Districts of Bangladesh in both English and Bengali (used for administrative hierarchy ranking)
const DISTRICT_NAMES = new Set([
  'dhaka', 'ঢাকা',
  'gazipur', 'গাজীপুর',
  'narayanganj', 'নারায়ণগঞ্জ', 'নারায়ণগঞ্জ',
  'tangail', 'টাঙ্গাইল',
  'narsingdi', 'নরসিংদী',
  'faridpur', 'ফরিদপুর',
  'gopalganj', 'গোপালগঞ্জ',
  'kishoreganj', 'কিশোরগঞ্জ',
  'manikganj', 'মানিকগঞ্জ',
  'munshiganj', 'মুন্সীগঞ্জ', 'মুন্সিগঞ্জ',
  'rajbari', 'রাজবাড়ী', 'রাজবাড়ী',
  'madaripur', 'মাদারীপুর',
  'shariatpur', 'শরীয়তপুর', 'শরীয়তপুর',
  'chittagong', 'chattogram', 'চট্টগ্রাম',
  "cox's bazar", 'coxs bazar', 'কক্সবাজার',
  'cumilla', 'comilla', 'কুমিল্লা',
  'chandpur', 'চাঁদপুর',
  'feni', 'ফেনী',
  'noakhali', 'নোয়াখালী', 'নোয়াখালী',
  'brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া',
  'lakshmipur', 'লক্ষ্মীপুর',
  'bandarban', 'বান্দরবান',
  'khagrachhari', 'খাগড়াছড়ি', 'খাগড়াছড়ি',
  'rangamati', 'রাঙ্গামাটি', 'রাঙামাটি',
  'rajshahi', 'রাজশাহী',
  'bogra', 'bogura', 'বগুড়া', 'বগুড়া',
  'pabna', 'পাবনা',
  'sirajganj', 'সিরাজগঞ্জ',
  'naogaon', 'নওগাঁ',
  'natore', 'নাটোর',
  'chapainawabganj', 'নবাবগঞ্জ', 'চাঁপাইনবাবগঞ্জ',
  'joypurhat', 'জয়পুরহাট', 'জয়পুরহাট',
  'khulna', 'খুলনা',
  'jessore', 'jashore', 'যশোর',
  'kushtia', 'কুষ্টিয়া', 'কুষ্টিয়া',
  'satkhira', 'সাতক্ষীরা',
  'bagerhat', 'বাগেরহাট',
  'jhenaidah', 'ঝিনাইদহ',
  'magura', 'মাগুরা',
  'narail', 'নড়াইল', 'নড়াইল',
  'chuadanga', 'চুয়াডাঙ্গা', 'চুয়াডাঙ্গা',
  'meherpur', 'মেহেরপুর',
  'barisal', 'barishal', 'বরিশাল',
  'patuakhali', 'পটুয়াখালী', 'পটুয়াখালী',
  'bhola', 'ভোলা',
  'pirojpur', 'পিরোজপুর',
  'barguna', 'বরগুনা',
  'jhalokati', 'jhalakathi', 'ঝালকাঠি', 'ঝালকাঠী',
  'sylhet', 'সিলেট',
  'moulvibazar', 'maulvibazar', 'মৌলভীবাজার',
  'habiganj', 'হবিগঞ্জ',
  'sunamganj', 'সুনামগঞ্জ',
  'rangpur', 'রংপুর',
  'dinajpur', 'দিনাজপুর',
  'kurigram', 'কুড়িগ্রাম', 'কুড়িগ্রাম',
  'gaibandha', 'গাইবান্ধা',
  'nilphamari', 'নীলফামারী',
  'lalmonirhat', 'লালমনিরহাট',
  'panchagarh', 'পঞ্চগড়', 'পঞ্চগড়',
  'thakurgaon', 'ঠাকুরগাঁও',
  'mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ',
  'jamalpur', 'জামালপুর',
  'netrokona', 'নেত্রকোনা', 'নেত্রকোণা',
  'sherpur', 'শেরপুর',
]);

// Auto-populate 495 BBS Upazilas into LOCAL_LANDMARK_MAP with THANA priority (100)
for (const u of ALL_UPAZILAS) {
  const normEn = u.nameEn.toLowerCase();
  const normBn = normalizeBengali(u.nameBn).toLowerCase();
  if (!LOCAL_LANDMARK_MAP[normEn] && !DISTRICT_NAMES.has(normEn)) {
    LOCAL_LANDMARK_MAP[normEn] = {
      lat: u.latitude,
      lng: u.longitude,
      standardName: u.nameEn,
      adminLevel: 'THANA',
    };
  }
  if (!LOCAL_LANDMARK_MAP[normBn] && !DISTRICT_NAMES.has(normBn)) {
    LOCAL_LANDMARK_MAP[normBn] = {
      lat: u.latitude,
      lng: u.longitude,
      standardName: u.nameEn,
      adminLevel: 'THANA',
    };
  }
  if (Array.isArray(u.aliasesEn)) {
    for (const a of u.aliasesEn) {
      const normA = a.toLowerCase().trim();
      if (!LOCAL_LANDMARK_MAP[normA] && !DISTRICT_NAMES.has(normA)) {
        LOCAL_LANDMARK_MAP[normA] = {
          lat: u.latitude,
          lng: u.longitude,
          standardName: u.nameEn,
          adminLevel: 'THANA',
        };
      }
    }
  }
  if (Array.isArray(u.aliasesBn)) {
    for (const a of u.aliasesBn) {
      const normA = normalizeBengali(a).toLowerCase().trim();
      if (!LOCAL_LANDMARK_MAP[normA] && !DISTRICT_NAMES.has(normA)) {
        LOCAL_LANDMARK_MAP[normA] = {
          lat: u.latitude,
          lng: u.longitude,
          standardName: u.nameEn,
          adminLevel: 'THANA',
        };
      }
    }
  }
}

const HOMONYM_CANDIDATE_DISTRICTS: Record<string, string[]> = {
  sherpur: ['Bogura', 'Sherpur'],
  'শেরপুর': ['Bogura', 'Sherpur'],
  shibganj: ['Bogura', 'Chapainawabganj'],
  'শিবগঞ্জ': ['Bogura', 'Chapainawabganj'],
  kaliganj: ['Gazipur', 'Lalmonirhat', 'Jhenaidah', 'Satkhira'],
  'কালীগঞ্জ': ['Gazipur', 'Lalmonirhat', 'Jhenaidah', 'Satkhira'],
  pirganj: ['Rangpur', 'Thakurgaon'],
  'পীরগঞ্জ': ['Rangpur', 'Thakurgaon'],
  lohagara: ['Chattogram', 'Narail'],
  'লোহাগাড়া': ['Chattogram', 'Narail'],
  'লোহাগাড়া': ['Chattogram', 'Narail'],
  companiganj: ['Noakhali', 'Sylhet'],
  'কোম্পানীগঞ্জ': ['Noakhali', 'Sylhet'],
  kawkhali: ['Rangamati', 'Pirojpur'],
  'কাউখালী': ['Rangamati', 'Pirojpur'],
  kachua: ['Chandpur', 'Bagerhat'],
  'কচুয়া': ['Chandpur', 'Bagerhat'],
  'কচুয়া': ['Chandpur', 'Bagerhat'],
  sreepur: ['Gazipur', 'Magura'],
  'শ্রীপুর': ['Gazipur', 'Magura'],
  phulbari: ['Dinajpur', 'Kurigram'],
  'ফুলবাড়ী': ['Dinajpur', 'Kurigram'],
  'ফুলবাড়ী': ['Dinajpur', 'Kurigram'],
  daulatpur: ['Manikganj', 'Kushtia'],
  'দৌলতপুর': ['Manikganj', 'Kushtia'],
  nawabganj: ['Dhaka', 'Dinajpur'],
  'নবাবগঞ্জ': ['Dhaka', 'Dinajpur'],
  durgapur: ['Rajshahi', 'Netrokona'],
  'দুর্গাপুর': ['Rajshahi', 'Netrokona'],
};

const NORMALIZED_HOMONYM_MAP: Record<string, string[]> = {};
for (const [key, val] of Object.entries(HOMONYM_CANDIDATE_DISTRICTS)) {
  NORMALIZED_HOMONYM_MAP[key.toLowerCase()] = val;
  NORMALIZED_HOMONYM_MAP[normalizeBengali(key).toLowerCase()] = val;
}

const DISTRICT_BN_MAP: Record<string, string[]> = {
  Bogura: ['বগুড়া', 'বগুড়া'],
  Sherpur: ['শেরপুর'],
  Chapainawabganj: ['চাঁপাইনবাবগঞ্জ', 'নবাবগঞ্জ'],
  Dhaka: ['ঢাকা'],
  Dinajpur: ['দিনাজপুর'],
  Rajshahi: ['রাজশাহী'],
  Netrokona: ['নেত্রকোনা', 'নেত্রকোণা'],
  Gazipur: ['গাজীপুর'],
  Lalmonirhat: ['লালমনিরহাট'],
  Jhenaidah: ['ঝিনাইদহ'],
  Satkhira: ['সাতক্ষীরা'],
  Rangpur: ['রংপুর'],
  Thakurgaon: ['ঠাকুরগাঁও'],
  Chattogram: ['চট্টগ্রাম'],
  Narail: ['নড়াইল', 'নড়াইল'],
  Noakhali: ['নোয়াখালী', 'নোয়াখালী'],
  Sylhet: ['সিলেট'],
  Rangamati: ['রাঙ্গামাটি', 'রাঙামাটি'],
  Pirojpur: ['পিরোজপুর'],
  Chandpur: ['চাঁদপুর'],
  Bagerhat: ['বাগেরহাট'],
  Magura: ['মাগুরা'],
  Kurigram: ['কুড়িগ্রাম', 'কুড়িগ্রাম'],
  Manikganj: ['মানিকগঞ্জ'],
  Kushtia: ['কুষ্টিয়া', 'কুষ্টিয়া'],
};

/**
 * Returns administrative priority weight:
 * - 100: Specific locality, neighborhood, thana, police station (e.g. Mirpur, Tongi, Chauddagram)
 * - 50: Broad district centroid (e.g. Dhaka, Chittagong, Gazipur)
 * - 10: Secondary place / hospital venue (e.g. DMCH, CMCH)
 */
export function getAdminPriority(key: string): number {
  const normKey = normalizeBengali(key).toLowerCase().trim();
  const entry = LOCAL_LANDMARK_MAP[normKey] || LOCAL_LANDMARK_MAP[key];
  if (entry?.adminLevel === 'HOSPITAL') return 10;
  // Multi-district homonym upazilas represent specific upazila/thana inquiries;
  // prioritize them over broad district centroids so that "বগুড়ার শেরপুরে" evaluates
  // Sherpur upazila with Bogura district context before returning Bogra district centroid.
  if (NORMALIZED_HOMONYM_MAP[normKey]) return 100;
  if (DISTRICT_NAMES.has(normKey) || entry?.adminLevel === 'DISTRICT') return 50;
  return 100;
}

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

const DISTRICT_TO_DIV_MAP: Record<string, string> = {
  Dhaka: 'Dhaka', Gazipur: 'Dhaka', Narayanganj: 'Dhaka', Narsingdi: 'Dhaka',
  Tangail: 'Dhaka', Kishoreganj: 'Dhaka', Manikganj: 'Dhaka', Munshiganj: 'Dhaka',
  Faridpur: 'Dhaka', Gopalganj: 'Dhaka', Madaripur: 'Dhaka', Rajbari: 'Dhaka',
  Shariatpur: 'Dhaka',
  Chattogram: 'Chattogram', Chittagong: 'Chattogram', "Cox's Bazar": 'Chattogram', Cumilla: 'Chattogram',
  Feni: 'Chattogram', Brahmanbaria: 'Chattogram', Noakhali: 'Chattogram',
  Lakshmipur: 'Chattogram', Chandpur: 'Chattogram', Rangamati: 'Chattogram',
  Khagrachhari: 'Chattogram', Bandarban: 'Chattogram',
  Rajshahi: 'Rajshahi', Bogura: 'Rajshahi', Pabna: 'Rajshahi', Sirajganj: 'Rajshahi',
  Naogaon: 'Rajshahi', Natore: 'Rajshahi', Chapainawabganj: 'Rajshahi', Joypurhat: 'Rajshahi',
  Khulna: 'Khulna', Jashore: 'Khulna', Satkhira: 'Khulna', Bagerhat: 'Khulna',
  Kushtia: 'Khulna', Jhenaidah: 'Khulna', Chuadanga: 'Khulna', Magura: 'Khulna',
  Meherpur: 'Khulna', Narail: 'Khulna',
  Barishal: 'Barishal', Patuakhali: 'Barishal', Bhola: 'Barishal', Pirojpur: 'Barishal',
  Barguna: 'Barishal', Jhalakathi: 'Barishal',
  Sylhet: 'Sylhet', Moulvibazar: 'Sylhet', Habiganj: 'Sylhet', Sunamganj: 'Sylhet',
  Rangpur: 'Rangpur', Dinajpur: 'Rangpur', Kurigram: 'Rangpur', Gaibandha: 'Rangpur',
  Nilphamari: 'Rangpur', Panchagarh: 'Rangpur', Thakurgaon: 'Rangpur', Lalmonirhat: 'Rangpur',
  Mymensingh: 'Mymensingh', Jamalpur: 'Mymensingh', Netrokona: 'Mymensingh', Sherpur: 'Mymensingh',
};

/**
 * Searches the input text for any known Bangladesh landmark or thana name.
 * Ranks by administrative hierarchy: locality/thana (100) > district centroid (50) > hospital (10),
 * then descending by length within the same administrative tier.
 */
export const findLandmarkInText = (text: string): GeocodeResult | null => {
  const cleanInput = normalizeBengali(text).toLowerCase();

  // Sort keys by administrative hierarchy, then length
  const keys = Object.keys(LOCAL_LANDMARK_MAP).sort((a, b) => {
    const prioDiff = getAdminPriority(b) - getAdminPriority(a);
    if (prioDiff !== 0) return prioDiff;
    return b.length - a.length;
  });

  for (const key of keys) {
    const cleanKey = normalizeBengali(key).toLowerCase();

    let isMatch = false;

    // For English keys (letters, digits, spaces, hyphens, apostrophes), require word boundaries
    if (/^[a-z0-9\s'-]+$/.test(cleanKey)) {
      const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(cleanInput)) {
        isMatch = true;
      }
    } else {
      const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^\\u0980-\\u09FF])${escaped}(?:ের|ে|তে|য়|য়ে|র|এর|এ)?(?:$|[^\\u0980-\\u09FF])`);
      if (regex.test(cleanInput)) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      continue;
    }

    // Check for homonym disambiguation with candidate district
    if (NORMALIZED_HOMONYM_MAP[cleanKey]) {
      const candidates = NORMALIZED_HOMONYM_MAP[cleanKey];
      let matchedCandidate: string | null = null;
      for (const candDist of candidates) {
        const normCand = candDist.toLowerCase();
        const bnNames = (DISTRICT_BN_MAP[candDist] || []).map((b) => normalizeBengali(b).toLowerCase());

        // Prevent self-matching: when the candidate district name is identical to the homonym itself
        // (e.g. 'Sherpur' district for 'Sherpur' upazila), require explicit district markers
        // (e.g. 'শেরপুর জেলা', 'শেরপুর জেলায়', 'sherpur district') so that standalone "শেরপুরে সংঘর্ষ"
        // does not falsely treat "শেরপুরে" as district context.
        const isSelfDistrict = candDist.toLowerCase() === cleanKey || bnNames.some((bn) => bn === cleanKey);
        let hasMention = false;
        if (isSelfDistrict) {
          hasMention =
            cleanInput.includes(`${normCand} district`) ||
            bnNames.some((bn) => cleanInput.includes(`${bn} জেলা`) || cleanInput.includes(`${bn} জেলায়`));
        } else {
          hasMention =
            cleanInput.includes(normCand) ||
            bnNames.some((bn) => cleanInput.includes(bn));
        }

        if (hasMention) {
          matchedCandidate = candDist;
          const uRec = ALL_UPAZILAS.find(
            (u) =>
              u.districtEn.toLowerCase() === candDist.toLowerCase() &&
              (u.nameEn.toLowerCase() === cleanKey || normalizeBengali(u.nameBn).toLowerCase() === cleanKey)
          );
          if (uRec) {
            return {
              locationName: uRec.nameEn,
              latitude: uRec.latitude,
              longitude: uRec.longitude,
              district: uRec.districtEn,
              upazila: uRec.nameEn,
              division: uRec.divisionEn,
              locationPrecision: 'UPAZILA',
              source: 'DICTIONARY',
            };
          }
          return {
            locationName: candDist,
            latitude: LOCAL_LANDMARK_MAP[cleanKey]?.lat ?? 25.0205,
            longitude: LOCAL_LANDMARK_MAP[cleanKey]?.lng ?? 90.0153,
            district: candDist,
            upazila: undefined,
            division: DISTRICT_TO_DIV_MAP[candDist],
            locationPrecision: 'DISTRICT',
            source: 'DICTIONARY',
          };
        }
      }

      // In homonym resolution, if an upazila name exists in multiple districts and no district context is found in text, set locationPrecision: 'AMBIGUOUS'
      if (!matchedCandidate) {
        const match = LOCAL_LANDMARK_MAP[key] || LOCAL_LANDMARK_MAP[cleanKey];
        return {
          locationName: match?.standardName ?? cleanKey,
          latitude: match?.lat ?? 23.8103,
          longitude: match?.lng ?? 90.4125,
          district: undefined,
          upazila: undefined,
          division: undefined,
          locationPrecision: 'AMBIGUOUS',
          source: 'DICTIONARY',
        };
      }
    }

    if (isMatch) {
      const match = LOCAL_LANDMARK_MAP[key];
      const isDist = DISTRICT_NAMES.has(cleanKey) || match.adminLevel === 'DISTRICT';
      const isThana = match.adminLevel === 'THANA' || match.adminLevel === 'LOCALITY' || match.adminLevel === 'HOSPITAL';
      const precision: 'EXACT' | 'UPAZILA' | 'DISTRICT' | 'AMBIGUOUS' = isDist
        ? 'DISTRICT'
        : (isThana ? 'UPAZILA' : 'UPAZILA'); // Never default landmarks to EXACT

      let district = isDist ? match.standardName : undefined;
      let upazila = isThana ? match.standardName : undefined;
      let division = DISTRICT_TO_DIV_MAP[match.standardName];

      if (match.standardName && match.standardName.includes(', ')) {
        const [locPart, distPart] = match.standardName.split(', ');
        district = distPart.trim();
        upazila = locPart.trim();
        division = DISTRICT_TO_DIV_MAP[district] || division;
      }

      if (!district) {
        const matchedUpazila = ALL_UPAZILAS.find(
          (u) =>
            u.nameEn.toLowerCase() === match.standardName.toLowerCase() ||
            normalizeBengali(u.nameBn).toLowerCase() === cleanKey
        );
        if (matchedUpazila) {
          district = matchedUpazila.districtEn;
          upazila = matchedUpazila.nameEn;
          division = matchedUpazila.divisionEn;
        }
      }

      return {
        locationName: match.standardName,
        latitude: match.lat,
        longitude: match.lng,
        district,
        upazila,
        division,
        locationPrecision: precision,
        source: 'DICTIONARY',
      };
    }
  }

  // Check 495 Upazilas directly for places not in landmark map
  for (const u of ALL_UPAZILAS) {
    const normEn = u.nameEn.toLowerCase();
    const normBn = normalizeBengali(u.nameBn).toLowerCase();

    // Check English with word boundary
    const enRegex = new RegExp(`(?:^|[^a-z0-9])${normEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i');
    const bnRegex = new RegExp(`(?:^|[^\\u0980-\\u09FF])${normBn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:ের|ে|তে|য়|য়ে|র|এর|এ)?(?:$|[^\\u0980-\\u09FF])`);
    if (enRegex.test(cleanInput) || bnRegex.test(cleanInput)) {
      const cleanKey = normEn;
      if (HOMONYM_CANDIDATE_DISTRICTS[cleanKey]) {
        const candidates = HOMONYM_CANDIDATE_DISTRICTS[cleanKey];
        let hasCandMention = false;
        for (const candDist of candidates) {
          const normCand = candDist.toLowerCase();
          const bnNames = (DISTRICT_BN_MAP[candDist] || []).map((b) => normalizeBengali(b).toLowerCase());
          if (cleanInput.includes(normCand) || bnNames.some((bn) => cleanInput.includes(bn))) {
            hasCandMention = true;
            break;
          }
        }
        if (!hasCandMention) {
          return {
            locationName: u.nameEn,
            latitude: u.latitude,
            longitude: u.longitude,
            district: undefined,
            upazila: undefined,
            division: undefined,
            locationPrecision: 'AMBIGUOUS',
            source: 'DICTIONARY',
          };
        }
      }
      return {
        locationName: u.nameEn,
        latitude: u.latitude,
        longitude: u.longitude,
        district: u.districtEn,
        upazila: u.nameEn,
        division: u.divisionEn,
        locationPrecision: 'UPAZILA',
        source: 'DICTIONARY',
      };
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
        locationPrecision: match.locationPrecision || 'UPAZILA',
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
      locationPrecision: cached.locationPrecision || 'UPAZILA',
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

    // Inspect OSM result type / admin level to assign truthful precision
    let precision: 'EXACT' | 'UPAZILA' | 'DISTRICT' | 'AMBIGUOUS' = 'UPAZILA';
    const osmType = (first.type || '').toLowerCase();
    const addressType = (first.addresstype || '').toLowerCase();
    const osmClass = (first.class || '').toLowerCase();

    if (
      addressType === 'district' ||
      addressType === 'state' ||
      osmType === 'state' ||
      osmType === 'district' ||
      (osmClass === 'boundary' && osmType === 'administrative' && query.toLowerCase().includes('district'))
    ) {
      precision = 'DISTRICT';
    } else if (
      addressType === 'county' ||
      addressType === 'city' ||
      addressType === 'town' ||
      addressType === 'village' ||
      addressType === 'suburb' ||
      addressType === 'municipality' ||
      osmType === 'city' ||
      osmType === 'town' ||
      osmType === 'village' ||
      osmType === 'suburb' ||
      osmType === 'administrative' ||
      osmClass === 'boundary' ||
      osmClass === 'place'
    ) {
      precision = 'UPAZILA';
    } else if (
      osmClass === 'highway' ||
      osmClass === 'building' ||
      osmClass === 'amenity' ||
      osmClass === 'shop' ||
      (first.osm_type === 'node' && osmClass !== 'place')
    ) {
      precision = 'EXACT';
    } else {
      precision = 'UPAZILA';
    }

    const resultObj = {
      lat,
      lng,
      standardName: first.display_name.split(',').slice(0, 2).join(', ').trim(),
      locationPrecision: precision,
    };

    dynamicCache.set(query.toLowerCase(), resultObj);

    return {
      locationName: resultObj.standardName,
      latitude: lat,
      longitude: lng,
      locationPrecision: precision,
      source: 'NOMINATIM',
    };
  } catch (error) {
    console.error(`[Nominatim] Error geocoding query "${query}":`, error);
    return null;
  }
};

/**
 * Strips dateline bureau tokens from the beginning of news snippet text.
 * e.g. "Dhaka, Nov 19 (UNB) - " or "ঢাকা, ১৯ নভেম্বর - " or "স্টাফ রিপোর্টার, ঢাকা: "
 */
export function stripDateline(text: string): string {
  if (!text) return '';
  return text
    // "Dhaka, Nov 19 (UNB) - " or "Dhaka, Nov 19: " or "Dhaka — "
    .replace(
      /^(?:Dhaka|Chittagong|Chattogram|Sylhet|Rajshahi|Khulna|Barisal|Barishal|Rangpur|Mymensingh|Comilla|Cumilla)(?:,\s*|\s+)(?:[A-Za-z0-9\s,().—–:-]+?)(?:[-—–:]\s*|\s{2,})/i,
      ''
    )
    // "ঢাকা, ১৯ নভেম্বর (বাসস) - " or "ঢাকা, ১৯ নভেম্বর:"
    .replace(
      /^(?:ঢাকা|চট্টগ্রাম|রাজশাহী|সিলেট|খুলনা|বরিশাল|রংপুর|ময়মনসিংহ|ময়মনসিংহ|কুমিল্লা)(?:,\s*|\s+)(?:[\u0980-\u09FF0-9\s,().—–:-]+?)(?:[-—–:]\s*|\s{2,})/i,
      ''
    )
    // "নিজস্ব প্রতিবেদক, ঢাকা:" or "স্টাফ রিপোর্টার, ঢাকা -" or "অনলাইন ডেস্ক -"
    .replace(
      /^(?:নিজস্ব প্রতিবেদক|স্টাফ রিপোর্টার|অনলাইন ডেস্ক|Staff Reporter|Special Correspondent|News Desk)[^:—–-]+[:—–-]\s*/i,
      ''
    )
    .trim();
}

/**
 * Neutralizes transit departure and destination points in text so that a vehicle's origin
 * (e.g. "ঢাকা থেকে ছেড়ে আসা", "coming from Chittagong") or transit destination
 * (e.g. "চট্টগ্রামগামী", "ঢাকামুখী", "bound for Chittagong") does not override the actual crash scene.
 */
export function maskTransitDepartures(text: string): string {
  if (!text) return '';
  return text
    // Multi-city routes: "ঢাকা থেকে কক্সবাজারগামী", "Dhaka to Cox's Bazar bound"
    .replace(
      /(?:^|[\s,।–—])([^\s,।–—]+)\s*(?:থেকে|হতে)\s*([^\s,।–—]+)(?:গামী|মুখী|অভিমুখী)/gi,
      ' '
    )
    // Bengali destination suffixes: "ঢাকাগামী", "চট্টগ্রামগামী", "কক্সবাজারগামী", "ঢাকামুখী", "চট্টগ্রাম অভিমুখী"
    .replace(
      /(?:^|[\s,।–—])([^\s,।–—]+)(?:গামী|মুখী|অভিমুখী)/gi,
      ' '
    )
    // Bengali departure origins: "ঢাকা থেকে ছেড়ে আসা", "চট্টগ্রাম থেকে আসা", "সিলেট হতে ছেড়ে আসা", "খুলনা থেকে রওনা"
    .replace(
      /(?:^|[\s,।–—])(কক্স\s*বাজার|saint\s*martin|[^\s,।–—]+)\s*(?:থেকে|হতে)\s*(?:ছেড়ে\s*আসা|ছেড়ে\s*যাওয়া|ছেড়ে|ছেড়ে\s*আসা|ছেড়ে|আসা|রওনা|যাত্রা|ছেড়েছিল|আসছিল)/gi,
      ' '
    )
    // English destination phrases: "bound for Chittagong", "heading to Dhaka", "en route to Rajshahi", "destined for Sylhet"
    .replace(
      /(?:bound for|heading to|heading towards|heading toward|headed for|headed to|en route to|destined for|on its way to|way to)\s+([^\s,;]+)/gi,
      ' '
    )
    // English departure origins: "coming from Chittagong", "departed from Dhaka", "traveling from Rajshahi", "left Sylhet"
    .replace(
      /(?:coming from|departed from|departing from|traveling from|travelling from|en route from|bound from|bus from|truck from|left|originating from)\s+([^\s,;]+)/gi,
      ' '
    );
}

/**
 * Neutralizes inter-district connecting highway and expressway corridor names
 * (e.g. "ঢাকা-চট্টগ্রাম মহাসড়কে", "Dhaka-Chittagong highway") so that the corridor endpoints
 * do not hijack incidents occurring in intermediate districts (e.g. Feni, Cumilla, Narayanganj).
 */
export function maskHighwayCorridors(text: string): string {
  if (!text) return '';
  return text
    // Bengali: "ঢাকা-চট্টগ্রাম মহাসড়কে", "ঢাকা-সিলেট মহাসড়কে", "ঢাকা-মাওয়া এক্সপ্রেসওয়েতে"
    .replace(
      /[^\s,।–—]+-[^\s,।–—]+\s*(?:মহাসড়কে|মহাসড়ক|এক্সপ্রেসওয়েতে|এক্সপ্রেসওয়ে|সড়কে|সড়ক)/gi,
      ' '
    )
    // English: "Dhaka-Chittagong highway", "Dhaka-Sylhet expressway"
    .replace(
      /[A-Za-z]+-[A-Za-z]+\s+(?:highway|expressway|corridor|road)/gi,
      ' '
    );
}

/**
 * Masks secondary medical / hospital venues in text so that the hospital where victims were rushed
 * (e.g. "ঢামেক হাসপাতালে নেওয়া হলে", "Dhaka Medical College Hospital", "কুমিল্লা মেডিকেল কলেজ হাসপাতালে")
 * does not override the actual accident / crime scene.
 */
export function maskHospitalPhrases(text: string): string {
  if (!text) return '';
  return text
    // Bengali medical colleges & hospitals: Any district/place preceding hospital
    // e.g. "ঢাকা মেডিকেল কলেজ হাসপাতাল", "কুমিল্লা মেডিকেল কলেজ হাসপাতাল", "ফেনী সদর হাসপাতাল", "কেরানীগঞ্জ উপজেলা স্বাস্থ্য কমপ্লেক্স"
    .replace(
      /(?:^|[\s,।–—])(?:[^\s,।–—]+\s+)?(?:মেডিকেল\s*কলেজ\s*(?:হাসপাতাল|এ)?|মেডিকেলে|মেডিকেল|সদর\s*হাসপাতাল|জেনারেল\s*হাসপাতাল|উপজেলা\s*স্বাস্থ্য\s*কমপ্লেক্স|স্বাস্থ্য\s*কমপ্লেক্স|হাসপাতালে|হাসপাতাল)/gi,
      ' '
    )
    // English medical colleges & hospitals: "Dhaka Medical College Hospital", "Cumilla Medical College", "Feni Sadar Hospital"
    .replace(
      /(?:[A-Za-z]+\s+)?(?:Medical\s+College\s+(?:Hospital)?|Medical|Sadar\s+Hospital|General\s+Hospital|District\s+Hospital|Health\s+Complex)/gi,
      ' '
    )
    // Referral phrases in English: "rushed to Dhaka Medical", "admitted to Chittagong Hospital"
    .replace(
      /(?:rushed to|admitted to|taken to|referred to)\s+[^,;]+(?:\s+Hospital)?/gi,
      ' '
    )
    // Known medical centers and acronyms: "ঢামেক", "চমেক", "রামেক", "কুমেক", "পঙ্গু হাসপাতাল", "DMCH", "CMCH", "NITOR"
    .replace(
      /\b(?:ঢামেক|চমেক|রামেক|সিমেক|শমেক|কুমেক|শজিমেক|মিটফোর্ড|পঙ্গু\s*হাসপাতাল|সোহরাওয়ার্দী\s*হাসপাতাল|DMCH|CMCH|RMCH|SOMCH|NITOR|BSMMU)\b/gi,
      ' '
    );
}

/**
 * Masks secondary administrative filing places (e.g. police stations where a report/GD was filed later)
 * to prevent them from overriding the actual physical crime/accident scene.
 */
export function maskSecondaryPlaces(text: string): string {
  if (!text) return '';
  return text
    // Secondary filing police stations: "শাহবাগ থানায় মামলা", "কোতোয়ালী থানায় সাধারণ ডায়েরি"
    .replace(
      /[^\s,।–—]+\s*(?:থানায়\s*(?:মামলা|অভিযোগ|সাধারণ\s*ডায়েরি|জিডি|হস্তান্তর|সোপর্দ))/gi,
      ' '
    )
    // English: "case filed with Kotwali police station"
    .replace(
      /(?:case filed with|complaint lodged at|handed over to)\s+([^\s,;]+)\s+(?:police station|thana)/gi,
      ' '
    );
}

/**
 * Neutralizes common non-geographic homonym words that coincide with upazila names
 * (e.g. "তালা ভেঙে" = breaking lock, not Tala Upazila in Satkhira).
 */
export function maskFalsePositivePhrases(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:দোকানের|ঘরের|গেটের|বাড়ির|আলমারির)\s+তালা/gi, ' ')
    .replace(/তালা\s+(?:ভেঙে|ভেঙ্গে|কেটে|মেরে|খুলে|ঝুলিয়ে|ভেঙেছে)/gi, ' ');
}

/**
 * Masks locations associated with past case titles or arrest actions:
 * e.g. "ফেনীতে খালেদা জিয়ার গাড়িবহরে হামলা, মামলার পলাতক আসামি গ্রেফতার"
 * Here, "ফেনীতে" describes the past 2017 case ("ফেনীতে খালেদা জিয়ার গাড়িবহরে হামলা মামলার"),
 * and NOT a current physical assault scene.
 */
export function maskArrestAndCaseVenue(text: string): string {
  if (!text) return '';
  return text
    // "ফেনীতে খালেদা জিয়ার গাড়িবহরে হামলা, মামলার" or "[Place]-এ হামলা মামলার"
    .replace(
      /(?:[^\s,।–—]+(?:\s*-[^\s,।–—]+)?)\s*(?:-এ|-এতে|এ|তে)?\s*(?:[^\s,।–—]+\s+){0,4}(?:হামলা|হত্যা|খুন|ডাকাতি|নাশকতা),?\s*মামলার/gi,
      ' '
    )
    // "[Place] থেকে গ্রেফতার" or "[Place] এ/তে/এতে গ্রেফতার" or "[Place] গ্রেফতার"
    // e.g. "গাজীপুরে গ্রেফতার ২", "গাজীপুর থেকে গ্রেফতার", "গাজীপুর-এ আটক", "গাজীপুরে ২ জন আটক"
    // Restricts bridging to explicit count/suspect/operation qualifiers so unpunctuated headlines
    // (e.g. "নরসিংদীতে ছিনতাই গাজীপুরে গ্রেফতার ২") do not wipe out earlier incident clauses.
    .replace(
      /(?:[^\s,।–—]+)\s*(?:থেকে|হতে|-এ|-এতে|এ|তে|য়|য়ে)?(?:\s+(?:[০-৯\d]+(?:\s*জন(?:কে)?)?|(?:মামলার\s+)?(?:পলাতক|সন্দেহভাজন|প্রধান)?\s*(?:আসামি|আসামিকে|ডাকাত|ডাকাতকে|সন্ত্রাসী|সন্ত্রাসীকে|মাদক\s*কারবারি|কারবারি|চোর|চোরকে|যুবক|যুবককে|সদস্য|সদস্যকে|কর্মী|কর্মীকে)|পুলিশের\s*হাতে|র‌্যাবের\s*হাতে|অভিযান\s*চালিয়ে)){0,2}\s+(?:গ্রেফতার|গ্রেপ্তার|আটক|গ্রেফতারের|আটকের)(?:\s*(?:হয়েছে|হয়েছেন|করা\s*হয়েছে|করা\s*হয়|হয়|[০-৯\d]+(?:\s*জন)?))?/gi,
      ' '
    )
    // English arrest patterns: e.g. "2 arrested in Gazipur", "held in Gazipur", "nabbed from Gazipur"
    .replace(
      /(?:arrested|held|detained|nabbed|apprehended)\s+(?:in|from|at)\s+([^\s,;।–—]+)/gi,
      ' '
    )
    .replace(
      /([^\s,;।–—]+)\s+(?:police\s+)?(?:arrest|arrested|held|detained)/gi,
      ' '
    )
    // "[Place]-এর আদালতে" or "[Place] কোর্টে"
    .replace(
      /(?:[^\s,।–—]+)\s*(?:আদালতে|আদালতের|কোর্টে|ট্রাইব্যুনালে)/gi,
      ' '
    );
}

function maskAllSecondaryNoise(text: string): string {
  if (!text) return '';
  return maskArrestAndCaseVenue(
    maskFalsePositivePhrases(
      maskSecondaryPlaces(
        maskHighwayCorridors(
          maskTransitDepartures(
            maskHospitalPhrases(text)
          )
        )
      )
    )
  );
}

/**
 * Determines if a matched location in the text refers merely to a casualty's origin/residence
 * (e.g. "নিহতদের বাড়ি কক্সবাজারে", "গ্রামের বাড়ি চকরিয়ায়") or suspect/accused address
 * (e.g. "আসামির বাড়ি", "অভিযুক্তের বাড়ি", "সাং", "স্থায়ী ঠিকানা") rather than the actual incident scene.
 */
export function isVictimOriginContext(text: string, locationName: string): boolean {
  if (!text) return false;
  const normText = normalizeBengali(text).toLowerCase();
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
    'আসামির বাড়ি',
    'আসামির বাড়ি',
    'অভিযুক্তের বাড়ি',
    'অভিযুক্তের বাড়ি',
    'সাং',
    'সাং-',
    'স্থায়ী ঠিকানা',
    'স্থায়ী ঠিকানা',
    'বর্তমান ঠিকানা',
    'আসামির ঠিকানা',
    'অভিযুক্তের ঠিকানা',
    'হত্যাকারীর বাড়ি',
    'হত্যাকারীর বাড়ি',
    'ছিনতাইকারীর বাড়ি',
    'ছিনতাইকারীর বাড়ি',
    'ডাকাতের বাড়ি',
    'ডাকাতের বাড়ি',
    'hometown',
    'native of',
    'resident of',
    'residence',
    'permanent address',
  ];

  const searchNames = [lowerLoc];
  const upazila = ALL_UPAZILAS.find(
    (u) => u.nameEn.toLowerCase() === lowerLoc || u.districtEn.toLowerCase() === lowerLoc
  );
  if (upazila) {
    searchNames.push(normalizeBengali(upazila.nameBn).toLowerCase());
    searchNames.push(normalizeBengali(upazila.districtBn).toLowerCase());
    if (upazila.aliasesBn) {
      for (const a of upazila.aliasesBn) {
        searchNames.push(normalizeBengali(a).toLowerCase());
      }
    }
  }

  for (const name of searchNames) {
    if (!name || name.length < 2) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const term of originTerms) {
      const termEscaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patternBefore = new RegExp(`(?:${termEscaped})[\\s\\S]{0,35}?(?:${escaped})`, 'i');
      const patternAfter = new RegExp(`(?:${escaped})[\\s\\S]{0,35}?(?:${termEscaped})`, 'i');
      if (patternBefore.test(normText) || patternAfter.test(normText)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * High-level domestic geocode resolver:
 * 1. Rejects international/foreign events (USA, Saudi, UK, Canada, India, etc.) -> returns null (pins nothing).
 * 2. Matches the headline first (highest confidence incident location).
 * 3. Applies administrative hierarchy: Locality / Thana > District Centroid.
 * 4. Neutralizes transit departure origins and secondary hospital/court venues.
 * 5. Strips datelines from news snippets.
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

  // Dateline bureau stripping
  const cleanBody = stripDateline(body);

  // 2. Headline Priority Match with transit, highway, hospital, and secondary place masking:
  // Incident scenes almost always appear in the headline without departure/destination/hospital noise
  const maskedTitle = maskAllSecondaryNoise(title);
  const headlineMatch = findLandmarkInText(maskedTitle);
  if (headlineMatch) {
    if (!isVictimOriginContext(title, headlineMatch.locationName)) {
      return headlineMatch;
    }
  }

  // 3. Snippet inspection with masking:
  // If body snippet is provided, check if masked body reveals the incident scene
  if (cleanBody) {
    const maskedBody = maskAllSecondaryNoise(cleanBody);
    const bodySceneMatch = findLandmarkInText(maskedBody);
    if (bodySceneMatch && !isVictimOriginContext(cleanBody, bodySceneMatch.locationName)) {
      return bodySceneMatch;
    }
  }

  // 4. Fallback to raw unmasked headline (e.g. story purely about "Dhaka-Chittagong highway" or hospital venue)
  const rawHeadlineMatch = findLandmarkInText(title);
  if (rawHeadlineMatch && !isVictimOriginContext(title, rawHeadlineMatch.locationName)) {
    return rawHeadlineMatch;
  }

  // 5. Fallback to raw clean body
  if (cleanBody) {
    const rawBodyMatch = findLandmarkInText(cleanBody);
    if (rawBodyMatch && !isVictimOriginContext(cleanBody, rawBodyMatch.locationName)) {
      return rawBodyMatch;
    }
  } else if (!snippet) {
    const maskedCombined = maskAllSecondaryNoise(titleOrCombined);
    const combinedMatch = findLandmarkInText(maskedCombined);
    if (combinedMatch && !isVictimOriginContext(titleOrCombined, combinedMatch.locationName)) {
      return combinedMatch;
    }

    const rawMatch = findLandmarkInText(titleOrCombined);
    if (rawMatch && !isVictimOriginContext(titleOrCombined, rawMatch.locationName)) {
      return rawMatch;
    }
  }

  return null;
};

/**
 * Validates that a set of coordinates strictly falls within Bangladesh and does not deviate
 * from the declared district centroid by more than ~0.7 degrees (~75 km), preventing cross-district
 * coordinate corruption or misassigned jurisdictions.
 */
export function validateCoordinateHierarchy(
  latitude: number,
  longitude: number,
  district?: string,
  upazila?: string
): { isValid: boolean; distanceDeg?: number; reason?: string } {
  if (!isWithinBangladesh(latitude, longitude)) {
    return {
      isValid: false,
      reason: `Coordinates (${latitude}, ${longitude}) are outside Bangladesh sovereign bounds`,
    };
  }

  if (district) {
    const cleanDist = district.toLowerCase().trim();
    const entry =
      LOCAL_LANDMARK_MAP[cleanDist] ||
      Object.values(LOCAL_LANDMARK_MAP).find(
        (e) =>
          e.standardName.toLowerCase() === cleanDist ||
          e.standardName.toLowerCase().startsWith(cleanDist)
      );

    if (entry) {
      const dLat = Math.abs(latitude - entry.lat);
      const dLng = Math.abs(longitude - entry.lng);
      const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distDeg > 0.7) {
        return {
          isValid: false,
          distanceDeg: Number(distDeg.toFixed(4)),
          reason: `Coordinates (${latitude}, ${longitude}) deviate ${distDeg.toFixed(4)}° (> 0.7°) from district '${district}' center (${entry.lat}, ${entry.lng})`,
        };
      }
      return {
        isValid: true,
        distanceDeg: Number(distDeg.toFixed(4)),
      };
    }
  }

  if (upazila) {
    const cleanU = upazila.toLowerCase().trim();
    const uRec = ALL_UPAZILAS.find(
      (u) =>
        u.nameEn.toLowerCase() === cleanU ||
        u.id === cleanU ||
        normalizeBengali(u.nameBn).toLowerCase() === cleanU
    );
    if (uRec) {
      const dLat = Math.abs(latitude - uRec.latitude);
      const dLng = Math.abs(longitude - uRec.longitude);
      const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distDeg > 0.5) {
        return {
          isValid: false,
          distanceDeg: Number(distDeg.toFixed(4)),
          reason: `Coordinates (${latitude}, ${longitude}) deviate ${distDeg.toFixed(4)}° (> 0.5°) from upazila '${upazila}' center (${uRec.latitude}, ${uRec.longitude})`,
        };
      }
      return {
        isValid: true,
        distanceDeg: Number(distDeg.toFixed(4)),
      };
    }
  }

  return { isValid: true };
}
