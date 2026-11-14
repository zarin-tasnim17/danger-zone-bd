export interface TargetCommand {
  lat: number;
  lng: number;
  zoom?: number;
  id: number;
}

import { create } from 'zustand';
import {
  MapMode,
  Coordinates,
  GeolocationAccuracyTier,
  classifyGeolocationAccuracy,
  sanitizeAccuracy,
  formatCoordinate,
} from '@repo/shared';

export type MapTileLayer = 'google_streets' | 'google_hybrid' | 'osm';
export type LocationSource = 'gps' | 'calibrated';
export type AcquisitionStage =
  | 'idle'
  | 'acquiring'
  | 'refining'
  | 'success'
  | 'timeout'
  | 'error';

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

export interface MapState {
  mode: MapMode;
  center: Coordinates;
  zoom: number;
  activeTileLayer: MapTileLayer;
  userLocation: { lat: number; lng: number } | null;
  userAccuracy: number | null;
  locationSource: LocationSource | null;
  locationLabel: string | null;
  isCalibrationModalOpen: boolean;
  isLowAccuracy: boolean;
  dismissedCalibrationBanner: boolean;
  isSosModalOpen: boolean;
  targetCommand: TargetCommand | null;

  // Progressive Refinement & Accuracy States
  isLocating: boolean;
  acquisitionStage: AcquisitionStage;
  userAccuracyTier: GeolocationAccuracyTier | null;
  locationTimestamp: number | null;
  activeRequestId: number;
  activeWatchId: number | null;

  setMode: (mode: MapMode) => void;
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
  flyTo: (coords: Coordinates, zoom?: number) => void;
  setActiveTileLayer: (layer: MapTileLayer) => void;
  setIsLocating: (isLocating: boolean) => void;
  setAcquisitionStage: (stage: AcquisitionStage) => void;
  setActiveWatchId: (id: number | null) => void;
  incrementRequestId: () => number;
  setUserLocation: (
    coords: { lat: number; lng: number } | null,
    accuracy?: number | null,
    source?: LocationSource,
    label?: string,
    timestamp?: number | null
  ) => void;
  calibrateUserLocation: (coords: { lat: number; lng: number }, label?: string) => void;
  resetToBrowserGps: () => void;
  loadSavedLocation: () => SavedUserLocation | null;
  openCalibrationModal: () => void;
  closeCalibrationModal: () => void;
  openSosModal: () => void;
  closeSosModal: () => void;
  setIsLowAccuracy: (isLow: boolean) => void;
  setDismissedCalibrationBanner: (dismissed: boolean) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  mode: 'basic',
  center: { lat: 23.685, lng: 90.3563 }, // Center of Bangladesh
  zoom: 7,
  activeTileLayer: MAP_LAYERS[defaultLayerEnv] ? defaultLayerEnv : 'google_streets',
  userLocation: null,
  userAccuracy: null,
  userAccuracyTier: null,
  locationSource: null,
  locationLabel: null,
  locationTimestamp: null,
  isLocating: false,
  acquisitionStage: 'idle',
  activeRequestId: 0,
  activeWatchId: null,
  isCalibrationModalOpen: false,
  isLowAccuracy: false,
  dismissedCalibrationBanner: false,
  isSosModalOpen: false,
  targetCommand: null,

  setMode: (mode) => set({ mode }),
  setCenter: (center) =>
    set((state) => ({
      center,
      targetCommand: {
        lat: center.lat,
        lng: center.lng,
        zoom: state.zoom,
        id: Date.now() + Math.random(),
      },
    })),
  setZoom: (zoom) =>
    set((state) => ({
      zoom,
      targetCommand: {
        lat: state.center.lat,
        lng: state.center.lng,
        zoom,
        id: Date.now() + Math.random(),
      },
    })),
  flyTo: (coords, zoom) =>
    set((state) => ({
      center: coords,
      zoom: zoom ?? state.zoom,
      targetCommand: {
        lat: coords.lat,
        lng: coords.lng,
        zoom: zoom ?? state.zoom,
        id: Date.now() + Math.random(),
      },
    })),
  setActiveTileLayer: (activeTileLayer) => set({ activeTileLayer }),
  setIsLocating: (isLocating) => set({ isLocating }),
  setAcquisitionStage: (acquisitionStage) => set({ acquisitionStage }),
  setActiveWatchId: (activeWatchId) => set({ activeWatchId }),
  incrementRequestId: () => {
    let nextId = 0;
    set((state) => {
      nextId = state.activeRequestId + 1;
      return { activeRequestId: nextId };
    });
    return nextId;
  },
  openCalibrationModal: () => set({ isCalibrationModalOpen: true }),
  closeCalibrationModal: () => set({ isCalibrationModalOpen: false }),
  openSosModal: () => set({ isSosModalOpen: true }),
  closeSosModal: () => set({ isSosModalOpen: false }),
  setIsLowAccuracy: (isLowAccuracy) => set({ isLowAccuracy }),
  setDismissedCalibrationBanner: (dismissedCalibrationBanner) => set({ dismissedCalibrationBanner }),

  setUserLocation: (coords, accuracy = null, source = 'gps', label = undefined, timestamp = null) => {
    if (!coords) {
      set({
        userLocation: null,
        userAccuracy: null,
        userAccuracyTier: null,
        locationSource: null,
        locationLabel: null,
        locationTimestamp: null,
        isLowAccuracy: false,
      });
      return;
    }

    const currentSource = get().locationSource;
    // If locationSource === 'calibrated' and incoming source === 'gps', DO NOT overwrite unless explicit forced reset
    if (currentSource === 'calibrated' && source === 'gps') {
      return;
    }

    const tier = classifyGeolocationAccuracy(accuracy);
    const isLow =
      tier === 'LOW' ||
      tier === 'VERY_LOW' ||
      tier === 'EXTREMELY_POOR';

    set({
      userLocation: {
        lat: formatCoordinate(coords.lat),
        lng: formatCoordinate(coords.lng),
      },
      userAccuracy: sanitizeAccuracy(accuracy),
      userAccuracyTier: tier,
      locationSource: source,
      locationLabel: label || null,
      locationTimestamp: timestamp ?? Date.now(),
      isLowAccuracy: isLow,
    });
  },

  calibrateUserLocation: (coords, label = undefined) => {
    const currentWatchId = get().activeWatchId;
    if (typeof navigator !== 'undefined' && navigator.geolocation && currentWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(currentWatchId);
      } catch (err) {
        console.warn('[useMapStore] Failed to clear geolocation watch upon calibration:', err);
      }
    }

    const formattedCoords = {
      lat: formatCoordinate(coords.lat),
      lng: formatCoordinate(coords.lng),
    };

    const saved: SavedUserLocation = {
      lat: formattedCoords.lat,
      lng: formattedCoords.lng,
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

    set((state) => ({
      activeRequestId: state.activeRequestId + 1,
      activeWatchId: null,
      isLocating: false,
      acquisitionStage: 'idle',
      userLocation: formattedCoords,
      userAccuracy: 25,
      userAccuracyTier: 'GOOD',
      locationSource: 'calibrated',
      locationLabel: saved.label || null,
      locationTimestamp: Date.now(),
      isLowAccuracy: false,
      dismissedCalibrationBanner: false,
      center: formattedCoords,
    }));
  },

  resetToBrowserGps: () => {
    const currentWatchId = get().activeWatchId;
    if (typeof navigator !== 'undefined' && navigator.geolocation && currentWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(currentWatchId);
      } catch (err) {
        console.warn('[useMapStore] Failed to clear geolocation watch upon reset:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_USER_LOCATION);
      } catch (err) {
        console.warn('[useMapStore] Failed to remove saved location from localStorage:', err);
      }
    }
    set((state) => ({
      activeRequestId: state.activeRequestId + 1,
      activeWatchId: null,
      isLocating: false,
      acquisitionStage: 'idle',
      userLocation: null,
      userAccuracy: null,
      userAccuracyTier: null,
      locationSource: null,
      locationLabel: null,
      locationTimestamp: null,
      isLowAccuracy: false,
      dismissedCalibrationBanner: false,
    }));
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
