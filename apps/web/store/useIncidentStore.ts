import { create } from "zustand";
import { DangerIncident, SOCKET_EVENTS } from "@repo/shared";
import { apiFetch } from "@/lib/api";
import { getSocket, joinMapBounds } from "@/lib/socket";

export interface SafeZoneItem {
  id: string;
  name: string;
  type: "POLICE_STATION" | "HOSPITAL" | "FIRE_STATION" | "COMMUNITY_SHELTER";
  latitude: number;
  longitude: number;
}

interface IncidentState {
  incidents: DangerIncident[];
  safeZones: SafeZoneItem[];
  isLoading: boolean;
  error: string | null;
  activeBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  setIncidents: (incidents: DangerIncident[]) => void;
  addIncident: (incident: DangerIncident) => void;
  fetchIncidentsInBounds: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => Promise<void>;
  fetchSafeZones: () => Promise<void>;
  voteIncident: (reportId: string, voteType: 1 | -1) => Promise<{ upvotes: number; downvotes: number }>;
  addContextUpdate: (reportId: string, content: string) => Promise<any>;
  initSocketListeners: () => void;
}

const mapBackendToFrontendIncident = (r: any): DangerIncident => {
  return {
    id: r.id,
    title: r.description ? r.description.split("\n")[0].substring(0, 70) : `${r.category} Incident`,
    description: r.description || "No description provided.",
    category: r.category,
    severity: r.severity,
    coordinates: {
      lat: r.latitude,
      lng: r.longitude,
    },
    locationName: r.sourceName ? r.sourceName : "Reported Hazard Zone",
    timestamp: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    upvotes: r.upvotes || 0,
    downvotes: r.downvotes || 0,
    status: r.sourceUrl ? "authority_verified" : "community_confirmed",
    reportedBy: r.sourceName ? `Press: ${r.sourceName}` : "Citizen Report",
    verifiedCount: r.upvotes || 0,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    fuzzedRadiusMeters: r.fuzzedRadiusMeters || 150,
  };
};

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: [],
  safeZones: [],
  isLoading: false,
  error: null,
  activeBounds: null,

  setIncidents: (incidents) => set({ incidents }),

  addIncident: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents.filter((i) => i.id !== incident.id)],
    })),

  fetchIncidentsInBounds: async (bounds) => {
    set({ isLoading: true, activeBounds: bounds });

    try {
      // Update viewport on server for targeted Socket.IO emissions
      joinMapBounds({
        minLat: bounds.minLat,
        maxLat: bounds.maxLat,
        minLng: bounds.minLng,
        maxLng: bounds.maxLng,
      });

      const query = new URLSearchParams({
        minLat: bounds.minLat.toString(),
        maxLat: bounds.maxLat.toString(),
        minLng: bounds.minLng.toString(),
        maxLng: bounds.maxLng.toString(),
      });

      const reports = await apiFetch<any[]>(`/reports?${query.toString()}`);
      const mapped = (reports || []).map(mapBackendToFrontendIncident);

      set({ incidents: mapped, isLoading: false });
    } catch (err: any) {
      console.warn("[Incidents] Fetch failed:", err.message);
      set({ isLoading: false, error: err.message });
    }
  },

  fetchSafeZones: async () => {
    try {
      const zones = await apiFetch<SafeZoneItem[]>("/safe-zones");
      set({ safeZones: zones || [] });
    } catch (err: any) {
      console.warn("[SafeZones] Fetch failed:", err.message);
    }
  },

  voteIncident: async (reportId: string, voteType: 1 | -1) => {
    // Optimistic vote tally update
    set((state) => ({
      incidents: state.incidents.map((inc) => {
        if (inc.id === reportId) {
          return {
            ...inc,
            upvotes: voteType === 1 ? inc.upvotes + 1 : inc.upvotes,
            downvotes: voteType === -1 ? inc.downvotes + 1 : inc.downvotes,
          };
        }
        return inc;
      }),
    }));

    try {
      const result = await apiFetch<{ upvotes: number; downvotes: number; status: string }>(
        `/reports/${reportId}/vote`,
        {
          method: "POST",
          body: JSON.stringify({ voteType }),
        }
      );

      // Reconcile with exact server vote totals
      set((state) => ({
        incidents: state.incidents.map((inc) =>
          inc.id === reportId
            ? { ...inc, upvotes: result.upvotes, downvotes: result.downvotes }
            : inc
        ),
      }));

      return result;
    } catch (err: any) {
      console.error("[Vote] Failed:", err.message);
      throw err;
    }
  },

  addContextUpdate: async (reportId: string, content: string) => {
    try {
      const result = await apiFetch(`/reports/${reportId}/updates`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return result;
    } catch (err: any) {
      console.error("[Update] Failed:", err.message);
      throw err;
    }
  },

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for new live reports
    socket.off(SOCKET_EVENTS.NEW_REPORT);
    socket.on(SOCKET_EVENTS.NEW_REPORT, (report: any) => {
      console.log("[Socket.IO] Real-time NEW_REPORT received:", report.id);
      const mapped = mapBackendToFrontendIncident(report);
      get().addIncident(mapped);
    });

    // Listen for vote updates
    socket.off(SOCKET_EVENTS.REPORT_VOTED);
    socket.on(SOCKET_EVENTS.REPORT_VOTED, (data: { reportId: string; upvotes: number; downvotes: number }) => {
      set((state) => ({
        incidents: state.incidents.map((inc) =>
          inc.id === data.reportId
            ? { ...inc, upvotes: data.upvotes, downvotes: data.downvotes }
            : inc
        ),
      }));
    });

    // Listen for purged reports (trust engine 5-downvote or admin purge)
    socket.off(SOCKET_EVENTS.REPORT_PURGED);
    socket.on(SOCKET_EVENTS.REPORT_PURGED, (data: { reportId: string }) => {
      console.log("[Socket.IO] Real-time REPORT_PURGED received:", data.reportId);
      set((state) => ({
        incidents: state.incidents.filter((inc) => inc.id !== data.reportId),
      }));
    });

    // Listen for expired reports (time-decay worker)
    socket.off(SOCKET_EVENTS.REPORT_EXPIRED);
    socket.on(SOCKET_EVENTS.REPORT_EXPIRED, (data: { reportIds: string[] }) => {
      const expiredSet = new Set(data.reportIds || []);
      set((state) => ({
        incidents: state.incidents.filter((inc) => !expiredSet.has(inc.id)),
      }));
    });

    // Listen for press cross-verification updates
    socket.off(SOCKET_EVENTS.REPORT_VERIFIED);
    socket.on(SOCKET_EVENTS.REPORT_VERIFIED, (data: { reportId: string; verifiedBy: string; sourceUrl?: string; articleTitle?: string }) => {
      console.log("[Socket.IO] Real-time REPORT_VERIFIED received:", data.reportId);
      set((state) => ({
        incidents: state.incidents.map((inc) => {
          if (inc.id === data.reportId) {
            const pressTag = `[Verified by Press: ${data.verifiedBy}]`;
            const updatedDesc = inc.description.includes(pressTag)
              ? inc.description
              : `${inc.description} ${pressTag}`;
            return {
              ...inc,
              description: updatedDesc,
              status: "authority_verified",
              sourceName: data.verifiedBy,
              sourceUrl: data.sourceUrl || inc.sourceUrl,
            };
          }
          return inc;
        }),
      }));
    });
  },
}));
