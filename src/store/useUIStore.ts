import { create } from 'zustand';

export interface UIStoreState {
  readonly showConstellations: boolean;
  readonly toggleConstellations: () => void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  showConstellations: true,
  toggleConstellations: () => set((state) => ({ showConstellations: !state.showConstellations })),
}));
