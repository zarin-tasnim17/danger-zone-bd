import { create } from 'zustand';
import { DangerIncident } from '@repo/shared';

interface IncidentState {
  incidents: DangerIncident[];
  setIncidents: (incidents: DangerIncident[]) => void;
  addIncident: (incident: DangerIncident) => void;
  clearIncidents: () => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  incidents: [],
  setIncidents: (incidents) => set({ incidents }),
  addIncident: (incident) =>
    set((state) => ({ incidents: [incident, ...state.incidents] })),
  clearIncidents: () => set({ incidents: [] }),
}));
