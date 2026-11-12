import http from 'http';
import { AddressInfo } from 'net';
import './config';
import { app } from '../../src/app';
import { initSocketServer } from '../../src/sockets/socketManager';
import { Server as SocketIOServer } from 'socket.io';

export interface TestServerHandle {
  baseUrl: string;
  apiBaseUrl: string;
  httpServer: http.Server;
  io: SocketIOServer;
  stop: () => Promise<void>;
}

export const startTestServer = async (): Promise<TestServerHandle> => {
  const httpServer = http.createServer(app);
  const io = initSocketServer(httpServer);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      resolve();
    });
  });

  const addr = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    apiBaseUrl: `${baseUrl}/api/v1`,
    httpServer,
    io,
    stop: async () => {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      if (typeof httpServer.closeAllConnections === 'function') {
        httpServer.closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
};
