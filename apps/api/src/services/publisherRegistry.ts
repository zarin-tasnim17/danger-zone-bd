export type PublisherQualityTier = 1 | 2 | 3 | 4;
export type PublisherSourceType = 'NEWSPAPER' | 'ONLINE_PORTAL' | 'WIRE' | 'TV_PORTAL' | 'REGIONAL_PRESS';
export type DiscoveryMethod = 'RSS' | 'GOOGLE_NEWS_PUBLISHER' | 'GOOGLE_NEWS_DISTRICT' | 'SITEMAP';

export interface GeographicCoverage {
  divisions: string[];
  districts: string[];
}

export interface PublisherPerformanceMetrics {
  retrievedArticles: number;
  successfullyParsed: number;
  freshArticles: number;
  qualifyingIncidents: number;
  uniqueIncidentsContributed: number;
  duplicateRate: number;
  lastSuccessfulRetrieval?: string;
  lastFailure?: string;
}

export interface PublisherEntry {
  domain: string;
  name: string;
  tier: PublisherQualityTier;
  qualityWeight: number; // 1.0 (Tier 1), 0.85 (Tier 2), 0.65 (Tier 3), 0.50 (Tier 4)
  sourceType: PublisherSourceType;
  language: 'bn' | 'en' | 'both';
  isWireAgency: boolean; // true for BSS, UNB
  discoveryMethods: DiscoveryMethod[];
  feedUrl?: string;
  requiresXmlSanitization?: boolean;
  geographicCoverage: GeographicCoverage;
  enabled: boolean;
  metrics?: PublisherPerformanceMetrics;
}

export const PUBLISHER_REGISTRY: Record<string, PublisherEntry> = {
  // ==========================================================================
  // TIER 1: NATIONAL MAJOR DAILIES & PRIMARY PORTALS (Quality Weight: 1.0)
  // ==========================================================================
  'prothomalo.com': {
    domain: 'prothomalo.com',
    name: 'Prothom Alo',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.prothomalo.com/feed',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'en.prothomalo.com': {
    domain: 'en.prothomalo.com',
    name: 'Prothom Alo English',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'en',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://en.prothomalo.com/feed',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'thedailystar.net': {
    domain: 'thedailystar.net',
    name: 'The Daily Star',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'en',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.thedailystar.net/frontpage/rss.xml',
    requiresXmlSanitization: true,
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'dhakatribune.com': {
    domain: 'dhakatribune.com',
    name: 'Dhaka Tribune',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'en',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.dhakatribune.com/feed/',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'tbsnews.net': {
    domain: 'tbsnews.net',
    name: 'The Business Standard',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'both',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.tbsnews.net/rss.xml',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'ittefaq.com.bd': {
    domain: 'ittefaq.com.bd',
    name: 'Daily Ittefaq',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'kalerkantho.com': {
    domain: 'kalerkantho.com',
    name: 'Kaler Kantho',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'jugantor.com': {
    domain: 'jugantor.com',
    name: 'Jugantor',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'samakal.com': {
    domain: 'samakal.com',
    name: 'Samakal',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'bdnews24.com': {
    domain: 'bdnews24.com',
    name: 'BDNews24',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'ONLINE_PORTAL',
    language: 'both',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'bd-pratidin.com': {
    domain: 'bd-pratidin.com',
    name: 'Bangladesh Pratidin',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER', 'GOOGLE_NEWS_DISTRICT'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'dailyjanakantha.com': {
    domain: 'dailyjanakantha.com',
    name: 'Janakantha',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'mzamin.com': {
    domain: 'mzamin.com',
    name: 'Daily Manab Zamin',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'dailynayadiganta.com': {
    domain: 'dailynayadiganta.com',
    name: 'Daily Naya Diganta',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'dailyinqilab.com': {
    domain: 'dailyinqilab.com',
    name: 'Daily Inqilab',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'amadershomoy.com': {
    domain: 'amadershomoy.com',
    name: 'Dainik Amader Shomoy',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'bonikbarta.net': {
    domain: 'bonikbarta.net',
    name: 'Bonik Barta',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'newagebd.net': {
    domain: 'newagebd.net',
    name: 'New Age',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'en',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'thefinancialexpress.com.bd': {
    domain: 'thefinancialexpress.com.bd',
    name: 'The Financial Express',
    tier: 1,
    qualityWeight: 1.0,
    sourceType: 'NEWSPAPER',
    language: 'en',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },

  // ==========================================================================
  // TIER 2: ESTABLISHED REGIONAL NEWSPAPERS & MAJOR DIGITAL PORTALS (Weight: 0.85)
  // ==========================================================================
  // Chattogram Division
  'dainikazadi.net': {
    domain: 'dainikazadi.net',
    name: 'Dainik Azadi',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://dainikazadi.net/feed/',
    geographicCoverage: {
      divisions: ['Chattogram'],
      districts: ['Chattogram', "Cox's Bazar", 'Feni', 'Rangamati', 'Bandarban', 'Khagrachhari'],
    },
    enabled: true,
  },
  'dainikpurbokone.net': {
    domain: 'dainikpurbokone.net',
    name: 'Dainik Purbokone',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Chattogram'],
      districts: ['Chattogram', "Cox's Bazar", 'Bandarban', 'Rangamati', 'Khagrachhari'],
    },
    enabled: true,
  },
  'cvoice24.com': {
    domain: 'cvoice24.com',
    name: 'CVoice24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Chattogram'],
      districts: ['Chattogram', "Cox's Bazar"],
    },
    enabled: true,
  },
  'pahar24.com': {
    domain: 'pahar24.com',
    name: 'Pahar24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Chattogram'],
      districts: ['Rangamati', 'Khagrachhari', 'Bandarban'],
    },
    enabled: true,
  },
  'cbn24.net': {
    domain: 'cbn24.net',
    name: "Cox's Bazar News (CBN)",
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Chattogram'],
      districts: ["Cox's Bazar", 'Bandarban'],
    },
    enabled: true,
  },
  // Khulna Division
  'khulnagazette.com': {
    domain: 'khulnagazette.com',
    name: 'Khulna Gazette',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Khulna'],
      districts: ['Khulna', 'Bagerhat', 'Satkhira', 'Jessore'],
    },
    enabled: true,
  },
  'gramerkagoj.com': {
    domain: 'gramerkagoj.com',
    name: 'Gramer Kagoj',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Khulna'],
      districts: ['Jessore', 'Jhenaidah', 'Magura', 'Narail'],
    },
    enabled: true,
  },
  'mathabhanga.com': {
    domain: 'mathabhanga.com',
    name: 'Dainik Mathabhanga',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Khulna'],
      districts: ['Chuadanga', 'Meherpur', 'Kushtia'],
    },
    enabled: true,
  },
  'patradoot.net': {
    domain: 'patradoot.net',
    name: 'Dainik Patradoot',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Khulna'],
      districts: ['Satkhira', 'Khulna'],
    },
    enabled: true,
  },
  // Rajshahi Division
  'sonalisangbad.com': {
    domain: 'sonalisangbad.com',
    name: 'Dainik Sonali Sangbad',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rajshahi'],
      districts: ['Rajshahi', 'Chapainawabganj', 'Natore', 'Naogaon'],
    },
    enabled: true,
  },
  'uttarbangaprotidin.com': {
    domain: 'uttarbangaprotidin.com',
    name: 'Uttarbanga Protidin',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rajshahi', 'Rangpur'],
      districts: ['Bogura', 'Joypurhat', 'Naogaon', 'Gaibandha'],
    },
    enabled: true,
  },
  'padmanews24.com': {
    domain: 'padmanews24.com',
    name: 'Padma News 24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rajshahi'],
      districts: ['Rajshahi', 'Pabna', 'Sirajganj'],
    },
    enabled: true,
  },
  'dailykaratoa.com': {
    domain: 'dailykaratoa.com',
    name: 'Dainik Karatoa',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rajshahi'],
      districts: ['Bogura', 'Sirajganj', 'Joypurhat'],
    },
    enabled: true,
  },
  // Rangpur Division
  'uttarbangasangbad.com': {
    domain: 'uttarbangasangbad.com',
    name: 'Uttarbanga Sangbad',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rangpur'],
      districts: ['Rangpur', 'Dinajpur', 'Gaibandha', 'Nilphamari', 'Lalmonirhat', 'Kurigram', 'Panchagarh', 'Thakurgaon'],
    },
    enabled: true,
  },
  'dainikdabanal.com': {
    domain: 'dainikdabanal.com',
    name: 'Dainik Dabanal',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rangpur'],
      districts: ['Rangpur', 'Nilphamari', 'Lalmonirhat'],
    },
    enabled: true,
  },
  // Barishal Division
  'barisaltoday.com': {
    domain: 'barisaltoday.com',
    name: 'Barisal Today',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Barishal'],
      districts: ['Barishal', 'Jhalokati', 'Pirojpur'],
    },
    enabled: true,
  },
  'shahnama.com': {
    domain: 'shahnama.com',
    name: 'Dainik Shahnama',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Barishal'],
      districts: ['Barishal', 'Bhola', 'Patuakhali', 'Barguna'],
    },
    enabled: true,
  },
  'amaderbarisal.com': {
    domain: 'amaderbarisal.com',
    name: 'Amader Barisal',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Barishal'],
      districts: ['Barishal', 'Patuakhali', 'Barguna'],
    },
    enabled: true,
  },
  // Sylhet Division
  'sylhetview24.net': {
    domain: 'sylhetview24.net',
    name: 'Sylhet View 24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://sylhetview24.net/feed/',
    geographicCoverage: {
      divisions: ['Sylhet'],
      districts: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
    },
    enabled: true,
  },
  'dainiksylhet.com': {
    domain: 'dainiksylhet.com',
    name: 'Dainik Sylhet',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Sylhet'],
      districts: ['Sylhet', 'Sunamganj'],
    },
    enabled: true,
  },
  'dailyjalalabad.com': {
    domain: 'dailyjalalabad.com',
    name: 'Daily Jalalabad',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Sylhet'],
      districts: ['Sylhet', 'Moulvibazar', 'Habiganj'],
    },
    enabled: true,
  },
  // Mymensingh Division
  'swadeshsangbad.com': {
    domain: 'swadeshsangbad.com',
    name: 'Dainik Swadesh Sangbad',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Mymensingh'],
      districts: ['Mymensingh', 'Jamalpur', 'Sherpur', 'Netrokona'],
    },
    enabled: true,
  },
  'mymensinghpratidin.com': {
    domain: 'mymensinghpratidin.com',
    name: 'Mymensingh Pratidin',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Mymensingh'],
      districts: ['Mymensingh', 'Netrokona'],
    },
    enabled: true,
  },
  // Major Online Portals & TV Newsrooms (Tier 2)
  'jagonews24.com': {
    domain: 'jagonews24.com',
    name: 'Jagonews24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'ONLINE_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.jagonews24.com/rss/rss.xml',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'banglatribune.com': {
    domain: 'banglatribune.com',
    name: 'Bangla Tribune',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'ONLINE_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.banglatribune.com/feed/',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'banglanews24.com': {
    domain: 'banglanews24.com',
    name: 'Banglanews24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'ONLINE_PORTAL',
    language: 'both',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'risingbd.com': {
    domain: 'risingbd.com',
    name: 'RisingBD',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'ONLINE_PORTAL',
    language: 'both',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'dhakapost.com': {
    domain: 'dhakapost.com',
    name: 'Dhaka Post',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'ONLINE_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'somoynews.tv': {
    domain: 'somoynews.tv',
    name: 'Somoy News TV',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'TV_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['RSS', 'GOOGLE_NEWS_PUBLISHER'],
    feedUrl: 'https://www.somoynews.tv/rss.xml',
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'jamuna.tv': {
    domain: 'jamuna.tv',
    name: 'Jamuna TV',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'TV_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'channel24bd.tv': {
    domain: 'channel24bd.tv',
    name: 'Channel 24',
    tier: 2,
    qualityWeight: 0.85,
    sourceType: 'TV_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },

  // ==========================================================================
  // TIER 3: DISTRICT AND LOCALIZED NEWSROOMS (Quality Weight: 0.65)
  // ==========================================================================
  'dhakamail.com': {
    domain: 'dhakamail.com',
    name: 'Dhaka Mail',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'ONLINE_PORTAL',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Dhaka'],
      districts: ['Dhaka', 'Gazipur', 'Narayanganj'],
    },
    enabled: true,
  },
  'narayanganjpost.com': {
    domain: 'narayanganjpost.com',
    name: 'Narayanganj Post',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Dhaka'],
      districts: ['Narayanganj', 'Munshiganj'],
    },
    enabled: true,
  },
  'gazipurbarta.com': {
    domain: 'gazipurbarta.com',
    name: 'Gazipur Barta',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Dhaka'],
      districts: ['Gazipur', 'Narsingdi'],
    },
    enabled: true,
  },
  'surmatimes.com': {
    domain: 'surmatimes.com',
    name: 'Surma Times',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Sylhet'],
      districts: ['Sylhet', 'Sunamganj', 'Moulvibazar', 'Habiganj'],
    },
    enabled: true,
  },
  'kurigrambarta.com': {
    domain: 'kurigrambarta.com',
    name: 'Kurigram Barta',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Rangpur'],
      districts: ['Kurigram', 'Lalmonirhat'],
    },
    enabled: true,
  },
  'netrokonanews24.com': {
    domain: 'netrokonanews24.com',
    name: 'Netrokona News 24',
    tier: 3,
    qualityWeight: 0.65,
    sourceType: 'REGIONAL_PRESS',
    language: 'bn',
    isWireAgency: false,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: {
      divisions: ['Mymensingh'],
      districts: ['Netrokona'],
    },
    enabled: true,
  },

  // ==========================================================================
  // TIER 4: NATIONAL WIRE AGENCIES (Quality Weight: 0.50)
  // ==========================================================================
  'bssnews.net': {
    domain: 'bssnews.net',
    name: 'Bangladesh Sangbad Sangstha (BSS)',
    tier: 4,
    qualityWeight: 0.50,
    sourceType: 'WIRE',
    language: 'both',
    isWireAgency: true,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'unb.com.bd': {
    domain: 'unb.com.bd',
    name: 'United News of Bangladesh (UNB)',
    tier: 4,
    qualityWeight: 0.50,
    sourceType: 'WIRE',
    language: 'both',
    isWireAgency: true,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'reuters.com': {
    domain: 'reuters.com',
    name: 'Reuters',
    tier: 4,
    qualityWeight: 0.50,
    sourceType: 'WIRE',
    language: 'both',
    isWireAgency: true,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'apnews.com': {
    domain: 'apnews.com',
    name: 'Associated Press (AP)',
    tier: 4,
    qualityWeight: 0.50,
    sourceType: 'WIRE',
    language: 'both',
    isWireAgency: true,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
  'afp.com': {
    domain: 'afp.com',
    name: 'Agence France-Presse (AFP)',
    tier: 4,
    qualityWeight: 0.50,
    sourceType: 'WIRE',
    language: 'both',
    isWireAgency: true,
    discoveryMethods: ['GOOGLE_NEWS_PUBLISHER'],
    geographicCoverage: { divisions: ['ALL'], districts: ['ALL_64'] },
    enabled: true,
  },
};

export type WireAgency = 'BSS' | 'UNB' | 'REUTERS' | 'AP' | 'AFP';

export interface WireSyndicationResult {
  isWire: boolean;
  agency?: WireAgency;
}

const WIRE_PATTERNS: Array<{ agency: WireAgency; patterns: RegExp[]; domains: string[] }> = [
  {
    agency: 'BSS',
    domains: ['bssnews.net'],
    patterns: [
      /\b(?:bss|bangladesh\s+sangbad\s+sangstha)\b/i,
      /(?:বাসস|বাংলাদেশ\s+সংবাদ\s+সংস্থা)/u,
      /\(বাসস\)/u,
      /—\s*বাসস/u,
      /বাসস\s*:/u,
    ],
  },
  {
    agency: 'UNB',
    domains: ['unb.com.bd'],
    patterns: [
      /\b(?:unb|united\s+news\s+of\s+bangladesh)\b/i,
      /(?:ইউএনবি|ইউনাইটেড\s+নিউজ\s+অব\s+বাংলাদেশ)/u,
      /\(ইউএনবি\)/u,
      /—\s*ইউএনবি/u,
      /ইউএনবি\s*:/u,
    ],
  },
  {
    agency: 'REUTERS',
    domains: ['reuters.com'],
    patterns: [
      /\breuters\b/i,
      /(?:রয়টার্স|রয়টার্স)/u,
      /\(রয়টার্স\)/u,
      /\(রয়টার্স\)/u,
      /—\s*(?:রয়টার্স|রয়টার্স)/u,
    ],
  },
  {
    agency: 'AP',
    domains: ['apnews.com'],
    patterns: [
      /\b(?:associated\s+press|a\.p\.)\b/i,
      /(?:^|[\s(\[—–])AP(?:[\s)\]:—–,.]|$)/,
      /(?:এপি|অ্যাসোসিয়েটেড\s+প্রেস)/u,
      /\(এপি\)/u,
    ],
  },
  {
    agency: 'AFP',
    domains: ['afp.com'],
    patterns: [
      /\b(?:afp|agence\s+france[-\s]?presse)\b/i,
      /(?:^|[\s(\[—–])AFP(?:[\s)\]:—–,.]|$)/,
      /(?:এএফপি|এজেন্স\s+ফ্রান্স[-\s]?প্রেস)/u,
      /\(এএফপি\)/u,
    ],
  },
];

/**
 * Resolves publisher entry from a URL hostname or outlet name
 */
export function getPublisherMetadata(urlOrDomain: string): PublisherEntry | null {
  if (!urlOrDomain) return null;

  try {
    let hostname = urlOrDomain.toLowerCase().trim();
    if (hostname.includes('://')) {
      const parsed = new URL(hostname);
      hostname = parsed.hostname;
    }
    hostname = hostname.replace(/^www\./, '');

    // Check exact domain match
    if (PUBLISHER_REGISTRY[hostname]) {
      return PUBLISHER_REGISTRY[hostname];
    }

    // Check subdomain match (e.g. en.prothomalo.com -> prothomalo.com)
    for (const [domain, entry] of Object.entries(PUBLISHER_REGISTRY)) {
      if (hostname.endsWith(`.${domain}`) || hostname === domain) {
        return entry;
      }
    }

    // Check name match
    for (const entry of Object.values(PUBLISHER_REGISTRY)) {
      if (entry.name.toLowerCase() === urlOrDomain.toLowerCase().trim()) {
        return entry;
      }
    }
  } catch {
    // Fallback on name match
    for (const entry of Object.values(PUBLISHER_REGISTRY)) {
      if (entry.name.toLowerCase() === urlOrDomain.toLowerCase().trim()) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Detects if a story originates from a wire agency (BSS, UNB, Reuters, AP, AFP) based on URL, source name, or title/body dispatches
 */
export function isWireSyndicatedStory(
  sourceUrl?: string,
  sourceName?: string,
  content?: string,
  title?: string
): WireSyndicationResult {
  const normUrl = (sourceUrl || '').toLowerCase();
  const normName = (sourceName || '').toLowerCase();
  const combinedText = `${title || ''} ${content || ''}`.normalize('NFC');

  for (const wire of WIRE_PATTERNS) {
    if (wire.domains.some((d) => normUrl.includes(d))) {
      return { isWire: true, agency: wire.agency };
    }
    if (wire.patterns.some((p) => p.test(normName))) {
      return { isWire: true, agency: wire.agency };
    }
    if (wire.patterns.some((p) => p.test(combinedText))) {
      return { isWire: true, agency: wire.agency };
    }
  }

  return { isWire: false };
}

export function calculateIndependentSourceCount(citations: any[]): number {
  if (!Array.isArray(citations) || citations.length === 0) return 0;
  const distinctSources = new Set<string>();

  for (const c of citations) {
    if (c.isWire && c.wireAgency) {
      distinctSources.add(`wire:${c.wireAgency}`);
    } else if (c.isWire) {
      distinctSources.add('wire:generic');
    } else {
      const domain = resolvePublisherDomain(c.sourceUrl, c.sourceName);
      distinctSources.add(`pub:${domain !== 'unknown' ? domain : c.sourceName}`);
    }
  }

  return distinctSources.size;
}

export interface DirectFeedDefinition {
  name: string;
  url: string;
  domain: string;
  requiresXmlSanitization?: boolean;
}

export const DIRECT_PUBLISHER_FEEDS: DirectFeedDefinition[] = [
  {
    name: 'Dhaka Tribune',
    url: 'https://www.dhakatribune.com/feed/',
    domain: 'dhakatribune.com',
  },
  {
    name: 'Dainik Azadi',
    url: 'https://dainikazadi.net/feed/',
    domain: 'dainikazadi.net',
  },
  {
    name: 'Jagonews24',
    url: 'https://www.jagonews24.com/rss/rss.xml',
    domain: 'jagonews24.com',
  },
  {
    name: 'Prothom Alo Bengali',
    url: 'https://www.prothomalo.com/feed',
    domain: 'prothomalo.com',
  },
  {
    name: 'Prothom Alo English',
    url: 'https://en.prothomalo.com/feed',
    domain: 'en.prothomalo.com',
  },
  {
    name: 'The Daily Star',
    url: 'https://www.thedailystar.net/frontpage/rss.xml',
    domain: 'thedailystar.net',
    requiresXmlSanitization: true,
  },
  {
    name: 'The Business Standard',
    url: 'https://www.tbsnews.net/rss.xml',
    domain: 'tbsnews.net',
  },
  {
    name: 'Bangla Tribune',
    url: 'https://www.banglatribune.com/feed/',
    domain: 'banglatribune.com',
  },
  {
    name: 'Sylhet View 24',
    url: 'https://sylhetview24.net/feed/',
    domain: 'sylhetview24.net',
  },
  {
    name: 'Somoy News TV',
    url: 'https://www.somoynews.tv/rss.xml',
    domain: 'somoynews.tv',
  },
];

export function resolvePublisherDomain(sourceUrl?: string, sourceName?: string): string {
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host) return host;
    } catch {
      // Ignore
    }
  }
  if (sourceName) {
    const meta = getPublisherMetadata(sourceName);
    if (meta) return meta.domain;
    return sourceName.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  return 'unknown';
}

/**
 * Returns publishers associated with a specific district or division.
 */
export function getPublishersForDistrict(districtName: string): PublisherEntry[] {
  const normDist = districtName.toLowerCase().trim();
  return Object.values(PUBLISHER_REGISTRY).filter((p) => {
    if (p.geographicCoverage.districts.includes('ALL_64')) return true;
    return p.geographicCoverage.districts.some((d) => d.toLowerCase() === normDist);
  });
}
