import { create } from 'zustand';

export interface UIStoreState {
  readonly showConstellations: boolean;
  readonly showCredits: boolean;
  readonly toggleConstellations: () => void;
  readonly toggleCredits: () => void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  showConstellations: true,
  showCredits: false,
  toggleConstellations: () => set((state) => ({ showConstellations: !state.showConstellations })),
  toggleCredits: () => set((state) => ({ showCredits: !state.showCredits })),
}));