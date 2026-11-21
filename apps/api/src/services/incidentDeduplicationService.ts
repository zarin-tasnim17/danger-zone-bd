import { prisma } from '../db/prisma';
import { Report, ReportCategory } from '@prisma/client';
import { LOCAL_LANDMARK_MAP, findLandmarkInText } from './geocodingService';
import { EventFingerprint, TimeOfDay, Citation } from '@repo/shared';
import {
  extractIncidentTemporalData,
  extractTimeOfDay,
  toBangladeshDateString,
} from './temporalExtractionService';
import { WireAgency } from './publisherRegistry';

export { EventFingerprint, TimeOfDay };

export interface TemporalWindow {
  occurrenceDate?: string; // YYYY-MM-DD in Bangladesh local time (UTC+6)
  timeOfDay?: TimeOfDay;
  publishedAt: Date;
}

export interface AdministrativeLocation {
  district?: string;
  upazila?: string;
  latitude: number;
  longitude: number;
}

export interface CasualtySignature {
  killed?: number;
  injured?: number;
}

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

  // Normalize decomposed Bengali Ya + Nukta (\u09af\u09bc) to atomic Yya (\u09df)
  title = title.replace(/\u09af\u09bc/g, '\u09df');

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
  'মাহিন্দ্র': 'mahindra',
  'মাহিন্দ্রর': 'mahindra',
  'মাহিন্দ্রকে': 'mahindra',
  'mahindra': 'mahindra',
  'ট্রাক্টর': 'tractor',
  'ট্রাক্টরের': 'tractor',
  'tractor': 'tractor',
  'অ্যাম্বুলেন্স': 'ambulance',
  'অ্যাম্বুলেন্সের': 'ambulance',
  'ambulance': 'ambulance',

  // Vehicles (Expanded Inflections & Local Transliterations)
  'বাসে': 'bus',
  'বাসটি': 'bus',
  'বাসটির': 'bus',
  'বাসটিকে': 'bus',
  'বাসটিতে': 'bus',
  'বাসটার': 'bus',
  'বাসটাকে': 'bus',
  'বাসটাতে': 'bus',
  'ট্রাকে': 'truck',
  'ট্রাকটি': 'truck',
  'ট্রাকটির': 'truck',
  'ট্রাকটিকে': 'truck',
  'ট্রাকটিতে': 'truck',
  'লরিকে': 'truck',
  'ডাম্পট্রাক': 'truck',
  'পিকআপে': 'pickup',
  'পিকআপভ্যানে': 'pickup',
  'কাভার্ডভ্যান': 'van',
  'কাভার্ডভ্যানের': 'van',
  'কাভার্ডভ্যানে': 'van',
  'কাভার্ড ভ্যান': 'van',
  'ভ্যানে': 'van',
  'মোটরবাইক': 'motorcycle',
  'মোটরবাইকের': 'motorcycle',
  'মোটরবাইকে': 'motorcycle',
  'বাইকে': 'motorcycle',
  'ইজিবাইক': 'cng',
  'ইজিবাইকের': 'cng',
  'ইজিবাইকে': 'cng',
  'টমটম': 'cng',
  'টমটমের': 'cng',
  'অটোরিকশায়': 'cng',
  'অটোরিকশাকে': 'cng',
  'ব্যাটারিচালিত': 'cng',
  'battery-run rickshaw': 'cng',
  'লেগুনায়': 'leguna',
  'নসিমনকে': 'nosimon',
  'করিমনকে': 'korimon',

  // Collision & Crash (Expanded Bengali & English)
  'সংঘর্ষ': 'clash',
  'সংঘর্ষে': 'clash',
  'সংঘর্ষের': 'clash',
  'সংঘর্ষটিতে': 'clash',
  'মুখোমুখি': 'collision',
  'ধাক্কা': 'collision',
  'ধাক্কায়': 'collision',
  'ধাক্কায়': 'collision',
  'চাপা': 'collision',
  'চাপায়': 'collision',
  'চাপায়': 'collision',
  'পিষ্ট': 'collision',
  'উল্টে': 'collision',
  'উল্টে গিয়ে': 'collision',
  'খাদে পড়ে': 'collision',
  'নিয়ন্ত্রণ হারিয়ে': 'collision',
  'নিয়ন্ত্রণ হারিয়ে': 'collision',
  'মুখোমুখি সংঘর্ষ': 'collision',
  'hit': 'collision',
  'collide': 'collision',
  'collides': 'collision',
  'collided': 'collision',
  'head-on': 'collision',
  'plunged': 'collision',
  'plunges': 'collision',
  'overturned': 'collision',
  'overturns': 'collision',
  'skidded': 'collision',
  'rammed': 'collision',
  'mishap': 'accident',
  'pileup': 'accident',
  'দুর্ঘটনা': 'accident',
  'accident': 'accident',
  'collision': 'collision',
  'crash': 'collision',
  'crashes': 'collision',

  // Clashes, Skirmishes & Confrontations
  'সংঘাত': 'clash',
  'সংঘাতে': 'clash',
  'মারামারি': 'clash',
  'রণক্ষেত্র': 'clash',
  'হাতাহাতি': 'clash',
  'ধাওয়া-পাল্টাধাওয়া': 'clash',
  'ধাওয়া পাল্টা ধাওয়া': 'clash',
  'পাল্টাপাল্টি ধাওয়া': 'clash',
  'পাল্টাপাল্টি ধাওয়া': 'clash',
  'দলাদলি': 'clash',
  'দুই পক্ষের সংঘর্ষ': 'clash',
  'দুপক্ষের সংঘর্ষ': 'clash',
  'গ্রামবাসীর সংঘর্ষ': 'clash',
  'clash': 'clash',
  'clashes': 'clash',
  'clashed': 'clash',
  'clashing': 'clash',
  'scuffle': 'clash',
  'scuffles': 'clash',
  'skirmish': 'clash',
  'skirmishes': 'clash',
  'brawl': 'clash',
  'confrontation': 'clash',
  'turf war': 'clash',
  'chase and counter-chase': 'clash',

  // Political & Student Factions
  'ছাত্রলীগ': 'CHHATRA_LEAGUE',
  'ছাত্রলীগের': 'CHHATRA_LEAGUE',
  'bcl': 'CHHATRA_LEAGUE',
  'chhatra league': 'CHHATRA_LEAGUE',
  'ছাত্রদল': 'CHHATRA_DAL',
  'ছাত্রদলের': 'CHHATRA_DAL',
  'jcd': 'CHHATRA_DAL',
  'chhatra dal': 'CHHATRA_DAL',
  'আওয়ামী লীগ': 'AWAMI_LEAGUE',
  'আওয়ামী লীগ': 'AWAMI_LEAGUE',
  'আওয়ামী': 'AWAMI_LEAGUE',
  'আওয়ামী': 'AWAMI_LEAGUE',
  'আওয়ামী লীগের': 'AWAMI_LEAGUE',
  'আওয়ামী লীগের': 'AWAMI_LEAGUE',
  'awami league': 'AWAMI_LEAGUE',
  'al': 'AWAMI_LEAGUE',
  'বিএনপি': 'BNP',
  'বিএনপির': 'BNP',
  'bnp': 'BNP',
  'জামায়াত': 'JAMAAT',
  'জামায়াত': 'JAMAAT',
  'জামায়াতের': 'JAMAAT',
  'জামায়াতের': 'JAMAAT',
  'jamaat': 'JAMAAT',
  'শিবির': 'SHIBIR',
  'শিবিরের': 'SHIBIR',
  'shibir': 'SHIBIR',
  'যুবলীগ': 'JUBO_LEAGUE',
  'jubo league': 'JUBO_LEAGUE',

  // Mob Beating & Lynching
  'গণপিটুনি': 'mob_beating',
  'গণপিটুনিতে': 'mob_beating',
  'গণপিটুনির': 'mob_beating',
  'গণধোলাই': 'mob_beating',
  'পিটিয়ে হত্যা': 'mob_beating',
  'পিটিয়ে হত্যা': 'mob_beating',
  'পিটিয়ে জখম': 'mob_beating',
  'পিটিয়ে জখম': 'mob_beating',
  'পিটিয়ে': 'mob_beating',
  'পিটিয়ে': 'mob_beating',
  'পিটুনি': 'mob_beating',
  'lynched': 'mob_beating',
  'lynching': 'mob_beating',
  'beaten to death': 'mob_beating',
  'mass beating': 'mob_beating',
  'mob beating': 'mob_beating',
  'mob attack': 'mob_beating',
  'mob justice': 'mob_beating',
  'mob violence': 'mob_beating',

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
  'ডাকাতিতে': 'robbery',
  'ডাকাত': 'robbery',
  'ডাকাতদের': 'robbery',
  'robbery': 'robbery',
  'dacoity': 'robbery',
  'robbed': 'robbery',
  'robbers': 'robbery',
  'robber': 'robbery',
  'dacoits': 'robbery',
  'dacoit': 'robbery',
  'heist': 'robbery',
  'plundered': 'robbery',
  'লুণ্ঠন': 'robbery',
  'লুণ্ঠিত': 'robbery',
  'লুট': 'robbery',
  'লুটে': 'robbery',
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
  'ছিনতাইকালে': 'snatching',
  'ছিনতাইকারী': 'snatching',
  'ছিনতাইকারীদের': 'snatching',
  'snatching': 'snatching',
  'snatched': 'snatching',
  'snatchers': 'snatching',
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
  'আগুনে': 'arson',
  'ভয়াবহ আগুন': 'arson',
  'ভয়াবহ আগুন': 'arson',
  'দগ্ধ': 'arson',
  'দগ্ধ হয়ে': 'arson',
  'জ্বালিয়ে': 'arson',
  'পোড়ানো': 'arson',
  'অগ্নিকাণ্ড': 'arson',
  'অগ্নিকাণ্ডে': 'arson',
  'অগ্নিসংযোগ': 'arson',
  'fire': 'arson',
  'arson': 'arson',
  'blaze': 'arson',
  'inferno': 'arson',
  'gutted': 'arson',
  'torched': 'arson',
  'conflagration': 'arson',
  'burnt': 'arson',
  'burned': 'arson',
  'flames': 'arson',
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
const DEFINITIVE_PATTERN = /(?:টা|টি|টির|টিকে|টিতে|টার|টাকে|টাতে)$/;
const CASE_PATTERN = /(?:ের|কে|তে|ে)$/;
const YYA_INFLECTION = new RegExp(`(?:${YYA_PATTERN}ে|${YYA_PATTERN})$`);

/**
 * Normalizes root words / synonyms in Bengali
 */
function stemBengaliToken(token: string): string {
  let word = token.normalize('NFC').toLowerCase();

  // Strip known trailing plural/definitive/case inflections while preserving base vowel 'া'
  word = word
    .replace(PLURAL_PATTERN, '')
    .replace(DEFINITIVE_PATTERN, '')
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
  let text = normDigits.normalize('NFC').toLowerCase().replace(/\u09af\u09bc/g, '\u09df');

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

  // Check multi-word entries in BILINGUAL_CONCEPT_MAP (e.g. 'mob beating', 'mass beating', 'beaten to death', 'battery-run rickshaw', 'chase and counter-chase')
  const normalizedSpacedText = text
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ')
    .replace(/\s+/g, ' ');

  for (const [phrase, concept] of Object.entries(BILINGUAL_CONCEPT_MAP)) {
    if (phrase.includes(' ') || phrase.includes('-')) {
      const normPhrase = phrase.toLowerCase().normalize('NFC').replace(/\u09af\u09bc/g, '\u09df');
      const spacedPhrase = normPhrase.replace(/[\-–—_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.includes(normPhrase) || normalizedSpacedText.includes(spacedPhrase)) {
        significant.add(concept);
      }
    }
  }

  // Strip punctuation and special characters including Double Dari, En-dash, and guillemets
  text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ');

  const rawWords = text.split(/\s+/).map((w) => w.trim()).filter(Boolean);

  const hasVehicles = extractVehicles(rawTitle).size > 0;
  const hasFactions = extractFactions(rawTitle).size > 0;

  for (const w of rawWords) {
    if (BENGALI_STOPWORDS.has(w)) continue;

    // Check cross-lingual concept dictionary
    const canonicalConcept = BILINGUAL_CONCEPT_MAP[w];
    if (canonicalConcept) {
      significant.add(canonicalConcept);
    }

    if (w.startsWith('সংঘর্ষ')) {
      if (hasVehicles) significant.add('collision');
      if (hasFactions || !hasVehicles) significant.add('clash');
      if (!hasVehicles && !hasFactions) {
        significant.add('collision');
        significant.add('clash');
      }
    }

    const stemmed = stemBengaliToken(w);
    if (stemmed.length >= 1 && !BENGALI_STOPWORDS.has(stemmed)) {
      significant.add(stemmed);
      const conceptFromStemmed = BILINGUAL_CONCEPT_MAP[stemmed];
      if (conceptFromStemmed) {
        significant.add(conceptFromStemmed);
      }
      if (stemmed.startsWith('সংঘর্ষ')) {
        if (hasVehicles) significant.add('collision');
        if (hasFactions || !hasVehicles) significant.add('clash');
        if (!hasVehicles && !hasFactions) {
          significant.add('collision');
          significant.add('clash');
        }
      }
    }
  }

  // Inject extracted factions and weapons into significant tokens
  const factions = extractFactions(rawTitle);
  for (const f of factions) {
    significant.add(f);
  }

  const weapons = extractWeapons(rawTitle);
  for (const w of weapons) {
    significant.add(w);
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
  bus: 'BUS', buses: 'BUS', 'বাস': 'BUS', 'বাসের': 'BUS', 'বাসে': 'BUS', 'বাসটি': 'BUS', 'বাসটির': 'BUS', 'বাসটিকে': 'BUS', 'বাসটিতে': 'BUS', 'বাসটার': 'BUS', 'বাসটাকে': 'BUS', 'বাসটাতে': 'BUS',
  truck: 'TRUCK', trucks: 'TRUCK', 'ট্রাক': 'TRUCK', 'ট্রাকের': 'TRUCK', 'ট্রাকে': 'TRUCK', 'ট্রাকটি': 'TRUCK', 'ট্রাকটির': 'TRUCK', 'ট্রাকটিকে': 'TRUCK', 'ট্রাকটিতে': 'TRUCK', lorry: 'TRUCK', 'লরি': 'TRUCK', 'লরির': 'TRUCK', 'লরিকে': 'TRUCK', 'ডাম্পট্রাক': 'TRUCK',
  pickup: 'PICKUP', 'পিকআপ': 'PICKUP', 'পিকআপের': 'PICKUP', 'পিকআপে': 'PICKUP', 'পিকআপভ্যান': 'PICKUP', 'পিকআপভ্যানে': 'PICKUP',
  van: 'COVERED_VAN', 'covered van': 'COVERED_VAN', 'covered-van': 'COVERED_VAN', 'কাভার্ডভ্যান': 'COVERED_VAN', 'কাভার্ডভ্যানের': 'COVERED_VAN', 'কাভার্ডভ্যানে': 'COVERED_VAN', 'কাভার্ড ভ্যান': 'COVERED_VAN', 'ভ্যান': 'COVERED_VAN', 'ভ্যানে': 'COVERED_VAN',
  motorcycle: 'MOTORCYCLE', motorbike: 'MOTORCYCLE', bike: 'MOTORCYCLE', 'মোটরসাইকেল': 'MOTORCYCLE', 'মোটরসাইকেলের': 'MOTORCYCLE', 'মোটরসাইকেলে': 'MOTORCYCLE', 'মোটরবাইক': 'MOTORCYCLE', 'মোটরবাইকের': 'MOTORCYCLE', 'মোটরবাইকে': 'MOTORCYCLE', 'বাইক': 'MOTORCYCLE', 'বাইকের': 'MOTORCYCLE', 'বাইকে': 'MOTORCYCLE',
  cng: 'CNG', 'auto-rickshaw': 'CNG', autorickshaw: 'CNG', easybike: 'CNG', 'সিএনজি': 'CNG', 'সিএনজির': 'CNG', 'অটোরিকশা': 'CNG', 'অটোরিকশায়': 'CNG', 'অটোরিকশাকে': 'CNG', 'ইজিবাইক': 'CNG', 'ইজিবাইকের': 'CNG', 'ইজিবাইকে': 'CNG', 'টমটম': 'CNG', 'টমটমের': 'CNG', 'ব্যাটারিচালিত': 'CNG', 'battery-run rickshaw': 'CNG',
  microbus: 'MICROBUS', 'মাইক্রোবাস': 'MICROBUS', 'মাইক্রোবাসের': 'MICROBUS', car: 'CAR', 'প্রাইভেটকার': 'CAR', 'কার': 'CAR',
  train: 'TRAIN', 'ট্রেন': 'TRAIN', 'ট্রেনের': 'TRAIN',
  nosimon: 'NOSIMON', 'নসিমন': 'NOSIMON', 'নসিমনের': 'NOSIMON', 'নসিমনকে': 'NOSIMON', 'নছিমন': 'NOSIMON',
  korimon: 'KORIMON', 'করিমন': 'KORIMON', 'করিমনের': 'KORIMON', 'করিমনকে': 'KORIMON',
  bhotbhoti: 'BHOTBHOTI', 'ভটভটি': 'BHOTBHOTI', 'ভটভটির': 'BHOTBHOTI',
  leguna: 'LEGUNA', 'লেগুনা': 'LEGUNA', 'লেগুনার': 'LEGUNA', 'লেগুনায়': 'LEGUNA',
  mahindra: 'MAHINDRA', 'মাহিন্দ্রা': 'MAHINDRA', 'মাহিন্দ্রার': 'MAHINDRA', 'মাহিন্দ্র': 'MAHINDRA', 'মাহিন্দ্রর': 'MAHINDRA', 'মাহিন্দ্রকে': 'MAHINDRA',
  tractor: 'TRACTOR', 'ট্রাক্টর': 'TRACTOR', 'ট্রাক্টরের': 'TRACTOR',
  ambulance: 'AMBULANCE', 'অ্যাম্বুলেন্স': 'AMBULANCE', 'অ্যাম্বুলেন্সের': 'AMBULANCE',
};

export function extractVehicles(tokensOrText: Set<string> | string[] | string): Set<string> {
  const vehicles = new Set<string>();
  const text = typeof tokensOrText === 'string' ? tokensOrText.toLowerCase().normalize('NFC').replace(/\u09af\u09bc/g, '\u09df') : '';
  const tokenList: string[] = typeof tokensOrText === 'string'
    ? text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ').split(/\s+/).filter(Boolean)
    : Array.isArray(tokensOrText) ? tokensOrText : Array.from(tokensOrText);

  if (text) {
    for (const [key, val] of Object.entries(VEHICLE_CANONICAL_MAP)) {
      if (key.includes(' ') && text.includes(key)) {
        vehicles.add(val);
      }
    }
  }

  for (const token of tokenList) {
    const norm = token.toLowerCase().trim().replace(/\u09af\u09bc/g, '\u09df');
    if (VEHICLE_CANONICAL_MAP[norm]) {
      vehicles.add(VEHICLE_CANONICAL_MAP[norm]);
    }
  }
  return vehicles;
}

export const WEAPON_CANONICAL_MAP: Record<string, string> = {
  // RAMDA / Machete / Cleaver
  'রামদা': 'RAMDA', 'রামদার': 'RAMDA', 'চাপাতি': 'RAMDA', 'চাপাতির': 'RAMDA',
  'কুড়াল': 'RAMDA', 'কুড়ালের': 'RAMDA', 'হাসুয়া': 'RAMDA', 'হাঁসুয়া': 'RAMDA',
  'ramda': 'RAMDA', 'machete': 'RAMDA', 'machetes': 'RAMDA', 'chapati': 'RAMDA', 'cleaver': 'RAMDA',

  // KNIFE / Dagger
  'ছুরি': 'KNIFE', 'ছুরিকাঘাত': 'KNIFE', 'ছুরিকাঘাতে': 'KNIFE', 'ছুরি মেরে': 'KNIFE',
  'ধারালো অস্ত্র': 'KNIFE', 'খুর': 'KNIFE', 'ড্যাগার': 'KNIFE',
  'knife': 'KNIFE', 'knives': 'KNIFE', 'dagger': 'KNIFE', 'blade': 'KNIFE', 'stabbing': 'KNIFE', 'stabbed': 'KNIFE',

  // PISTOL / Handgun
  'পিস্তল': 'PISTOL', 'পিস্তলের': 'PISTOL', 'রিভলবার': 'PISTOL', 'রিভলভার': 'PISTOL', 'হ্যান্ডগান': 'PISTOL',
  'pistol': 'PISTOL', 'pistols': 'PISTOL', 'revolver': 'PISTOL', 'revolvers': 'PISTOL', 'handgun': 'PISTOL',

  // GUN / Firearm / Rifle
  'বন্দুক': 'GUN', 'বন্দুকের': 'GUN', 'বন্দুকধারী': 'GUN', 'আগ্নেয়াস্ত্র': 'GUN', 'আগ্নেয়াস্ত্র': 'GUN',
  'রাইফেল': 'GUN', 'শটগান': 'GUN', 'গুলি': 'GUN', 'গুলিবিদ্ধ': 'GUN', 'গুলিবর্ষণ': 'GUN', 'গোলাগুলি': 'GUN',
  'gun': 'GUN', 'guns': 'GUN', 'firearm': 'GUN', 'firearms': 'GUN', 'rifle': 'GUN', 'shotgun': 'GUN', 'gunfire': 'GUN', 'shootout': 'GUN', 'gunfight': 'GUN',

  // COCKTAIL / Crude Bomb
  'ককটেল': 'COCKTAIL', 'ককটেলের': 'COCKTAIL', 'ককটেল বিস্ফোরণ': 'COCKTAIL', 'বোমা': 'COCKTAIL', 'বোমা হামলা': 'COCKTAIL', 'হাতবোমা': 'COCKTAIL',
  'cocktail': 'COCKTAIL', 'cocktails': 'COCKTAIL', 'crude bomb': 'COCKTAIL', 'crude bombs': 'COCKTAIL', 'handmade bomb': 'COCKTAIL', 'bomb': 'COCKTAIL',

  // INDIGENOUS WEAPON
  'দেশীয় অস্ত্র': 'INDIGENOUS_WEAPON', 'দেশি অস্ত্র': 'INDIGENOUS_WEAPON', 'দেশীয় অস্ত্রের': 'INDIGENOUS_WEAPON',
  'টেঁটা': 'INDIGENOUS_WEAPON', 'টেঁটা যুদ্ধ': 'INDIGENOUS_WEAPON', 'বল্লম': 'INDIGENOUS_WEAPON', 'সড়কি': 'INDIGENOUS_WEAPON', 'ঢাল-সড়কি': 'INDIGENOUS_WEAPON', 'লাঠিসোঁটা': 'INDIGENOUS_WEAPON',
  'indigenous weapon': 'INDIGENOUS_WEAPON', 'indigenous weapons': 'INDIGENOUS_WEAPON', 'local weapons': 'INDIGENOUS_WEAPON', 'teta': 'INDIGENOUS_WEAPON', 'spear': 'INDIGENOUS_WEAPON',
};

export function extractWeapons(tokensOrText: Set<string> | string[] | string): Set<string> {
  const weapons = new Set<string>();
  const text = typeof tokensOrText === 'string' ? tokensOrText.toLowerCase().normalize('NFC').replace(/\u09af\u09bc/g, '\u09df') : '';
  const tokenList: string[] = typeof tokensOrText === 'string'
    ? text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ').split(/\s+/).filter(Boolean)
    : Array.isArray(tokensOrText) ? tokensOrText : Array.from(tokensOrText);

  if (text) {
    for (const [key, val] of Object.entries(WEAPON_CANONICAL_MAP)) {
      if (key.includes(' ') && text.includes(key)) {
        weapons.add(val);
      }
    }
  }

  for (const token of tokenList) {
    const norm = token.toLowerCase().trim().replace(/\u09af\u09bc/g, '\u09df');
    if (WEAPON_CANONICAL_MAP[norm]) {
      weapons.add(WEAPON_CANONICAL_MAP[norm]);
    }
  }
  return weapons;
}

export const FACTION_CANONICAL_MAP: Record<string, string> = {
  // Awami League
  'আওয়ামী লীগ': 'AWAMI_LEAGUE', 'আওয়ামী লীগ': 'AWAMI_LEAGUE', 'আওয়ামী': 'AWAMI_LEAGUE', 'আওয়ামী': 'AWAMI_LEAGUE',
  'আওয়ামী লীগের': 'AWAMI_LEAGUE', 'আওয়ামী লীগের': 'AWAMI_LEAGUE', 'আলীগ': 'AWAMI_LEAGUE', 'আ\'লীগ': 'AWAMI_LEAGUE',
  'awami league': 'AWAMI_LEAGUE', 'al': 'AWAMI_LEAGUE',

  // BNP
  'বিএনপি': 'BNP', 'বিএনপির': 'BNP', 'বাংলাদেশ জাতীয়তাবাদী দল': 'BNP',
  'bnp': 'BNP', 'bangladesh nationalist party': 'BNP',

  // Chhatra League
  'ছাত্রলীগ': 'CHHATRA_LEAGUE', 'ছাত্রলীগের': 'CHHATRA_LEAGUE', 'বিসিএল': 'CHHATRA_LEAGUE',
  'chhatra league': 'CHHATRA_LEAGUE', 'bcl': 'CHHATRA_LEAGUE', 'bangladesh chhatra league': 'CHHATRA_LEAGUE',

  // Jubo League
  'যুবলীগ': 'JUBO_LEAGUE', 'যুবলীগের': 'JUBO_LEAGUE',
  'jubo league': 'JUBO_LEAGUE', 'jl': 'JUBO_LEAGUE',

  // Chhatra Dal
  'ছাত্রদল': 'CHHATRA_DAL', 'ছাত্রদলের': 'CHHATRA_DAL', 'জেসিডি': 'CHHATRA_DAL',
  'chhatra dal': 'CHHATRA_DAL', 'jcd': 'CHHATRA_DAL',

  // Jamaat
  'জামায়াত': 'JAMAAT', 'জামায়াত': 'JAMAAT', 'জামায়াতে ইসলামী': 'JAMAAT', 'জামায়াতে ইসলামী': 'JAMAAT',
  'জামায়াতের': 'JAMAAT', 'জামায়াতের': 'JAMAAT',
  'jamaat': 'JAMAAT', 'jamaat-e-islami': 'JAMAAT', 'jei': 'JAMAAT',

  // Shibir
  'শিবির': 'SHIBIR', 'শিবিরের': 'SHIBIR', 'ইসলামী ছাত্রশিবির': 'SHIBIR',
  'shibir': 'SHIBIR', 'ics': 'SHIBIR', 'islami chhatra shibir': 'SHIBIR',
};

export function extractFactions(tokensOrText: Set<string> | string[] | string): Set<string> {
  const factions = new Set<string>();
  const text = typeof tokensOrText === 'string' ? tokensOrText.toLowerCase().normalize('NFC').replace(/\u09af\u09bc/g, '\u09df') : '';
  const tokenList: string[] = typeof tokensOrText === 'string'
    ? text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।॥|—–«»‹›]/gu, ' ').split(/\s+/).filter(Boolean)
    : Array.isArray(tokensOrText) ? tokensOrText : Array.from(tokensOrText);

  if (text) {
    for (const [key, val] of Object.entries(FACTION_CANONICAL_MAP)) {
      if (key.includes(' ') && text.includes(key)) {
        factions.add(val);
      }
    }
  }

  for (const token of tokenList) {
    const norm = token.toLowerCase().trim().replace(/\u09af\u09bc/g, '\u09df');
    if (FACTION_CANONICAL_MAP[norm]) {
      factions.add(FACTION_CANONICAL_MAP[norm]);
    }
  }
  return factions;
}

export function extractEntities(tokensOrText: Set<string> | string[] | string): Set<string> {
  const entities = new Set<string>();
  const vehicles = extractVehicles(tokensOrText);
  const weapons = extractWeapons(tokensOrText);
  const factions = extractFactions(tokensOrText);

  vehicles.forEach((v) => entities.add(v));
  weapons.forEach((w) => entities.add(w));
  factions.forEach((f) => entities.add(f));

  return entities;
}

const BENGALI_NUMBER_WORDS: Record<string, number> = {
  'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5,
  'ছয়': 6, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'নয়': 9, 'দশ': 10,
  'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15,
  'ষোলো': 16, 'সতেরো': 17, 'আঠারো': 18, 'উনিশ': 19, 'কুড়ি': 20, 'বিশ': 20,
};

const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
};

function parseCountValue(raw: string): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const digitVal = parseInt(trimmed, 10);
  if (!isNaN(digitVal)) return digitVal;
  if (BENGALI_NUMBER_WORDS[trimmed] !== undefined) return BENGALI_NUMBER_WORDS[trimmed];
  if (ENGLISH_NUMBER_WORDS[trimmed.toLowerCase()] !== undefined) return ENGLISH_NUMBER_WORDS[trimmed.toLowerCase()];
  return undefined;
}

export function extractCasualtySignature(text: string): CasualtySignature {
  if (!text) return {};
  const norm = normalizeDigits(text).normalize('NFC').toLowerCase().replace(/\u09af\u09bc/g, '\u09df');
  const signature: CasualtySignature = {};

  const numTokens = '(\\d+|এক|দুই|তিন|চার|পাঁচ|ছয়|ছয়|সাত|আট|নয়|নয়|দশ|one|two|three|four|five|six|seven|eight|nine|ten)';

  // 1. Killed extraction
  const killedRegexes = [
    new RegExp(`(?:^|[\\s,।–—])${numTokens}\\s*(?:জন(?:ের)?|জনে)?\\s*(?:প্রাণহানি|নিহত|মৃত্যু|লাশ|মরদেহ|dead|killed|dies|deaths?|fatalities)`, 'u'),
    new RegExp(`(?:নিহত|প্রাণহানি|মৃত্যু|killed|dead|deaths?)\\s*[:\\s]\\s*(?:অন্তত\\s*)?${numTokens}`, 'u'),
  ];

  for (const regex of killedRegexes) {
    const match = norm.match(regex);
    if (match && match[1]) {
      const count = parseCountValue(match[1]);
      if (count !== undefined && count > 0) {
        signature.killed = count;
        break;
      }
    }
  }

  // 2. Injured extraction
  const injuredRegexes = [
    new RegExp(`(?:^|[\\s,।–—])${numTokens}\\s*(?:জন(?:ের)?|জনে)?\\s*(?:আহত|জখম|দগ্ধ|গুলিবিদ্ধ|injured|hurt|wounded|burned)`, 'u'),
    new RegExp(`(?:আহত|জখম|injured|wounded)\\s*[:\\s]\\s*(?:অন্তত\\s*)?${numTokens}`, 'u'),
  ];

  for (const regex of injuredRegexes) {
    const match = norm.match(regex);
    if (match && match[1]) {
      const count = parseCountValue(match[1]);
      if (count !== undefined && count > 0) {
        signature.injured = count;
        break;
      }
    }
  }

  return signature;
}

export function extractTemporalWindow(
  title: string,
  summary: string = '',
  publishedAt: Date = new Date()
): TemporalWindow {
  const temporal = extractIncidentTemporalData(title, summary, publishedAt);
  return {
    occurrenceDate: temporal.occurrenceDate,
    timeOfDay: temporal.timeOfDay,
    publishedAt,
  };
}

export function areTemporalWindowsCompatible(
  w1: TemporalWindow,
  w2: TemporalWindow,
  maxHourDelta: number = 48
): { compatible: boolean; reason?: string } {
  // 1. Occurrence Date Separation (Different calendar days)
  if (w1.occurrenceDate && w2.occurrenceDate && w1.occurrenceDate !== w2.occurrenceDate) {
    return { compatible: false, reason: 'DIFFERENT_OCCURRENCE_DATE' };
  }

  // 2. Time-of-Day Separation (Conflicting times of day on same day/vicinity)
  if (w1.timeOfDay && w2.timeOfDay && w1.timeOfDay !== w2.timeOfDay) {
    const conflictingPairs = new Set([
      'MORNING-NIGHT', 'NIGHT-MORNING',
      'MORNING-AFTERNOON', 'AFTERNOON-MORNING',
      'AFTERNOON-NIGHT', 'NIGHT-AFTERNOON',
      'MORNING-EVENING', 'EVENING-MORNING',
    ]);
    if (conflictingPairs.has(`${w1.timeOfDay}-${w2.timeOfDay}`)) {
      return { compatible: false, reason: 'TIME_OF_DAY_CONFLICT' };
    }
  }

  // 3. Publication Delta Window
  const deltaHours = Math.abs(w1.publishedAt.getTime() - w2.publishedAt.getTime()) / (1000 * 60 * 60);
  if (deltaHours > maxHourDelta) {
    return { compatible: false, reason: 'EXCEEDED_LOOKBACK_DELTA' };
  }

  return { compatible: true };
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

  // Faction Conflict Penalty:
  // If both stories mention political factions or student wings, but have completely disjoint sets
  const factions1 = extractFactions(title1);
  const factions2 = extractFactions(title2);
  let factionConflict = false;
  if (factions1.size > 0 && factions2.size > 0) {
    const hasSharedFaction = Array.from(factions1).some((f) => factions2.has(f));
    if (!hasSharedFaction) {
      factionConflict = true;
    }
  }

  // Casualty Signature Discrepancy:
  // Distinguishes minor collisions from mass fatality disasters
  const cas1 = extractCasualtySignature(title1);
  const cas2 = extractCasualtySignature(title2);
  let casualtyConflict = false;
  if (cas1.killed !== undefined && cas2.killed !== undefined) {
    if (
      (cas1.killed === 1 && cas2.killed >= 5) ||
      (cas2.killed === 1 && cas1.killed >= 5) ||
      Math.abs(cas1.killed - cas2.killed) >= 5
    ) {
      casualtyConflict = true;
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
    'MAHINDRA',
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
    'clash',
    'mob_beating',
    'AWAMI_LEAGUE',
    'BNP',
    'CHHATRA_LEAGUE',
    'CHHATRA_DAL',
    'JUBO_LEAGUE',
    'JAMAAT',
    'SHIBIR',
    'RAMDA',
    'KNIFE',
    'PISTOL',
    'GUN',
    'COCKTAIL',
    'INDIGENOUS_WEAPON',
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
  if (vehicleConflict || factionConflict || casualtyConflict) {
    finalScore = Math.max(0, finalScore - 0.40);
  }

  // Incident Duplicate Criteria:
  // 1. 3 or more shared tokens and Jaccard >= 0.25
  // 2. OR 2 or more shared high-value entities (e.g. [truck, pickup] or [robbery, arrest]) and overlapRatio >= 0.35
  // 3. OR high overall overlap (>= 0.50)
  // Strictly disallowed if vehicleConflict, factionConflict, or casualtyConflict is true
  const isDuplicate = !vehicleConflict && !factionConflict && !casualtyConflict && (
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
 * temporal compatibility, category match, and title token similarity.
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
  summary?: string;
  publishedAt?: Date;
  isWireSyndicated?: boolean;
  wireAgency?: WireAgency | null;
}): Promise<{
  existingReport: Report;
  sharedTokens: string[];
  shouldUpgradeCoords?: boolean;
  newCoords?: { latitude: number; longitude: number; district?: string; upazila?: string };
} | null> {
  const { title, category, latitude, longitude, district, upazila, locationPrecision, summary } = params;
  let maxDelta = params.maxDistanceDegrees ?? 0.035; // ~3.5 km
  const lookbackHours = params.lookbackHours ?? 48; // 48 hours
  const publishedAt = params.publishedAt ?? new Date();
  const cutoff = new Date(publishedAt.getTime() - lookbackHours * 60 * 60 * 1000);

  if (locationPrecision === 'DISTRICT' && district) {
    maxDelta = 0.35;
  }

  // Extract incoming temporal window (Feature 14)
  const incomingWindow = extractTemporalWindow(title, summary || '', publishedAt);

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

  let candidates: any[] = [];
  try {
    candidates = await prisma.report.findMany({
      where: whereConditions,
      include: {
        newsArticles: {
          select: { title: true, publishedAt: true },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  } catch (findErr: any) {
    if (
      String(findErr?.message || '').includes('activeTimeStart') ||
      String(findErr?.message || '').includes('activeTimeEnd') ||
      findErr?.code === '42703'
    ) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeStart" TEXT;
          ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "activeTimeEnd" TEXT;
        `);
        candidates = await prisma.report.findMany({
          where: whereConditions,
          include: {
            newsArticles: {
              select: { title: true, publishedAt: true },
              take: 3,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        });
      } catch {
        candidates = [];
      }
    } else {
      throw findErr;
    }
  }

  for (const candidate of candidates) {
    const candidateTitle =
      candidate.newsArticles?.[0]?.title ||
      (candidate.description ? cleanIncidentTitle(candidate.description.split('\n')[0]) : '');
    const candidatePublishedAt =
      candidate.newsArticles?.[0]?.publishedAt ||
      candidate.createdAt;
    const candidateSummary = candidate.description || '';

    // Temporal Separation Check (Feature 14)
    const candidateWindow = extractTemporalWindow(candidateTitle, candidateSummary, candidatePublishedAt);
    const temporalCheck = areTemporalWindowsCompatible(incomingWindow, candidateWindow, lookbackHours);
    if (!temporalCheck.compatible) {
      continue; // Distinct event occurring at different day/time!
    }

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

export class CandidateLockManager {
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * Generates a spatial/administrative lock key based on EventFingerprint location.
   * Uses district name if available; falls back to a coarse spatial grid (~22km cell).
   * Note: Category is intentionally omitted to prevent split-brain races across compatible categories.
   */
  public getLockKey(district?: string, latitude?: number, longitude?: number): string {
    if (district && district.trim()) {
      return `dist:${district.toLowerCase().trim()}`;
    }
    if (latitude !== undefined && longitude !== undefined && (latitude !== 0 || longitude !== 0)) {
      const latBucket = Math.floor(latitude * 5);
      const lngBucket = Math.floor(longitude * 5);
      return `geo:${latBucket}:${lngBucket}`;
    }
    return 'dist:nationwide_fallback';
  }

  /**
   * Executes an asynchronous task exclusively for the given key.
   * Includes a 10-second safety timeout lease to prevent deadlocks.
   */
  public async runExclusive<T>(key: string, task: () => Promise<T>, timeoutMs = 10000): Promise<T> {
    while (this.locks.has(key)) {
      await Promise.race([
        this.locks.get(key)!,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }

    let releaseLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    const timeoutTimer = setTimeout(() => {
      if (this.locks.get(key) === lockPromise) {
        console.warn(`[CandidateLockManager] ⚠️ Lock lease timed out for key "${key}". Force-releasing.`);
        this.locks.delete(key);
        releaseLock();
      }
    }, timeoutMs);

    try {
      return await task();
    } finally {
      clearTimeout(timeoutTimer);
      if (this.locks.get(key) === lockPromise) {
        this.locks.delete(key);
      }
      releaseLock();
    }
  }
}

export const candidateLock = new CandidateLockManager();

export function buildEventFingerprint(params: {
  category: ReportCategory;
  title: string;
  summary?: string;
  publishedAt?: Date;
  latitude: number;
  longitude: number;
  district?: string;
  upazila?: string;
  isWireSyndicated?: boolean;
  wireAgency?: WireAgency | null;
}): EventFingerprint {
  const publishedAt = params.publishedAt || new Date();
  const temporal = extractTemporalWindow(params.title, params.summary || '', publishedAt);
  const entities = extractEntities(`${params.title} ${params.summary || ''}`);
  const casualtySignature = extractCasualtySignature(`${params.title} ${params.summary || ''}`);

  return {
    category: params.category,
    temporalWindow: {
      occurrenceDate: temporal.occurrenceDate,
      timeOfDay: temporal.timeOfDay,
      publishedAt,
    },
    administrativeLocation: {
      district: params.district,
      upazila: params.upazila,
      latitude: params.latitude,
      longitude: params.longitude,
    },
    entities,
    casualtySignature: Object.keys(casualtySignature).length > 0 ? casualtySignature : undefined,
    isWireSyndicated: !!params.isWireSyndicated,
    wireAgency: params.wireAgency || null,
  };
}
