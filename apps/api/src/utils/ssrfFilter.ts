import dns from 'dns';
import net from 'net';

/**
 * Checks if an IPv4 address belongs to private, loopback, link-local, or reserved subnets.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 treated as unsafe
  }

  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 (Broadcast/Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (RFC 6598 Carrier-Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (RFC 1122 Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (RFC 3927 Link-Local / Cloud Metadata: AWS, GCP, Azure, DigitalOcean)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (RFC 6890 IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24 (RFC 5737 TEST-NET-1)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (RFC 2544 Network Interconnect Benchmark)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (RFC 5737 TEST-NET-2)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;

  // 203.0.113.0/24 (RFC 5737 TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 (RFC 5771 Multicast: 224.0.0.0 - 239.255.255.255)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (RFC 1112 Reserved / Future Use: 240.0.0.0 - 255.255.255.254)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address belongs to private, loopback, link-local, or reserved ranges.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Loopback (::1) and Unspecified (::)
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:') || normalized.startsWith('0:0:0:0:0:ffff:')) {
    const ipv4Part = normalized.substring(normalized.lastIndexOf(':') + 1);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateOrReservedIPv4(ipv4Part);
    }
    return true;
  }

  // Unique Local Address fc00::/7 (fc00:: - fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-Local Unicast fe80::/10 (fe80:: - febf::)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // Multicast ff00::/8
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Checks if an IP string is private or reserved.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateOrReservedIPv4(ip);
  }
  if (version === 6) {
    return isPrivateOrReservedIPv6(ip);
  }
  return true; // Not a valid IP -> unsafe
}

/**
 * Blocked internal or metadata hostnames.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  'internal',
  'local',
  'intranet',
]);

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.internal')) return true;
  if (lower.endsWith('.lan')) return true;
  return false;
}

export interface UrlSafetyResult {
  isSafe: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validates external URL against SSRF, non-HTTP protocols, and internal network boundaries.
 * Resolves DNS to ensure no private/loopback/cloud-metadata IPs are targeted.
 */
export async function validateUrlForSafeFetch(rawUrl: string): Promise<UrlSafetyResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isSafe: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isSafe: false, reason: 'Malformed URL' };
  }

  // Restrict protocol strictly to HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isSafe: false, reason: `Disallowed URL protocol: ${parsed.protocol}. Only http: and https: are allowed.` };
  }

  // Disallow user credentials in URL
  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: 'URLs with embedded authentication credentials are not permitted' };
  }

  const rawHost = parsed.hostname.toLowerCase();
  const cleanHost = rawHost.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // Check known internal hostnames
  if (isBlockedHostname(cleanHost)) {
    return { isSafe: false, reason: `Access to internal hostname '${cleanHost}' is forbidden` };
  }

  // If host is an IP literal
  if (net.isIP(cleanHost)) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return { isSafe: false, reason: `IP literal '${cleanHost}' is in a private, loopback, or reserved range` };
    }
    return { isSafe: true, url: parsed };
  }

  // Resolve hostname via DNS
  try {
    const records = await dns.promises.lookup(cleanHost, { all: true });
    if (!records || records.length === 0) {
      return { isSafe: false, reason: `DNS lookup failed for hostname '${cleanHost}'` };
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          isSafe: false,
          reason: `Hostname '${cleanHost}' resolves to private/reserved IP address: ${record.address}`,
        };
      }
    }
  } catch (dnsErr: any) {
    return { isSafe: false, reason: `DNS lookup error for '${cleanHost}': ${dnsErr.message}` };
  }

  return { isSafe: true, url: parsed };
}

/**
 * XML Sanitization against XXE and Billion Laughs vulnerabilities.
 * Strips DOCTYPE declarations with entity definitions while preserving valid RSS/Atom content.
 */
export function sanitizeXmlPayload(xml: string): string {
  if (!xml || typeof xml !== 'string') return '';

  let sanitized = xml
    // Strip control characters except whitespace (\t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip DOCTYPE declarations that contain inline internal DTD subsets (XXE/Billion laughs)
  sanitized = sanitized.replace(/<!DOCTYPE[^>]*\[[\s\S]*?\]>/gi, '');

  // Strip standard external DOCTYPE declarations
  sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Strip standalone entity declarations
  sanitized = sanitized.replace(/<!ENTITY[^>]*>/gi, '');

  return sanitized.trim();
}

/**
 * Maximum permitted feed response size in bytes (5 MB).
 */
export const MAX_FEED_RESPONSE_BYTES = 5 * 1024 * 1024;
