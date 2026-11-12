import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { apiFetch } from '@/lib/api';
import { getSocket, setSocketAuthToken } from '@/lib/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import {
  installFetchMock,
  jsonResponse,
  type FetchMockController,
} from '../framework/fetchMock';
import { buildAuthUser } from '../fixtures/mockData';
import { WEB_TEST_CONFIG } from '../framework/config';

/**
 * Post-Fix Verification: Newly Introduced Regressions & Newly Discovered Defects.
 * Follows the strict rule of `dontADDgit/post_verification_frontend.md`:
 * every unfixed regression / new issue has a faithful failing reproduction test
 * without mutating application source files or weakening assertions.
 */
describe('[Regression][Post-Fix Newly Discovered Defects] Open Regressions & Gaps', () => {
  let sandbox: BrowserSandboxHandle;
  let fetchMock: FetchMockController;

  beforeEach(() => {
    sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    fetchMock = installFetchMock();
    setSocketAuthToken(null);
    useAuthStore.setState({ user: null, deviceId: null, isLoading: false, error: null });
  });

  afterEach(() => {
    setSocketAuthToken(null);
    getSocket()?.disconnect();
    fetchMock.restore();
    sandbox.restore();
  });

  it('[FRONTEND-REG-001] /profile handleSwitchIdentity (POST /auth/device + initAuth) MUST update in-memory Socket.IO token instead of keeping prior session socketToken', async () => {
    // Prior session leaves an active socketToken in lib/socket.ts
    setSocketAuthToken('stale-admin-socket-token');
    const socket = getSocket();
    assert.equal((socket?.auth as any)?.token, 'stale-admin-socket-token');

    const switchedUser = buildAuthUser({ id: 'switched-citizen-2', role: 'USER' });
    fetchMock.on(
      '/api/v1/auth/device',
      () =>
        jsonResponse(
          {
            success: true,
            data: {
              user: switchedUser,
              socketToken: 'fresh-switched-socket-token',
            },
          },
          200
        ),
      { method: 'POST' }
    );
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: switchedUser }, 200));

    // Exact sequence executed by apps/web/app/profile/page.tsx:138-142
    sandbox.localStorage.setItem('bd_safety_device_id', 'device-switched-2');
    await apiFetch('/auth/device', {
      method: 'POST',
      body: JSON.stringify({ anonymousId: 'device-switched-2' }),
    });
    await useAuthStore.getState().initAuth();

    assert.equal(
      (getSocket()?.auth as any)?.token,
      'fresh-switched-socket-token',
      'Switching identity on /profile must update Socket.IO handshake auth token to the newly switched session token'
    );
  });

  it('[FRONTEND-NEW-001] reloading with existing HttpOnly cookie (GET /users/me 200) MUST still provide a valid Socket.IO auth token for cross-origin user:<id> room joins', async () => {
    const existingUser = buildAuthUser({ id: 'reload-user-1', role: 'USER' });
    fetchMock.on('/api/v1/users/me', () => jsonResponse({ success: true, data: existingUser }, 200));

    await useAuthStore.getState().initAuth();
    const socket = getSocket();

    assert.ok(
      typeof (socket?.auth as any)?.token === 'string' && (socket?.auth as any).token.length > 0,
      'initAuth() hydrating an existing cookie session via GET /users/me must also populate socket.auth.token for cross-origin WebSocket auth'
    );
  });

  it('[FRONTEND-NEW-002] lib/socket.ts default SOCKET_URL MUST resolve 127.0.0.1 to local backend http://127.0.0.1:5000 instead of production Render URL', () => {
    const socketSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'lib/socket.ts'), 'utf8');
    const match = socketSrc.match(/const SOCKET_URL =[\s\S]*?;/);
    assert.ok(match, 'Expected SOCKET_URL declaration in lib/socket.ts');

    const expr = match[0].replace(/^const SOCKET_URL =\s*/, '').replace(/;$/, '');
    const resolvedOn127 = vm.runInNewContext(expr, {
      process: { env: {} },
      window: { location: { hostname: '127.0.0.1' } },
    });

    assert.equal(
      resolvedOn127,
      'http://127.0.0.1:5000',
      `Expected 127.0.0.1 to target local backend http://127.0.0.1:5000, got ${resolvedOn127}`
    );
  });
});
