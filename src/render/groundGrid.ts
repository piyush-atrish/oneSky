/**
 * The terrain's look: a dark ground with a polar grid (rings and spokes) drawn by the fragment shader.
 *
 * Why a shader and not line geometry: one draw call on the existing ground disk, no z-fighting with it, and
 * lines whose width is measured in screen pixels via `fwidth`, so they stay crisp at every zoom and dissolve
 * where they would otherwise shimmer near the horizon. three.js (WebGL2 only) turns this legacy-style source
 * (`varying`, `gl_FragColor`) into GLSL ES 3.00, like the star shader, where `fwidth` is built in.
 *
 * Lengths are in "eye heights": the camera sits GROUND_OFFSET above the ground, and a perspective grid depends
 * only on spacing relative to that height. Sizing the grid in eye heights gives a floor that reads as a
 * floor without moving the ground, which would let stars bleed below the horizon.
 */

export const GROUND_VERTEX_SHADER = /* glsl */ `
varying vec2 vGround;

void main() {
  vGround = position.xy; // the disk lies flat in world XY, unrotated: this is the world position, perspective-correct
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GROUND_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uNear;      // ground color under the viewer
uniform vec3 uFar;       // ground color toward the horizon
uniform vec3 uCream;     // grid color
uniform vec3 uAmber;     // cardinal-line color
uniform float uRingStep; // world units between rings
uniform float uWidthPx;  // base line width, device pixels
uniform float uFadeNear; // lines are fully visible inside this distance...
uniform float uFadeFar;  // ...and gone beyond this one
uniform float uMinor;    // opacity of minor rings and spokes
uniform float uMajor;    // opacity of major rings and 30-degree spokes
uniform float uCardinal; // opacity of the E, S and W spokes
uniform float uNorth;    // opacity of the N spoke

varying vec2 vGround;

const float TAU = 6.28318530718;
const float SPOKES = 72.0;             // every 5 degrees; must be even so the atan seam falls on a cell boundary
const float RINGS_PER_MAJOR = 5.0;
const float SPOKES_PER_MEDIUM = 6.0;   // every 30 degrees
const float SPOKES_PER_CARDINAL = 18.0; // every 90 degrees

// Coverage of the line at integer values of a cell coordinate; "aa" is that coordinate's change per pixel.
float lineCoverage(float coord, float aa, float widthPx) {
  float px = abs(fract(coord - 0.5) - 0.5) / max(aa, 1e-6); // pixels to the nearest line
  float cover = 1.0 - smoothstep(widthPx * 0.5 - 0.5, widthPx * 0.5 + 0.5, px);
  // Lines only read as lines while the gap between them is several line-widths wide. Closer than that they
  // merge into a haze and shimmer, so they dissolve instead: clean ground at the horizon, no banding.
  float cellPx = 1.0 / max(aa, 1e-6);
  return cover * smoothstep(widthPx * 4.0, widthPx * 12.0, cellPx);
}

void main() {
  float r = length(vGround);

  // Rings. Majors reuse the minor derivative: dividing a coordinate divides its derivative.
  float ring = r / uRingStep;
  float ringAa = fwidth(ring);
  float ringMinor = lineCoverage(ring, ringAa, uWidthPx);
  float ringMajor = lineCoverage(ring / RINGS_PER_MAJOR, ringAa / RINGS_PER_MAJOR, uWidthPx * 1.4);

  // Spokes. atan jumps at the -X axis; the fract(+0.5) twin is continuous there, so the smaller derivative is the true one.
  float spoke = atan(vGround.y, vGround.x) * (SPOKES / TAU);
  float spokeAa = min(fwidth(spoke), fwidth(fract(spoke + 0.5)));
  float spokeMinor = lineCoverage(spoke, spokeAa, uWidthPx);
  float spokeMedium = lineCoverage(spoke / SPOKES_PER_MEDIUM, spokeAa / SPOKES_PER_MEDIUM, uWidthPx * 1.4);
  float spokeCardinal = lineCoverage(spoke / SPOKES_PER_CARDINAL, spokeAa / SPOKES_PER_CARDINAL, uWidthPx * 1.6);
  float northCoord = spoke / SPOKES - 0.25; // an integer exactly on the +Y axis (north)
  float spokeNorth = lineCoverage(northCoord, spokeAa / SPOKES, uWidthPx * 1.6);

  // Spokes crowd together under the viewer: let them dissolve there. All lines dissolve toward the horizon.
  float hub = smoothstep(uRingStep * 0.5, uRingStep * 2.0, r);
  float reach = 1.0 - smoothstep(uFadeNear, uFadeFar, r);

  float cream = max(uMinor * max(ringMinor, spokeMinor * hub), uMajor * max(ringMajor, spokeMedium * hub));
  float amber = max(uCardinal * spokeCardinal, uNorth * spokeNorth) * hub;
  cream *= 1.0 - min(1.0, amber / max(uCardinal, 1e-3)); // a cardinal line is amber, not amber over cream

  vec3 color = mix(uNear, uFar, smoothstep(0.0, uFadeFar, r));
  color = mix(color, uCream, cream * reach);
  color = mix(color, uAmber, amber * reach);

  gl_FragColor = vec4(color, 1.0);
}
`;

/** sRGB hex to the raw 0..1 triple the shader writes out (like the star shader, no color-space conversion). */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Everything tunable about the look. Lengths are in eye heights unless noted; opacities are 0..1. */
export const GROUND_STYLE = {
  near: '#0b1c10',
  far: '#1c4129', // lighter toward the horizon, so the ground reads against the black sky
  cream: '#E0E0CE', // Colors.textPrimary
  amber: '#F2AF29', // Colors.primaryAccent
  ringStep: 2, // eye heights between rings
  fadeNear: 60, // world units; the camera far plane is 100
  fadeFar: 92,
  lineWidthDp: 0.9,
  minor: 0.13,
  major: 0.24,
  cardinal: 0.5,
  north: 0.72,
} as const;

export interface GroundUniforms {
  [name: string]: { value: number | [number, number, number] };
  uNear: { value: [number, number, number] };
  uFar: { value: [number, number, number] };
  uCream: { value: [number, number, number] };
  uAmber: { value: [number, number, number] };
  uRingStep: { value: number };
  uWidthPx: { value: number };
  uFadeNear: { value: number };
  uFadeFar: { value: number };
  uMinor: { value: number };
  uMajor: { value: number };
  uCardinal: { value: number };
  uNorth: { value: number };
}

export function createGroundUniforms(groundOffset: number, pixelRatio: number): GroundUniforms {
  const s = GROUND_STYLE;
  return {
    uNear: { value: hexToRgb(s.near) },
    uFar: { value: hexToRgb(s.far) },
    uCream: { value: hexToRgb(s.cream) },
    uAmber: { value: hexToRgb(s.amber) },
    uRingStep: { value: s.ringStep * groundOffset },
    uWidthPx: { value: s.lineWidthDp * pixelRatio },
    uFadeNear: { value: s.fadeNear },
    uFadeFar: { value: s.fadeFar },
    uMinor: { value: s.minor },
    uMajor: { value: s.major },
    uCardinal: { value: s.cardinal },
    uNorth: { value: s.north },
  };
}