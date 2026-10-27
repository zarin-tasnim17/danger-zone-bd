import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';

let io: SocketIOServer | null = null;

// Extend Socket data typing
declare module 'socket.io' {
  interface SocketData {
    user: JwtPayload;
    bounds?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  }
}

/**
 * Parse a raw Cookie header string into key-value pairs
 */
const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, cookieStr) => {
    const [key, ...val] = cookieStr.trim().split('=');
    if (key) acc[key] = decodeURIComponent(val.join('='));
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Socket.IO handshake authentication middleware
 * Checks HttpOnly cookie `accessToken` or handshake auth payload `token`
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies.accessToken || socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error: Missing access token'));
    }

    const decoded = verifyAccessToken(token);
    socket.data.user = decoded;
    return next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

/**
 * Initialize Socket.IO attached to existing HTTP server
 */
export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const rawCors = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const corsOrigins = rawCors === '*' ? '*' : rawCors.split(',').map((o) => o.trim());

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true
    },
    pingTimeout: 20000,
    pingInterval: 25000
  });

  // Enforce JWT handshake authentication
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (User: ${user.id}, Role: ${user.role})`);

    // Automatically join the live map feed room
    socket.join('live_reports');

    // Automatically join user-specific notification room
    socket.join(`user:${user.id}`);

    // Room subscription based on map bounds
    socket.on('joinMapBounds', (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => {
      socket.data.bounds = bounds;
      console.log(`[Socket.IO] ${socket.id} updated viewport bounds:`, bounds);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  return io;
};

/**
 * Access the initialized Socket.IO instance
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocketServer first.');
  }
  return io;
};

/**
 * Public sanitized report interface strictly excluding PII (userId, IP, device fingerprints)
 */
export interface SanitizedReportEvent {
  id: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  upvotes: number;
  downvotes: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  sourceUrl?: string | null;
  sourceName?: string | null;
}

/**
 * Broadcast NEW_REPORT to all connected map clients
 */
export const emitNewReport = (report: SanitizedReportEvent) => {
  if (!io) return;
  io.to('live_reports').emit('NEW_REPORT', report);
};

/**
 * Broadcast REPORT_VOTED to update vote tallies in real time
 */
export const emitReportVoted = (data: { reportId: string; upvotes: number; downvotes: number; status: string }) => {
  if (!io) return;
  io.to('live_reports').emit('REPORT_VOTED', data);
};

/**
 * Broadcast REPORT_PURGED when a pin is purged by the Trust Engine
 */
export const emitReportPurged = (data: { reportId: string; reason?: string }) => {
  if (!io) return;
  io.to('live_reports').emit('REPORT_PURGED', data);
};

/**
 * Broadcast REPORT_EXPIRED when incidents expire via Time-Decay
 */
export const emitReportExpired = (data: { reportIds: string[]; reason: string }) => {
  if (!io) return;
  io.to('live_reports').emit('REPORT_EXPIRED', data);
};

/**
 * Broadcast REPORT_RESOLVED when an incident is marked resolved
 */
export const emitReportResolved = (data: { reportId: string; status: string; resolvedAt?: string }) => {
  if (!io) return;
  io.to('live_reports').emit('REPORT_RESOLVED', data);
};

/**
 * Broadcast NEW_REPORT_UPDATE when a threaded context update is posted
 */
export const emitNewReportUpdate = (data: { reportId: string; update: any }) => {
  if (!io) return;
  io.to('live_reports').emit('NEW_REPORT_UPDATE', data);
};

/**
 * Targeted geofence alert emitted to a specific user room
 */
export const emitUserAlert = (userId: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit('GEOFENCE_ALERT', data);
};

/**
 * Broadcast REPORT_VERIFIED when a citizen report is cross-confirmed by a press report
 */
export const emitReportVerified = (data: { reportId: string; verifiedBy: string; sourceUrl?: string; articleTitle?: string }) => {
  if (!io) return;
  io.to('live_reports').emit('REPORT_VERIFIED', data);
};
