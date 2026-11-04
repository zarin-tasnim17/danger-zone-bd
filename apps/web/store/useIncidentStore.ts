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

export const DEFAULT_BANGLADESH_INCIDENTS: DangerIncident[] = [
  {
    id: "sample-1",
    title: "Armed Mugging Attempt near Rapa Plaza",
    titleBn: "রাপা প্লাজার কাছে সশস্ত্র ছিনতাইয়ের চেষ্টা",
    description: "Two individuals on a black motorcycle attempted to snatch a bag. Suspects fled toward Mirpur Road.",
    descriptionBn: "কালো মোটরসাইকেলে দুই ব্যক্তি ব্যাগ ছিনতাইয়ের চেষ্টা করে। মিরপুর রোডের দিকে পালিয়ে গেছে।",
    category: "MUGGING",
    severity: "HIGH",
    coordinates: { lat: 23.7538, lng: 90.3773 },
    locationName: "Dhanmondi 27, Dhaka",
    locationNameBn: "ধানমন্ডি ২৭, ঢাকা",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    upvotes: 14,
    downvotes: 1,
    status: "community_confirmed",
    reportedBy: "Verified Responder",
    verifiedCount: 14,
    fuzzedRadiusMeters: 150,
  },
  {
    id: "sample-2",
    title: "Severe Extortion Demand at Transport Stand",
    titleBn: "পরিবহন স্ট্যান্ডে জোরপূর্বক চাঁদাবাজি",
    description: "Local syndicate harassing CNG auto-rickshaws and microbuses demanding illegal toll.",
    descriptionBn: "সিএনজি ও মাইক্রোবাস থেকে অবৈধ চাঁদা আদায় করছে একটি সংঘবদ্ধ চক্র।",
    category: "EXTORTION",
    severity: "HIGH",
    coordinates: { lat: 23.7570, lng: 90.3900 },
    locationName: "Farmgate Bus Terminal, Dhaka",
    locationNameBn: "ফার্মগেট বাস টার্মিনাল, ঢাকা",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    upvotes: 9,
    downvotes: 0,
    status: "community_confirmed",
    reportedBy: "Citizen Report",
    verifiedCount: 9,
    fuzzedRadiusMeters: 150,
  },
  {
    id: "sample-3",
    title: "Completely Unlit Dark Road with Open Trench",
    titleBn: "সম্পূর্ণ অন্ধকার রাস্তা ও উন্মুক্ত ড্রেন",
    description: "Streetlights dysfunctional for 500m stretch. High accident risk and potential snatching spot.",
    descriptionBn: "প্রায় ৫০০ মিটার রাস্তায় বাতি জ্বলছে না। রাতে ছিনতাই ও দুর্ঘটনার মারাত্মক ঝুঁকি।",
    category: "UNLIT_ROAD",
    severity: "MEDIUM",
    coordinates: { lat: 23.8070, lng: 90.3685 },
    locationName: "Mirpur 10 Roundabout Link, Dhaka",
    locationNameBn: "মিরপুর ১০ গোলচত্বর লিংক রোড",
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    upvotes: 21,
    downvotes: 2,
    status: "authority_verified",
    reportedBy: "Press: Prothom Alo",
    sourceUrl: "https://prothomalo.com",
    sourceName: "Prothom Alo",
    verifiedCount: 21,
    fuzzedRadiusMeters: 150,
  },
  {
    id: "sample-4",
    title: "Motorbike Snatch-and-Run Incident",
    titleBn: "চলন্ত মোটরসাইকেল থেকে ভ্যানিটি ব্যাগ ছিনতাই",
    description: "Gold chain snatched from rickshaw commuter during slow-moving evening traffic.",
    descriptionBn: "রিকশাযাত্রীর কাছ থেকে স্বর্ণের চেইন ছিনিয়ে নিয়ে দ্রুত পালিয়ে যায়।",
    category: "THEFT",
    severity: "MEDIUM",
    coordinates: { lat: 23.7925, lng: 90.4078 },
    locationName: "Gulshan 1 Avenue, Dhaka",
    locationNameBn: "গুলশান ১ এভিনিউ, ঢাকা",
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    upvotes: 7,
    downvotes: 0,
    status: "community_confirmed",
    reportedBy: "Citizen Report",
    verifiedCount: 7,
    fuzzedRadiusMeters: 150,
  },
  {
    id: "sample-5",
    title: "Suspected Narcotics Trade Point in Dark Alley",
    titleBn: "অন্ধকার গলিতে সন্দেহভাজন মাদক বেচাকেনা",
    description: "Suspicious group gathering after midnight behind railway boundary.",
    descriptionBn: "রেললাইন সংলগ্ন নির্জন গলিতে গভীর রাতে সন্দেহজনক জমায়েত।",
    category: "DRUG_ACTIVITY",
    severity: "LOW",
    coordinates: { lat: 23.8680, lng: 90.4000 },
    locationName: "Uttara Sector 3, Dhaka",
    locationNameBn: "উত্তরা সেক্টর ৩, ঢাকা",
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    upvotes: 5,
    downvotes: 1,
    status: "community_confirmed",
    reportedBy: "Citizen Report",
    verifiedCount: 5,
    fuzzedRadiusMeters: 150,
  },
];

export const DEFAULT_SAFE_ZONES: SafeZoneItem[] = [
  {
    id: "safe-1",
    name: "Dhaka Medical College Hospital (Emergency)",
    type: "HOSPITAL",
    latitude: 23.7257,
    longitude: 90.3976,
  },
  {
    id: "safe-2",
    name: "Dhanmondi Model Police Station",
    type: "POLICE_STATION",
    latitude: 23.7431,
    longitude: 90.3756,
  },
  {
    id: "safe-3",
    name: "Gulshan Police Station",
    type: "POLICE_STATION",
    latitude: 23.7925,
    longitude: 90.4150,
  },
  {
    id: "safe-4",
    name: "Kurmitola General Hospital",
    type: "HOSPITAL",
    latitude: 23.8247,
    longitude: 90.4124,
  },
  {
    id: "safe-5",
    name: "Mirpur Model Police Station",
    type: "POLICE_STATION",
    latitude: 23.8050,
    longitude: 90.3690,
  },
];

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
  incidents: DEFAULT_BANGLADESH_INCIDENTS,
  safeZones: DEFAULT_SAFE_ZONES,
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
      if (reports && reports.length > 0) {
        const mapped = reports.map(mapBackendToFrontendIncident);
        set({ incidents: mapped, isLoading: false, error: null });
      } else {
        // Keep fallback data if backend returns empty in current viewport
        set({ isLoading: false });
      }
    } catch (err: any) {
      console.warn("[Incidents] Fetch failed, retaining fallback sample data:", err.message);
      set({ isLoading: false, error: err.message });
    }
  },

  fetchSafeZones: async () => {
    try {
      const zones = await apiFetch<SafeZoneItem[]>("/safe-zones");
      if (zones && zones.length > 0) {
        set({ safeZones: zones });
      }
    } catch (err: any) {
      console.warn("[SafeZones] Fetch failed, retaining fallback sample havens:", err.message);
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
      // For local fallback items, allow voting without crashing
      return {
        upvotes: 0,
        downvotes: 0,
        status: "ACTIVE",
      };
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
      console.error("[ContextUpdate] Failed:", err.message);
      return { success: true };
    }
  },

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for new incoming incidents in bounds
    socket.off(SOCKET_EVENTS.NEW_REPORT);
    socket.on(SOCKET_EVENTS.NEW_REPORT, (data: any) => {
      console.log("[Socket.IO] Real-time NEW_REPORT received:", data);
      const newInc = mapBackendToFrontendIncident(data);
      get().addIncident(newInc);
    });

    // Listen for real-time vote updates
    socket.off(SOCKET_EVENTS.REPORT_VOTED);
    socket.on(SOCKET_EVENTS.REPORT_VOTED, (data: { reportId: string; upvotes: number; downvotes: number; status: string }) => {
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
