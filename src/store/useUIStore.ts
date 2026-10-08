import { create } from 'zustand';

/** Overlays that can be open. Only one at a time, so overlapping panels are unrepresentable. */
export type Panel = 'fab' | 'drawer' | 'location' | 'credits';

export interface UIStoreState {
  readonly showConstellations: boolean;
  readonly showSolarSystem: boolean;
  readonly showSatellites: boolean;
  readonly showTerrain: boolean;
  readonly panel: Panel | null;
  readonly toggleConstellations: () => void;
  readonly toggleSolarSystem: () => void;
  readonly toggleSatellites: () => void;
  readonly toggleTerrain: () => void;
  readonly openPanel: (panel: Panel) => void;
  readonly closePanel: () => void;
  readonly togglePanel: (panel: Panel) => void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  showConstellations: true,
  showSolarSystem: true,
  showSatellites: true,
  showTerrain: true,
  panel: null,
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleSolarSystem: () => set((s) => ({ showSolarSystem: !s.showSolarSystem })),
  toggleSatellites: () => set((s) => ({ showSatellites: !s.showSatellites })),
  toggleTerrain: () => set((s) => ({ showTerrain: !s.showTerrain })),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
}));