import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@repo/shared';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker } from '../framework/dbTracker';
import {
  createDeviceActor,
  createPrivilegedActor,
  mintCustomAccessToken,
} from '../framework/authHelpers';
import { assertNoReportPii, assertSuccessEnvelope } from '../framework/assertions';
import { SMALL_DHAKA_POLYGON } from '../framework/fixtures';

const connectSocket = (
  baseUrl: string,
  auth?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      auth,
      extraHeaders,
      reconnection: false,
      timeout: 5000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.disconnect();
      reject(err);
    });
  });

describe('API Functional: Socket.IO Real-Time Gateway (EP-047)', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();
  const sockets: Socket[] = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    for (const s of sockets) s.disconnect();
    await tracker.cleanup();
    await server.stop();
  });

  it('Allows guest read-only socket & authenticated socketToken handshake; rejects tampered/non-string tokens', async () => {
    const guest = await connectSocket(server.baseUrl);
    sockets.push(guest);
    assert.equal(guest.connected, true);

    const user = await createDeviceActor(server.baseUrl, tracker);
    const authed = await connectSocket(server.baseUrl, { token: user.socketToken });
    sockets.push(authed);
    assert.equal(authed.connected, true);

    // Emit client JOIN_MAP_BOUNDS
    authed.emit(SOCKET_EVENTS.JOIN_MAP_BOUNDS, {
      minLng: 90.3,
      minLat: 23.7,
      maxLng: 90.45,
      maxLat: 23.85,
    });

    // Reject forged token
    await assert.rejects(
      connectSocket(server.baseUrl, { token: 'invalid.jwt.token' }),
      /jwt|invalid|authentication/i
    );

    // Reject non-string token
    await assert.rejects(
      connectSocket(server.baseUrl, { token: 12345 }),
      /invalid token format/i
    );

    // Reject expired token
    const expired = mintCustomAccessToken(
      { id: user.id, role: user.role, isVerified: false, tokenUse: 'socket' },
      { expiresIn: -10 }
    );
    await assert.rejects(connectSocket(server.baseUrl, { token: expired }), /expired/i);
  });

  it('Broadcasts sanitized NEW_REPORT, REPORT_VOTED, NEW_REPORT_UPDATE, REPORT_RESOLVED, REPORT_PURGED, and targeted GEOFENCE_ALERT', async () => {
    const watcher = await createDeviceActor(server.baseUrl, tracker);
    const reporter = await createDeviceActor(server.baseUrl, tracker);
    const admin = await createPrivilegedActor(server.baseUrl, tracker, { role: 'ADMIN' });

    // Watcher subscribes to geofenced alert zone containing (23.745, 90.375)
    const zone = assertSuccessEnvelope(
      await watcher.client.post('/api/v1/alerts/zones', {
        name: 'Watcher Alert Box',
        coordinates: SMALL_DHAKA_POLYGON,
      }),
      201
    );
    tracker.trackAlertZone(zone.id);

    const watcherSock = await connectSocket(server.baseUrl, { token: watcher.socketToken });
    const guestSock = await connectSocket(server.baseUrl);
    sockets.push(watcherSock, guestSock);

    let guestReceivedGeofence = false;
    guestSock.on(SOCKET_EVENTS.GEOFENCE_ALERT, () => {
      guestReceivedGeofence = true;
    });

    const newReportPromise = new Promise<any>((resolve) =>
      guestSock.once(SOCKET_EVENTS.NEW_REPORT, resolve)
    );
    const geofencePromise = new Promise<any>((resolve) =>
      watcherSock.once(SOCKET_EVENTS.GEOFENCE_ALERT, resolve)
    );

    // Create HIGH report inside zone
    const created = assertSuccessEnvelope(
      await reporter.client.post('/api/v1/reports', {
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: 23.745,
        longitude: 90.375,
        description: 'High severity incident inside watcher geofence',
      }),
      201
    );
    tracker.trackReport(created.id);

    const [newReportEvt, geofenceEvt] = await Promise.all([newReportPromise, geofencePromise]);
    assert.equal(newReportEvt.id, created.id);
    assertNoReportPii(newReportEvt, 'Socket NEW_REPORT');
    assert.equal(geofenceEvt.type, 'GEOFENCE_ALERT');
    assert.equal(geofenceEvt.data?.reportId, created.id);

    // Vote event
    const votePromise = new Promise<any>((resolve) =>
      guestSock.once(SOCKET_EVENTS.REPORT_VOTED, resolve)
    );
    await watcher.client.post(`/api/v1/reports/${created.id}/vote`, { voteType: 1 });
    const voteEvt = await votePromise;
    assert.equal(voteEvt.reportId, created.id);
    assert.equal(voteEvt.upvotes, 1);

    // Update event
    const updPromise = new Promise<any>((resolve) =>
      guestSock.once(SOCKET_EVENTS.NEW_REPORT_UPDATE, resolve)
    );
    await watcher.client.post(`/api/v1/reports/${created.id}/updates`, {
      content: 'Live patrol checking the road',
    });
    const updEvt = await updPromise;
    assert.equal(updEvt.reportId, created.id);
    assert.equal('userId' in updEvt.update, false);

    // Resolve event
    const resolvePromise = new Promise<any>((resolve) =>
      guestSock.once(SOCKET_EVENTS.REPORT_RESOLVED, resolve)
    );
    await reporter.client.patch(`/api/v1/reports/${created.id}/resolve`, {});
    const resolvedEvt = await resolvePromise;
    assert.equal(resolvedEvt.reportId, created.id);
    assert.equal(resolvedEvt.status, 'RESOLVED');

    // Purge event
    const purgePromise = new Promise<any>((resolve) =>
      guestSock.once(SOCKET_EVENTS.REPORT_PURGED, resolve)
    );
    await admin.client.post(`/api/v1/admin/reports/${created.id}/purge`, {
      reason: 'Socket purge test',
    });
    const purgedEvt = await purgePromise;
    assert.equal(purgedEvt.reportId, created.id);

    assert.equal(guestReceivedGeofence, false, 'Guest socket must never receive private GEOFENCE_ALERT');
  });
});
