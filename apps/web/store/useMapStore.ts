import { create } from 'zustand';
import { MapMode, Coordinates } from '@repo/shared';

export type MapTileLayer = 'google_streets' | 'google_hybrid' | 'osm';

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

const defaultLayerEnv =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAP_DEFAULT_LAYER as MapTileLayer) ||
  'google_streets';

interface MapState {
  mode: MapMode;
  center: Coordinates;
  zoom: number;
  activeTileLayer: MapTileLayer;
  setMode: (mode: MapMode) => void;
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
  setActiveTileLayer: (layer: MapTileLayer) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mode: 'basic',
  center: { lat: 23.685, lng: 90.3563 }, // Center of Bangladesh
  zoom: 7,
  activeTileLayer: MAP_LAYERS[defaultLayerEnv] ? defaultLayerEnv : 'google_streets',
  setMode: (mode) => set({ mode }),
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setActiveTileLayer: (activeTileLayer) => set({ activeTileLayer }),
}));
