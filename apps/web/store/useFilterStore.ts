import { create } from 'zustand';
import { IncidentSeverity, IncidentCategory } from '@repo/shared';

interface FilterState {
  selectedSeverity: IncidentSeverity | 'all';
  selectedCategories: IncidentCategory[];
  selectedCategory: IncidentCategory | 'all'; // Backward compatibility
  searchQuery: string;
  setSeverity: (severity: IncidentSeverity | 'all') => void;
  setCategories: (categories: IncidentCategory[]) => void;
  toggleCategory: (category: IncidentCategory) => void;
  setCategory: (category: IncidentCategory | 'all') => void;
  clearCategories: () => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedSeverity: 'all',
  selectedCategories: [],
  selectedCategory: 'all',
  searchQuery: '',
  setSeverity: (selectedSeverity) => set({ selectedSeverity }),
  setCategories: (selectedCategories) =>
    set({
      selectedCategories,
      selectedCategory:
        selectedCategories.length === 1
          ? selectedCategories[0]
          : selectedCategories.length === 0
          ? 'all'
          : selectedCategories[0],
    }),
  toggleCategory: (category) =>
    set((state) => {
      const exists = state.selectedCategories.includes(category);
      const updated = exists
        ? state.selectedCategories.filter((c) => c !== category)
        : [...state.selectedCategories, category];
      return {
        selectedCategories: updated,
        selectedCategory:
          updated.length === 1 ? updated[0] : updated.length === 0 ? 'all' : updated[0],
      };
    }),
  setCategory: (category) =>
    set({
      selectedCategory: category,
      selectedCategories: category === 'all' ? [] : [category],
    }),
  clearCategories: () => set({ selectedCategories: [], selectedCategory: 'all' }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () =>
    set({
      selectedSeverity: 'all',
      selectedCategories: [],
      selectedCategory: 'all',
      searchQuery: '',
    }),
}));
