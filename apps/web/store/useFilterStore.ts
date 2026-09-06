import { create } from 'zustand';
import { IncidentSeverity, IncidentCategory } from '@repo/shared';

interface FilterState {
  selectedSeverity: IncidentSeverity | 'all';
  selectedCategory: IncidentCategory | 'all';
  searchQuery: string;
  setSeverity: (severity: IncidentSeverity | 'all') => void;
  setCategory: (category: IncidentCategory | 'all') => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedSeverity: 'all',
  selectedCategory: 'all',
  searchQuery: '',
  setSeverity: (selectedSeverity) => set({ selectedSeverity }),
  setCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () =>
    set({ selectedSeverity: 'all', selectedCategory: 'all', searchQuery: '' }),
}));
