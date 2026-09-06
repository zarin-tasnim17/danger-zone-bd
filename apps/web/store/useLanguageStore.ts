import { create } from 'zustand';
import { Language } from '@repo/shared';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),
  toggleLanguage: () =>
    set((state) => ({ language: state.language === 'en' ? 'bn' : 'en' })),
}));
