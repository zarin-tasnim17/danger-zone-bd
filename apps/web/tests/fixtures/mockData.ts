import type { AuthUser } from '@/store/useAuthStore';
import type { DangerIncident, SafeZoneItem } from '@repo/shared';

export const buildAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: '11111111-1111-4111-8111-111111111111',
  role: 'USER',
  trustScore: 100,
  isVerified: false,
  isBanned: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  _count: {
    reports: 0,
    votes: 0,
    alertZones: 0,
  },
  verifications: [],
  ...overrides,
});

export const buildIncident = (overrides: Partial<DangerIncident> = {}): DangerIncident => ({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Armed mugging reported near Dhanmondi 27 intersection.',
  description: 'Armed mugging reported near Dhanmondi 27 intersection.',
  category: 'ROBBERY',
  severity: 'HIGH',
  coordinates: {
    lat: 23.7465,
    lng: 90.376,
  },
  locationName: 'Dhanmondi 27',
  timestamp: '2026-11-12T10:00:00.000Z',
  upvotes: 2,
  downvotes: 0,
  status: 'community_confirmed',
  reportedBy: 'Citizen Report',
  verifiedCount: 2,
  fuzzedRadiusMeters: 150,
  isGpsVerified: false,
  ...overrides,
});

export const buildSafeZone = (overrides: Partial<SafeZoneItem> = {}): SafeZoneItem => ({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Dhanmondi Model Police Box',
  type: 'POLICE_BOX',
  latitude: 23.7461,
  longitude: 90.3742,
  createdAt: '2026-11-12T10:00:00.000Z',
  distanceMeters: 185.5,
  ...overrides,
});

export const createSignedPngFile = (name = 'evidence.png', sizeBytes = 2048): File => {
  const bytes = new Uint8Array(Math.max(sizeBytes, 16));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return new File([bytes], name, { type: 'image/png' });
};

export const createSpoofedExeAsJpgFile = (name = 'malware.jpg'): File => {
  const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  return new File([bytes], name, { type: 'image/jpeg' });
};

export const DHAKA_VALID_POLYGON: [number, number][] = [
  [90.37, 23.74],
  [90.38, 23.74],
  [90.38, 23.75],
  [90.37, 23.75],
  [90.37, 23.74],
];

export const DHAKA_OVERSIZED_POLYGON: [number, number][] = [
  [90.2, 23.65],
  [90.5, 23.65],
  [90.5, 23.95],
  [90.2, 23.95],
  [90.2, 23.65],
];
