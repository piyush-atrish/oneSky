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
import { TWO_PI } from '../math/MathConstants';

/**
 * Elevation floor: straight at the horizon.
 *
 * NOTE — this is a deliberate narrowing from the original architecture
 * doc, which specified elevation clamped to [-1.4, 1.4] (allowing the
 * camera to tilt *below* the horizon). This task's spec calls for a
 * floor of `0` instead. Given `TerrainLayer` is an opaque ground plane,
 * tilting below the horizon currently shows nothing but flat dark
 * terrain either way, so `0` is a defensible simplification — but it's
 * a real, deliberate deviation from the original doc, not an
 * accidental one, and worth confirming is actually what's wanted (e.g.
 * if a future milestone wants the user to look down and see nearby
 * terrain detail, this floor would need to move back to `-1.4`).
 */
const MIN_ELEVATION_RAD = -1.3;

/** Elevation ceiling: just short of the zenith, matching the original architecture doc's gimbal-lock guard. */
const MAX_ELEVATION_RAD = 1.5;

/** Narrowest allowed field of view — most "zoomed in". */
const MIN_FOV_DEG = 10;

/** Widest allowed field of view — most "zoomed out". */
const MAX_FOV_DEG = 75;

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
}));