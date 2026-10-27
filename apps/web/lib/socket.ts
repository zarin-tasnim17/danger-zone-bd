import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@repo/shared";

let socketInstance: Socket | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://127.0.0.1:5000";

/**
 * Access or create the singleton Socket.IO instance.
 * Strictly browser-only (`typeof window !== 'undefined'`).
 * Implements reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity
 * as required by the Master Blueprint for Render free-tier sleep handling.
 */
export const getSocket = (): Socket | null => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    });

    socketInstance.on(SOCKET_EVENTS.CONNECT, () => {
      console.log("[Socket.IO] Connected to live safety server:", socketInstance?.id);
    });

    socketInstance.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.warn("[Socket.IO] Disconnected from safety server:", reason);
    });
  }

  return socketInstance;
};

/**
 * Emits updated map viewport coordinates to receive localized updates
 */
export const joinMapBounds = (bounds: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit(SOCKET_EVENTS.JOIN_MAP_BOUNDS, bounds);
  }
};
