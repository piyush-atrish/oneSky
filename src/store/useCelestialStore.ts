import { create } from 'zustand';
import { computeCelestialPositions, CelestialPositions } from '../astro/EphemerisService';
import { downloadIssTle } from '../astro/SatelliteService';

export type TleStatus = 'idle' | 'loading' | 'retrying' | 'ok' | 'failed';

export interface CelestialStoreState {
  readonly positions: CelestialPositions | null;
  readonly lastComputed: number | null;
  readonly issTle: [string, string] | null;
  readonly tleStatus: TleStatus;
  readonly updatePositions: (date: Date) => void;
  readonly fetchIssTle: () => Promise<void>;
}

export const useCelestialStore = create<CelestialStoreState>()((set) => ({
  positions: null,
  lastComputed: null,
  issTle: null,
  tleStatus: 'idle',
  updatePositions: (date) =>
    set({ positions: computeCelestialPositions(date), lastComputed: date.getTime() }),
  fetchIssTle: async () => {
    set((s) => ({ tleStatus: s.tleStatus === 'failed' || s.tleStatus === 'retrying' ? 'retrying' : 'loading' }));
    try {
      const tle = await downloadIssTle();
      set({ issTle: tle, tleStatus: 'ok' });
    } catch {
      set({ issTle: null, tleStatus: 'failed' });
    }
  },
}));