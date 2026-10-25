/**
 * useCameraStore.ts
 *
 * Camera navigation state (azimuth/elevation/fov), decoupled from React's
 * render cycle on purpose: a pan/pinch gesture can fire dozens of times a
 * second, and re-rendering the component tree on every one of those
 * would be wasted work when nothing here needs to trigger a re-render —
 * `CameraManager.tsx` reads this store imperatively, inside `useFrame`,
 * via `getState()`, not via the reactive `useCameraStore()` hook.
 */

import { create } from 'zustand';

const TWO_PI = Math.PI * 2;

const MIN_ELEVATION_RAD = -1.3;

/** Elevation ceiling: just short of the zenith, matching the original architecture doc's gimbal-lock guard. */
const MAX_ELEVATION_RAD = 1.5;

/** Narrowest allowed field of view — most "zoomed in". */
export const MIN_FOV_DEG = 10;

/** Widest allowed field of view — most "zoomed out". */
export const MAX_FOV_DEG = 75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface CameraStoreState {
  /** Horizontal look angle, in radians, wrapped to `[0, 2π)`. */
  readonly azimuth: number;
  /** Vertical look angle, in radians, clamped to `[MIN_ELEVATION_RAD, MAX_ELEVATION_RAD]`. */
  readonly elevation: number;
  /** Camera field of view, in degrees, clamped to `[MIN_FOV_DEG, MAX_FOV_DEG]`. */
  readonly fov: number;
  /** Applies a drag-gesture delta to azimuth/elevation, wrapping and clamping as it goes. */
  readonly pan: (deltaAzimuth: number, deltaElevation: number) => void;
  /** Applies a pinch-gesture delta to fov, clamping as it goes. */
  readonly zoom: (deltaFov: number) => void;
  /** Sets the fov outright, clamped. Prefer this for gestures: it cannot drift out of step with the store. */
  readonly setFov: (fov: number) => void;
}

export const useCameraStore = create<CameraStoreState>()((set) => ({
  azimuth: 0,
  elevation: 0,
  fov: 45,

  pan: (deltaAzimuth, deltaElevation) =>
    set((state) => ({
      // Floor-mod, not `%`: JS's `%` keeps the sign of its left operand,
      // so a plain `(azimuth + delta) % TWO_PI` can go negative when
      // panning past 0 the "other way" — the double-mod below always
      // lands in [0, TWO_PI), which is what keeps this stable over an
      // unbounded number of rotations instead of drifting in precision
      // (or sign) the longer a session runs.
      azimuth: (((state.azimuth + deltaAzimuth) % TWO_PI) + TWO_PI) % TWO_PI,
      elevation: clamp(state.elevation + deltaElevation, MIN_ELEVATION_RAD, MAX_ELEVATION_RAD),
    })),

  zoom: (deltaFov) =>
    set((state) => ({
      fov: clamp(state.fov + deltaFov, MIN_FOV_DEG, MAX_FOV_DEG),
    })),

  setFov: (fov) =>
    set((state) => {
      const next = clamp(fov, MIN_FOV_DEG, MAX_FOV_DEG);
      return next === state.fov ? state : { fov: next }; // same state object: subscribers are not notified
    }),
}));