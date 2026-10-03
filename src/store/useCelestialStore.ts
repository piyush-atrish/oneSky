import { create } from 'zustand';
import { computeCelestialPositions, CelestialPositions } from '../astro/EphemerisService';
import { downloadIssTle } from '../astro/SatelliteService';

export interface CelestialStoreState {
  readonly positions: CelestialPositions | null;
  readonly lastComputed: number | null;
  readonly issTle: [string, string] | null;
  readonly updatePositions: (date: Date) => void;
  readonly fetchIssTle: () => Promise<void>;
}

export const useCelestialStore = create<CelestialStoreState>()((set) => ({
  positions: null,
  lastComputed: null,
  issTle: null,
  updatePositions: (date) =>
    set({ positions: computeCelestialPositions(date), lastComputed: date.getTime() }),
  fetchIssTle: async () => {
    try {
      const tle = await downloadIssTle();
      set({ issTle: tle });
    } catch {
      set({ issTle: null });
    }
  },
}));