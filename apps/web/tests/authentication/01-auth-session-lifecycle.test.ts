import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import { installFetchMock, jsonResponse, type FetchMockController } from '../framework/fetchMock';
import { buildAuthUser } from '../fixtures/mockData';

describe('[Auth][Mocked] Anonymous Device Lifecycle, Refresh & Admin Login Isolation', () => {
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

  it('reuses stored bd_safety_device_id across initAuth calls without generating duplicate anonymous identities', async () => {
    sandbox.localStorage.setItem('bd_safety_device_id', 'existing-device-uuid-001');
    const user = buildAuthUser({ id: 'u-existing', role: 'USER' });

    fetchMock.on('/api/v1/auth/device', ({ call }) => {
      assert.deepEqual(call.bodyJson, { anonymousId: 'existing-device-uuid-001' });
      return jsonResponse({ success: true, data: { user: { id: user.id }, socketToken: 'tok-repeat' } }, 200);
    });
    fetchMock.on('/api/v1/users/me', () =>
      fetchMock.getCallsFor('/api/v1/auth/device').length === 0
        ? jsonResponse({ success: false, error: 'Unauthorized' }, 401)
        : jsonResponse({ success: true, data: user }, 200)
    );

    const loaded = await useAuthStore.getState().initAuth();
    assert.equal(loaded?.id, 'u-existing');
    assert.equal(sandbox.localStorage.getItem('bd_safety_device_id'), 'existing-device-uuid-001');
  });

  it('admin password login succeeds only when role === ADMIN', async () => {
    const admin = buildAuthUser({ id: 'admin-1', role: 'ADMIN', email: 'admin@dangerzone.bd', isVerified: true });
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: true, data: { user: { id: admin.id, role: 'ADMIN' }, socketToken: 'sock-admin' } }, 200)
    );
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: admin }, 200));

    const authed = await useAuthStore.getState().loginAdminWithPassword('admin@dangerzone.bd', 'strong-pass');
    assert.equal(authed.role, 'ADMIN');
    assert.equal(useAuthStore.getState().user?.role, 'ADMIN');
  });

  it('logout posts to /auth/logout and clears session without minting a new anonymous identity', async () => {
    sandbox.localStorage.setItem('bd_safety_device_id', 'old-dev-id');
    useAuthStore.setState({
      user: buildAuthUser({ id: 'old-user', role: 'USER' }),
      deviceId: 'old-dev-id',
      isLoading: false,
      error: null,
    });

    fetchMock.on('/api/v1/auth/logout', () => jsonResponse({ success: true, data: { loggedOut: true } }, 200), {
      method: 'POST',
    });

    await useAuthStore.getState().logout();
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/logout', 'POST').length, 1);
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/device').length, 0);
    assert.equal(sandbox.localStorage.getItem('bd_safety_device_id'), null);
    assert.equal(useAuthStore.getState().user, null);
    assert.equal(useAuthStore.getState().deviceId, null);
  });

  it('resetAnonymousIdentity explicitly rotates device identity when requested on /profile', async () => {
    sandbox.localStorage.setItem('bd_safety_device_id', 'old-dev-id');
    const rotated = buildAuthUser({ id: 'new-anon-user', role: 'USER' });

    fetchMock.on('/api/v1/auth/logout', () => jsonResponse({ success: true, data: { loggedOut: true } }, 200), {
      method: 'POST',
    });
    fetchMock.on('/api/v1/auth/device', () =>
      jsonResponse({ success: true, data: { user: { id: rotated.id }, socketToken: 'sock-new' } }, 201)
    );
    fetchMock.on('/api/v1/users/me', () =>
      fetchMock.getCallsFor('/api/v1/auth/device').length === 0
        ? jsonResponse({ success: false, error: 'Unauthorized' }, 401)
        : jsonResponse({ success: true, data: rotated }, 200)
    );

    const nextUser = await useAuthStore.getState().resetAnonymousIdentity();
    assert.equal(nextUser?.id, 'new-anon-user');
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/logout', 'POST').length, 1);
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/device', 'POST').length, 1);
    const nextDevice = sandbox.localStorage.getItem('bd_safety_device_id');
    assert.ok(nextDevice && nextDevice !== 'old-dev-id');
  });
});
