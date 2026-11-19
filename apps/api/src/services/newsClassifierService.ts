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
    'mugging',
    'mugger',
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
    'আগ্নেয়াস্ত্র',
    'বন্দুকধারী',
    'বোমা হামলা',
    'সংঘর্ষ',
    'দুই পক্ষের সংঘর্ষ',
    'দুপক্ষের সংঘর্ষ',
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
    'সংঘর্ষে নিহত',
    'সংঘর্ষে আহত',
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
  'বোমা হামলা',
  'দুই পক্ষের সংঘর্ষ',
  'দুপক্ষের সংঘর্ষ',
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
  /(?:ককটেল\s*বিস্ফোরণ|বোমা\s*হামলা|বোমা\s*বিস্ফোরণ|গুলি\s*বর্ষণ|গুলি\s*ছুড়ে|ককটেল\s*হামলা|রণক্ষেত্র|ককটেল\s*ছোড়া|অস্ত্রধারীদের\s*গুলি|cocktail\s*blast|cocktail\s*explosion|bomb\s*attack|bomb\s*blast|gunfire|shooting|bombed|explosive\s*device)/i,
];

function checkGroundRealityDisqualification(
  combinedText: string
): { isDisqualified: boolean; reason?: string } {
  // Retrospective legal / trial detection
  const isJudicialRetrospective = RETROSPECTIVE_JUDICIAL_PATTERNS.some((pat) =>
    pat.test(combinedText)
  );

  // Active physical attack directed at venue (not a past trial/verdict)
  const isCourtVenueAttack =
    COURT_VENUE_PATTERNS.some((p) => p.test(combinedText)) &&
    IMMEDIATE_VIOLENT_ATTACK_PATTERNS.some((p) => p.test(combinedText)) &&
    !isJudicialRetrospective;

  const isPoliticalVenueAttack =
    POLITICAL_VENUE_PATTERNS.some((p) => p.test(combinedText)) &&
    IMMEDIATE_VIOLENT_ATTACK_PATTERNS.some((p) => p.test(combinedText)) &&
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

  // 6. Administrative Dispute Disqualification
  if (ADMINISTRATIVE_DISPUTE_KEYWORDS.some((kw) => matchesKeyword(combinedText, kw))) {
    return { isDisqualified: true, reason: 'ADMINISTRATIVE_DISPUTE' };
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
    combinedText.includes('মুখোমুখি সংঘর্ষ') ||
    combinedText.includes('সড়ক দুর্ঘটনা') ||
    combinedText.includes('গাড়ি দুর্ঘটনা') ||
    combinedText.includes('বাস-ট্রাক') ||
    combinedText.includes('ট্রাক-পিকআপ') ||
    combinedText.includes('পিকআপ-ড্রাম') ||
    combinedText.includes('গাড়ির সংঘর্ষ') ||
    combinedText.includes('লরির সংঘর্ষ') ||
    combinedText.includes('মোটরসাইকেল দুর্ঘটনা') ||
    combinedText.includes('অটোরিকশা দুর্ঘটনা') ||
    combinedText.includes('চাপা পড়ে নিহত') ||
    combinedText.includes('চাপা দিয়ে নিহত') ||
    combinedText.includes('চাপা দিয়েছে') ||
    combinedText.includes('উল্টে খাদে') ||
    combinedText.includes('বাস উল্টে') ||
    combinedText.includes('ট্রাক উল্টে') ||
    combinedText.includes('পিকআপ উল্টে') ||
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
    // If genuine violent political/weapon terms are present, violent clash overrides road keywords
    if (hasViolentFaction) {
      resolvedCategory = 'ARMED_ASSAULT';
    } else {
      resolvedCategory = 'ROAD_ACCIDENT';
    }
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
  const disqualification = checkGroundRealityDisqualification(combinedText);
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
