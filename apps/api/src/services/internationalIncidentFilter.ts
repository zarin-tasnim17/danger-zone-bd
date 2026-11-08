/**
 * Bangladesh Domestic News Safety Boundary Filter
 *
 * Danger Zone Bangladesh is exclusively a public safety and hazard map for the sovereign
 * territory of Bangladesh. Overseas news reports (e.g. accidents in Saudi Arabia, UAE,
 * India, Malaysia, USA) where expatriate Bangladeshis or international events are reported
 * MUST be filtered out so they are never erroneously geocoded onto Bangladesh's map.
 */

// Normalized list of foreign countries, territories, overseas cities, and international markers
const FOREIGN_KEYWORDS: string[] = [
  // Middle East & Gulf (Very common expatriate news)
  'সৌদি',
  'সৌদিতে',
  'সৌদি আরব',
  'সৌদি আরবে',
  'জেদ্দা',
  'জেদ্দায়',
  'জেদ্দায়',
  'রিয়াদ',
  'রিয়াদ',
  'মক্কা',
  'মক্কায়',
  'মদিনা',
  'মদিনায়',
  'দাহরান',
  'দাম্মাম',
  'দুবাই',
  'দুবাইতে',
  'শারজাহ',
  'আবুধাবি',
  'আবু ধাবি',
  'সংযুক্ত আরব আমিরাত',
  'ইউএই',
  'কাতার',
  'কাতারে',
  'দোহা',
  'কুয়েত',
  'কুয়েত',
  'কুয়েতে',
  'ওমান',
  'ওমানে',
  'মাসকাট',
  'বাহরাইন',
  'বাহরাইনে',
  'লেবানন',
  'লেবাননে',
  'বৈরুত',
  'ইরাক',
  'ইরান',
  'ইয়েমেন',
  'সিরিয়া',
  'ইসরায়েল',
  'ইসরাইল',
  'ফিলিস্তিন',
  'গাজা',

  // South Asia, Neighbors & Southeast Asia
  'ভারত',
  'ভারতে',
  'ভারতীয়',
  'ভারতীয়',
  'কলকাতা',
  'কলকাতায়',
  'কলকাতায়',
  'দিল্লি',
  'দিল্লিতে',
  'মুম্বাই',
  'পশ্চিমবঙ্গ',
  'পশ্চিমবঙ্গে',
  'আসামে',
  'আসাম রাজ্য',
  'ত্রিপুরা',
  'ত্রিপুরায়',
  'পাকিস্তান',
  'পাকিস্তানে',
  'করাচি',
  'লাহোর',
  'ইসলামাবাদ',
  'নেপাল',
  'কাঠমান্ডু',
  'ভুটান',
  'শ্রীলঙ্কা',
  'কলম্বো',
  'মিয়ানমার',
  'মিয়ানমার',
  'বার্মা',
  'ইয়াঙ্গুন',
  'মালয়েশিয়া',
  'মালয়েশিয়া',
  'মালয়েশিয়ায়',
  'কুয়ালালামপুর',
  'সিঙ্গাপুর',
  'সিঙ্গাপুরে',
  'ইন্দোনেশিয়া',
  'থাইল্যান্ড',
  'ব্যাংকক',
  'ভিয়েতনাম',

  // Europe, Americas & Africa
  'যুক্তরাষ্ট্র',
  'যুক্তরাষ্ট্রে',
  'আমেরিকা',
  'আমেরিকায়',
  'আমেরিকাতে',
  'নিউইয়র্ক',
  'নিউইয়র্ক',
  'ওয়াশিংটন',
  'কানাডা',
  'কানাডায়',
  'যুক্তরাজ্য',
  'যুক্তরাজ্যে',
  'ব্রিটেন',
  'লন্ডন',
  'লন্ডনে',
  'ইতালি',
  'ইতালিতে',
  'রোমে',
  'ফ্রান্স',
  'প্যারিস',
  'জার্মানি',
  'বার্লিন',
  'গ্রিস',
  'রাশিয়া',
  'মস্কো',
  'ইউক্রেন',
  'তুরস্ক',
  'ইস্তাম্বুল',
  'দক্ষিণ আফ্রিকা',
  'দক্ষিণ আফ্রিকায়',
  'লিবিয়া',
  'সুদানে',
  'মিশর',
  'অস্ট্রেলিয়া',
  'সিডনি',

  // Expatriate / Overseas Markers (When in headline or primary phrase)
  'প্রবাসী',
  'প্রবাসে',
  'বিদেশে',
  'বিদেশের মাটিতে',
  'আন্তর্জাতিক সংবাদ',

  // English Keywords
  'saudi',
  'saudi arabia',
  'jeddah',
  'riyadh',
  'dubai',
  'uae',
  'qatar',
  'kuwait',
  'oman',
  'bahrain',
  'malaysia',
  'singapore',
  'india',
  'kolkata',
  'delhi',
  'pakistan',
  'myanmar',
  'united states',
  'usa',
  'united kingdom',
  'uk',
  'london',
  'expatriate',
  'overseas',
  'abroad',
];

export interface ForeignCheckResult {
  isForeign: boolean;
  matchedTerm?: string;
  reason?: string;
}

/**
 * Evaluates whether a news article describes an international / foreign incident.
 *
 * @param title The news headline (highest priority)
 * @param snippet The short article preview or lead sentence
 */
export function isForeignIncident(title: string, snippet: string = ''): ForeignCheckResult {
  if (!title && !snippet) {
    return { isForeign: false };
  }

  // Normalize Bengali Unicode (NFC) to ensure consistent match of nuktas
  const normTitle = (title || '').normalize('NFC').toLowerCase();
  const normSnippet = (snippet || '').normalize('NFC').toLowerCase();
  const combined = `${normTitle} ${normSnippet}`;

  for (const keyword of FOREIGN_KEYWORDS) {
    const normKeyword = keyword.normalize('NFC').toLowerCase();

    // Prevent false positive on Bengali 'আসামি' (which means accused/convict, not Assam state)
    if (keyword.startsWith('আসাম')) {
      const isAccusedWord = /(?:আসামি|আসামির|আসামিদের|আসামিরা|আসামীর)/i.test(normTitle);
      const isAssamState = /(?:আসামে|আসাম\s+রাজ্য|আসামের)/i.test(normTitle);
      if (isAccusedWord && !isAssamState) {
        continue;
      }
    }

    // 1. High-priority headline check (e.g. "সৌদিতে সড়ক দুর্ঘটনা...", "ভারতে ছিনতাই...")
    if (normTitle.includes(normKeyword)) {
      return {
        isForeign: true,
        matchedTerm: keyword,
        reason: `Headline explicitly references foreign country/location "${keyword}"`,
      };
    }

    // 2. Incident-specific phrasing in snippet
    const accidentForeignRegex = new RegExp(
      `(?:${normKeyword})[\\s\\S]{0,30}(?:সড়ক দুর্ঘটনা|দুর্ঘটনা|নিহত|আহত|হামলা|ছিনতাই|আগুনে|দাফন|লাশ|dead|killed|crash|accident)`,
      'i'
    );

    if (accidentForeignRegex.test(combined)) {
      return {
        isForeign: true,
        matchedTerm: keyword,
        reason: `Article context associates incident with foreign location "${keyword}"`,
      };
    }
  }

  return { isForeign: false };
}
