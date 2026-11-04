import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/socket";

export interface PlatformStats {
  totalReports: number;
  activeReports: number;
  resolvedReports: number;
  criticalThreats: number;
  totalCitizens: number;
  verifiedCitizens: number;
  safeHavens: number;
  totalVotes: number;
  lastActiveAt: string;
  timestamp: string;
}

interface StatsState {
  stats: PlatformStats | null;
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
  initStatsListener: () => void;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  isLoading: true,
  error: null,

  fetchStats: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await apiFetch<{ success: boolean; data: PlatformStats }>("/stats");
      if (response && response.data) {
        set({ stats: response.data, isLoading: false, error: null });
      }
    } catch (err: any) {
      console.warn("[StatsStore] Could not fetch live platform stats:", err.message);
      set({ isLoading: false, error: err.message });
    }
  },

  initStatsListener: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off("STATS_UPDATED");
    socket.on("STATS_UPDATED", (newStats: PlatformStats) => {
      set({ stats: newStats });
    });
  },
}));
