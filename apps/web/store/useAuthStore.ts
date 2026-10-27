import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";

export interface AuthUser {
  id: string;
  email?: string;
  role: "USER" | "VERIFIED_RESPONDER" | "ADMIN";
  trustScore: number;
  isVerified: boolean;
  isBanned?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  deviceId: string | null;
  isLoading: boolean;
  error: string | null;
  initAuth: () => Promise<AuthUser | null>;
  loginAdmin: (anonymousId: string, email?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEVICE_ID_KEY = "bd_safety_device_id";

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  deviceId: null,
  isLoading: true,
  error: null,

  initAuth: async () => {
    if (typeof window === "undefined") return null;

    set({ isLoading: true, error: null });

    try {
      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `anon-dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }

      set({ deviceId });

      // Silent device authentication
      await apiFetch("/auth/device", {
        method: "POST",
        body: JSON.stringify({ anonymousId: deviceId }),
      });

      // Retrieve full user profile
      const profile = await apiFetch<AuthUser>("/users/me");

      set({ user: profile, isLoading: false });

      // Initialize Socket connection now that HttpOnly cookies are set
      getSocket();

      return profile;
    } catch (err: any) {
      console.warn("[Auth] Silent device authentication fallback notice:", err.message);
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  loginAdmin: async (anonymousId: string, email?: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiFetch("/auth/device", {
        method: "POST",
        body: JSON.stringify({ anonymousId, email }),
      });

      const profile = await apiFetch<AuthUser>("/users/me");

      if (profile.role !== "ADMIN") {
        throw new Error("This account does not have administrator privileges.");
      }

      set({ user: profile, isLoading: false });

      // Refresh socket connection with admin authorization
      const socket = getSocket();
      if (socket) {
        socket.disconnect();
        socket.connect();
      }

      return profile;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await apiFetch<AuthUser>("/users/me");
      set({ user: profile });
    } catch {
      // Ignore background refresh errors
    }
  },

  logout: async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors
    }

    set({ user: null });

    // Re-initialize as new anonymous citizen
    localStorage.removeItem(DEVICE_ID_KEY);
    await get().initAuth();
  },
}));
