import { create } from 'zustand';
import { CONSTELLATION_LINES } from '../data/constellationLines';
import { STAR_CATALOG } from '../data/starCatalog';
import { useCelestialStore } from './useCelestialStore';
import { useLocationStore } from './useLocationStore';

/** Ceiling for the engine phase, counted from the moment the entrance animation finishes. */
export const ENGINE_TIMEOUT_MS = 5000;
/** Absolute ceiling from app start, so a loading screen that never reports back can't strand the app. */
export const ABSOLUTE_TIMEOUT_MS = 10000;

export type ReadyGate = 'fonts' | 'catalog' | 'ephemeris' | 'location' | 'scene';
type Gates = Readonly<Record<ReadyGate, boolean>>;

interface Timing {
  readonly entranceDone: boolean;
  readonly timedOut: boolean;
}

export interface AppReadyState extends Timing {
  readonly started: boolean;
  /** True once heavy init has begun; the 3D scene may mount from this point on, not before. */
  readonly engineStarted: boolean;
  /** Per-gate status. Stays inspectable after a timeout so fallback UI can tell what failed. */
  readonly gates: Gates;
  readonly isReady: boolean;
  /** Idempotent. Arms the absolute ceiling only; does no heavy work. */
  readonly start: () => void;
  /** Called by the loading screen when its entrance animation has completed. Starts the engine phase. */
  readonly entranceFinished: () => void;
  readonly completeGate: (gate: ReadyGate) => void;
}

const derive = (gates: Gates, { entranceDone, timedOut }: Timing): boolean =>
  entranceDone && (timedOut || Object.values(gates).every(Boolean));

export const useAppReadyStore = create<AppReadyState>()((set, get) => {
  const patch = (next: Partial<Timing> & { gates?: Gates }) =>
    set((s) => {
      const gates = next.gates ?? s.gates;
      const timing = { entranceDone: next.entranceDone ?? s.entranceDone, timedOut: next.timedOut ?? s.timedOut };
      return { ...timing, gates, isReady: derive(gates, timing) };
    });

  const completeGate = (gate: ReadyGate) => {
    if (!get().gates[gate]) patch({ gates: { ...get().gates, [gate]: true } });
  };

  /** Heavy init, run once and only after the entrance animation has finished. */
  const startEngine = () => {
    if (get().engineStarted) return;
    setTimeout(() => patch({ timedOut: true }), ENGINE_TIMEOUT_MS);

    if (STAR_CATALOG.length > 0 && CONSTELLATION_LINES.length > 0) completeGate('catalog');

    // Ephemeris runs synchronously before the scene mounts, so it never competes with shader compilation.
    try {
      useCelestialStore.getState().updatePositions(new Date());
      completeGate('ephemeris');
    } catch {
      // Gate stays closed; the timeout releases the app and fallback UI can read `gates`.
    }

    set({ engineStarted: true }); // App mounts the 3D scene from here

    // Location never rejects; denied or no fix still "settles". The TLE fetch is deliberately absent:
    // SatelliteLayer starts it on mount and nothing waits on it.
    void useLocationStore.getState().fetchLocation().finally(() => completeGate('location'));
  };

  return {
    started: false,
    engineStarted: false,
    gates: { fonts: false, catalog: false, ephemeris: false, location: false, scene: false },
    entranceDone: false,
    timedOut: false,
    isReady: false,
    completeGate,
    start: () => {
      if (get().started) return;
      set({ started: true });
      setTimeout(() => {
        patch({ entranceDone: true, timedOut: true });
        startEngine();
      }, ABSOLUTE_TIMEOUT_MS);
    },
    entranceFinished: () => {
      if (get().entranceDone) return;
      patch({ entranceDone: true });
      startEngine();
    },
  };
});