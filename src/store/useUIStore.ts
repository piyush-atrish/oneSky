import { create } from 'zustand';

export interface UIStoreState {
  readonly showConstellations: boolean;
  readonly showCredits: boolean;
  readonly showSolarSystem: boolean;
  readonly showSatellites: boolean;
  readonly showTerrain: boolean;
  readonly toggleConstellations: () => void;
  readonly toggleCredits: () => void;
  readonly toggleSolarSystem: () => void;
  readonly toggleSatellites: () => void;
  readonly toggleTerrain: () => void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  showConstellations: true,
  showCredits: false,
  showSolarSystem: true,
  showSatellites: true,
  showTerrain: true,
  toggleConstellations: () => set((state) => ({ showConstellations: !state.showConstellations })),
  toggleCredits: () => set((state) => ({ showCredits: !state.showCredits })),
  toggleSolarSystem: () => set((state) => ({ showSolarSystem: !state.showSolarSystem })),
  toggleSatellites: () => set((state) => ({ showSatellites: !state.showSatellites })),
  toggleTerrain: () => set((state) => ({ showTerrain: !state.showTerrain })),
}));