/**
 * Where the N / E / S / W markers go on screen. Pure: no React, no three.js, so it can run in a Reanimated
 * worklet on the UI thread and be unit-tested directly.
 *
 * The sky math treats +Y as north (the north celestial pole lands on +Y at every latitude) and +X as east.
 */

export interface CompassPoint {
  readonly label: 'N' | 'E' | 'S' | 'W';
  readonly dx: number;
  readonly dy: number;
}

export const COMPASS_POINTS: readonly CompassPoint[] = [
  { label: 'N', dx: 0, dy: 1 },
  { label: 'E', dx: 1, dy: 0 },
  { label: 'S', dx: 0, dy: -1 },
  { label: 'W', dx: -1, dy: 0 },
];

// Marker box, in dp: the letter, a small gap, then a tick whose foot rests on the horizon.
export const LETTER_HEIGHT = 28;
export const TICK_HEIGHT = 8;
export const MARKER_GAP = 2;
export const MARKER_HEIGHT = LETTER_HEIGHT + MARKER_GAP + TICK_HEIGHT;
export const MARKER_WIDTH = 32;

const EDGE_FADE_PX = 48; // fade over the last stretch before a side edge
const TOP_FADE_PX = 40; // fade as the horizon nears the top of the screen
const FOOT_FADE_PX = 160; // how far the horizon may sink below the foot of the view before the markers are gone

/** Frame layout: column-major projection*view (16 numbers), then viewport width and height. */
export const COMPASS_FRAME_LENGTH = 18;

/**
 * Unit directions (three numbers each) of the points where the ground meets the sky, in N, E, S, W order.
 * The ground disk sits `groundOffset` below the camera and is clipped by the far plane, so its visible edge is
 * at a tiny angle below true horizontal; resting on that edge is what keeps the markers off the terrain.
 */
export function compassAnchors(far: number, groundOffset: number): number[] {
  const out: number[] = [];
  for (const { dx, dy } of COMPASS_POINTS) {
    const x = dx * far;
    const y = dy * far;
    const z = -groundOffset;
    const length = Math.hypot(x, y, z);
    out.push(x / length, y / length, z / length);
  }
  return out;
}

export interface CompassPlacement {
  /** Horizontal center of the marker, in dp. */
  readonly x: number;
  /** Where the marker's foot (the bottom of its tick) rests, in dp from the top. */
  readonly y: number;
  readonly opacity: number;
}

const clamp01 = (n: number): number => {
  'worklet';
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

/**
 * Screen placement of one marker, or null when it is behind the camera or not yet known.
 *
 * The marker rests on the horizon. If the horizon sinks below `footY` (the camera tips up), the marker rides
 * along the foot of the view and fades out as the horizon moves away; if the horizon leaves through the top
 * (the camera tips down), it fades out too. It never sits lower than the horizon, so it cannot be covered
 * by the ground, and it fades near the side edges instead of being cut off.
 */
export function placeCompassMarker(
  frame: readonly number[],
  ax: number | undefined,
  ay: number,
  az: number,
  footY: number,
): CompassPlacement | null {
  'worklet';
  if (frame.length < COMPASS_FRAME_LENGTH || ax === undefined) return null;

  const w = frame[3] * ax + frame[7] * ay + frame[11] * az + frame[15];
  if (w <= 0) return null;
  const ndcX = (frame[0] * ax + frame[4] * ay + frame[8] * az + frame[12]) / w;
  const ndcY = (frame[1] * ax + frame[5] * ay + frame[9] * az + frame[13]) / w;
  const width = frame[16];
  const height = frame[17];

  const x = ((ndcX + 1) / 2) * width;
  const horizonY = ((1 - ndcY) / 2) * height;
  const y = horizonY < footY ? horizonY : footY;

  const sunk = clamp01(1 - (horizonY - y) / FOOT_FADE_PX);
  const top = clamp01((y - MARKER_HEIGHT) / TOP_FADE_PX);
  const edge = clamp01((x < width - x ? x : width - x) / EDGE_FADE_PX);
  return { x, y, opacity: sunk * top * edge };
}