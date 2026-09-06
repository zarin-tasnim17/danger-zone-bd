import http from 'http';
import { app } from './app';
import { setupSockets } from './sockets';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
setupSockets(server);

server.listen(PORT, () => {
  console.log(`[Server] API is running on port ${PORT}`);
});
