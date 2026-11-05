import { create } from 'zustand';
import { MapMode, Coordinates } from '@repo/shared';

export type MapTileLayer = 'google_streets' | 'google_hybrid' | 'osm';
export type LocationSource = 'gps' | 'calibrated';

export interface SavedUserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  source: LocationSource;
  label?: string;
  updatedAt: number;
}

export interface MapLayerConfig {
  id: MapTileLayer;
  nameEn: string;
  nameBn: string;
  url: string;
  maxZoom: number;
  subdomains: string[];
  attribution: string;
}

export const MAP_LAYERS: Record<MapTileLayer, MapLayerConfig> = {
  google_streets: {
    id: 'google_streets',
    nameEn: 'Google Streets',
    nameBn: 'গুগল স্ট্রিট ম্যাপ',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps',
  },
  google_hybrid: {
    id: 'google_hybrid',
    nameEn: 'Satellite Hybrid',
    nameBn: 'স্যাটেলাইট হাইব্রিড',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps Satellite',
  },
  osm: {
    id: 'osm',
    nameEn: 'OpenStreetMap',
    nameBn: 'ওপেন-স্ট্রিট-ম্যাপ',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap contributors',
  },
};

export const STORAGE_KEY_USER_LOCATION = 'danger_zone_user_location';

const defaultLayerEnv =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAP_DEFAULT_LAYER as MapTileLayer) ||
  'google_streets';

interface MapState {
  mode: MapMode;
  center: Coordinates;
  zoom: number;
  activeTileLayer: MapTileLayer;
  userLocation: { lat: number; lng: number } | null;
  userAccuracy: number | null;
  locationSource: LocationSource | null;
  locationLabel: string | null;

  setMode: (mode: MapMode) => void;
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
  setActiveTileLayer: (layer: MapTileLayer) => void;
  setUserLocation: (
    coords: { lat: number; lng: number } | null,
    accuracy?: number | null,
    source?: LocationSource,
    label?: string
  ) => void;
  calibrateUserLocation: (coords: { lat: number; lng: number }, label?: string) => void;
  resetToBrowserGps: () => void;
  loadSavedLocation: () => SavedUserLocation | null;
}

export const useMapStore = create<MapState>((set) => ({
  mode: 'basic',
  center: { lat: 23.685, lng: 90.3563 }, // Center of Bangladesh
  zoom: 7,
  activeTileLayer: MAP_LAYERS[defaultLayerEnv] ? defaultLayerEnv : 'google_streets',
  userLocation: null,
  userAccuracy: null,
  locationSource: null,
  locationLabel: null,

  setMode: (mode) => set({ mode }),
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setActiveTileLayer: (activeTileLayer) => set({ activeTileLayer }),

  setUserLocation: (coords, accuracy = null, source = 'gps', label = undefined) => {
    set({
      userLocation: coords,
      userAccuracy: accuracy ?? null,
      locationSource: coords ? source : null,
      locationLabel: coords ? label || null : null,
    });
  },

  calibrateUserLocation: (coords, label = undefined) => {
    const saved: SavedUserLocation = {
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
      accuracy: 25, // Calibrated locations are pinpointed by the user
      source: 'calibrated',
      label: label || 'Calibrated Location',
      updatedAt: Date.now(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_USER_LOCATION, JSON.stringify(saved));
      } catch (err) {
        console.warn('[useMapStore] Failed to save calibrated location to localStorage:', err);
      }
    }

    set({
      userLocation: coords,
      userAccuracy: 25,
      locationSource: 'calibrated',
      locationLabel: saved.label || null,
      center: coords,
    });
  },

  resetToBrowserGps: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_USER_LOCATION);
      } catch (err) {
        console.warn('[useMapStore] Failed to remove saved location from localStorage:', err);
      }
    }
    set({
      userLocation: null,
      userAccuracy: null,
      locationSource: null,
      locationLabel: null,
    });
  },

  loadSavedLocation: () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER_LOCATION);
      if (!raw) return null;
      const parsed: SavedUserLocation = JSON.parse(raw);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return parsed;
      }
    } catch (err) {
      console.warn('[useMapStore] Failed to parse saved location from localStorage:', err);
    }
    return null;
  },
}));
