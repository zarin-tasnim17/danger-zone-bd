import http from 'http';
import { app } from './app';
import { initSocketServer } from './sockets';
import { env } from './config/env';

const PORT = env.PORT ? parseInt(env.PORT, 10) : 5000;

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocketServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API is running on port ${PORT}`);
});
