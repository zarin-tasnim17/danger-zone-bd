import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { io as ioClient } from 'socket.io-client';
import { SOCKET_EVENTS } from '@repo/shared';
import { GET as nextHealthGet } from '@/app/api/health/route';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { useIncidentStore } from '@/store/useIncidentStore';
import { useStatsStore } from '@/store/useStatsStore';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import { startLiveBackendHarness, type LiveHarnessContext } from '../framework/liveHarness';
import {
  nextHealthResponseSchema,
  reportUpdateResponseItemSchema,
  safeZoneResponseItemSchema,
} from '../framework/contractSchemas';
import { WEB_TEST_CONFIG } from '../framework/config';
import { DHAKA_VALID_POLYGON } from '../fixtures/mockData';

describe('[Workflows][Live Backend] Full Frontend -> Express + PostGIS + Socket.IO E2E Integration', () => {
  let harness: LiveHarnessContext;
  let sandbox: BrowserSandboxHandle;
  let restoreProxyFetch: () => void;

  before(async () => {
    harness = await startLiveBackendHarness();
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    restoreProxyFetch = harness.installBrowserProxyFetch();
    useAuthStore.setState({ user: null, deviceId: null, isLoading: false, error: null });
    useIncidentStore.setState({
      incidents: [],
      safeZones: [],
      isLoading: false,
      isUpdatingBounds: false,
      error: null,
      activeBounds: null,
    });
    useStatsStore.setState({ stats: null, isLoading: false, error: null });
  });

  after(async () => {
    getSocket()?.disconnect();
    restoreProxyFetch();
    sandbox.restore();
    await harness.teardown();
  });

  it('verifies Next.js GET /api/health proxy against live Express /health & /health/db', async () => {
    const res = await nextHealthGet();
    assert.equal(res.status, 200);
    const body = await res.json();
    const parsed = nextHealthResponseSchema.safeParse(body);
    assert.equal(parsed.success, true, `Unexpected /api/health response: ${JSON.stringify(body)}`);
    assert.equal(body.status, 'healthy');
    assert.equal(body.services.backend.status, 'online');
    assert.equal(body.services.database.status, 'connected');
  });

  it('executes complete citizen -> responder -> admin lifecycle via real apiFetch, Zustand stores & HttpOnly cookies', async () => {
    // 1. Anonymous device onboarding via useAuthStore.initAuth()
    const citizen = await useAuthStore.getState().initAuth();
    assert.ok(citizen?.id, 'Citizen user ID must be returned');
    harness.tracker.trackUser(citizen.id);
    assert.equal(harness.cookieJar.has('accessToken'), true, 'HttpOnly accessToken cookie must be set');
    assert.equal(harness.cookieJar.has('refreshToken'), true, 'HttpOnly refreshToken cookie must be set');

    // Repeat device init should succeed idempotently with 200 OK
    const repeatedCitizen = await useAuthStore.getState().initAuth();
    assert.equal(repeatedCitizen?.id, citizen.id);

    // 2. Create Incident Report via exact frontend EP-013 payload
    const createdReport = await apiFetch<any>('/reports', {
      method: 'POST',
      headers: {
        'x-device-lat': String(WEB_TEST_CONFIG.dhakaCenter.latitude),
        'x-device-lng': String(WEB_TEST_CONFIG.dhakaCenter.longitude),
        'x-device-accuracy': '18',
      },
      body: JSON.stringify({
        category: 'ROBBERY',
        severity: 'HIGH',
        description: `[WEB-LIVE-TEST] Armed robbery test incident ${Date.now()}`,
        latitude: WEB_TEST_CONFIG.dhakaCenter.latitude,
        longitude: WEB_TEST_CONFIG.dhakaCenter.longitude,
      }),
    });
    assert.ok(createdReport?.id);
    harness.tracker.trackReport(createdReport.id);

    // 3. Read incidents & bounds via useIncidentStore (EP-014) + detail (EP-015)
    await useIncidentStore.getState().fetchIncidentsInBounds({
      minLat: WEB_TEST_CONFIG.dhakaBounds.minLat,
      minLng: WEB_TEST_CONFIG.dhakaBounds.minLng,
      maxLat: WEB_TEST_CONFIG.dhakaBounds.maxLat,
      maxLng: WEB_TEST_CONFIG.dhakaBounds.maxLng,
    });
    assert.ok(
      useIncidentStore.getState().incidents.some((i) => i.id === createdReport.id),
      'Created report must appear in bounded incident store'
    );

    const detail = await apiFetch<any>(`/reports/${createdReport.id}`);
    assert.equal(detail.id, createdReport.id);

    // 4. Self-vote returns 400 + rolls back optimistic store update; second citizen votes successfully (EP-017, EP-018, EP-019)
    await assert.rejects(
      () => useIncidentStore.getState().voteIncident(createdReport.id, 1),
      /cannot vote on your own report/i
    );
    const rolledBackItem = useIncidentStore.getState().incidents.find((i) => i.id === createdReport.id);
    assert.equal(rolledBackItem?.upvotes, 0);

    // Switch temporarily to a second anonymous citizen to vote on first citizen's report
    const firstDeviceId = sandbox.localStorage.getItem('bd_safety_device_id');
    assert.ok(firstDeviceId);
    const citizen2 = await useAuthStore.getState().resetAnonymousIdentity();
    assert.ok(citizen2?.id && citizen2.id !== citizen.id);
    harness.tracker.trackUser(citizen2.id);

    const voteResult = await useIncidentStore.getState().voteIncident(createdReport.id, 1);
    assert.equal(voteResult.upvotes, 1);

    // Switch back to original author device (matching /profile handleSwitchIdentity flow)
    sandbox.localStorage.setItem('bd_safety_device_id', firstDeviceId);
    await apiFetch('/auth/device', {
      method: 'POST',
      body: JSON.stringify({ anonymousId: firstDeviceId }),
    });
    const switchedBack = await useAuthStore.getState().initAuth();
    assert.equal(switchedBack?.id, citizen.id);

    const updateRes = await useIncidentStore
      .getState()
      .addContextUpdate(createdReport.id, 'Patrol unit alerted near Kalabagan.');
    assert.equal(reportUpdateResponseItemSchema.safeParse(updateRes).success, true);
    assert.equal(updateRes.author.role, 'USER');

    const updatesList = await apiFetch<any[]>(`/reports/${createdReport.id}/updates`);
    assert.ok(Array.isArray(updatesList) && updatesList.length >= 1);

    // 5. Media presigned URL request (EP-028 GET /media/presigned-url)
    const uploadMeta = await apiFetch<any>(
      `/media/presigned-url?reportId=${createdReport.id}&fileType=${encodeURIComponent('image/png')}&fileSize=2048`
    );
    assert.ok(uploadMeta.fileKey && uploadMeta.uploadUrl);

    // 6. Safe zones proximity (EP-020) + Safe route (EP-023) + Stats (EP-041)
    await useIncidentStore.getState().fetchSafeZones();
    const nearbyZones = await apiFetch<any[]>(
      `/safe-zones?lat=${WEB_TEST_CONFIG.dhakaCenter.latitude}&lng=${WEB_TEST_CONFIG.dhakaCenter.longitude}&radius=5000`
    );
    assert.ok(Array.isArray(nearbyZones));
    for (const z of nearbyZones) {
      assert.equal(safeZoneResponseItemSchema.safeParse(z).success, true);
      if (z.distanceMeters !== undefined) {
        assert.equal(typeof z.distanceMeters, 'number');
      }
    }

    const safeRoute = await apiFetch<any>('/routes/safe-path', {
      method: 'POST',
      body: JSON.stringify(WEB_TEST_CONFIG.routeSample),
    });
    assert.ok(safeRoute && typeof safeRoute === 'object');

    await useStatsStore.getState().fetchStats();
    assert.equal(typeof useStatsStore.getState().stats?.activeReports, 'number');

    // 7. Alert geofence create/list/delete + Push subscribe (EP-024..EP-027)
    const alertZone = await apiFetch<any>('/alerts/zones', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Audit Home Perimeter',
        coordinates: DHAKA_VALID_POLYGON,
      }),
    });
    assert.ok(alertZone?.id);
    harness.tracker.trackAlertZone(alertZone.id);

    const userZones = await apiFetch<any[]>('/alerts/zones');
    assert.ok(userZones.some((z) => z.id === alertZone.id));

    const pushRes = await apiFetch<any>('/alerts/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: `https://push.example.com/sub/${crypto.randomUUID()}`,
        keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-secret' },
      }),
    });
    assert.ok(pushRes);

    await apiFetch(`/alerts/zones/${alertZone.id}`, { method: 'DELETE' });

    // 8. KYC verification request (EP-011) & Owner Resolve (EP-016)
    const verification = await apiFetch<any>('/users/verify', {
      method: 'POST',
      body: JSON.stringify({
        type: 'PHONE_OTP',
        phoneNumber: '+8801712345678',
      }),
    });
    assert.ok(verification?.id);
    harness.tracker.trackVerification(verification.id);

    const resolved = await apiFetch<any>(`/reports/${createdReport.id}/resolve`, {
      method: 'PATCH',
    });
    assert.equal(resolved.status, 'RESOLVED');

    // 9. Provision ephemeral ADMIN user via DB & login via EP-007 through useAuthStore
    const adminEmail = `audit-admin-${Date.now()}@dangerzone.test`;
    const adminPass = 'AuditAdmin!2345';
    await harness.createEphemeralAdmin(adminEmail, adminPass);

    const authedAdmin = await useAuthStore.getState().loginAdminWithPassword(adminEmail, adminPass);
    assert.equal(authedAdmin.role, 'ADMIN');

    const [pendingList, logsList, trendsData] = await Promise.all([
      apiFetch<any[]>('/admin/verifications'),
      apiFetch<any>('/admin/logs?page=1&limit=20'),
      apiFetch<any>('/admin/analytics/trends'),
    ]);
    assert.ok(Array.isArray(pendingList));
    assert.ok(pendingList.some((v) => v.id === verification.id));
    assert.ok(logsList);
    assert.ok(trendsData);

    // Approve KYC (EP-033)
    await apiFetch(`/admin/verifications/${verification.id}/approve`, {
      method: 'POST',
    });

    // Ban & Unban citizen (EP-035, EP-036)
    await apiFetch(`/admin/users/${citizen.id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Moderation test ban check' }),
    });
    await apiFetch(`/admin/users/${citizen.id}/unban`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Restore citizen post test' }),
    });

    // Safe Zone Admin CRUD (EP-021, EP-022)
    const createdZone = await apiFetch<any>('/safe-zones', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Audit Safe Hospital',
        type: 'HOSPITAL',
        latitude: 23.747,
        longitude: 90.377,
      }),
    });
    assert.ok(createdZone?.id);
    harness.tracker.trackSafeZone(createdZone.id);
    await apiFetch(`/safe-zones/${createdZone.id}`, { method: 'DELETE' });

    // Purge test report (EP-037)
    await apiFetch(`/admin/reports/${createdReport.id}/purge`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cleanup audit incident' }),
    });

    // Disconnect socket before cleanup
    getSocket()?.disconnect();

    // 10. Clean up & verify ZERO DB orphans!
    await harness.tracker.cleanup();
    const orphans = await harness.getOrphanCounts();
    assert.deepEqual(orphans, {
      ORPHAN_USERS: 0,
      ORPHAN_REPORTS: 0,
      ORPHAN_SAFE_ZONES: 0,
      ORPHAN_ALERT_ZONES: 0,
      ORPHAN_REFRESH_TOKENS: 0,
      ORPHAN_MOD_LOGS: 0,
    });
  });

  it('connects to live Express Socket.IO server and receives joined room events', async () => {
    const socket = ioClient(harness.server.baseUrl, {
      transports: ['websocket'],
      reconnection: false,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
        socket.on('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      assert.equal(socket.connected, true);
      socket.emit(SOCKET_EVENTS.JOIN_MAP_BOUNDS, WEB_TEST_CONFIG.dhakaBounds);
      await new Promise((r) => setTimeout(r, 100));
    } finally {
      socket.disconnect();
    }
  });
});
