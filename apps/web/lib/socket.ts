import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@repo/shared";

let socketInstance: Socket | null = null;
let currentSocketToken: string | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://danger-zone-bd.onrender.com"
    : "http://127.0.0.1:5000");

/**
 * Updates the in-memory Socket.IO handshake token for cross-origin auth
 * and reconnects an active or stale socket cleanly while preserving registered listeners.
 * Passing null clears credentials and disconnects without reconnecting as a guest.
 */
export const setSocketAuthToken = (token: string | null) => {
  const normalized = token && token.trim().length > 0 ? token : null;
  const tokenChanged = normalized !== currentSocketToken;
  currentSocketToken = normalized;

  if (socketInstance) {
    socketInstance.auth = normalized ? { token: normalized } : {};
    if (normalized) {
      if (tokenChanged || !socketInstance.connected) {
        socketInstance.disconnect().connect();
      }
    } else if (socketInstance.connected) {
      socketInstance.disconnect();
    }
  }
};

export const setSocketToken = setSocketAuthToken;

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
      auth: currentSocketToken ? { token: currentSocketToken } : undefined,
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

    socketInstance.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message);
      // If an authenticated handshake fails (e.g., expired 15m token), fall back to guest
      // read-only live_reports until apiFetch silent refresh provides a new socketToken.
      const msg = (err?.message || "").toLowerCase();
      if (
        currentSocketToken &&
        (msg.includes("token") || msg.includes("unauthorized") || msg.includes("expired") || msg.includes("authentication"))
      ) {
        currentSocketToken = null;
        if (socketInstance) {
          socketInstance.auth = {};
        }
      }
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
