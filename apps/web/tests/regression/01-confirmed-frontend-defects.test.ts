import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { apiFetch, ApiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import {
  installFetchMock,
  jsonResponse,
  delay,
  type FetchMockController,
} from '../framework/fetchMock';
import { buildAuthUser } from '../fixtures/mockData';
import { WEB_TEST_CONFIG } from '../framework/config';

/**
 * Deterministic Regression Reproduction Suite (FRONTEND-001 through FRONTEND-011).
 * Each test asserts the EXPECTED FIXED BEHAVIOR against the current application code.
 * While application code remains unfixed, every test here deterministically fails,
 * proving the exact defect without touching production code.
 */
describe('[Regression][Unfixed Frontend Defects] Deterministic Reproduction Suite', () => {
  let sandbox: BrowserSandboxHandle;
  let fetchMock: FetchMockController;

  beforeEach(() => {
    sandbox = installBrowserGlobals();
    fetchMock = installFetchMock();
    useAuthStore.setState({ user: null, deviceId: null, isLoading: false, error: null });
  });

  afterEach(() => {
    getSocket()?.disconnect();
    fetchMock.restore();
    sandbox.restore();
  });

  it('[FRONTEND-001] concurrent 401 responses MUST coalesce behind a single-flight /auth/refresh promise instead of firing duplicate rotations', async () => {
    let callA = 0;
    let callB = 0;
    fetchMock.on('/api/v1/users/me', () => {
      callA++;
      return callA === 1
        ? jsonResponse({ success: false, error: 'Expired' }, 401)
        : jsonResponse({ success: true, data: { id: 'u1' } }, 200);
    });
    fetchMock.on('/api/v1/stats', () => {
      callB++;
      return callB === 1
        ? jsonResponse({ success: false, error: 'Expired' }, 401)
        : jsonResponse({ success: true, data: { activeReports: 1 } }, 200);
    });
    fetchMock.on(
      '/api/v1/auth/refresh',
      async () => {
        await delay(15);
        return jsonResponse({ success: true, data: { socketToken: 'tok-once' } }, 200);
      },
      { method: 'POST' }
    );

    await Promise.all([apiFetch('/users/me'), apiFetch('/stats')]);
    assert.equal(
      fetchMock.getCallsFor('/api/v1/auth/refresh').length,
      1,
      'Expected exactly 1 single-flight POST /api/v1/auth/refresh call under concurrent 401s'
    );
  });

  it('[FRONTEND-002] failed POST /auth/login (401 Invalid credentials) MUST NOT trigger silent /auth/refresh', async () => {
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: false, error: 'Invalid credentials' }, 401)
    );
    fetchMock.on('/api/v1/auth/refresh', () =>
      jsonResponse({ success: true, data: { socketToken: 'stale-device' } }, 200)
    );

    await assert.rejects(
      () =>
        apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'bad@example.com', password: 'wrong' }),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 401
    );

    assert.equal(
      fetchMock.getCallsFor('/api/v1/auth/refresh').length,
      0,
      'Bad password login must skip silent /auth/refresh completely'
    );
  });

  it('[FRONTEND-003] loginAdminWithPassword rejecting non-ADMIN role MUST call POST /auth/logout so browser cookies do not stay polluted', async () => {
    const citizen = buildAuthUser({ id: 'cit-1', role: 'USER', email: 'cit@example.com' });
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: true, data: { user: citizen, socketToken: 'tok' } }, 200)
    );
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: citizen }, 200));
    fetchMock.on('/api/v1/auth/logout', () => jsonResponse({ success: true, data: { ok: true } }, 200));

    await assert.rejects(
      () => useAuthStore.getState().loginAdminWithPassword('cit@example.com', 'password123'),
      /administrator privileges/
    );

    assert.equal(
      fetchMock.getCallsFor('/api/v1/auth/logout', 'POST').length,
      1,
      'Must revoke cookies via POST /api/v1/auth/logout when refusing non-admin session'
    );
  });

  it('[FRONTEND-004] initAuth MUST check existing /users/me session before unconditionally overwriting cookies with POST /auth/device', async () => {
    const existingAdmin = buildAuthUser({ id: 'admin-keep', role: 'ADMIN', isVerified: true });
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: existingAdmin }, 200));
    fetchMock.on('/api/v1/auth/device', () =>
      jsonResponse({ success: true, data: { user: { id: 'anon-overwrite' }, socketToken: 'anon' } }, 201)
    );

    const res = await useAuthStore.getState().initAuth();
    assert.equal(res?.role, 'ADMIN');
    assert.equal(
      fetchMock.getCallsFor('/api/v1/auth/device').length,
      0,
      'Authenticated Admin session should not be overwritten by POST /auth/device on mount'
    );
  });

  it('[FRONTEND-005] alerts/page.tsx MUST await initAuth() before calling getSocket() so user:<id> room joins reliably', () => {
    const src = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/alerts/page.tsx'), 'utf8');
    const bootstrapCallIdx = src.indexOf('bootstrap();');
    const cleanupIdx = src.indexOf('socket.on("GEOFENCE_ALERT"', bootstrapCallIdx);
    const sliceAfterBootstrapCall =
      bootstrapCallIdx !== -1 && cleanupIdx !== -1 ? src.slice(bootstrapCallIdx, cleanupIdx) : '';
    assert.equal(
      sliceAfterBootstrapCall.includes('getSocket()'),
      false,
      'alerts/page.tsx must call getSocket() inside the awaited async flow after initAuth(), not synchronously after unawaited bootstrap()'
    );
  });

  it('[FRONTEND-006] alerts/page.tsx MUST NOT fabricate fake https://push.safetymap.bd Web Push subscriptions on PushManager failure', () => {
    const src = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/alerts/page.tsx'), 'utf8');
    assert.equal(
      src.includes('https://push.safetymap.bd/device/'),
      false,
      'Synthetic placeholder Web Push endpoint must be removed so browser failure is reported honestly'
    );
  });

  it('[FRONTEND-007] ReportIncidentModal MUST validate trimmed non-empty title/description and enforce <=1000 composed character limit', () => {
    const src = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'components/incidents/ReportIncidentModal.tsx'),
      'utf8'
    );
    assert.equal(
      src.includes('!title.trim()') && src.includes('!description.trim()'),
      true,
      'ReportIncidentModal must reject whitespace-only titles and descriptions before posting ": "'
    );
    assert.equal(
      src.includes('fullDescription.length > 1000'),
      true,
      'ReportIncidentModal must enforce <= 1000 composed character limit matching createReportSchema'
    );
  });

  it('[FRONTEND-008] safe-zones/page.tsx MUST validate finite lat/lng, Bangladesh bounds, >=2 char name without selectedZone useEffect refetch loop', () => {
    const src = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'app/safe-zones/page.tsx'),
      'utf8'
    );
    assert.equal(src.includes('trimmedName.length < 2'), true, 'Must enforce >= 2 char safe zone name');
    assert.equal(
      src.includes('!Number.isFinite(lat) || !Number.isFinite(lng)'),
      true,
      'safe-zones/page.tsx must reject NaN/Infinity coordinates before POST /api/v1/safe-zones'
    );
    assert.equal(
      src.includes('lat < 20.0 || lat > 27.5 || lng < 88.0 || lng > 93.5'),
      true,
      'safe-zones/page.tsx must validate Bangladesh coordinate bounds (20.0..27.5, 88.0..93.5)'
    );
    const fetchIdx = src.indexOf('const fetchSafeZones = useCallback');
    const effectIdx = src.indexOf('useEffect(() =>', fetchIdx);
    const fetchBlock = fetchIdx !== -1 && effectIdx !== -1 ? src.slice(fetchIdx, effectIdx) : '';
    assert.equal(fetchBlock.includes('setSelectedZone((prev) => prev ?? data[0])'), true);
    assert.equal(
      /\},\s*\[[^\]]*selectedZone[^\]]*\]\s*\)/.test(fetchBlock),
      false,
      'selectedZone must not appear in fetchSafeZones useCallback dependency array (avoids 3x mount refetch loop)'
    );
  });

  it('[FRONTEND-009] admin/page.tsx MUST surface API errors, validate >=3-char moderation reasons, and validate target UUID', () => {
    const src = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/admin/page.tsx'), 'utf8');
    assert.equal(src.includes('.trim().length < 3'), true);
    assert.equal(src.includes('UUID_PATTERN.test(trimmedUserId)'), true, 'Must validate user UUID before ban/unban');
    assert.equal(src.includes('fetchAdminData'), true);
    const fetchAdminIdx = src.indexOf('const fetchAdminData');
    const useEffectAfterFetchIdx = src.indexOf('useEffect', fetchAdminIdx);
    const fetchAdminSlice = src.slice(fetchAdminIdx, useEffectAfterFetchIdx);
    assert.equal(
      /catch\s*\([^)]*\)\s*\{[\s\S]*?setDataError[\s\S]*?showToast/.test(fetchAdminSlice),
      true,
      'fetchAdminData must surface API errors in both inline error banner and toast'
    );
  });

  it('[FRONTEND-010] apiFetch MUST enforce a default AbortController timeout and /report MUST cap quick prompts & preserve manual coordinate inputs', async () => {
    const apiSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'lib/api.ts'), 'utf8');
    assert.equal(apiSrc.includes('DEFAULT_API_TIMEOUT_MS'), true);
    assert.equal(apiSrc.includes('AbortController'), true);

    fetchMock.on('/api/v1/hung-upstream', ({ signal }) => {
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    await assert.rejects(
      () => apiFetch('/hung-upstream', { timeoutMs: 25 }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 0 &&
        err.data?.isNetworkError === true &&
        err.data?.isTimeout === true
    );

    const reportSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/report/page.tsx'), 'utf8');
    assert.equal(
      reportSrc.includes('next.slice(0, 500)'),
      true,
      '/report quick contextual prompts must clamp description at 500 characters'
    );
    assert.equal(
      reportSrc.includes('setLatInput(raw)') && reportSrc.includes('setLngInput(raw)'),
      true,
      '/report coordinate inputs must retain string draft without snapping empty input back to Dhaka Banani default'
    );
  });

  it('[FRONTEND-011] concurrent useAuthStore.initAuth() calls (e.g. StrictMode double-mount) MUST deduplicate behind a single-flight promise instead of firing parallel POST /auth/device requests', async () => {
    const user = buildAuthUser({ id: 'dedup-u1' });
    fetchMock.on('/api/v1/auth/device', async () => {
      await delay(15);
      return jsonResponse({ success: true, data: { user: { id: user.id }, socketToken: 'sock' } }, 201);
    });
    fetchMock.on('/api/v1/users/me', () =>
      fetchMock.getCallsFor('/api/v1/auth/device').length === 0
        ? jsonResponse({ success: false, error: 'Unauthorized' }, 401)
        : jsonResponse({ success: true, data: user }, 200)
    );

    await Promise.all([useAuthStore.getState().initAuth(), useAuthStore.getState().initAuth()]);
    assert.equal(
      fetchMock.getCallsFor('/api/v1/auth/device').length,
      1,
      'Concurrent initAuth() invocations must coalesce to a single POST /api/v1/auth/device request'
    );
  });
});
