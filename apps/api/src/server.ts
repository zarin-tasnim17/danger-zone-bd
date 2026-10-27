import http from 'http';
import { app } from './app';
import { initSocketServer } from './sockets';
import { initTimeDecayCron, initNewsCrawlerCron } from './jobs';
import { prisma } from './db/prisma';
import { env } from './config/env';

const PORT = env.PORT ? parseInt(env.PORT, 10) : 5000;

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocketServer(server);

// Initialize Background Workers
const timeDecayCron = initTimeDecayCron();
const newsCrawlerCron = initNewsCrawlerCron();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API is running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  timeDecayCron.stop();
  newsCrawlerCron.stop();

  server.close(async () => {
    console.log('[Server] HTTP and Socket.IO server closed.');
    await prisma.$disconnect();
    console.log('[Server] Database connections closed.');
    process.exit(0);
  });

  // Force exit after 10s if connections refuse to close
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
