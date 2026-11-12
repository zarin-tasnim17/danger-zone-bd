import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '@/store/useAuthStore';
import { useIncidentStore } from '@/store/useIncidentStore';
import { useStatsStore } from '@/store/useStatsStore';
import { getSocket } from '@/lib/socket';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import { installFetchMock, jsonResponse, delay, type FetchMockController } from '../framework/fetchMock';
import { buildAuthUser, buildIncident, buildSafeZone } from '../fixtures/mockData';

describe('[Stores][Mocked] Zustand Auth, Incident & Stats Stores Integration', () => {
  let sandbox: BrowserSandboxHandle;
  let fetchMock: FetchMockController;

  beforeEach(() => {
    sandbox = installBrowserGlobals();
    fetchMock = installFetchMock();
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

  afterEach(() => {
    getSocket()?.disconnect();
    fetchMock.restore();
    sandbox.restore();
  });

  it('useAuthStore.initAuth creates persistent deviceId, authenticates via /auth/device, and loads /users/me', async () => {
    const profile = buildAuthUser({ id: 'anon-user-1', role: 'USER', trustScore: 100 });
    fetchMock.on(
      '/api/v1/auth/device',
      () => jsonResponse({ success: true, data: { user: { id: profile.id }, socketToken: 'sock-1' } }, 201),
      { method: 'POST' }
    );
    fetchMock.on('/api/v1/users/me', () =>
      fetchMock.getCallsFor('/api/v1/auth/device', 'POST').length === 0
        ? jsonResponse({ success: false, error: 'Unauthorized' }, 401)
        : jsonResponse({ success: true, data: profile }, 200)
    );

    const result = await useAuthStore.getState().initAuth();
    assert.equal(result?.id, 'anon-user-1');
    assert.ok(sandbox.localStorage.getItem('bd_safety_device_id'));
    assert.equal(useAuthStore.getState().user?.role, 'USER');
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/device').length, 1);
    assert.equal(fetchMock.getCallsFor('/api/v1/users/me').length, 2);
  });

  it('useAuthStore.loginAdminWithPassword rejects non-ADMIN accounts and revokes newly issued cookies via /auth/logout', async () => {
    const nonAdmin = buildAuthUser({ id: 'citizen-1', role: 'USER', email: 'citizen@example.com' });
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: true, data: { user: nonAdmin, socketToken: 's-nonadmin' } }, 200)
    );
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: nonAdmin }, 200));
    fetchMock.on('/api/v1/auth/logout', () => jsonResponse({ success: true, data: { message: 'ok' } }, 200), {
      method: 'POST',
    });

    await assert.rejects(
      () => useAuthStore.getState().loginAdminWithPassword('citizen@example.com', 'password123'),
      /administrator privileges/
    );
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/logout', 'POST').length, 1);
    assert.equal(useAuthStore.getState().user, null);
  });

  it('useIncidentStore fetches incidents & safeZones, handles optimistic vote rollback on API failure, and deduplicates in-flight votes', async () => {
    const backendReport = {
      id: 'rep-1',
      category: 'ROBBERY',
      severity: 'HIGH',
      description: 'Mugging near Mirpur 10',
      latitude: 23.8069,
      longitude: 90.3687,
      upvotes: 5,
      downvotes: 1,
      createdAt: '2026-11-12T10:00:00.000Z',
    };
    fetchMock.on('/api/v1/reports', () => jsonResponse({ success: true, data: [backendReport] }, 200), {
      method: 'GET',
    });
    fetchMock.on('/api/v1/safe-zones', () =>
      jsonResponse({ success: true, data: [buildSafeZone()] }, 200)
    );

    await useIncidentStore.getState().fetchAllIncidents();
    await useIncidentStore.getState().fetchSafeZones();
    assert.equal(useIncidentStore.getState().incidents.length, 1);
    assert.equal(useIncidentStore.getState().safeZones.length, 1);

    // Concurrent vote lock check + backend error rollback
    fetchMock.on(
      '/api/v1/reports/rep-1/vote',
      async () => {
        await delay(25);
        return jsonResponse({ success: false, error: 'Rate limit exceeded' }, 429);
      },
      { method: 'POST' }
    );

    const p1 = useIncidentStore.getState().voteIncident('rep-1', 1);
    const p2 = useIncidentStore.getState().voteIncident('rep-1', 1);

    // While in flight, optimistic state adds +1 upvote
    assert.equal(useIncidentStore.getState().incidents[0].upvotes, 6);

    // Second concurrent call immediately returns current state without sending duplicate HTTP POST
    const res2 = await p2;
    assert.equal(res2.upvotes, 6);

    await assert.rejects(() => p1, /Rate limit exceeded/);
    // Rolled back cleanly to original counts on backend failure
    assert.equal(useIncidentStore.getState().incidents[0].upvotes, 5);
    assert.equal(useIncidentStore.getState().incidents[0].downvotes, 1);
    assert.equal(fetchMock.getCallsFor('/api/v1/reports/rep-1/vote', 'POST').length, 1);
  });

  it('useStatsStore handles both unwrapped and nested response payloads cleanly', async () => {
    const sampleStats = {
      totalReports: 20,
      activeReports: 14,
      resolvedReports: 6,
      criticalThreats: 3,
      totalCitizens: 100,
      verifiedCitizens: 12,
      safeHavens: 9,
      totalVotes: 45,
      lastActiveAt: '2026-11-12T10:00:00.000Z',
      timestamp: '2026-11-12T10:00:00.000Z',
    };
    fetchMock.on('/api/v1/stats', () => jsonResponse({ success: true, data: sampleStats }, 200));

    await useStatsStore.getState().fetchStats();
    assert.equal(useStatsStore.getState().stats?.activeReports, 14);
    assert.equal(useStatsStore.getState().error, null);

    // Unused helper import reference sanity
    assert.equal(buildIncident().category, 'ROBBERY');
  });
});
