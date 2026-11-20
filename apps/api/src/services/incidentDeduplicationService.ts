import { prisma } from '../db/prisma';
import { Report, ReportCategory } from '@prisma/client';
import { LOCAL_LANDMARK_MAP, findLandmarkInText } from './geocodingService';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'ocid',
  'ved',
  'source',
]);

/**
 * Normalizes raw news URLs by stripping tracking parameters, standardizing protocol to HTTPS,
 * removing www. subdomain, lowercasing domain, and trimming trailing slashes while preserving root /.
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    let urlToParse = trimmed;
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(urlToParse)) {
      urlToParse = `https://${urlToParse}`;
    }

    const parsed = new URL(urlToParse);
    parsed.protocol = 'https:';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    for (const k of keysToDelete) {
      parsed.searchParams.delete(k);
    }

    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname.length === 0) {
      pathname = '/';
    }
    parsed.pathname = pathname;

    const qs = parsed.searchParams.toString();
    const hash = parsed.hash || '';
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${qs ? '?' + qs : ''}${hash}`;
  } catch {
    return trimmed;
  }
}

const OUTLET_SUFFIX_PATTERN =
  /\s*[-–—|]\s*(?:the daily star|daily star|prothom alo|প্রথম আলো|dhaka post|ঢাকা পোস্ট|সমকাল|samakal|কালের কণ্ঠ|kalerkantho|যুগান্তর|jugantor|ইত্তেফাক|ittefaq|bdnews24|banglanews24|jagonews24|bangladesh pratidin|বাংলাদেশ প্রতিদিন|মানবজমিন|ইনকিলাব|বণিক বার্তা|সারাবাংলা|বাংলা ট্রিবিউন|bangla tribune|সময় টিভি|somoy tv|যমুনা টিভি|jamuna tv|ডিবিসি নিউজ|dbc news|চ্যানেল ২৪|channel 24|bd bulletin|cvoice24|daily observer|ajker patrika|the business standard|risingbd)[^$]*$/i;

/**
 * Cleans raw news headlines by stripping feed aggregator prefixes, trailing outlet credits,
 * and punctuation markers (Bengali Double Dari, Dari, En-dash, Em-dash).
 */
export function cleanIncidentTitle(rawTitle: string): string {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let title = rawTitle.trim();
  if (!title) return '';

  // 1. Strip leading feed aggregator prefixes: [Google News ...], [The Daily Star], [Press: ...]
  title = title.replace(/^\[(?:google news[^\]]*|the daily star[^\]]*|press:[^\]]*)\]\s*/i, '');

  // 2. Strip trailing publisher credits like "- The Daily Star", "| প্রথম আলো"
  title = title.replace(OUTLET_SUFFIX_PATTERN, '');

  // 3. Strip Bengali Double Dari (॥, \u0965), Dari (।, \u0964), En-dash (–, \u2013), Em-dash (—, \u2014), pipes (|), dashes
  title = title.replace(/[॥।–—|]/g, ' ');

  // 4. Collapse consecutive whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // 5. If title consists only of punctuation/symbols/dashes after cleaning, return empty string
  if (!/[a-zA-Z0-9\u0980-\u09FF]/.test(title)) {
    return '';
  }

  return title;
}

const BENGALI_STOPWORDS = new Set([
  'ও',
  'এবং',
  'বা',
  'এ',
  'এর',
  'কে',
  'তে',
  'হতে',
  'থেকে',
  'পর',
  'হয়ে',
  'হলে',
  'করে',
  'করা',
  'হয়েছে',
  'নিয়ে',
  'সঙ্গে',
  'সাথে',
  'জন',
  'হওয়ায়',
  'নিহতদের',
  'নিহতরা',
  'আহতরা',
  'জানিয়েছে',
  'জানান',
  'পুলিশ',
  'থানার',
  'উপজেলার',
  'এলাকায়',
  'ইন',
  'অন',
  'দ্য',
  'জাতীয়',
  'জাতীয়',
  'সংবাদ',
  'সংস্থা',
  'news',
  'the',
  'and',
  'with',
  'from',
  'near',
  'hospital',
  'police',
  'case',
  'tv',
  'com',
  'in',
  'at',
  'on',
  'of',
  'to',
  'for',
]);

const OUTLET_NAMES = [
  'jagonews24',
  'the daily star',
  'daily star',
  'দ্য ডেইলি স্টার বাংলা',
  'দ্য ডেইলি স্টার',
  'ডেইলি স্টার',
  'bangladesh times',
  'বাংলাদেশ টাইমস',
  'risingbd',
  'dhakapost',
  'ঢাকা পোস্ট',
  'dbcnews',
  'প্রথম আলো',
  'prothom alo',
  'বিডিনিউজ টোয়েন্টিফোর ডটকম',
  'বিডিনিউজ',
  'bdnews24',
  'বাংলাদেশ সংবাদ সংস্থা',
  'বাসস',
  'সমকাল',
  'কালের কণ্ঠ',
  'যুগান্তর',
  'ইত্তেফাক',
  'বাংলাদেশ প্রতিদিন',
  'ইনকিলাব',
  'মানবজমিন',
  'বণিক বার্তা',
  'বাংলানিউজ',
  'banglanews24',
  'সারাবাংলা',
  'বাংলা ট্রিবিউন',
  'bangla tribune',
  'সময় টিভি',
  'somoy tv',
  'যমুনা টিভি',
  'jamuna tv',
  'ডিবিসি নিউজ',
  'চ্যানেল ২৪',
  'channel 24',
  'ekattor tv',
  'google news',
];

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d] || d);
}

/**
 * Cross-lingual Concept Dictionary:
 * Bridges English and Bangla news headlines so identical incidents reported across
 * different languages (e.g. The Daily Star in English vs Jagonews24 in Bangla)
 * resolve to the exact same canonical tokens.
 */
const RAW_BILINGUAL_CONCEPT_MAP: Record<string, string> = {
  // Vehicles
  'ট্রাক': 'truck',
  'ট্রাকের': 'truck',
  'truck': 'truck',
  'trucks': 'truck',
  'লরি': 'truck',
  'লরির': 'truck',
  'lorry': 'truck',
  'ডাম্প': 'truck',
  'dump': 'truck',
  'পিকআপ': 'pickup',
  'পিকআপের': 'pickup',
  'পিকআপভ্যান': 'pickup',
  'pickup': 'pickup',
  'pickups': 'pickup',
  'বাস': 'bus',
  'বাসের': 'bus',
  'bus': 'bus',
  'buses': 'bus',
  'সিএনজি': 'cng',
  'সিএনজির': 'cng',
  'cng': 'cng',
  'অটোরিকশা': 'cng',
  'autorickshaw': 'cng',
  'মাইক্রোবাস': 'microbus',
  'microbus': 'microbus',
  'মোটরসাইকেল': 'motorcycle',
  'মোটরসাইকেলের': 'motorcycle',
  'motorcycle': 'motorcycle',
  'বাইক': 'motorcycle',
  'bike': 'motorcycle',
  'ভ্যান': 'van',
  'van': 'van',
  'গাড়ি': 'car',
  'গাড়ির': 'car',
  'গাড়ী': 'car',
  'car': 'car',
  'cars': 'car',
  'প্রাইভেটকার': 'car',
  'ট্রেন': 'train',
  'ট্রেনের': 'train',
  'train': 'train',
  'নসিমন': 'nosimon',
  'নসিমনের': 'nosimon',
  'নছিমন': 'nosimon',
  'nosimon': 'nosimon',
  'করিমন': 'korimon',
  'করিমনের': 'korimon',
  'korimon': 'korimon',
  'ভটভটি': 'bhotbhoti',
  'ভটভটির': 'bhotbhoti',
  'bhotbhoti': 'bhotbhoti',
  'লেগুনা': 'leguna',
  'লেগুনার': 'leguna',
  'leguna': 'leguna',
  'মাহিন্দ্রা': 'mahindra',
  'মাহিন্দ্রার': 'mahindra',
  'mahindra': 'mahindra',
  'ট্রাক্টর': 'tractor',
  'ট্রাক্টরের': 'tractor',
  'tractor': 'tractor',
  'অ্যাম্বুলেন্স': 'ambulance',
  'অ্যাম্বুলেন্সের': 'ambulance',
  'ambulance': 'ambulance',

  // Collision & Crash
  'সংঘর্ষ': 'collision',
  'সংঘর্ষে': 'collision',
  'মুখোমুখি': 'collision',
  'collision': 'collision',
  'crash': 'collision',
  'crashes': 'collision',
  'ধাক্কা': 'collision',
  'ধাক্কায়': 'collision',
  'hit': 'collision',
  'দুর্ঘটনা': 'accident',
  'accident': 'accident',

  // Casualty & Harm
  'নিহত': 'killed',
  'প্রাণহানি': 'killed',
  'killed': 'killed',
  'kill': 'killed',
  'dead': 'killed',
  'dies': 'killed',
  'death': 'killed',
  'deaths': 'killed',
  'fatal': 'killed',
  'fatality': 'killed',
  'লাশ': 'killed',
  'মরদেহ': 'killed',
  'আহত': 'injured',
  'injured': 'injured',
  'injuries': 'injured',
  'hurt': 'injured',

  // Crimes & Violence
  'ডাকাতি': 'robbery',
  'ডাকাতির': 'robbery',
  'robbery': 'robbery',
  'dacoity': 'robbery',
  'লুণ্ঠন': 'robbery',
  'লুণ্ঠিত': 'robbery',
  'লুট': 'robbery',
  'লুটপাট': 'robbery',
  'লুটের': 'robbery',
  'টাকা': 'money',
  'money': 'money',
  'looted': 'robbery',
  'চুরি': 'theft',
  'theft': 'theft',
  'burglary': 'theft',
  'stolen': 'theft',
  'ছিনতাই': 'snatching',
  'ছিনতাইয়ের': 'snatching',
  'ছিনতাইকারী': 'snatching',
  'snatching': 'snatching',
  'mugging': 'snatching',
  'mugged': 'snatching',
  'mugger': 'snatching',
  'overpass': 'overpass',
  'ওভারব্রিজ': 'overpass',
  'ওভারব্রিজের': 'overpass',
  'flyover': 'overpass',
  'ফ্লাইওভার': 'overpass',
  'pedestrian': 'pedestrian',
  'পথচারী': 'pedestrian',
  'পথচারীর': 'pedestrian',
  'পথচারীকে': 'pedestrian',
  'knife': 'stabbing',
  'ছুরি': 'stabbing',
  'ছুরিকাঘাতে': 'stabbing',
  'গ্রেপ্তার': 'arrest',
  'গ্রেফতার': 'arrest',
  'আটক': 'arrest',
  'arrest': 'arrest',
  'arrested': 'arrest',
  'held': 'arrest',
  'detained': 'arrest',
  'খুন': 'murder',
  'হত্যা': 'murder',
  'murder': 'murder',
  'কোপানো': 'stabbing',
  'কুপিয়ে': 'stabbing',
  'ছুরিকাঘাত': 'stabbing',
  'stabbed': 'stabbing',
  'stabbing': 'stabbing',
  'গুলি': 'gunfire',
  'গুলিবিদ্ধ': 'gunfire',
  'shot': 'gunfire',
  'gunfire': 'gunfire',
  'shooting': 'gunfire',
  'আগুন': 'arson',
  'অগ্নিসংযোগ': 'arson',
  'fire': 'arson',
  'arson': 'arson',
  'কিশোর': 'teengang',
  'গ্যাং': 'teengang',
  'gang': 'teengang',
  'চাঁদাবাজি': 'extortion',
  'extortion': 'extortion',

  // Locations & Landmarks
  'ফার্মগেট': 'farmgate',
  'farmgate': 'farmgate',
  'মিরপুর': 'mirpur',
  'mirpur': 'mirpur',
  'উত্তরা': 'uttara',
  'uttara': 'uttara',
  'ধানমন্ডি': 'dhanmondi',
  'dhanmondi': 'dhanmondi',
  'যাত্রাবাড়ী': 'jatrabari',
  'jatrabari': 'jatrabari',
  'মোহাম্মদপুর': 'mohammadpur',
  'mohammadpur': 'mohammadpur',
  'গুলশান': 'gulshan',
  'gulshan': 'gulshan',
  'বনানী': 'banani',
  'banani': 'banani',
  'মতিঝিল': 'motijheel',
  'motijheel': 'motijheel',
  'বাড্ডা': 'badda',
  'badda': 'badda',
  'সীতাকুণ্ড': 'sitakunda',
  'sitakunda': 'sitakunda',
  'গাজীপুর': 'gazipur',
  'gazipur': 'gazipur',
  'টঙ্গী': 'tongi',
  'tongi': 'tongi',
  'কেরানীগঞ্জ': 'keraniganj',
  'keraniganj': 'keraniganj',
  'টেকনাফ': 'teknaf',
  'teknaf': 'teknaf',
  'সিলেট': 'sylhet',
  'sylhet': 'sylhet',
  'ময়মনসিংহ': 'mymensingh',
  'mymensingh': 'mymensingh',
  'রাজশাহী': 'rajshahi',
  'rajshahi': 'rajshahi',
  'চট্টগ্রাম': 'chittagong',
  'chittagong': 'chittagong',
  'খুলনা': 'khulna',
  'khulna': 'khulna',
  'বরিশাল': 'barisal',
  'barisal': 'barisal',
  'রংপুর': 'rangpur',
  'rangpur': 'rangpur',

  // Drugs & Narcotics
  'ইয়াবা': 'yaba',
  'yaba': 'yaba',
  'মাদক': 'drug',
  'drug': 'drug',
  'drugs': 'drug',
  'narcotics': 'drug',
  'গাঁজা': 'drug',
  'ফেনসিডিল': 'drug',
  'হেরোইন': 'drug',
  'আইস': 'drug',
  'মাদকদ্রব্য': 'drug',
};

const BILINGUAL_CONCEPT_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(RAW_BILINGUAL_CONCEPT_MAP)) {
  BILINGUAL_CONCEPT_MAP[k] = v;
  BILINGUAL_CONCEPT_MAP[k.normalize('NFC')] = v;
}

const YYA_PATTERN = '(?:\u09df|\u09af\u09bc)';
const PLURAL_PATTERN = new RegExp(`(?:গুলোর|গুলোতে|গুলো${YYA_PATTERN}|গুলো|দের|খানা|খানি|টুকু)$`);
const CASE_PATTERN = /(?:ের|কে|তে|ে)$/;
const YYA_INFLECTION = new RegExp(`(?:${YYA_PATTERN}ে|${YYA_PATTERN})$`);

/**
 * Normalizes root words / synonyms in Bengali
 */
function stemBengaliToken(token: string): string {
  let word = token.normalize('NFC').toLowerCase();

  // Strip known trailing plural/case inflections while preserving base vowel 'া'
  word = word
    .replace(PLURAL_PATTERN, '')
    .replace(CASE_PATTERN, '')
    .replace(YYA_INFLECTION, '');

  const normGari = 'গাড়ি'.normalize('NFC');
  const normGariOld = 'গাড়ী'.normalize('NFC');
  if (word.startsWith(normGari) || word.startsWith(normGariOld)) return normGari;

  const normDhakka = 'ধাক্কা'.normalize('NFC');
  if (word.startsWith(normDhakka)) return normDhakka;

  const normChintay = 'ছিনতাই'.normalize('NFC');
  if (word.startsWith(normChintay)) return normChintay;

  if (word.startsWith('গ্রেপ্তা') || word.startsWith('গ্রেফতা') || word === 'আটক') return 'গ্রেপ্তার'.normalize('NFC');
  if (word.startsWith('পিকআপ')) return 'পিকআপ';
  if (word.startsWith('ট্রাক')) return 'ট্রাক';
  if (word.startsWith('বাস')) return 'বাস';
  if (word.startsWith('লরি')) return 'লরি';
  if (word.startsWith('ডাকাতি')) return 'ডাকাতি';
  if (word.startsWith('লুণ্ঠ')) return 'লুণ্ঠন';
  if (word.startsWith('টাকা')) return 'টাকা';
  if (word.startsWith('মামলা')) return 'মামলা';
  if (word.startsWith('ঘটনা')) return 'ঘটনা';

  return word;
}

/**
 * Extracts normalized, stemmed, cross-lingual significant entity/event tokens from a news title
 */
export function extractSignificantTokens(rawTitle: string): Set<string> {
  const cleanedTitle = cleanIncidentTitle(rawTitle);
  const normDigits = normalizeDigits(cleanedTitle);
  let text = normDigits.normalize('NFC').toLowerCase();

  // Strip zero-width non-joiner and zero-width joiner
  text = text.replace(/[\u200C\u200D]/g, '');

  // Strip [Google News ...] prefixes
  text = text.replace(/^\[(?:google news[^\]]*|the daily star[^\]]*)\]\s*/i, '');

  // Strip media outlet brand signatures
  for (const outlet of OUTLET_NAMES) {
    text = text.split(outlet).join(' ');
  }

  const significant = new Set<string>();

  // Extract identified landmark entity tokens (e.g. Uttara, Mirpur, Patenga)
  const landmarkMatch = findLandmarkInText(rawTitle);
  if (landmarkMatch) {
    const locLower = landmarkMatch.locationName.toLowerCase();
    significant.add(locLower);
    const shortLoc = locLower.split(',')[0].trim();
    significant.add(shortLoc);
  }

  // Extract standalone digits (e.g. casualty counts: '2', '3', '8')
  const digitMatches = normDigits.match(/\b\d+\b/g);
  if (digitMatches) {
    digitMatches.forEach((d) => significant.add(d));
  }

  // Strip punctuation and special characters including Double Dari, En-dash, and guillemets
  text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ');

  const rawWords = text.split(/\s+/).map((w) => w.trim()).filter(Boolean);

  for (const w of rawWords) {
    if (BENGALI_STOPWORDS.has(w)) continue;

    // Check cross-lingual concept dictionary
    const canonicalConcept = BILINGUAL_CONCEPT_MAP[w];
    if (canonicalConcept) {
      significant.add(canonicalConcept);
    }

    const stemmed = stemBengaliToken(w);
    if (stemmed.length >= 1 && !BENGALI_STOPWORDS.has(stemmed)) {
      significant.add(stemmed);
      const conceptFromStemmed = BILINGUAL_CONCEPT_MAP[stemmed];
      if (conceptFromStemmed) {
        significant.add(conceptFromStemmed);
      }
    }
  }

  return significant;
}

/**
 * Identifies major location names mentioned in title
 */
function extractLocations(tokens: Set<string>): string[] {
  const locs: string[] = [];
  for (const t of tokens) {
    if (
      LOCAL_LANDMARK_MAP[t] ||
      LOCAL_LANDMARK_MAP[t + 'ে'] ||
      LOCAL_LANDMARK_MAP[t + 'ের'] ||
      Object.values(LOCAL_LANDMARK_MAP).some((m) => m.standardName.toLowerCase() === t)
    ) {
      locs.push(t);
    }
  }
  return locs;
}

const VEHICLE_CANONICAL_MAP: Record<string, string> = {
  bus: 'BUS', buses: 'BUS', 'বাস': 'BUS', 'বাসের': 'BUS',
  truck: 'TRUCK', trucks: 'TRUCK', 'ট্রাক': 'TRUCK', 'ট্রাকের': 'TRUCK', lorry: 'TRUCK', 'লরি': 'TRUCK', 'লরির': 'TRUCK',
  pickup: 'PICKUP', 'পিকআপ': 'PICKUP', 'পিকআপের': 'PICKUP',
  van: 'COVERED_VAN', 'covered van': 'COVERED_VAN', 'covered-van': 'COVERED_VAN', 'কাভার্ডভ্যান': 'COVERED_VAN', 'কাভার্ডভ্যানের': 'COVERED_VAN', 'ভ্যান': 'COVERED_VAN',
  motorcycle: 'MOTORCYCLE', motorbike: 'MOTORCYCLE', bike: 'MOTORCYCLE', 'মোটরসাইকেল': 'MOTORCYCLE', 'মোটরসাইকেলের': 'MOTORCYCLE', 'বাইক': 'MOTORCYCLE', 'বাইকের': 'MOTORCYCLE',
  cng: 'CNG', 'auto-rickshaw': 'CNG', autorickshaw: 'CNG', easybike: 'CNG', 'সিএনজি': 'CNG', 'সিএনজির': 'CNG', 'অটোরিকশা': 'CNG', 'ইজিবাইক': 'CNG', 'টমটম': 'CNG',
  microbus: 'MICROBUS', 'মাইক্রোবাস': 'MICROBUS', 'মাইক্রোবাসের': 'MICROBUS', car: 'CAR', 'প্রাইভেটকার': 'CAR', 'কার': 'CAR',
  train: 'TRAIN', 'ট্রেন': 'TRAIN', 'ট্রেনের': 'TRAIN',
  nosimon: 'NOSIMON', 'নসিমন': 'NOSIMON', 'নসিমনের': 'NOSIMON', 'নছিমন': 'NOSIMON',
  korimon: 'KORIMON', 'করিমন': 'KORIMON', 'করিমনের': 'KORIMON',
  bhotbhoti: 'BHOTBHOTI', 'ভটভটি': 'BHOTBHOTI', 'ভটভটির': 'BHOTBHOTI',
  leguna: 'LEGUNA', 'লেগুনা': 'LEGUNA', 'লেগুনার': 'LEGUNA',
  mahindra: 'MAHINDRA', 'মাহিন্দ্রা': 'MAHINDRA', 'মাহিন্দ্রার': 'MAHINDRA',
  tractor: 'TRACTOR', 'ট্রাক্টর': 'TRACTOR', 'ট্রাক্টরের': 'TRACTOR',
  ambulance: 'AMBULANCE', 'অ্যাম্বুলেন্স': 'AMBULANCE', 'অ্যাম্বুলেন্সের': 'AMBULANCE',
};

export function extractVehicles(tokensOrText: Set<string> | string[] | string): Set<string> {
  const vehicles = new Set<string>();
  const tokenList: string[] = typeof tokensOrText === 'string'
    ? Array.from(extractSignificantTokens(tokensOrText))
    : Array.isArray(tokensOrText) ? tokensOrText : Array.from(tokensOrText);

  for (const token of tokenList) {
    const norm = token.toLowerCase().trim();
    if (VEHICLE_CANONICAL_MAP[norm]) {
      vehicles.add(VEHICLE_CANONICAL_MAP[norm]);
    }
  }
  return vehicles;
}

/**
 * Calculates token overlap similarity between two titles.
 * Fully supports bilingual matching (English <-> Bangla) and applies vehicle conflict penalty.
 */
export function calculateStorySimilarity(
  title1: string,
  title2: string
): { isDuplicate: boolean; score: number; sharedTokens: string[] } {
  const set1 = extractSignificantTokens(title1);
  const set2 = extractSignificantTokens(title2);

  if (set1.size === 0 || set2.size === 0) {
    return { isDuplicate: false, score: 0, sharedTokens: [] };
  }

  // If both titles explicitly mention conflicting districts (e.g. Mymensingh vs Sylhet), reject duplicate
  const locs1 = extractLocations(set1);
  const locs2 = extractLocations(set2);
  if (locs1.length > 0 && locs2.length > 0) {
    const hasSharedLoc = locs1.some((l1) =>
      locs2.some((l2) => {
        if (l1 === l2) return true;
        const s1 = LOCAL_LANDMARK_MAP[l1]?.standardName || l1;
        const s2 = LOCAL_LANDMARK_MAP[l2]?.standardName || l2;
        return s1.toLowerCase() === s2.toLowerCase();
      })
    );
    if (!hasSharedLoc) {
      return { isDuplicate: false, score: 0, sharedTokens: [] };
    }
  }

  // Vehicle Conflict Penalty:
  // If both stories mention vehicle entities, but have completely disjoint sets of vehicles
  // (e.g. Bus-Truck collision at 8 AM vs Covered Van-Motorcycle crash at 2 PM on the same highway)
  const vehicles1 = extractVehicles(set1);
  const vehicles2 = extractVehicles(set2);
  let vehicleConflict = false;
  if (vehicles1.size > 0 && vehicles2.size > 0) {
    const hasSharedVehicle = Array.from(vehicles1).some((v) => vehicles2.has(v));
    if (!hasSharedVehicle) {
      vehicleConflict = true;
    }
  }

  const sharedTokens: string[] = [];
  for (const t of set1) {
    if (set2.has(t)) {
      sharedTokens.push(t);
    }
  }

  const unionSize = new Set([...set1, ...set2]).size;
  const jaccard = unionSize > 0 ? sharedTokens.length / unionSize : 0;
  const overlapRatio = sharedTokens.length / Math.min(set1.size, set2.size);

  // Core anchor entities that strongly indicate identical incidents
  const highValueEntities = [
    'truck',
    'pickup',
    'bus',
    'microbus',
    'cng',
    'motorcycle',
    'nosimon',
    'korimon',
    'bhotbhoti',
    'leguna',
    'mahindra',
    'tractor',
    'ambulance',
    'collision',
    'accident',
    'killed',
    'injured',
    'robbery',
    'theft',
    'snatching',
    'arrest',
    'murder',
    'stabbing',
    'gunfire',
    'arson',
    'teengang',
    'extortion',
    'yaba',
    'drug',
    'মাদক',
    'ইয়াবা',
    'ইয়াবা'.normalize('NFC'),
    'ট্রাক',
    'পিকআপ',
    'বাস',
    'সংঘর্ষ',
    'ডাকাতি',
    'ছিনতাই',
    'গ্রেপ্তার',
    'খুন',
  ];

  const sharedHighValue = sharedTokens.filter((st) => highValueEntities.includes(st));

  let finalScore = Math.max(jaccard, overlapRatio);
  if (vehicleConflict) {
    finalScore = Math.max(0, finalScore - 0.40);
  }

  // Incident Duplicate Criteria:
  // 1. 3 or more shared tokens and Jaccard >= 0.25
  // 2. OR 2 or more shared high-value entities (e.g. [truck, pickup] or [robbery, arrest]) and overlapRatio >= 0.35
  // 3. OR high overall overlap (>= 0.50)
  // Strictly disallowed if vehicleConflict is true
  const isDuplicate = !vehicleConflict && (
    (sharedTokens.length >= 3 && jaccard >= 0.25) ||
    (sharedHighValue.length >= 2 && overlapRatio >= 0.35) ||
    overlapRatio >= 0.5
  );

  return {
    isDuplicate,
    score: finalScore,
    sharedTokens,
  };
}

/**
 * Searches the database for an existing active report representing the same incident.
 * Checks spatial proximity (approx 3.5km, expanding to 35km for parent district centroid matches),
 * category match, and title token similarity.
 */
export async function findDuplicateActiveReport(params: {
  title: string;
  category: ReportCategory;
  latitude: number;
  longitude: number;
  district?: string;
  upazila?: string;
  locationPrecision?: string;
  maxDistanceDegrees?: number;
  lookbackHours?: number;
}): Promise<{
  existingReport: Report;
  sharedTokens: string[];
  shouldUpgradeCoords?: boolean;
  newCoords?: { latitude: number; longitude: number; district?: string; upazila?: string };
} | null> {
  const { title, category, latitude, longitude, district, upazila, locationPrecision } = params;
  let maxDelta = params.maxDistanceDegrees ?? 0.035; // ~3.5 km
  const lookbackHours = params.lookbackHours ?? 48; // 48 hours
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  if (locationPrecision === 'DISTRICT' && district) {
    maxDelta = 0.35;
  }

  // Categories that can be considered compatible when matching duplicate press coverage
  const compatibleCategories: Record<string, ReportCategory[]> = {
    ROAD_ACCIDENT: ['ROAD_ACCIDENT', 'ARMED_ASSAULT'],
    ROBBERY: ['ROBBERY', 'DACOITY', 'THEFT_ROBBERY', 'THEFT'],
    THEFT: ['THEFT', 'THEFT_ROBBERY', 'ROBBERY'],
    THEFT_ROBBERY: ['THEFT_ROBBERY', 'ROBBERY', 'THEFT', 'DACOITY', 'THEFT_DACOITY'],
    SNATCHING: ['SNATCHING', 'MUGGING', 'SNATCHING_ARMED_ASSAULT'],
    SNATCHING_ARMED_ASSAULT: ['SNATCHING_ARMED_ASSAULT', 'SNATCHING', 'ARMED_ASSAULT', 'MUGGING'],
    ARMED_ASSAULT: ['ARMED_ASSAULT', 'SNATCHING_ARMED_ASSAULT', 'ROAD_ACCIDENT'],
    EXTORTION: ['EXTORTION', 'YOUTH_GANG_ACTIVITY'],
    YOUTH_GANG_ACTIVITY: ['YOUTH_GANG_ACTIVITY', 'TEEN_GANG', 'TEEN_GANG_ARMED_ASSAULT', 'EXTORTION', 'ARMED_ASSAULT'],
    DRUG_RELATED_CRIME: ['DRUG_RELATED_CRIME', 'DRUG_ACTIVITY'],
    UNLIT_ROAD: ['UNLIT_ROAD'],
    // Legacy aliases
    MUGGING: ['MUGGING', 'SNATCHING', 'SNATCHING_ARMED_ASSAULT'],
    DACOITY: ['DACOITY', 'ROBBERY', 'THEFT_ROBBERY', 'THEFT'],
    THEFT_DACOITY: ['THEFT_DACOITY', 'THEFT_ROBBERY', 'ROBBERY', 'THEFT'],
    TEEN_GANG: ['TEEN_GANG', 'YOUTH_GANG_ACTIVITY', 'TEEN_GANG_ARMED_ASSAULT'],
    TEEN_GANG_ARMED_ASSAULT: ['TEEN_GANG_ARMED_ASSAULT', 'YOUTH_GANG_ACTIVITY', 'ARMED_ASSAULT'],
    DRUG_ACTIVITY: ['DRUG_ACTIVITY', 'DRUG_RELATED_CRIME'],
  };

  const allowedCategories = compatibleCategories[category] || [category];

  const whereConditions: any = {
    status: 'ACTIVE',
    createdAt: { gte: cutoff },
    category: { in: allowedCategories },
  };

  if (district) {
    whereConditions.OR = [
      {
        latitude: { gte: latitude - maxDelta, lte: latitude + maxDelta },
        longitude: { gte: longitude - maxDelta, lte: longitude + maxDelta },
      },
      {
        district: district,
        latitude: { gte: latitude - 0.35, lte: latitude + 0.35 },
        longitude: { gte: longitude - 0.35, lte: longitude + 0.35 },
      },
    ];
  } else {
    whereConditions.latitude = { gte: latitude - maxDelta, lte: latitude + maxDelta };
    whereConditions.longitude = { gte: longitude - maxDelta, lte: longitude + maxDelta };
  }

  const candidates = await prisma.report.findMany({
    where: whereConditions,
    include: {
      newsArticles: {
        select: { title: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  for (const candidate of candidates) {
    const candidateTitle =
      candidate.newsArticles?.[0]?.title ||
      (candidate.description ? cleanIncidentTitle(candidate.description.split('\n')[0]) : '');
    const sim = calculateStorySimilarity(title, candidateTitle);

    if (sim.isDuplicate) {
      const candidatePrecision = (candidate as any).locationPrecision || 'EXACT';
      let shouldUpgradeCoords = false;
      let newCoords: { latitude: number; longitude: number; district?: string; upazila?: string } | undefined = undefined;

      if (candidatePrecision === 'DISTRICT' && (locationPrecision === 'UPAZILA' || locationPrecision === 'EXACT')) {
        shouldUpgradeCoords = true;
        newCoords = { latitude, longitude, district, upazila };
      }

      return {
        existingReport: candidate,
        sharedTokens: sim.sharedTokens,
        shouldUpgradeCoords,
        newCoords,
      };
    }
  }

  return null;
}
