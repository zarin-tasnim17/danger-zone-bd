import { create } from "zustand";
import { apiFetch, ApiError } from "@/lib/api";
import { getSocket, setSocketAuthToken } from "@/lib/socket";

export interface AuthUser {
  id: string;
  email?: string;
  role: "USER" | "VERIFIED_RESPONDER" | "ADMIN";
  trustScore: number;
  isVerified: boolean;
  isBanned?: boolean;
  createdAt?: string;
  _count?: {
    reports: number;
    votes: number;
    alertZones: number;
  };
  verifications?: {
    id: string;
    type: 'PHONE_OTP' | 'NID_DOCUMENT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
  }[];
}

interface AuthState {
  user: AuthUser | null;
  deviceId: string | null;
  isLoading: boolean;
  error: string | null;
  initAuth: () => Promise<AuthUser | null>;
  loginAdminWithPassword: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  resetAnonymousIdentity: () => Promise<AuthUser | null>;
  refreshProfile: () => Promise<void>;
}

const DEVICE_ID_KEY = "bd_safety_device_id";
let initAuthPromise: Promise<AuthUser | null> | null = null;

function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  deviceId: null,
  isLoading: true,
  error: null,

  initAuth: async () => {
    if (typeof window === "undefined") return null;

    if (!initAuthPromise) {
      initAuthPromise = (async () => {
        set({ isLoading: true, error: null });

        try {
          const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);

          // Probe existing session first so ADMIN, VERIFIED_RESPONDER, and USER cookies are preserved
          try {
            const existingProfile = await apiFetch<AuthUser>("/users/me");
            set({
              user: existingProfile,
              deviceId: existingDeviceId,
              isLoading: false,
            });
            getSocket();
            return existingProfile;
          } catch (probeErr: any) {
            // Only mint/re-auth anonymous device identity when session is unauthenticated (401)
            if (!(probeErr instanceof ApiError && probeErr.statusCode === 401)) {
              throw probeErr;
            }
          }

          const deviceId = getOrCreateDeviceId();
          set({ deviceId });

          // Silent device authentication for unauthenticated guests
          const deviceAuth = await apiFetch<{
            user?: { id: string; role: string };
            socketToken?: string;
          }>("/auth/device", {
            method: "POST",
            body: JSON.stringify({ anonymousId: deviceId }),
          });

          if (deviceAuth?.socketToken) {
            setSocketAuthToken(deviceAuth.socketToken);
          }

          // Retrieve full user profile
          const profile = await apiFetch<AuthUser>("/users/me");

          set({ user: profile, isLoading: false });

          // Initialize Socket connection now that cookies & scoped socketToken are set
          getSocket();

          return profile;
        } catch (err: any) {
          console.warn("[Auth] Silent device authentication fallback notice:", err.message);
          set({ user: null, isLoading: false, error: err.message });
          return null;
        } finally {
          initAuthPromise = null;
        }
      })();
    }

    return initAuthPromise;
  },

  loginAdminWithPassword: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const loginData = await apiFetch<{ socketToken?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const profile = await apiFetch<AuthUser>("/users/me");

      if (profile.role !== "ADMIN") {
        await apiFetch("/auth/logout", {
          method: "POST",
          skipAuthRefresh: true,
        }).catch(() => {});
        getSocket()?.disconnect();
        setSocketAuthToken(null);
        set({ user: null });
        throw new Error("This account does not have administrator privileges.");
      }

      set({ user: profile, isLoading: false });

      // Refresh socket connection with admin authorization
      setSocketAuthToken(loginData?.socketToken ?? null);
      getSocket();

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
      await apiFetch("/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      });
    } catch {
      // Ignore logout errors
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(DEVICE_ID_KEY);
    }
    getSocket()?.disconnect();
    setSocketAuthToken(null);
    set({ user: null, deviceId: null, isLoading: false, error: null });
  },

  resetAnonymousIdentity: async () => {
    await get().logout();
    return await get().initAuth();
  },
}));
