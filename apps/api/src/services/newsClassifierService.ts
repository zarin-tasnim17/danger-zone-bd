import { ReportCategory, ReportSeverity } from '@prisma/client';

export interface ClassifiedNews {
  isSafetyRelated: boolean;
  category: ReportCategory;
  severity: ReportSeverity;
  confidence: number;
  matchedKeywords: string[];
  disqualifiedReason?: string;
}

export type ClassificationResult = ClassifiedNews;

const CATEGORY_KEYWORDS: Record<ReportCategory, string[]> = {
  THEFT: [
    'চুরি',
    'চোর',
    'সিঁধেল চুরি',
    'গাড়ি চুরি',
    'টাকা চুরি',
    'মোটরসাইকেল চুরি',
    'স্বর্ণালঙ্কার চুরি',
    'তালা ভেঙে চুরি',
    'গ্রিল কেটে চুরি',
    'চুরি হয়েছে',
    'চুরির ঘটনা',
    'চুরি চক্র',
    'মুঠোফোন চুরি',
    'মোবাইল চুরি',
    'গরু চুরি',
    'নগদ টাকা চুরি',
    'theft',
    'thief',
    'thieves',
    'burglary',
    'burgled',
    'stolen',
    'stole',
    'burglarized',
    'break-in',
    'broken into',
    'stealing',
  ],
  ROBBERY: [
    'ডাকাতি',
    'ডাকাত দল',
    'ডাকাত',
    'সশস্ত্র ডাকাত',
    'লুণ্ঠন',
    'লুটপাট',
    'সিন্দুক ভেঙে',
    'গৃহকর্তাকে বেঁধে',
    'robbery',
    'robbers',
    'rob',
    'armed robbery',
    'robbers looted',
    'gang robbery',
    'home invasion',
    'dacoity',
    'dacoits',
  ],
  THEFT_ROBBERY: [
    'চুরি ও ডাকাতি',
    'চুরি ডাকাতি',
    'theft and robbery',
    'burglary and robbery',
  ],
  SNATCHING: [
    'ছিনতাই',
    'ছিনতাইকারী',
    'ব্যাগ টান',
    'ব্যাগ ছিনতাই',
    'মোবাইল ছিনতাই',
    'snatching',
    'snatcher',
    'snatchers',
    'snatch',
    'snatched',
    'mugging',
    'mugger',
    'muggers',
    'bag snatched',
    'phone snatched',
  ],
  ARMED_ASSAULT: [
    'অস্ত্রসহ হামলা',
    'ধারালো অস্ত্র',
    'কোপানো',
    'কুপিয়ে জখম',
    'ছুরিকাঘাত',
    'ছুরি মেরে',
    'গুলিবিদ্ধ',
    'গুলি বর্ষণ',
    'গুলিবর্ষণ',
    'বন্দুকযুদ্ধ',
    'গুলি বিনিময়',
    'গোলাগুলি',
    'গুলির লড়াই',
    'আগ্নেয়াস্ত্র',
    'বন্দুকধারী',
    'বোমা হামলা',
    'সংঘর্ষ',
    'দুই পক্ষের সংঘর্ষ',
    'দুপক্ষের সংঘর্ষ',
    'দুই গ্রামের সংঘর্ষ',
    'দুই গ্রামবাসীর সংঘর্ষ',
    'গ্রামবাসীর সংঘর্ষ',
    'গ্রামবাসীর মধ্যে সংঘর্ষ',
    'এলাকাবাসীর সংঘর্ষ',
    'দুই গ্রুপের সংঘর্ষ',
    'গোষ্ঠীগত সংঘর্ষ',
    'সংঘর্ষে আহত',
    'সংঘর্ষে নিহত',
    'সংঘর্ষে রক্তাক্ত',
    'টেঁটা যুদ্ধ',
    'টেঁটা',
    'রামদা',
    'চাপাতি',
    'বল্লম',
    'হাঁসুয়া',
    'ঢাল-সড়কি',
    'সড়কি',
    'লাঠিসোঁটা',
    'দেশীয় অস্ত্র',
    'ইটপাটকেল',
    'মারপিট',
    'হাতাহাতি',
    'রণক্ষেত্র',
    'চোর সন্দেহে পিটুনি',
    'গণপিটুনি',
    'পাল্টাপাল্টি ধাওয়া',
    'পক্ষের সংঘর্ষ',
    'মারামারি',
    'মারধর',
    'হামলা',
    'হামলা ও সংঘর্ষ',
    'হামলা-ভাঙচুর',
    'ধাওয়া-পাল্টাধাওয়া',
    'ধাওয়া পাল্টা ধাওয়া',
    'টিয়ারশেল',
    'ককটেল বিস্ফোরণ',
    'ককটেল',
    'গাড়িতে আগুন',
    'ভাঙচুর',
    'আক্রমণ',
    'knife attack',
    'stabbed',
    'stabbing',
    'machete attack',
    'gunfire',
    'shootout',
    'gunfight',
    'armed attack',
    'shot and injured',
    'shot',
    'bullet',
    'bomb attack',
    'bomb',
    'bombed',
    'bombing',
    'blast',
    'cocktail blast',
    'cocktail explosion',
    'explosive',
    'explosives',
    'explosion',
    'kill',
    'killing',
    'clash',
    'clashes',
    'violent clash',
    'factional clash',
    'mob clash',
    'riot',
    'assault',
    'machete',
    'machetes',
    'stabbed',
    'stabbing',
    'stab',
    'hacked',
  ],
  SNATCHING_ARMED_ASSAULT: [
    'ছিনতাই ও হামলা',
    'ছিনতাইকালে কুপিয়ে',
    'ছিনতাইকালে গুলি',
    'ছিনতাই ও কোপানো',
    'armed mugging',
    'violent snatching',
    'armed snatching',
  ],
  EXTORTION: [
    'চাঁদাবাজি',
    'চাঁদা দাবি',
    'চাঁদাবাজ',
    'দখলবাজি',
    'দখল',
    'অবৈধ চাঁদা',
    'চাঁদা না দেওয়ায়',
    'extortion',
    'extortionist',
    'extorted',
    'protection money',
    'illegal toll',
  ],
  YOUTH_GANG_ACTIVITY: [
    'কিশোর গ্যাং',
    'কিশোর গ্যাংয়ের',
    'কিশোর অপরাধী',
    'কিশোরদের মারামারি',
    'কিশোর গ্যাংয়ের মহড়া',
    'কিশোর গ্যাংয়ের হামলা',
    'youth gang',
    'youth gang activity',
    'teenage gang',
    'teen gang',
    'juvenile delinquency',
  ],
  DRUG_RELATED_CRIME: [
    'মাদক',
    'ইয়াবা',
    'গাঁজা',
    'ফেনসিডিল',
    'হেরোইন',
    'মাদক কারবারি',
    'মাদকদ্রব্য',
    'আইস',
    'ট্যাপেন্টাডল',
    'মাদকের আড্ডা',
    'drug related crime',
    'narcotics',
    'yaba',
    'drug peddler',
    'drug dealer',
    'drugs seized',
    'phensedyl',
    'heroin',
    'cannabis',
    'meth',
  ],
  UNLIT_ROAD: [
    'অন্ধকার রাস্তা',
    'বাতি নেই',
    'বাতি বন্ধ',
    'স্ট্রিট লাইট নষ্ট',
    'সড়ক বাতি নেই',
    'অন্ধকার সড়ক',
    'ভাঙা রাস্তা',
    'খানাখন্দ',
    'বিপজ্জনক গর্ত',
    'ম্যানহোল খোলা',
    'ঝুঁকিপূর্ণ সড়ক',
    'unlit',
    'unlit road',
    'dark street',
    'street light off',
    'blackout',
    'broken road',
    'pothole hazard',
    'open manhole',
  ],
  ROAD_ACCIDENT: [
    'সড়ক দুর্ঘটনা',
    'সড়ক দুর্ঘটনায়',
    'গাড়ি দুর্ঘটনা',
    'বাস উল্টে',
    'ট্রাক ধাক্কা',
    'বাস-ট্রাক সংঘর্ষ',
    'মুখোমুখি সংঘর্ষ',
    'পিকআপের সংঘর্ষ',
    'পিকআপ সংঘর্ষ',
    'ট্রাক-পিকআপ সংঘর্ষ',
    'ট্রাক-পিকআপের সংঘর্ষ',
    'ট্রাক-পিকআপ মুখোমুখি সংঘর্ষ',
    'বাস-পিকআপ সংঘর্ষ',
    'পিকআপ-ড্রাম ট্রাকের সংঘর্ষ',
    'ড্রাম ট্রাক',
    'গাড়ির সংঘর্ষ',
    'লরির সংঘর্ষ',
    'মোটরসাইকেলের সংঘর্ষ',
    'সিএনজি সংঘর্ষ',
    'অটোরিকশা সংঘর্ষ',
    'কাভার্ডভ্যান সংঘর্ষ',
    'ভ্যানের সংঘর্ষ',
    'গাড়ি চাপায়',
    'গাড়ি উল্টে',
    'ট্রাক উল্টে',
    'পিকআপ উল্টে',
    'যানবাহন সংঘর্ষ',
    'মোটরসাইকেল দুর্ঘটনা',
    'অটোরিকশা দুর্ঘটনা',
    'ট্রেন দুর্ঘটনা',
    'চাপা পড়ে নিহত',
    'চাপা দিয়ে নিহত',
    'চাপা দিয়েছে',
    'চাপা পড়ে',
    'চাপা দিয়ে',
    'চাপায়',
    'চাপায় নিহত',
    'ধাক্কায়',
    'ধাক্কায় নিহত',
    'ধাক্কায় আহত',
    'ধাক্কা লেগে',
    'ধাক্কা দিয়ে',
    'খাদে পড়ে',
    'খাদে পড়ে নিহত',
    'খাদে পড়ে আহত',
    'নিয়ন্ত্রণ হারিয়ে',
    'নিয়ন্ত্রণ হারিয়ে',
    'প্রাণহানি',
    'প্রাণ হারান',
    'দুর্ঘটনায় প্রাণ গেল',
    'দুর্ঘটনায় নিহত',
    'দুর্ঘটনায় আহত',
    'চাপায় আহত',
    'ধাক্কায় আহত',
    'দুর্ঘটনায় প্রাণহানি',
    'মোটরসাইকেল চালক নিহত',
    'road accident',
    'traffic accident',
    'deadly crash',
    'car crash',
    'bus crash',
    'truck crash',
    'train crash',
    'crashed into',
    'vehicle collision',
    'head-on collision',
    'head on collision',
    'collision between',
    'road crash',
    'highway crash',
    'hit and run',
    'overturned bus',
    'lost control',
    'plunged into ditch',
    'fatal crash',
    'crashed',
    'collide',
    'collided',
    'collision',
    'head-on',
    'head on',
    'hit-and-run',
    'skidded',
  ],
  // Legacy aliases
  MUGGING: [
    'ছিনতাই',
    'mugging',
  ],
  DACOITY: [
    'ডাকাতি',
    'dacoity',
  ],
  THEFT_DACOITY: [
    'চুরি ডাকাতি',
  ],
  TEEN_GANG: [
    'কিশোর গ্যাং',
  ],
  TEEN_GANG_ARMED_ASSAULT: [
    'কিশোর গ্যাং অস্ত্র',
  ],
  DRUG_ACTIVITY: [
    'মাদক',
  ],
};

const HIGH_SEVERITY_KEYWORDS = [
  'নিহত',
  'মৃত',
  'লাশ',
  'গুলিবিদ্ধ',
  'গুলি',
  'বন্দুক',
  'বন্দুকযুদ্ধ',
  'গোলাগুলি',
  'গুলিবর্ষণ',
  'shootout',
  'gunfight',
  'অস্ত্র',
  'অস্ত্রধারী',
  'আগ্নেয়াস্ত্র',
  'কোপানো',
  'কুপিয়ে জখম',
  'ছুরিকাঘাত',
  'খুন',
  'হত্যা',
  'ডাকাতি',
  'বোমা',
  'বোমা হামলা',
  'ককটেল',
  'ককটেল বিস্ফোরণ',
  'বিস্ফোরণ',
  'রক্তক্ষয়ী',
  'রক্তক্ষয়ী সংঘর্ষ',
  'অর্ধশত আহত',
  'শতাধিক আহত',
  'বহু আহত',
  'গুরুতর আহত',
  'গুরুতর জখম',
  'টেঁটা যুদ্ধ',
  'রণক্ষেত্র',
  'দেশীয় অস্ত্র',
  'রামদা',
  'চাপাতি',
  'বল্লম',
  'সংঘর্ষে অর্ধশত',
  'অগ্নিসংযোগ',
  'dead',
  'killed',
  'kill',
  'shot',
  'murdered',
  'fatal',
  'fatality',
  'shot dead',
  'firearm',
  'bomb',
  'blast',
  'armed',
  'robbery',
  'kidnap',
  'kidnapped',
  'cocktail',
  'explosion',
  'arson',
];

const COMPOUND_SAFETY_PHRASES = new Set([
  'সড়ক দুর্ঘটনা',
  'কিশোর গ্যাং',
  'সশস্ত্র ডাকাত',
  'ডাকাত দল',
  'সিন্দুক ভেঙে',
  'গৃহকর্তাকে বেঁধে',
  'চুরি ও ডাকাতি',
  'চুরি ডাকাতি',
  'ব্যাগ টান',
  'ব্যাগ ছিনতাই',
  'মোবাইল ছিনতাই',
  'অস্ত্রসহ হামলা',
  'ধারালো অস্ত্র',
  'কুপিয়ে জখম',
  'ছুরি মেরে',
  'গুলি বর্ষণ',
  'গুলি বিনিময়',
  'গুলির লড়াই',
  'বোমা হামলা',
  'দুই পক্ষের সংঘর্ষ',
  'দুপক্ষের সংঘর্ষ',
  'দুই গ্রামের সংঘর্ষ',
  'দুই গ্রামবাসীর সংঘর্ষ',
  'গ্রামবাসীর সংঘর্ষ',
  'এলাকাবাসীর সংঘর্ষ',
  'দুই গ্রুপের সংঘর্ষ',
  'সংঘর্ষে আহত',
  'সংঘর্ষে নিহত',
  'সংঘর্ষে রক্তাক্ত',
  'টেঁটা যুদ্ধ',
  'চোর সন্দেহে পিটুনি',
  'গণপিটুনি',
  'চুরির ঘটনাকে কেন্দ্র করে',
  'চুরির জেরে সংঘর্ষ',
  'চুরি নিয়ে সংঘর্ষ',
  'পক্ষের সংঘর্ষ',
  'হামলা ও সংঘর্ষ',
  'হামলা-ভাঙচুর',
  'ধাওয়া-পাল্টাধাওয়া',
  'ধাওয়া পাল্টা ধাওয়া',
  'ককটেল বিস্ফোরণ',
  'গাড়িতে আগুন',
  'বাসে আগুন',
  'গাড়িতে অগ্নিসংযোগ',
  'মুখোমুখি সংঘর্ষ',
  'গাড়ি দুর্ঘটনা',
  'বাস-ট্রাক',
  'ট্রাক-পিকআপ',
  'পিকআপ-ড্রাম',
  'গাড়ির সংঘর্ষ',
  'লরির সংঘর্ষ',
  'মোটরসাইকেল দুর্ঘটনা',
  'অটোরিকশা দুর্ঘটনা',
  'চাপা পড়ে নিহত',
  'চাপা দিয়ে নিহত',
  'চাপা দিয়েছে',
  'উল্টে খাদে',
  'বাস উল্টে',
  'ট্রাক উল্টে',
  'পিকআপ উল্টে',
  'knife attack',
  'machete attack',
  'armed attack',
  'shot and injured',
  'bomb attack',
  'head-on collision',
  'road crash',
  'deadly crash',
  'traffic accident',
  'armed robbery',
  'robbers looted',
  'gang robbery',
  'home invasion',
  'theft and robbery',
  'burglary and robbery',
  'bag snatched',
  'phone snatched',
  'teen gang',
  'unlit road',
  'pothole hazard',
].map((p) => p.normalize('NFC')));

const MEDIUM_SPECIFICITY_TERMS = new Set([
  'ছিনতাইকারী',
  'গুলিবিদ্ধ',
  'ইয়াবা',
  'ডাকাতি',
  'ডাকাত',
  'লুণ্ঠন',
  'লুটপাট',
  'ছিনতাই',
  'কোপানো',
  'ছুরিকাঘাত',
  'আগ্নেয়াস্ত্র',
  'বন্দুকধারী',
  'বন্দুকযুদ্ধ',
  'গোলাগুলি',
  'গুলিবর্ষণ',
  'টিয়ারশেল',
  'ককটেল',
  'চাঁদাবাজ',
  'চাঁদাবাজি',
  'ফেনসিডিল',
  'হেরোইন',
  'মাদক',
  'গাঞ্জা',
  'আইস',
  'গাঁজা',
  'অস্ত্রধারী',
  'খুন',
  'হত্যা',
  'snatcher',
  'robbery',
  'robbers',
  'burglary',
  'burgled',
  'extortion',
  'narcotics',
  'yaba',
  'phensedyl',
  'heroine',
  'dacoity',
  'dacoits',
  'stabbing',
  'machete',
  'gunfire',
  'shootout',
  'gunfight',
  'mugger',
  'mugging',
  'kidnap',
  'kidnapped',
].map((p) => p.normalize('NFC')));

const isEnglishKeyword = (kw: string) => /^[a-zA-Z0-9\s-]+$/.test(kw);
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getKeywordWeight = (kw: string): number => {
  const norm = kw.normalize('NFC').trim();
  if (norm.includes(' ') || norm.includes('-') || COMPOUND_SAFETY_PHRASES.has(norm)) {
    return 5;
  }
  if (MEDIUM_SPECIFICITY_TERMS.has(norm)) {
    return 3;
  }
  return 1;
};

const matchesKeyword = (text: string, kw: string): boolean => {
  const normKw = kw.normalize('NFC').toLowerCase();
  if (isEnglishKeyword(normKw)) {
    const regex = new RegExp(`\\b${escapeRegex(normKw)}\\b`, 'i');
    return regex.test(text);
  }
  // For short Bengali keywords (length <= 3, e.g. "আইস"), enforce boundary checks so "আইস" does not match "আইসিজে"
  if (normKw.length <= 3) {
    const regex = new RegExp(`(?:^|[\\s,।–—"\'‘“\\(\\)\\[\\]\/-])${escapeRegex(normKw)}(?:$|[\\s,।–—"\'’”\\(\\)\\[\\]\/-])`, 'u');
    return regex.test(text);
  }
  return text.includes(normKw);
};

const MEDIUM_SEVERITY_KEYWORDS = [
  'আহত',
  'আটক',
  'গ্রেফতার',
  'লুট',
  'ছিনতাই',
  'হামলা',
  'মারধর',
  'চুরি',
  'চোর',
  'হুমকি',
  'চাঁদাবাজি',
  'চাঁদা',
  'injured',
  'hospitalized',
  'arrested',
  'arrest',
  'seized',
  'seize',
  'robbed',
  'snatched',
  'theft',
  'stolen',
  'burglary',
  'clash',
  'extortion',
];

const VEHICLE_KEYWORDS = [
  'ট্রাক',
  'পিকআপ',
  'বাস',
  'মাইক্রোবাস',
  'সিএনজি',
  'অটোরিকশা',
  'লরি',
  'কাভার্ডভ্যান',
  'মোটরসাইকেল',
  'বাইক',
  'টমটম',
  'ভ্যান',
  'ইজিবাইক',
  'নসিমন',
  'করিমন',
  'ড্রাম ট্রাক',
  'কার',
  'প্রাইভেটকার',
  'অ্যাম্বুলেন্স',
  'ট্রেন',
  'গাড়ি',
  'গাড়ির',
  'গাড়িতে',
  'যানবাহন',
  'truck',
  'pickup',
  'bus',
  'microbus',
  'cng',
  'autorickshaw',
  'lorry',
  'motorcycle',
  'bike',
  'van',
  'ambulance',
  'train',
  'vehicle',
  'car',
];

const VIOLENT_FACTION_KEYWORDS = [
  'বিএনপি',
  'আওয়ামী',
  'আওয়ামী লীগ',
  'ছাত্রলীগ',
  'ছাত্রদল',
  'যুবলীগ',
  'জামায়াত',
  'শিবির',
  'দুই পক্ষ',
  'দুপক্ষ',
  'দুই দলের',
  'দুই গ্রাম',
  'দুই গ্রামের',
  'দুই গ্রামের সংঘর্ষ',
  'গ্রামবাসী',
  'গ্রামবাসীর',
  'গ্রামবাসীর সংঘর্ষ',
  'এলাকাবাসী',
  'এলাকাবাসীর',
  'দুই গ্রুপ',
  'দুই গ্রুপের',
  'গোষ্ঠী',
  'গোষ্ঠীর',
  'টেঁটা',
  'টেঁটা যুদ্ধ',
  'রামদা',
  'চাপাতি',
  'বল্লম',
  'হাঁসুয়া',
  'ঢাল-সড়কি',
  'সড়কি',
  'লাঠিসোঁটা',
  'দেশীয় অস্ত্র',
  'ইটপাটকেল',
  'মারপিট',
  'হাতাহাতি',
  'গণপিটুনি',
  'চোর সন্দেহে পিটুনি',
  'পাল্টাপাল্টি ধাওয়া',
  'village clash',
  'mob violence',
  'পক্ষের সংঘর্ষ',
  'রাজনৈতিক সংঘর্ষ',
  'দলাদলি',
  'মারামারি',
  'মারধর',
  'ককটেল',
  'টিয়ারশেল',
  'টিয়ারশেল',
  'আগ্নেয়াস্ত্র',
  'আগ্নেয়াস্ত্র',
  'বন্দুকধারী',
  'গুলিবিদ্ধ',
  'গুলি বর্ষণ',
  'ধারালো অস্ত্র',
  'কোপানো',
  'কুপিয়ে',
  'ছুরিকাঘাত',
  'ছুরি মেরে',
  'অস্ত্রসহ হামলা',
  'ভাঙচুর',
  'শ্রমিক-পুলিশ',
  'শ্রমিকদের সঙ্গে পুলিশের',
  'পুলিশ-শ্রমিক',
  'পোশাকশ্রমিক',
  'পোশাক শ্রমিক',
  'শ্রমিক আন্দোলন',
  'বিক্ষোভ',
  'রণক্ষেত্র',
  'অবরোধ',
  'গাড়িতে আগুন',
  'গাড়িতে অগ্নিসংযোগ',
  'বাসে আগুন',
  'আগুন জ্বালিয়ে',
  'আগুন দিয়ে',
  'knife attack',
  'stabbing',
  'machete',
  'gunfire',
  'armed clash',
  'political clash',
  'factional clash',
  'protest clash',
  'police clash',
  'arson',
];

const BAIL_KEYWORDS = [
  'জামিন',
  'জামিনে',
  'জামিন পেলেন',
  'জামিন মঞ্জুর',
  'জামিন নামঞ্জুর',
  'জামিন আবেদন',
  'জামিন স্থগিত',
  'অন্তর্র্বতীকালীন জামিন',
  'স্থায়ী জামিন',
  'অগ্রিম জামিন',
  'জামিনের শুনানি',
  'bail',
  'bail plea',
  'bail petition',
  'bail granted',
  'bail rejected',
  'bail denied',
  'secures bail',
  'anticipatory bail',
  'interim bail',
  'bail hearing',
  'granted bail',
];

const COURT_KEYWORDS = [
  'আদালত',
  'আদালতে',
  'আদালতের নির্দেশ',
  'আদালত প্রাঙ্গণ',
  'হাইকোর্ট',
  'সুপ্রিম কোর্ট',
  'বিচারিক আদালত',
  'জজ কোর্ট',
  'ম্যাজিস্ট্রেট',
  'বিচারক',
  'রিমান্ড',
  'রিমান্ডে',
  'রিমান্ড মঞ্জুর',
  'রিমান্ড আবেদন',
  'চার্জশিট',
  'অভিযোগপত্র',
  'অভিযোগ গঠন',
  'চার্জ গঠন',
  'শুনানি',
  'শুনানির দিন',
  'হাজিরা দিলেন',
  'আদালতে হাজিরা',
  'কারাগারে প্রেরণের নির্দেশ',
  'কারাগারে প্রেরণ',
  'জেলহাজতে প্রেরণ',
  'কারাগারে পাঠানোর নির্দেশ',
  'কারাদণ্ড',
  'সাজা বহাল',
  'সাজার নির্দেশ',
  'যাবজ্জীবন কারাদণ্ড',
  'যাবজ্জীবন',
  'যাবজ্জীবন সাজা',
  'মৃত্যুদণ্ড',
  'মৃত্যুদণ্ডের রায়',
  'ফাঁসির রায়',
  'সাজা',
  'দণ্ডাদেশ',
  'বিচার শুরু',
  'রায় ঘোষণা',
  'আদালতের আদেশ',
  'বিচারিক আদেশ',
  'বিশেষ ট্রাইব্যুনাল',
  'ট্রাইব্যুনাল',
  'খালাস পেলেন',
  'মামলা থেকে খালাস',
  'গ্রেপ্তারি পরোয়ানা',
  'গ্রেফতারি পরোয়ানা',
  'হুলিয়া জারি',
  'আইনি লড়াই',
  'রিট আবেদন',
  'রিট দায়ের',
  'court',
  'courthouse',
  'high court',
  'supreme court',
  'appellate division',
  'magistrate court',
  'sessions court',
  'sessions judge',
  'metropolitan magistrate',
  'judge',
  'magistrate',
  'tribunal',
  'remand',
  'remanded',
  'placed on remand',
  'chargesheet',
  'charge sheet',
  'charges framed',
  'indictment',
  'hearing',
  'trial',
  'verdict',
  'sentences',
  'sentenced',
  'sentencing',
  'sentenced to',
  'life term',
  'death sentence',
  'sent to jail',
  'ordered to jail',
  'judicial custody',
  'convicted',
  'conviction',
  'convicts',
  'acquitted',
  'acquittal',
  'acquits',
  'arrest warrant',
  'warrant of arrest',
  'lawsuit',
  'legal battle',
  'writ petition',
];

const CORRUPTION_KEYWORDS = [
  'দুদক',
  'দুদকের',
  'দুর্নীতি দমন কমিশন',
  'দুর্নীতি',
  'দুর্নীতির অভিযোগ',
  'দুর্নীতি মামলায়',
  'দুর্নীতির অনুসন্ধান',
  'অবৈধ সম্পদ',
  'জ্ঞাত আয়বহির্ভূত সম্পদ',
  'জ্ঞাত আয়বহির্ভূত',
  'অর্থ পাচার',
  'মানি লন্ডারিং',
  'মানিলন্ডারিং',
  'অর্থ আত্মসাৎ',
  'তহবিল তছরুপ',
  'ঘুষ কেলেঙ্কারি',
  'ঘুষ গ্রহণ',
  'ঘুষ নেওয়ার',
  'ব্যাংক জালিয়াতি',
  'ঋণ জালিয়াতি',
  'ভুয়া ঋণ',
  'সম্পদ বিবরণী',
  'acc',
  'anti-corruption commission',
  'anti-corruption',
  'corruption',
  'corruption probe',
  'corruption case',
  'graft',
  'graft case',
  'ill-gotten wealth',
  'illegal assets',
  'unexplained wealth',
  'money laundering',
  'embezzlement',
  'embezzled',
  'bribery',
  'bribe',
  'financial scam',
  'loan scam',
  'bank fraud',
  'financial irregularities',
];

const POLITICAL_STATEMENT_KEYWORDS = [
  'সংবাদ সম্মেলন',
  'প্রেস ব্রিফিং',
  'প্রেস কনফারেন্স',
  'বিবৃতিতে বলেন',
  'এক বিবৃতিতে',
  'যৌথ বিবৃতি',
  'সমাবেশে বললেন',
  'আলোচনা সভায় বললেন',
  'বক্তব্যে বলেন',
  'হুঁশিয়ারি উচ্চারণ',
  'হুঁশিয়ারি দেন',
  'হুঁশিয়ারি দিলেন',
  'স্মারকলিপি পেশ',
  'স্মারকলিপি প্রদান',
  'গোলটেবিল বৈঠক',
  'মতবিনিময় সভা',
  'নির্বাচনী প্রচারণায় বললেন',
  'প্রেস বিজ্ঞপ্তি',
  'press conference',
  'press briefing',
  'press release',
  'joint statement',
  'issued a statement',
  'in a statement',
  'speaks at rally',
  'addressed the gathering',
  'submitted memorandum',
  'roundtable discussion',
  'discussion meeting',
  'election campaign speech',
];

const ADMINISTRATIVE_DISPUTE_KEYWORDS = [
  'সীমানা বিরোধ',
  'জমি সংক্রান্ত বিরোধ',
  'দাপ্তরিক আদেশ',
  'প্রশাসনিক আদেশ',
  'বদলি করা হয়েছে',
  'কর্মকর্তা বদলি',
  'টেন্ডার বাতিল',
  'কারণ দর্শানোর নোটিশ',
  'শোকজ নোটিশ',
  'পদত্যাগপত্র জমা',
  'পদত্যাগ করেছেন',
  'boundary dispute',
  'land dispute',
  'civil dispute',
  'administrative order',
  'official transfer',
  'tender cancellation',
  'show-cause notice',
  'show cause notice',
  'resignation letter',
  'tender dispute',
];

const HISTORICAL_ALLEGATION_KEYWORDS = [
  'বছরের পুরোনো মামলা',
  'দশক আগের মামলা',
  'ঐতিহাসিক মামলা',
  '১৯৭১ সালের যুদ্ধাপরাধ',
  'যুদ্ধাপরাধ ট্রাইব্যুনাল',
  'মানবতাবিরোধী অপরাধ ট্রাইব্যুনাল',
  'আন্তর্জাতিক অপরাধ ট্রাইব্যুনাল',
  '১৯৭১ সালের',
  'decades-old case',
  'decades-old',
  'years-old case',
  'war crimes tribunal',
  'crimes against humanity',
  'international crimes tribunal',
  '1971 war crimes',
  '1971 war',
];

const RETROSPECTIVE_JUDICIAL_PATTERNS = [
  // Bengali: case trials, chargesheets, remands, verdicts, life sentences, death sentences, hearings
  /(?:মামলায়|মামলার|মামলা|বিচার)[\s\S]{0,40}?(?:চার্জশিট|অভিযোগপত্র|রিমান্ড|রায়|সাজা|কারাদণ্ড|যাবজ্জীবন|মৃত্যুদণ্ড|জামিন|শুনানি|বিচার|খালাস|আদেশ|দণ্ড)/i,
  /(?:চার্জশিট|অভিযোগপত্র|রিমান্ড|রায়|সাজা|কারাদণ্ড|যাবজ্জীবন|মৃত্যুদণ্ড|জামিন|শুনানি|বিচার|খালাস)[\s\S]{0,35}?(?:মঞ্জুর|দাখিল|ঘোষণা|নামঞ্জুর|স্থগিত|শুরু|পেলেন|দিলেন|প্রদান|বহাল|দণ্ড|হাজিরা|কার্যকর)/i,
  /(?:আদালতের|বিচারিক|বিচারকের|ট্রাইব্যুনালের|আদালত|ট্রাইব্যুনাল)\s*(?:আদেশ|নির্দেশ|রায়|সাজা|দণ্ড|হাজিরা|বিচার)/i,

  // English: sentences, indictments, chargesheets, remands, verdicts, trials
  /(?:sentences|sentenced|sentencing|convicted|conviction|convicts|acquitted|acquittal|acquits)[\s\S]{0,40}?(?:imprisonment|jail|term|death|in|to|for|penalty)/i,
  /(?:chargesheet|charge sheet|indictment|remand|remanded|verdict|bail|hearing|trial)[\s\S]{0,35}?(?:in|upheld|deferred|rejected|denied|granted|issued|passed|announced|delivered|begins|set|ordered)/i,
  /(?:sentenced\s+to|life\s+term|death\s+sentence|placed\s+on\s+remand|remanded\s+to|sent\s+to\s+jail|ordered\s+to\s+jail|judicial\s+custody)/i,
  /(?:court|tribunal|judge|magistrate)\s+(?:sentences|sentenced|convicts|convicted|orders|ordered|delivered\s+verdict|announced\s+verdict)/i,

  // Historical / past time allegations
  /(?:বছরের\s+পুরোনো|বছর\s+আগের|দশক\s+আগের|১৯৭১\s*সালের|১৯৭১|decades-old|years-old|years\s+ago)/i,
];

// Patterns identifying active physical attacks directed AT court venues or political gatherings
const COURT_VENUE_PATTERNS = [
  /(?:আদালত\s*(?:চত্বরে|চত্বর|প্রাঙ্গণে|প্রাঙ্গণ|ভবনে|ভবন|গেটে|গেট|এলাকায়|এলাকা|কক্ষে|কক্ষ|সামনে)|court\s+(?:premises|building|compound|gate|complex|entrance)|courthouse)/i,
];

const POLITICAL_VENUE_PATTERNS = [
  /(?:রাজনৈতিক\s*সমাবেশ|সমাবেশস্থলে|সমাবেশস্থল|সমাবেশ\s*মঞ্চ|মিছিল|দলীয়\s*কার্যালয়|party\s+office|political\s+rally|campaign\s+rally|protest\s+rally)/i,
];

const IMMEDIATE_VIOLENT_ATTACK_PATTERNS = [
  /(?:ককটেল\s*বিস্ফোরণ|বোমা\s*হামলা|বোমা\s*বিস্ফোরণ|গুলি\s*বর্ষণ|গুলি\s*ছুড়ে|ককটেল\s*হামলা|রণক্ষেত্র|ককটেল\s*ছোড়া|অস্ত্রধারীদের\s*গুলি|রক্তক্ষয়ী\s*সংঘর্ষ|ধারালো\s*অস্ত্র|রামদা|কুপিয়ে|cocktail\s*blast|cocktail\s*explosion|bomb\s*attack|bomb\s*blast|gunfire|shooting|bombed|explosive\s*device|armed\s*clash|machete)/i,
];

const ARREST_FOLLOWUP_PATTERNS = [
  // Existing: Explicit suspect arrest
  /(?:পলাতক\s*আসামি|আসামি|আসামিকে)\s*(?:গ্রেফতার|গ্রেপ্তার|আটক|গ্রেফতারের|ধরা)/u,
  /(?:গ্রেফতার|গ্রেপ্তার|আটক)\s*(?:হয়েছে|হয়েছেন|করা\s*হয়েছে|করা\s*হয়)/u,
  /(?:র‌্যাব|র‍্যাব|পুলিশ|ডিবি|গোয়েন্দা\s*পুলিশ|আইনশৃঙ্খলা\s*বাহিনী)[\s\S]{0,25}?(?:গ্রেফতার|গ্রেপ্তার|আটক)\s*করেছে/u,

  // Feature 7: Standalone [Place] এ [Criminal Type] আটক/গ্রেফতার
  /(?:ডাকাত\s*দল|ডাকাত\s*দলের|ডাকাত|সন্ত্রাসী|চাঁদাবাজ|ছিনতাইকারী|মাদক\s*কারবারি|কারবারি|চোর\s*চক্র|চোর|পাচারকারী|অপরাধী|খুনি|জঙ্গি|সদস্য|মূলহোতা)[\s\S]{0,35}?(?:আটক|গ্রেফতার|গ্রেপ্তার)/u,
  /(?:গ্রেফতার|গ্রেপ্তার|আটক)\s*[০-৯\d]+/u, // e.g. গ্রেফতার ৪, আটক ৩
  /[০-৯\d]+\s*(?:জন|সদস্য|ডাকাত|ছিনতাইকারী|মাদক\s*কারবারি)?\s*(?:আটক|গ্রেফতার|গ্রেপ্তার)/u, // e.g. ৩ সদস্য আটক
  /(?:মূলহোতাসহ|অস্ত্রসহ|মাদকসহ|ফেনসিডিলসহ|ইয়াবাসহ|চোরাই\s*মালসহ|মালামালসহ)[\s\S]{0,25}?(?:গ্রেফতার|গ্রেপ্তার|আটক)/u,
  /(?:গ্রেফতার|গ্রেপ্তার|আটক)\s*হয়েছেন/u,
  /(?:গ্রেফতার|গ্রেপ্তার|আটক)\s*অভিযান/u,
  /(?:অভিযান\s*চালিয়ে\s*[\s\S]{0,25}?(?:আটক|গ্রেফতার|গ্রেপ্তার))/u,

  // English standalone arrest & detention patterns
  /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:robbers?|thieves|thief|peddlers?|suspects?|extortionists?|criminals?|dacoits?|gang\s+members?|culprits?|fugitives?)\s+(?:arrested|held|nabbed|detained)\b/i,
  /\b(?:police|db|rab|cid|bgb|law\s+enforcers?)\s+(?:arrest|arrests|nab|nabs|detain|detains|hold|holds)\b/i,
  /\b(?:arrested|held|nabbed|detained)\s+(?:with|in|from|at|by)\b/i,
  /\b(?:arrest|detention|nabbed|apprehended)\s+of\b/i,
  /\b(?:fugitive(?:\s+accused)?\s+(?:arrested|nabbed|detained|held)|accused\s+(?:arrested|nabbed|held)|suspects?\s+arrested|arrest\s+of\s+accused)\b/i,
];

const ACTIVE_ARREST_CLASH_PATTERNS = [
  /(?:গ্রেফতারকালে|গ্রেপ্তারকালে|গ্রেফতার\s*অভিযানে|গ্রেপ্তার\s*অভিযানে|অভিযানকালে)[\s\S]{0,35}?(?:হামলা|সংঘর্ষ|ককটেল|গুলি|গুলিবিদ্ধ|গোলাগুলি|আহত|রণক্ষেত্র)/u,
  /(?:বন্দুকযুদ্ধ|গুলির\s*লড়াই|গুলি\s*বিনিময়|গোলাগুলি|গুলিবর্ষণ|crossfire|gunfight|shootout)/u,
  /\b(?:shootout|gunfight|gunfire|come\s+under\s+fire|come\s+under\s+gunfire|under\s+gunfire|attacked\s+during|clashed\s+with\s+police)\b/i,
];

// Feature 8: Case Filing / Lawsuit Follow-Up Patterns
const CASE_FILING_PATTERNS = [
  /(?:মামলা\s*দায়ের|মামলা\s*হয়েছে|মামলা\s*রুজু|মামলা\s*নথিভুক্ত|মামলা\s*দায়ের\s*হয়েছে|মামলা\s*দায়ের\s*করা\s*হয়েছে|থানায়\s*মামলা\s*(?:দায়ের)?|অভিযোগ\s*দায়ের|আদালতে\s*মামলা)/u,
  /(?:ঘটনায়|জেরে|নিয়ে)[\s\S]{0,35}?(?:মামলা\s*দায়ের|মামলা\s*হয়েছে|মামলা\s*রুজু)/u,
  /(?:বিরুদ্ধে|নামে)[\s\S]{0,35}?(?:মামলা\s*দায়ের|মামলা\s*করা\s*হয়েছে)/u,
  /\b(?:case\s+(?:filed|lodged|recorded|registered)|lawsuit\s+(?:filed|lodged)|complaint\s+(?:lodged|filed)|FIR\s+(?:filed|lodged|registered))\b/i,
  /\bcase\s+filed\s+over\b/i,
];

// Feature 8: Administrative Probe / Inquiry Committee Patterns
const PROBE_COMMITTEE_PATTERNS = [
  /(?:তদন্ত\s*কমিটি\s*(?:গঠন|গঠন\s*করেছে|করা\s*হয়েছে|হয়েছে|করল|ঘোষণা)|তদন্ত\s*দল\s*গঠন)/u,
  /(?:তদন্ত\s*কমিটিকে|কমিটিকে\s*আগামী[\s\S]{0,30}?প্রতিবেদন)/u,
  /\b(?:probe\s+committee|inquiry\s+committee|investigation\s+committee|probe\s+body|fact-finding\s+committee)\s+(?:formed|constituted|set\s+up|launched|announced)\b/i,
  /\b(?:formed|constituted)\s+(?:a\s+)?(?:probe|inquiry|investigation)\s+committee\b/i,
];

// Feature 8: Interrogation / Questioning Patterns
const INTERROGATION_PATTERNS = [
  /(?:রিমান্ডে\s*জিজ্ঞাসাবাদ|জিজ্ঞাসাবাদ\s*করা\s*হচ্ছে|জিজ্ঞাসাবাদ\s*চলছে|আটক[\s\S]{0,25}?জিজ্ঞাসাবাদ|জিজ্ঞাসাবাদে\s*(?:গুরুত্বপূর্ণ|তথ্য|স্বীকার))/u,
  /\b(?:suspects?\s+interrogated|interrogated\s+by|under\s+interrogation|questioned\s+by\s+police)\b/i,
];

// Feature 8: General Diary (GD) Patterns
const GENERAL_DIARY_PATTERNS = [
  /(?:সাধারণ\s*ডায়েরি\s*\(?জিডি\)?|থানায়\s*জিডি|জিডি\s*করেছেন|জিডি\s*দায়ের|জিডি\s*অন্তর্ভুক্ত|জিডি\s*করা\s*হয়েছে)/u,
  /\b(?:general\s+diary|GD\s+filed|filed\s+(?:a\s+)?GD|lodged\s+(?:a\s+)?GD)\b/i,
];

const HISTORICAL_CASE_PATTERNS = [
  /(?:হামলা|হত্যা|খুন|ডাকাতি|লুটপাট|নাশকতা)\s*মামলার\s*(?:পলাতক\s*আসামি|আসামি|তদন্ত|অভিযোগপত্র|চার্জশিট|হাজিরা|রায়|শুনানি|আদেশ|নথি)/u,
  /(?:গাড়িবহরে\s*হামলা,\s*মামলার|গাড়িবহরে\s*হামলা\s*মামলার)/u,
  /\b(?:case\s+filed\s+over\s+past|accused\s+in(?:\s+the)?\s+\w+\s+case|lawsuit\s+over\s+past)\b/i,
];

const POLITICAL_REACTION_PATTERNS = [
  /(?:হামলায়\s*জড়িতদের\s*আইনের\s*আওতায়\s*আনা\s*হবে|হামলার\s*ঘটনায়\s*(?:রাষ্ট্রপতির|প্রধানমন্ত্রীর|জরুরি|পদক্ষেপ|তদন্ত)|হামলার\s*নিন্দা|হামলার\s*তীব্র\s*নিন্দা|নিন্দা\s*ও\s*প্রতিবাদ)/u,
  /\b(?:condemns?\s+(?:the\s+)?attack|vows?\s+action\s+against\s+attackers|demands?\s+justice)\b/i,
];

const RETROSPECTIVE_SUMMARY_PATTERNS = [
  /(?:\d+\s*দিনে\s*[\s\S]{0,30}?(?:হামলা|আগুন|সংঘর্ষ|নিহত|গুলিবিদ্ধ)|এক\s*মাসে\s*[\s\S]{0,30}?(?:হামলা|হত্যা|খুন)|বছরের\s*খতিয়ান|crime\s+statistics|monthly\s+review)/u,
  /\b(?:in\s+\d+\s+days\s+.*(?:attacks?|killed|shot)|monthly\s+crime\s+statistics)\b/i,
];

const CAMPUS_STANDOFF_RESOLVED_PATTERNS = [
  /(?:৪\s*ঘণ্টা\s*অবরুদ্ধ|ঘণ্টা\s*অবরুদ্ধ|অবরুদ্ধ\s*মুক্ত|পরিস্থিতি\s*শান্ত|পরিস্থিতি\s*স্বাভাবিক|মীমাংসা\s*হয়েছে|প্রভোস্টের\s*হস্তক্ষেপে\s*শান্ত)/u,
  /\b(?:situation\s+calmed\s+down|standoff\s+ended|confined\s+for\s+\d+\s+hours\s+then\s+freed)\b/i,
];

const FOLLOW_UP_MOURNING_PATTERNS = [
  'জানাজা সম্পন্ন',
  'দাফন সম্পন্ন',
  'কবরস্থ',
  'শোকের ছায়া',
  'শোকের ছায়া',
  'জানাজা শেষে',
  'দাফন শেষে',
  'শেষকৃত্য সম্পন্ন',
  'memorial service',
  'burial held',
  'funeral prayer',
  'funeral held',
  'laid to rest',
];

function checkGroundRealityDisqualification(
  combinedText: string,
  title: string = ''
): { isDisqualified: boolean; reason?: string } {
  const isImmediateAttack = IMMEDIATE_VIOLENT_ATTACK_PATTERNS.some((pat) => pat.test(combinedText));

  // Retrospective legal / trial detection
  const isJudicialRetrospective = RETROSPECTIVE_JUDICIAL_PATTERNS.some((pat) =>
    pat.test(combinedText)
  );

  // Active physical attack directed at venue (not a past trial/verdict)
  const isCourtVenueAttack =
    COURT_VENUE_PATTERNS.some((p) => p.test(combinedText)) &&
    isImmediateAttack &&
    !isJudicialRetrospective;

  const isPoliticalVenueAttack =
    POLITICAL_VENUE_PATTERNS.some((p) => p.test(combinedText)) &&
    isImmediateAttack &&
    !isJudicialRetrospective;

  // 1. Bail Hearing Disqualification (Bail hearings are strictly legal proceedings)
  if (BAIL_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    return { isDisqualified: true, reason: 'BAIL_HEARING' };
  }

  // 2. Corruption Probe Disqualification (ACC investigations are strictly non-physical financial/graft inquiries)
  if (CORRUPTION_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    return { isDisqualified: true, reason: 'CORRUPTION_PROBE' };
  }

  // 3. Historical Allegation Disqualification (1971 war crimes, decades-old allegations)
  if (HISTORICAL_ALLEGATION_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    return { isDisqualified: true, reason: 'HISTORICAL_ALLEGATION' };
  }

  // 4. Court Proceeding Disqualification (unless an active bomb/gunfire attack is taking place at the court venue itself)
  if (COURT_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    if (!isCourtVenueAttack) {
      return { isDisqualified: true, reason: 'COURT_PROCEEDING' };
    }
  }

  // 5. Political Statement Disqualification (unless an active violent attack is taking place at the political gathering)
  if (POLITICAL_STATEMENT_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    if (!isPoliticalVenueAttack) {
      return { isDisqualified: true, reason: 'POLITICAL_STATEMENT' };
    }
  }

  // 6. Administrative Dispute Disqualification (unless an active violent attack/clash with weapons is underway)
  if (ADMINISTRATIVE_DISPUTE_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    if (!isImmediateAttack) {
      return { isDisqualified: true, reason: 'ADMINISTRATIVE_DISPUTE' };
    }
  }

  // 7. Mourning and Funeral Follow-Up Disqualification (retrospective burial/prayer ceremonies)
  if (FOLLOW_UP_MOURNING_PATTERNS.some((pattern) => combinedText.includes(pattern))) {
    return { isDisqualified: true, reason: 'MOURNING_FOLLOWUP' };
  }

  // 8. Case Filing Follow-Up Disqualification (Feature 8)
  const isCaseFilingTitle = CASE_FILING_PATTERNS.some((p) => p.test(title));
  const isCaseFiling = CASE_FILING_PATTERNS.some((p) => p.test(combinedText));
  if ((isCaseFilingTitle || (isCaseFiling && !isImmediateAttack)) && !isCourtVenueAttack) {
    return { isDisqualified: true, reason: 'CASE_FILING_FOLLOWUP' };
  }

  // 9. Administrative Probe / Inquiry Committee Disqualification (Feature 8)
  const isProbeTitle = PROBE_COMMITTEE_PATTERNS.some((p) => p.test(title));
  const isProbe = PROBE_COMMITTEE_PATTERNS.some((p) => p.test(combinedText));
  if (isProbeTitle || (isProbe && !isImmediateAttack)) {
    return { isDisqualified: true, reason: 'PROBE_COMMITTEE' };
  }

  // 10. Interrogation / Questioning Follow-Up Disqualification (Feature 8)
  const isInterrogationTitle = INTERROGATION_PATTERNS.some((p) => p.test(title));
  const isInterrogation = INTERROGATION_PATTERNS.some((p) => p.test(combinedText));
  if (isInterrogationTitle || (isInterrogation && !isImmediateAttack)) {
    return { isDisqualified: true, reason: 'INTERROGATION_FOLLOWUP' };
  }

  // 11. General Diary (GD) Disqualification (Feature 8)
  const isGDTitle = GENERAL_DIARY_PATTERNS.some((p) => p.test(title));
  const isGD = GENERAL_DIARY_PATTERNS.some((p) => p.test(combinedText));
  if (isGDTitle || (isGD && !isImmediateAttack)) {
    return { isDisqualified: true, reason: 'GENERAL_DIARY' };
  }

  // 12. Arrest Follow-Up Disqualification (Feature 7) (unless active shootout/violence occurred during the arrest or live contraband interdiction)
  const isArrestFollowup = ARREST_FOLLOWUP_PATTERNS.some((pat) => pat.test(combinedText));
  const hasActiveArrestClash = ACTIVE_ARREST_CLASH_PATTERNS.some((pat) => pat.test(combinedText));
  const isBorderOrContrabandSeizure =
    /(?:বিজিবির\s*অভিযানে|সীমান্তে[\s\S]{0,35}?(?:অভিযানে|বিজিবি)|পাচারকালে|চোরাচালানকালে|smuggling\s+in\s+progress|border\s+(?:guard|drive|seizure))/u.test(combinedText) &&
    /(?:উদ্ধার|জব্দ|seized|recovered)/u.test(combinedText);
  if (isArrestFollowup && !hasActiveArrestClash && !isBorderOrContrabandSeizure) {
    return { isDisqualified: true, reason: 'ARREST_FOLLOWUP' };
  }

  // 13. Historical Case Reference Disqualification (e.g. "গাড়িবহরে হামলা মামলার পলাতক আসামি গ্রেফতার")
  const isHistoricalCase = HISTORICAL_CASE_PATTERNS.some((pat) => pat.test(combinedText));
  if (isHistoricalCase && !isImmediateAttack) {
    return { isDisqualified: true, reason: 'HISTORICAL_CASE_MENTION' };
  }

  // 14. Political Reaction / Ministerial Statement Disqualification
  const isPoliticalReaction = POLITICAL_REACTION_PATTERNS.some((pat) => pat.test(combinedText));
  if (isPoliticalReaction && !isImmediateAttack) {
    return { isDisqualified: true, reason: 'POLITICAL_STATEMENT' };
  }

  // 15. Retrospective Crime Statistics / Multi-day Summary Disqualification
  if (RETROSPECTIVE_SUMMARY_PATTERNS.some((pat) => pat.test(combinedText))) {
    return { isDisqualified: true, reason: 'RETROSPECTIVE_SUMMARY' };
  }

  // 16. Resolved Campus / Institutional Standoff Disqualification
  const isCampusResolved = CAMPUS_STANDOFF_RESOLVED_PATTERNS.some((pat) => pat.test(combinedText));
  if (isCampusResolved && !isImmediateAttack) {
    return { isDisqualified: true, reason: 'RESOLVED_ALTERCATION' };
  }

  return { isDisqualified: false };
}

/**
 * Classifies an article's headline and summary into a public safety category and severity level.
 * Supports both Bangla and English news content with smart combination resolution.
 */
export const classifyNewsText = (title: string, summary: string = ''): ClassifiedNews => {
  // Normalize Unicode (NFC) to handle decomposed nuktas (e.g. ড+় vs ড়) across different Bengali news sources
  const combinedText = `${title} ${summary}`.normalize('NFC').toLowerCase();
  const matchedKeywords: string[] = [];

  const categoryScores: Partial<Record<ReportCategory, number>> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ReportCategory, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (matchesKeyword(combinedText, kw)) {
        const weight = getKeywordWeight(kw);
        score += weight;
        matchedKeywords.push(kw);
      }
    }
    if (score > 0) {
      categoryScores[category] = score;
    }
  }

  // Distinguish vehicular collisions from violent armed/political clashes:
  // In Bengali, vehicular crashes are often titled "মুখোমুখি সংঘর্ষ" or "বাস-ট্রাক সংঘর্ষ".
  // If the story involves vehicles and NO human violent faction/weapon/protest terms, it must resolve to ROAD_ACCIDENT.
  const hasVehicle = VEHICLE_KEYWORDS.some((vk) => matchesKeyword(combinedText, vk));
  const hasViolentFaction = VIOLENT_FACTION_KEYWORDS.some((fk) => matchesKeyword(combinedText, fk));
  const hasRoadCollisionTerms =
    combinedText.includes('সংঘর্ষ') ||
    combinedText.includes('দুর্ঘটনা') ||
    combinedText.includes('দুর্ঘটনায়') ||
    combinedText.includes('ধাক্কা') ||
    combinedText.includes('ধাক্কায়') ||
    combinedText.includes('চাপা') ||
    combinedText.includes('চাপায়') ||
    combinedText.includes('উল্টে') ||
    combinedText.includes('খাদে') ||
    combinedText.includes('নিয়ন্ত্রণ হারিয়ে') ||
    combinedText.includes('নিয়ন্ত্রণ হারিয়ে') ||
    combinedText.includes('মুখোমুখি সংঘর্ষ') ||
    combinedText.includes('সড়ক দুর্ঘটনা') ||
    combinedText.includes('গাড়ি দুর্ঘটনা') ||
    combinedText.includes('collision') ||
    combinedText.includes('traffic accident') ||
    combinedText.includes('head-on collision') ||
    combinedText.includes('road crash') ||
    combinedText.includes('crash') ||
    combinedText.includes('crashed');

  if (hasVehicle && !hasViolentFaction && hasRoadCollisionTerms) {
    categoryScores['ROAD_ACCIDENT'] = (categoryScores['ROAD_ACCIDENT'] || 0) + 15;
    categoryScores['ARMED_ASSAULT'] = 0; // Clear collision with generic "সংঘর্ষ" keyword
    if (!matchedKeywords.includes('road accident')) {
      matchedKeywords.push('road accident');
    }
  }

  // Detect Smart Combinations
  const hasTheft = (categoryScores['THEFT'] || 0) > 0;
  const hasRobbery = (categoryScores['ROBBERY'] || 0) > 0 || (categoryScores['DACOITY'] || 0) > 0;
  const hasSnatching = (categoryScores['SNATCHING'] || 0) > 0 || (categoryScores['MUGGING'] || 0) > 0;
  const hasArmedAssault = (categoryScores['ARMED_ASSAULT'] || 0) > 0;

  let resolvedCategory: ReportCategory | null = null;

  if (hasTheft && hasRobbery) {
    resolvedCategory = 'THEFT_ROBBERY';
  } else if (hasSnatching && hasArmedAssault) {
    resolvedCategory = 'SNATCHING_ARMED_ASSAULT';
  } else if (hasArmedAssault && (categoryScores['ROAD_ACCIDENT'] || 0) > 0) {
    // A road accident strictly requires vehicular involvement and collision context.
    // If genuine violent human/faction/clash terms are present, ARMED_ASSAULT takes precedence.
    if (hasVehicle && hasRoadCollisionTerms && !hasViolentFaction) {
      resolvedCategory = 'ROAD_ACCIDENT';
    } else {
      resolvedCategory = 'ARMED_ASSAULT';
    }
  } else if (hasArmedAssault && hasTheft) {
    // When a theft-related dispute, background cause, or trigger leads to an active physical clash,
    // assault, or injuries (e.g. "হবিগঞ্জে চুরির ঘটনাকে কেন্দ্র করে দুই গ্রামের সংঘর্ষে আহত অর্ধশত"),
    // the active physical safety hazard on the ground is ARMED_ASSAULT.
    resolvedCategory = 'ARMED_ASSAULT';
  } else {
    // Pick category with highest score (prefer primary forms over legacy aliases)
    let maxScore = 0;
    for (const [cat, score] of Object.entries(categoryScores) as [ReportCategory, number][]) {
      if (score > maxScore) {
        maxScore = score;
        resolvedCategory = cat;
      }
    }
  }

  // Map legacy aliases to primary forms
  if (resolvedCategory === 'MUGGING') resolvedCategory = 'SNATCHING';
  if (resolvedCategory === 'DACOITY') resolvedCategory = 'ROBBERY';
  if (resolvedCategory === 'THEFT_DACOITY') resolvedCategory = 'THEFT_ROBBERY';
  if (resolvedCategory === 'TEEN_GANG') resolvedCategory = 'YOUTH_GANG_ACTIVITY';
  if (resolvedCategory === 'DRUG_ACTIVITY') resolvedCategory = 'DRUG_RELATED_CRIME';

  // Evaluate ground-reality physical safety disqualification
  const disqualification = checkGroundRealityDisqualification(combinedText, title);
  if (disqualification.isDisqualified) {
    return {
      isSafetyRelated: false,
      category: resolvedCategory || 'ROAD_ACCIDENT',
      severity: 'LOW',
      confidence: 0.0,
      matchedKeywords,
      disqualifiedReason: disqualification.reason,
    };
  }

  // Verify ARMED_ASSAULT weapon evidence:
  // If an incident resolves to ARMED_ASSAULT but only has generic beating (মারধর, মারপিট)
  // without deadly weapons (firearms, sharp cutting blades, explosives) or organized mass casualties,
  // disqualify as UNARMED_SCUFFLE
  if (resolvedCategory === 'ARMED_ASSAULT') {
    const hasDeadlyWeapon =
      combinedText.includes('অস্ত্র') ||
      combinedText.includes('আগ্নেয়াস্ত্র') ||
      combinedText.includes('বন্দুক') ||
      combinedText.includes('গুলি') ||
      combinedText.includes('গুলিবিদ্ধ') ||
      combinedText.includes('কোপানো') ||
      combinedText.includes('কুপিয়ে') ||
      combinedText.includes('ছুরিকাঘাত') ||
      combinedText.includes('ছুরি') ||
      combinedText.includes('চাপাতি') ||
      combinedText.includes('রামদা') ||
      combinedText.includes('টেঁটা') ||
      combinedText.includes('বোমা') ||
      combinedText.includes('ককটেল') ||
      combinedText.includes('টিয়ারশেল') ||
      combinedText.includes('লাঠিসোঁটা') ||
      combinedText.includes('দেশীয় অস্ত্র') ||
      combinedText.includes('রক্তক্ষয়ী') ||
      combinedText.includes('সংঘর্ষে আহত') ||
      combinedText.includes('সংঘর্ষে নিহত') ||
      combinedText.includes('রণক্ষেত্র') ||
      combinedText.includes('gunfire') ||
      combinedText.includes('shootout') ||
      combinedText.includes('gunfight') ||
      combinedText.includes('বন্দুকযুদ্ধ') ||
      combinedText.includes('গোলাগুলি') ||
      combinedText.includes('গুলিবর্ষণ') ||
      combinedText.includes('shooting') ||
      combinedText.includes('shot') ||
      combinedText.includes('stabbed') ||
      combinedText.includes('stabbing') ||
      combinedText.includes('machete') ||
      combinedText.includes('bomb') ||
      combinedText.includes('blast') ||
      combinedText.includes('armed');

    if (!hasDeadlyWeapon) {
      const isInstitutionalOrScuffle =
        combinedText.includes('হল') ||
        combinedText.includes('হলে') ||
        combinedText.includes('ক্যাম্পাস') ||
        combinedText.includes('বিশ্ববিদ্যালয়') ||
        combinedText.includes('শিক্ষার্থী') ||
        combinedText.includes('ছাত্র') ||
        combinedText.includes('মারধর') ||
        combinedText.includes('হাতাহাতি');

      if (isInstitutionalOrScuffle) {
        return {
          isSafetyRelated: false,
          category: 'ARMED_ASSAULT',
          severity: 'LOW',
          confidence: 0.0,
          matchedKeywords,
          disqualifiedReason: 'UNARMED_SCUFFLE',
        };
      }
    }
  }

  if (!resolvedCategory) {
    return {
      isSafetyRelated: false,
      category: 'ROAD_ACCIDENT',
      severity: 'LOW',
      confidence: 0.0,
      matchedKeywords: [],
    };
  }

  // Determine Severity
  let severity: ReportSeverity = 'LOW';
  for (const kw of HIGH_SEVERITY_KEYWORDS) {
    if (matchesKeyword(combinedText, kw)) {
      severity = 'HIGH';
      break;
    }
  }

  if (severity !== 'HIGH') {
    for (const kw of MEDIUM_SEVERITY_KEYWORDS) {
      if (matchesKeyword(combinedText, kw)) {
        severity = 'MEDIUM';
        break;
      }
    }
  }

  // Calculate probabilistic confidence score (0.0 - 1.0)
  let confidence = 0.0;
  const rawScore = categoryScores[resolvedCategory] || 0;
  if (rawScore >= 15) {
    confidence = 0.95;
  } else if (rawScore >= 10) {
    confidence = 0.88;
  } else if (rawScore >= 5) {
    confidence = 0.78;
  } else if (rawScore >= 3) {
    confidence = 0.70;
  } else {
    confidence = 0.60;
  }

  return {
    isSafetyRelated: true,
    category: resolvedCategory,
    severity,
    confidence,
    matchedKeywords,
  };
};
