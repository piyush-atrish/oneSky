import { create } from 'zustand';
import { computeCelestialPositions, CelestialPositions } from '../astro/EphemerisService';
import { downloadIssTle } from '../astro/SatelliteService';
import { createTleLoader } from '../astro/TleCache';
import { fileTleStorage } from '../astro/TleFileStorage';

/** One loader for the whole app: it reads the saved copy first and follows CelesTrak's usage policy. */
const tleLoader = createTleLoader({ storage: fileTleStorage, fetcher: downloadIssTle, now: Date.now });

export type TleStatus = 'idle' | 'loading' | 'retrying' | 'ok' | 'failed';

export interface CelestialStoreState {
  readonly positions: CelestialPositions | null;
  readonly lastComputed: number | null;
  readonly issTle: [string, string] | null;
  /** When the ISS orbit data in `issTle` was downloaded (ms since epoch), or null. */
  readonly tleFetchedAt: number | null;
  readonly tleStatus: TleStatus;
  readonly updatePositions: (date: Date) => void;
  readonly fetchIssTle: () => Promise<void>;
}

export const useCelestialStore = create<CelestialStoreState>()((set) => ({
  positions: null,
  lastComputed: null,
  issTle: null,
  tleFetchedAt: null,
  tleStatus: 'idle',
  updatePositions: (date) =>
    set({ positions: computeCelestialPositions(date), lastComputed: date.getTime() }),
  fetchIssTle: async () => {
    set((s) => ({ tleStatus: s.tleStatus === 'failed' || s.tleStatus === 'retrying' ? 'retrying' : 'loading' }));
    const { tle, fetchedAt } = await tleLoader.load();
    set(tle ? { issTle: tle, tleFetchedAt: fetchedAt, tleStatus: 'ok' } : { issTle: null, tleFetchedAt: null, tleStatus: 'failed' });
  },
}));