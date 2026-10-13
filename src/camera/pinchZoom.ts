/**
 * Pinch-to-zoom as a small state machine, independent of any gesture library.
 *
 * Gesture libraries report pinch `scale` relative to when the pinch began, and deliver "started" and "updated"
 * events through separate channels with no ordering guarantee. So nothing here trusts a value cached by an
 * earlier event:
 *  - A pinch's baseline FOV is read from the live camera at the moment the pinch is known to have started.
 *  - The baseline `scale` is the first scale seen, so whatever the recognizer had accumulated before it
 *    activated can never turn into a jump.
 *  - Updates arriving while no pinch is active (a "started" event that is late or lost) are held back, and
 *    adopted as a new pinch after a few arrive in a row, rather than being applied against stale values.
 *  - Limits are enforced by moving the baseline, not by remembering an unclamped target, so reversing at a
 *    limit responds at once.
 */

export interface PinchZoomOptions {
  readonly min: number;
  readonly max: number;
  /** The camera's current field of view, read fresh at the start of every pinch. */
  readonly readFov: () => number;
  /** Called when an update arrives with no active pinch (useful to spot event reordering in development). */
  readonly onOrphan?: () => void;
}

export interface PinchZoom {
  /** The pinch became active. */
  start(): void;
  /** The pinch finished or was cancelled. */
  end(): void;
  /** Feeds a cumulative scale; returns the field of view to apply, or null if there is nothing to apply. */
  update(scale: number): number | null;
}

/** Updates without an active pinch that we wait for before assuming the "started" event was lost. */
const ADOPT_AFTER = 3;

export function createPinchZoom({ min, max, readFov, onOrphan }: PinchZoomOptions): PinchZoom {
  let active = false;
  let startFov = 0;
  let scaleBase = 0; // 0 until the first update of this pinch
  let orphans = 0;

  const begin = () => {
    active = true;
    startFov = readFov();
    scaleBase = 0;
    orphans = 0;
  };

  return {
    start: begin,

    end() {
      active = false;
      orphans = 0;
    },

    update(scale) {
      if (!(scale > 0) || !Number.isFinite(scale)) return null;

      if (!active) {
        onOrphan?.();
        if (++orphans < ADOPT_AFTER) return null;
        begin(); // "started" never came: treat this run of updates as a new pinch
      }

      if (scaleBase === 0) {
        scaleBase = scale; // first update: establishes the baseline, changes nothing
        return null;
      }

      let fov = startFov / (scale / scaleBase);
      if (fov < min || fov > max) {
        fov = fov < min ? min : max;
        scaleBase = (scale * fov) / startFov; // pin the baseline to the limit so reversing responds immediately
      }
      return fov;
    },
  };
}