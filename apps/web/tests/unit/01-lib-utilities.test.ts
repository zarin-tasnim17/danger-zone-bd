import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from '@/lib/api';
import { validateEvidenceFile } from '@/lib/mediaUpload';
import { calculateDistanceMeters, evaluateHardwareGpsProximity } from '@/lib/gpsVerification';
import { isIncidentCategoryMatch } from '@/lib/filterUtils';
import { cleanIncidentTitle, formatCategoryLabel } from '@/lib/incidentUtils';
import { getSafeZonePresentation, normalizeSafeZoneType } from '@/lib/safeZoneMeta';
import { installBrowserGlobals } from '../framework/domEnv';
import {
  MAX_GPS_PROXIMITY_METERS,
  MAX_HARDWARE_GPS_ACCURACY_METERS,
  normalizeBangladeshPhone,
} from '@repo/shared';

describe('[Unit][Mocked] Frontend API & Domain Utilities', () => {
  it('resolveApiUrl resolves browser same-origin /api/v1 proxy paths without duplicating prefixes', () => {
    const sandbox = installBrowserGlobals();
    try {
      assert.equal(resolveApiUrl('/reports'), '/api/v1/reports');
      assert.equal(resolveApiUrl('users/me'), '/api/v1/users/me');
      assert.equal(resolveApiUrl('/api/v1/auth/device'), '/api/v1/auth/device');
      assert.equal(
        resolveApiUrl('https://example.com/api/v1/health'),
        'https://example.com/api/v1/health'
      );
    } finally {
      sandbox.restore();
    }
  });

  it('resolveApiUrl resolves SSR server paths from INTERNAL_API_URL cleanly', () => {
    const prevInternal = process.env.INTERNAL_API_URL;
    const prevPublic = process.env.NEXT_PUBLIC_API_URL;
    const hadWindow = 'window' in globalThis;
    const savedWindow = (globalThis as any).window;
    if (hadWindow) delete (globalThis as any).window;

    try {
      process.env.INTERNAL_API_URL = 'http://127.0.0.1:5055';
      assert.equal(resolveApiUrl('/reports'), 'http://127.0.0.1:5055/api/v1/reports');
      assert.equal(resolveApiUrl('/api/v1/stats'), 'http://127.0.0.1:5055/api/v1/stats');

      process.env.INTERNAL_API_URL = 'http://127.0.0.1:5055/api/v1';
      assert.equal(resolveApiUrl('/reports'), 'http://127.0.0.1:5055/api/v1/reports');
      assert.equal(resolveApiUrl('/api/v1/reports'), 'http://127.0.0.1:5055/api/v1/reports');
    } finally {
      if (hadWindow) (globalThis as any).window = savedWindow;
      if (prevInternal === undefined) delete process.env.INTERNAL_API_URL;
      else process.env.INTERNAL_API_URL = prevInternal;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = prevPublic;
    }
  });

  it('evaluateHardwareGpsProximity classifies HARDWARE_VERIFIED, OUT_OF_RANGE, LOW_ACCURACY, and UNAVAILABLE accurately', () => {
    assert.equal(evaluateHardwareGpsProximity(null, 23.7465, 90.376).status, 'UNAVAILABLE');

    const exact = evaluateHardwareGpsProximity(
      { lat: 23.7465, lng: 90.376, accuracy: 25 },
      23.7465,
      90.376
    );
    assert.equal(exact.status, 'HARDWARE_VERIFIED');
    assert.equal(exact.isVerified, true);
    assert.equal(exact.isEligibleHardwareGps, true);

    const lowAcc = evaluateHardwareGpsProximity(
      { lat: 23.7465, lng: 90.376, accuracy: MAX_HARDWARE_GPS_ACCURACY_METERS + 50 },
      23.7465,
      90.376
    );
    assert.equal(lowAcc.status, 'LOW_ACCURACY');
    assert.equal(lowAcc.isVerified, false);

    // ~1.1km north of Dhanmondi
    const farDist = calculateDistanceMeters(23.7465, 90.376, 23.7565, 90.376);
    assert.ok(farDist > MAX_GPS_PROXIMITY_METERS);
    const far = evaluateHardwareGpsProximity(
      { lat: 23.7565, lng: 90.376, accuracy: 15 },
      23.7465,
      90.376
    );
    assert.equal(far.status, 'OUT_OF_RANGE');
    assert.equal(far.isVerified, false);
  });

  it('validateEvidenceFile enforces allowed MIME types, non-empty size, and 5MB cap', () => {
    const valid = new File([new Uint8Array(1024)], 'photo.webp', { type: 'image/webp' });
    assert.deepEqual(validateEvidenceFile(valid), { valid: true });

    const badMime = new File([new Uint8Array(512)], 'doc.pdf', { type: 'application/pdf' });
    const badMimeRes = validateEvidenceFile(badMime);
    assert.equal(badMimeRes.valid, false);
    if (!badMimeRes.valid) assert.equal(badMimeRes.code, 'UNSUPPORTED_TYPE');

    const empty = new File([], 'empty.png', { type: 'image/png' });
    const emptyRes = validateEvidenceFile(empty);
    assert.equal(emptyRes.valid, false);
    if (!emptyRes.valid) assert.equal(emptyRes.code, 'EMPTY_FILE');

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' });
    const bigRes = validateEvidenceFile(big);
    assert.equal(bigRes.valid, false);
    if (!bigRes.valid) assert.equal(bigRes.code, 'FILE_TOO_LARGE');
  });

  it('filterUtils, incidentUtils, safeZoneMeta, and @repo/shared phone normalization handle edge cases', () => {
    assert.equal(isIncidentCategoryMatch('THEFT_ROBBERY', ['ROBBERY']), true);
    assert.equal(isIncidentCategoryMatch('MUGGING', ['SNATCHING']), true);
    assert.equal(isIncidentCategoryMatch('FIRE_HAZARD', ['ROBBERY']), false);

    assert.equal(
      cleanIncidentTitle('[Google News BD] Armed mugging - dhakapost.com'),
      'Armed mugging'
    );
    assert.equal(formatCategoryLabel('ARMED_ASSAULT', 'en').includes('_'), false);
    assert.equal(formatCategoryLabel('CUSTOM_RAW_ENUM', 'en'), 'CUSTOM RAW ENUM');

    assert.equal(normalizeSafeZoneType('POLICE_STATION'), 'POLICE_BOX');
    assert.equal(getSafeZonePresentation('PHARMACY', 'en').iconKey, 'pharmacy');

    assert.equal(normalizeBangladeshPhone('8801711223344'), '+8801711223344');
    assert.equal(normalizeBangladeshPhone('01812345678'), '+8801812345678');
  });
});
