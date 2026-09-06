import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export const setupSockets = (httpServer: HttpServer) => {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('joinMapBounds', (bounds: any) => {
      console.log(`[Socket.IO] ${socket.id} joined bounds:`, bounds);
      // Future scope: Subscribe to a room representing these geo-bounds
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};
