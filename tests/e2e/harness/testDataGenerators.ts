import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@repo/shared';
import type {
  RawNewsItemContract,
  ClassifiedArticleContract,
  ReportEntityContract,
  GeocodeResultContract,
} from './contractValidator';

export const ALL_11_SAFETY_CATEGORIES: ReportCategory[] = [
  'THEFT',
  'ROBBERY',
  'THEFT_ROBBERY',
  'SNATCHING',
  'ARMED_ASSAULT',
  'SNATCHING_ARMED_ASSAULT',
  'EXTORTION',
  'YOUTH_GANG_ACTIVITY',
  'DRUG_RELATED_CRIME',
  'UNLIT_ROAD',
  'ROAD_ACCIDENT',
];

export const ALL_8_DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
] as const;

export const DISTRICT_TO_DIVISION: Record<string, string> = {
  // Dhaka Division (13)
  Dhaka: 'Dhaka', Gazipur: 'Dhaka', Narayanganj: 'Dhaka', Narsingdi: 'Dhaka',
  Tangail: 'Dhaka', Kishoreganj: 'Dhaka', Manikganj: 'Dhaka', Munshiganj: 'Dhaka',
  Faridpur: 'Dhaka', Gopalganj: 'Dhaka', Madaripur: 'Dhaka', Rajbari: 'Dhaka',
  Shariatpur: 'Dhaka',
  // Chattogram Division (11)
  Chattogram: 'Chattogram', "Cox's Bazar": 'Chattogram', Cumilla: 'Chattogram',
  Feni: 'Chattogram', Brahmanbaria: 'Chattogram', Noakhali: 'Chattogram',
  Lakshmipur: 'Chattogram', Chandpur: 'Chattogram', Rangamati: 'Chattogram',
  Khagrachhari: 'Chattogram', Bandarban: 'Chattogram',
  // Rajshahi Division (8)
  Rajshahi: 'Rajshahi', Bogura: 'Rajshahi', Pabna: 'Rajshahi', Sirajganj: 'Rajshahi',
  Naogaon: 'Rajshahi', Natore: 'Rajshahi', Chapainawabganj: 'Rajshahi', Joypurhat: 'Rajshahi',
  // Khulna Division (10)
  Khulna: 'Khulna', Jashore: 'Khulna', Satkhira: 'Khulna', Bagerhat: 'Khulna',
  Kushtia: 'Khulna', Jhenaidah: 'Khulna', Chuadanga: 'Khulna', Magura: 'Khulna',
  Meherpur: 'Khulna', Narail: 'Khulna',
  // Barishal Division (6)
  Barishal: 'Barishal', Patuakhali: 'Barishal', Bhola: 'Barishal', Pirojpur: 'Barishal',
  Barguna: 'Barishal', Jhalakathi: 'Barishal',
  // Sylhet Division (4)
  Sylhet: 'Sylhet', Moulvibazar: 'Sylhet', Habiganj: 'Sylhet', Sunamganj: 'Sylhet',
  // Rangpur Division (8)
  Rangpur: 'Rangpur', Dinajpur: 'Rangpur', Kurigram: 'Rangpur', Gaibandha: 'Rangpur',
  Nilphamari: 'Rangpur', Panchagarh: 'Rangpur', Thakurgaon: 'Rangpur', Lalmonirhat: 'Rangpur',
  // Mymensingh Division (4)
  Mymensingh: 'Mymensingh', Jamalpur: 'Mymensingh', Netrokona: 'Mymensingh', Sherpur: 'Mymensingh',
};

export const ALL_64_DISTRICTS: string[] = Object.keys(DISTRICT_TO_DIVISION);

export const DISTRICT_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  // Dhaka Division
  Dhaka: { latitude: 23.8103, longitude: 90.4125 },
  Gazipur: { latitude: 24.0022, longitude: 90.4264 },
  Narayanganj: { latitude: 23.6238, longitude: 90.5000 },
  Narsingdi: { latitude: 23.9193, longitude: 90.7176 },
  Tangail: { latitude: 24.2513, longitude: 89.9167 },
  Kishoreganj: { latitude: 24.4449, longitude: 90.7766 },
  Manikganj: { latitude: 23.8644, longitude: 90.0047 },
  Munshiganj: { latitude: 23.5422, longitude: 90.5305 },
  Faridpur: { latitude: 23.6071, longitude: 89.8429 },
  Gopalganj: { latitude: 23.0051, longitude: 89.8266 },
  Madaripur: { latitude: 23.1641, longitude: 90.1897 },
  Rajbari: { latitude: 23.7574, longitude: 89.6445 },
  Shariatpur: { latitude: 23.2423, longitude: 90.4348 },
  // Chattogram Division
  Chattogram: { latitude: 22.3569, longitude: 91.7832 },
  "Cox's Bazar": { latitude: 21.4272, longitude: 92.0058 },
  Cumilla: { latitude: 23.4682, longitude: 91.1788 },
  Feni: { latitude: 23.0159, longitude: 91.3976 },
  Brahmanbaria: { latitude: 23.9571, longitude: 91.1119 },
  Noakhali: { latitude: 22.8696, longitude: 91.0998 },
  Lakshmipur: { latitude: 22.9425, longitude: 90.8412 },
  Chandpur: { latitude: 23.2333, longitude: 90.6667 },
  Rangamati: { latitude: 22.7324, longitude: 92.2985 },
  Khagrachhari: { latitude: 23.1193, longitude: 91.9847 },
  Bandarban: { latitude: 22.1953, longitude: 92.2184 },
  // Rajshahi Division
  Rajshahi: { latitude: 24.3745, longitude: 88.6042 },
  Bogura: { latitude: 24.8465, longitude: 89.3777 },
  Pabna: { latitude: 24.0118, longitude: 89.2452 },
  Sirajganj: { latitude: 24.4534, longitude: 89.7008 },
  Naogaon: { latitude: 24.7936, longitude: 88.9318 },
  Natore: { latitude: 24.4206, longitude: 88.9324 },
  Chapainawabganj: { latitude: 24.5965, longitude: 88.2775 },
  Joypurhat: { latitude: 25.1011, longitude: 89.0277 },
  // Khulna Division
  Khulna: { latitude: 22.8456, longitude: 89.5403 },
  Jashore: { latitude: 23.1664, longitude: 89.2182 },
  Satkhira: { latitude: 22.7185, longitude: 89.0705 },
  Bagerhat: { latitude: 22.6516, longitude: 89.7859 },
  Kushtia: { latitude: 23.9013, longitude: 89.1205 },
  Jhenaidah: { latitude: 23.5448, longitude: 89.1539 },
  Chuadanga: { latitude: 23.6402, longitude: 88.8418 },
  Magura: { latitude: 23.4873, longitude: 89.4199 },
  Meherpur: { latitude: 23.7622, longitude: 88.6318 },
  Narail: { latitude: 23.1725, longitude: 89.5127 },
  // Barishal Division
  Barishal: { latitude: 22.7010, longitude: 90.3535 },
  Patuakhali: { latitude: 22.3596, longitude: 90.3299 },
  Bhola: { latitude: 22.6859, longitude: 90.6481 },
  Pirojpur: { latitude: 22.5841, longitude: 89.9720 },
  Barguna: { latitude: 22.1587, longitude: 90.1256 },
  Jhalakathi: { latitude: 22.6406, longitude: 90.1987 },
  // Sylhet Division
  Sylhet: { latitude: 24.8949, longitude: 91.8687 },
  Moulvibazar: { latitude: 24.4829, longitude: 91.7774 },
  Habiganj: { latitude: 24.3749, longitude: 91.4155 },
  Sunamganj: { latitude: 25.0658, longitude: 91.3950 },
  // Rangpur Division
  Rangpur: { latitude: 25.7439, longitude: 89.2752 },
  Dinajpur: { latitude: 25.6217, longitude: 88.6355 },
  Kurigram: { latitude: 25.8054, longitude: 89.6362 },
  Gaibandha: { latitude: 25.3288, longitude: 89.5408 },
  Nilphamari: { latitude: 25.9318, longitude: 88.8560 },
  Panchagarh: { latitude: 26.3411, longitude: 88.5542 },
  Thakurgaon: { latitude: 26.0337, longitude: 88.4617 },
  Lalmonirhat: { latitude: 25.9923, longitude: 89.2847 },
  // Mymensingh Division
  Mymensingh: { latitude: 24.7471, longitude: 90.4203 },
  Jamalpur: { latitude: 24.9375, longitude: 89.9378 },
  Netrokona: { latitude: 24.8709, longitude: 90.7279 },
  Sherpur: { latitude: 25.0205, longitude: 90.0153 },
};

export interface PoliceStationFixture {
  station_id: string;
  station_name_en: string;
  station_name_bn: string;
  division: string;
  district: string;
  police_jurisdiction?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  verification?: {
    status: string;
    confidence: string;
  };
}

let cachedStations: PoliceStationFixture[] | null = null;

export function loadAllPoliceStations(): PoliceStationFixture[] {
  if (cachedStations) {
    return cachedStations;
  }

  const possiblePaths = [
    path.resolve(process.cwd(), 'bangladesh_police_stations.json'),
    path.resolve(__dirname, '../../../bangladesh_police_stations.json'),
    path.resolve(__dirname, '../../../../bangladesh_police_stations.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.stations)) {
          cachedStations = parsed.stations;
          return cachedStations!;
        }
      } catch {
        // Fallback to next path
      }
    }
  }

  // Fallback: 64 representative district police headquarters
  cachedStations = ALL_64_DISTRICTS.map((dist, idx) => {
    const center = DISTRICT_CENTERS[dist] || { latitude: 23.81, longitude: 90.41 };
    return {
      station_id: `BD-PS-${String(idx + 1).padStart(4, '0')}`,
      station_name_en: `${dist} Sadar Police Station`,
      station_name_bn: `${dist} সদর মডেল থানা`,
      division: DISTRICT_TO_DIVISION[dist] || 'Dhaka',
      district: dist,
      location: {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      verification: {
        status: 'verified',
        confidence: 'high',
      },
    };
  });

  return cachedStations!;
}

export function getPoliceStationsByDistrict(district: string): PoliceStationFixture[] {
  const all = loadAllPoliceStations();
  const lower = district.toLowerCase().trim();
  return all.filter((s) => s.district.toLowerCase().trim() === lower);
}

export function getPoliceStationByName(name: string): PoliceStationFixture | undefined {
  const all = loadAllPoliceStations();
  const lower = name.toLowerCase().trim();
  return all.find(
    (s) =>
      s.station_name_en.toLowerCase().includes(lower) ||
      lower.includes(s.station_name_en.toLowerCase()) ||
      s.station_name_bn.includes(name) ||
      name.includes(s.station_name_bn)
  );
}

// ============================================================================
// Fixture Generators
// ============================================================================

export function generateMockRawNewsItem(overrides: Partial<RawNewsItemContract> = {}): RawNewsItemContract {
  const id = crypto.randomUUID();
  return {
    guid: overrides.guid || `guid-${id}`,
    title: overrides.title || 'মিরপুরে বাসের ধাক্কায় পথচারী নিহত',
    link: overrides.link || `https://news.bangladesh.test/article-${id}?utm_source=rss&ref=fbclid`,
    pubDate: overrides.pubDate || new Date(),
    contentSnippet: overrides.contentSnippet || 'মিরপুর ১০ গোলচত্বরে একটি দ্রুতগতির বাসের ধাক্কায় এক ব্যক্তি প্রাণ হারিয়েছেন।',
    sourceName: overrides.sourceName || 'The Daily Star',
    categoryHint: overrides.categoryHint || 'ROAD_ACCIDENT',
  };
}

export function generateMockClassifiedArticle(
  category: ReportCategory = 'ROAD_ACCIDENT',
  overrides: Partial<ClassifiedArticleContract> = {}
): ClassifiedArticleContract {
  return {
    title: overrides.title || 'সীতাকুণ্ডে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত',
    canonicalUrl: overrides.canonicalUrl || 'https://news.bangladesh.test/sitakunda-accident',
    sourceName: overrides.sourceName || 'Prothom Alo',
    category,
    severity: overrides.severity || 'HIGH',
    confidence: overrides.confidence ?? 0.95,
    isSafetyRelated: overrides.isSafetyRelated ?? true,
    matchedKeywords: overrides.matchedKeywords || ['সংঘর্ষ', 'নিহত', 'বাস', 'ট্রাক'],
  };
}

export function generateMockGeocodeResult(
  overrides: Partial<GeocodeResultContract> = {}
): GeocodeResultContract {
  return {
    locationName: overrides.locationName || 'Ramna Model Thana',
    latitude: overrides.latitude ?? 23.745713,
    longitude: overrides.longitude ?? 90.404659,
    confidence: overrides.confidence || 'HIGH',
    district: overrides.district || 'Dhaka',
    division: overrides.division || 'Dhaka',
    source: overrides.source || 'DICTIONARY',
    isAmbiguous: overrides.isAmbiguous ?? false,
    matchedThana: overrides.matchedThana || 'Ramna',
  };
}

export function generateMockIncidentReport(
  overrides: Partial<ReportEntityContract> = {}
): ReportEntityContract {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    userId: overrides.userId || 'news-crawler-bot-system-v1',
    title: overrides.title || 'সীতাকুণ্ডে সড়ক দুর্ঘটনা',
    description: overrides.description ?? 'সীতাকুণ্ড থানা এলাকায় বাস-ট্রাক সংঘর্ষ',
    category: overrides.category || 'ROAD_ACCIDENT',
    severity: overrides.severity || 'HIGH',
    latitude: overrides.latitude ?? 22.6200,
    longitude: overrides.longitude ?? 91.6600,
    status: overrides.status || 'ACTIVE',
    verificationStage: overrides.verificationStage || 'CLASSIFIED',
    expiresAt: overrides.expiresAt !== undefined ? overrides.expiresAt : new Date(Date.now() + 48 * 3600 * 1000),
    citations: overrides.citations || [
      {
        sourceName: 'The Daily Star',
        sourceUrl: 'https://news.bangladesh.test/sitakunda-accident',
        title: '3 killed in Sitakunda highway collision',
      },
    ],
    upvotes: overrides.upvotes ?? 0,
    downvotes: overrides.downvotes ?? 0,
    sourceUrl: overrides.sourceUrl ?? 'https://news.bangladesh.test/sitakunda-accident',
    sourceName: overrides.sourceName ?? 'The Daily Star',
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
  };
}

export function generateBilingualNewsPair(
  category: ReportCategory,
  district: string
): { banglaTitle: string; englishTitle: string; district: string } {
  const center = DISTRICT_CENTERS[district] || { latitude: 23.81, longitude: 90.41 };
  switch (category) {
    case 'ROAD_ACCIDENT':
      return {
        banglaTitle: `${district}ে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ২`,
        englishTitle: `2 killed in bus-truck collision in ${district}`,
        district,
      };
    case 'SNATCHING':
      return {
        banglaTitle: `${district} সদর এলাকায় পথচারীর মোবাইল ও টাকা ছিনতাই`,
        englishTitle: `Mugging incident in ${district} sadar, phone snatched`,
        district,
      };
    case 'YOUTH_GANG_ACTIVITY':
      return {
        banglaTitle: `${district}ে কিশোর গ্যাংয়ের দুই পক্ষের মধ্যে সংঘর্ষ`,
        englishTitle: `Teen gang clash breaks out in ${district}`,
        district,
      };
    case 'DRUG_RELATED_CRIME':
      return {
        banglaTitle: `${district}ে বিপুল ইয়াবাসহ চিহ্নিত মাদক কারবারি আটক`,
        englishTitle: `Drug dealer arrested with yaba in ${district}`,
        district,
      };
    default:
      return {
        banglaTitle: `${district}ে আইনশৃঙ্খলা পরিস্থিতির অবনতিতে ঘটনা`,
        englishTitle: `Incident reported in ${district}`,
        district,
      };
  }
}
