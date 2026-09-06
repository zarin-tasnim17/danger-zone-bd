import { create } from 'zustand';
import { MapMode, Coordinates } from '@repo/shared';

interface MapState {
  mode: MapMode;
  center: Coordinates;
  zoom: number;
  setMode: (mode: MapMode) => void;
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mode: 'basic',
  center: { lat: 23.685, lng: 90.3563 }, // Center of Bangladesh
  zoom: 7,
  setMode: (mode) => set({ mode }),
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
}));
