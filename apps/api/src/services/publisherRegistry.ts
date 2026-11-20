export type PublisherQualityTier = 1 | 2 | 3 | 4;

export interface PublisherEntry {
  domain: string;
  name: string;
  tier: PublisherQualityTier;
  qualityWeight: number; // 1.0 (Tier 1), 0.85 (Tier 2), 0.65 (Tier 3), 0.50 (Tier 4)
  isWireAgency: boolean; // true for BSS, UNB
  feedUrl?: string;
  requiresXmlSanitization?: boolean;
}

export const PUBLISHER_REGISTRY: Record<string, PublisherEntry> = {
  // Tier 1: National Major Dailies (Quality Weight: 1.0)
  'dhakatribune.com': {
    domain: 'dhakatribune.com',
    name: 'Dhaka Tribune',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
    feedUrl: 'https://www.dhakatribune.com/feed/',
  },
  'prothomalo.com': {
    domain: 'prothomalo.com',
    name: 'Prothom Alo',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
    feedUrl: 'https://www.prothomalo.com/feed',
  },
  'en.prothomalo.com': {
    domain: 'en.prothomalo.com',
    name: 'Prothom Alo English',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
    feedUrl: 'https://en.prothomalo.com/feed',
  },
  'thedailystar.net': {
    domain: 'thedailystar.net',
    name: 'The Daily Star',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
    feedUrl: 'https://www.thedailystar.net/frontpage/rss.xml',
    requiresXmlSanitization: true,
  },
  'bdnews24.com': {
    domain: 'bdnews24.com',
    name: 'BDNews24',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
  },
  'samakal.com': {
    domain: 'samakal.com',
    name: 'Samakal',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
  },
  'kalerkantho.com': {
    domain: 'kalerkantho.com',
    name: 'Kaler Kantho',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
  },
  'jugantor.com': {
    domain: 'jugantor.com',
    name: 'Jugantor',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
  },
  'ittefaq.com.bd': {
    domain: 'ittefaq.com.bd',
    name: 'Daily Ittefaq',
    tier: 1,
    qualityWeight: 1.0,
    isWireAgency: false,
  },

  // Tier 2: Established Regional Publishers (Quality Weight: 0.85)
  'dainikazadi.net': {
    domain: 'dainikazadi.net',
    name: 'Dainik Azadi',
    tier: 2,
    qualityWeight: 0.85,
    isWireAgency: false,
    feedUrl: 'https://dainikazadi.net/feed/',
  },
  'cvoice24.com': {
    domain: 'cvoice24.com',
    name: 'CVoice24',
    tier: 2,
    qualityWeight: 0.85,
    isWireAgency: false,
  },
  'sylhetview24.net': {
    domain: 'sylhetview24.net',
    name: 'Sylhet View 24',
    tier: 2,
    qualityWeight: 0.85,
    isWireAgency: false,
  },
  'khulnagazette.com': {
    domain: 'khulnagazette.com',
    name: 'Khulna Gazette',
    tier: 2,
    qualityWeight: 0.85,
    isWireAgency: false,
  },

  // Tier 3: Local Portals, Digital Newsrooms & TV Portals (Quality Weight: 0.65)
  'jagonews24.com': {
    domain: 'jagonews24.com',
    name: 'Jagonews24',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
    feedUrl: 'https://www.jagonews24.com/rss/rss.xml',
  },
  'dhakapost.com': {
    domain: 'dhakapost.com',
    name: 'Dhaka Post',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
  },
  'banglatribune.com': {
    domain: 'banglatribune.com',
    name: 'Bangla Tribune',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
  },
  'banglanews24.com': {
    domain: 'banglanews24.com',
    name: 'Banglanews24',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
  },
  'somoynews.tv': {
    domain: 'somoynews.tv',
    name: 'Somoy News TV',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
  },
  'jamuna.tv': {
    domain: 'jamuna.tv',
    name: 'Jamuna TV',
    tier: 3,
    qualityWeight: 0.65,
    isWireAgency: false,
  },

  // Tier 4: National Wire Agencies (Quality Weight: 0.50)
  'bssnews.net': {
    domain: 'bssnews.net',
    name: 'Bangladesh Sangbad Sangstha (BSS)',
    tier: 4,
    qualityWeight: 0.50,
    isWireAgency: true,
  },
  'unb.com.bd': {
    domain: 'unb.com.bd',
    name: 'United News of Bangladesh (UNB)',
    tier: 4,
    qualityWeight: 0.50,
    isWireAgency: true,
  },
};

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
 * Detects if a story originates from a wire agency (BSS, UNB) based on URL, source name, or title/body dispatches
 */
export function isWireSyndicatedStory(
  sourceUrl?: string,
  sourceName?: string,
  content?: string
): { isWire: boolean; agency?: 'BSS' | 'UNB' } {
  const normUrl = (sourceUrl || '').toLowerCase();
  const normName = (sourceName || '').toLowerCase();
  const normContent = (content || '').toLowerCase();

  if (normUrl.includes('bssnews.net') || normName.includes('bss') || normName.includes('বাসস')) {
    return { isWire: true, agency: 'BSS' };
  }
  if (normUrl.includes('unb.com.bd') || normName.includes('unb') || normName.includes('ইউএনবি')) {
    return { isWire: true, agency: 'UNB' };
  }

  // Check content wire dispatches (e.g. "(BSS) -", "— বাসস", "UNB -")
  if (/\b(?:bss|বাসস)\b/i.test(normContent)) {
    return { isWire: true, agency: 'BSS' };
  }
  if (/\b(?:unb|ইউএনবি)\b/i.test(normContent)) {
    return { isWire: true, agency: 'UNB' };
  }

  return { isWire: false };
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
