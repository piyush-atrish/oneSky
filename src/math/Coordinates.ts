/**
 * Coordinates.ts
 *
 * Converts between equatorial coordinates (right ascension / declination
 * — how every star and DSO in the catalog is specified) and Cartesian
 * unit vectors on the celestial sphere.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A COORDINATE-CONVENTION CONFLICT, AND HOW THIS FILE RESOLVES IT
 * ─────────────────────────────────────────────────────────────────────
 * Astronomical convention (and stardroid-v2's own `RaDec.toGeocentricVector`,
 * which {@link raDecToGeocentricVector} below is a byte-for-byte port of)
 * puts the north celestial pole — dec = +90° — on the +Z axis:
 *
 *     x = cos(ra)·cos(dec)      (ra = 0°,  dec = 0°  →  +X)
 *     y = sin(ra)·cos(dec)      (ra = 90°, dec = 0°  →  +Y)
 *     z = sin(dec)              (dec = 90°           →  +Z)
 *
 * Three.js's *default* scene convention puts world-up on +Y instead
 * (`camera.up` and `Object3D.DEFAULT_UP` both default to `(0,1,0)`), with
 * the camera looking down -Z. Feed this module's output straight into a
 * stock Three.js scene and the celestial pole ends up sideways, not up.
 *
 * Two ways to resolve that:
 *   (a) permute axes in the math layer — bake a rotation into
 *       `raDecToGeocentricVector` itself, or into every call site, so its
 *       output lands directly in Three.js's default Y-up frame;
 *   (b) configure the *scene* as Z-up instead, and leave the equatorial
 *       math alone.
 *
 * This file takes (b), for three reasons. First, it's what the rest of
 * Milestone 1 already implies: the ground-terrain disc is a horizontal
 * plane, which is the XY-plane precisely when Z is vertical, and
 * `SkyCanvas.tsx`'s fixed camera looks toward `(0, 1, 0)` at "elevation
 * 0" — only sensible if Y is a horizontal azimuth-reference direction,
 * not the vertical axis. Second, every future astronomy-layer port
 * (precession, sidereal time, an observer's local north/up/east frame —
 * stardroid-v2's `SkyModel.localFrame`) will produce vectors in this
 * same equatorial convention; keeping ONE frame from math → astronomy →
 * render eliminates a whole class of "did I remember to permute here"
 * bugs, and keeps this module testable against stardroid-v2's own
 * fixtures without a rotation getting in the way. Third, it avoids a
 * per-vertex transform over a batched star buffer that can run into the
 * thousands of points.
 *
 * That makes it a REQUIREMENT — not a suggestion — that whoever builds
 * `SkyCanvas.tsx` sets the render scene to Z-up before constructing any
 * `Object3D`:
 *
 *     THREE.Object3D.DEFAULT_UP.set(0, 0, 1);   // once, at app start
 *     camera.up.set(0, 0, 1);                   // belt-and-suspenders
 *
 * `Object3D` reads `DEFAULT_UP` at construction time, so this has to run
 * before the camera or any mesh is created, not after.
 *
 * To keep that requirement from being an unenforced comment living in a
 * different file, {@link equatorialToRenderSpace} below is the single
 * seam every consumer should call before handing a vector to Three.js.
 * Under the Z-up convention it's presently the identity — but it is the
 * one place to change if that convention is ever revisited, instead of
 * every star, planet, and camera-target call site.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A SEPARATE CAVEAT: THIS IS NOT YET A HORIZON
 * ─────────────────────────────────────────────────────────────────────
 * Milestone 1 has no observer location or time model, so there is no
 * real altitude/azimuth transform yet — declination is not altitude,
 * and right ascension is not azimuth, except coincidentally for an
 * observer standing on the celestial equator at one specific sidereal
 * time. Plotting raw equatorial vectors against a Z-up "ground" is a
 * deliberate stand-in for the hardcoded test scene, not real sky
 * physics. When an observer `LocalFrame` is ported (mirroring
 * stardroid-v2's `SkyModel.localFrame`/`pointing`), the render layer
 * will rotate through *that* frame rather than plotting
 * {@link raDecToGeocentricVector}'s output directly — which is exactly
 * why this file stays a faithful, un-opinionated port of the pure
 * equatorial math, and doesn't try to guess at horizon behavior early.
 */

import { Vector3 } from './Vector3';
import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES } from './MathConstants';

/**
 * A direction on the celestial sphere: right ascension and declination,
 * both in degrees. Geocentric and fixed in space — these are the
 * celestial-sphere analog of longitude/latitude, and are how every star,
 * deep-sky object, and (mean) planet position in the catalog is
 * specified.
 */
export interface RaDec {
  /** Right ascension, in degrees, conventionally in `[0, 360)`. */
  readonly raDeg: number;
  /** Declination, in degrees, in `[-90, 90]`. */
  readonly decDeg: number;
}

/**
 * Converts a right ascension / declination pair to a unit vector in
 * geocentric equatorial coordinates (+Z = north celestial pole; see the
 * file-level doc comment above for the full convention and why it is
 * *not* pre-rotated for Three.js).
 *
 * A byte-for-byte port of stardroid-v2's `RaDec.toGeocentricVector()` —
 * intentionally, so this function's output can be cross-checked directly
 * against stardroid-v2's own test fixtures.
 *
 * @param raDeg Right ascension, in degrees.
 * @param decDeg Declination, in degrees.
 * @returns A unit vector (length 1, up to floating-point error) pointing
 *   in that direction.
 */
export function raDecToGeocentricVector(raDeg: number, decDeg: number): Vector3 {
  const ra = raDeg * DEGREES_TO_RADIANS;
  const dec = decDeg * DEGREES_TO_RADIANS;
  const cosDec = Math.cos(dec);
  return new Vector3(Math.cos(ra) * cosDec, Math.sin(ra) * cosDec, Math.sin(dec));
}

/**
 * Recovers right ascension / declination from a geocentric vector
 * (need not be a unit vector — only its direction matters).
 *
 * This is the inverse of {@link raDecToGeocentricVector}, and wasn't in
 * the original file spec, but it's a direct port of stardroid-v2's
 * `RaDec.fromGeocentricVector()`, costs almost nothing to include, and
 * unlocks two things this module will otherwise be missing on day one:
 * a round-trip property test (`raDecToGeocentricVector` composed with
 * this should be the identity, mirroring stardroid-v2's own
 * `MathPropertiesTest.raDecRoundTripsThroughVector`), and the "what did
 * the user just tap on" direction needed by Search & Snap / tap-to-
 * identify once those land.
 *
 * @param v A geocentric vector. Degenerate input (`x === 0 && y === 0`,
 *   i.e. exactly on the pole) returns `raDeg: 0` — `atan2(0, 0)` is `0`
 *   in JavaScript, matching Kotlin's `atan2` — since right ascension is
 *   genuinely undefined exactly at the pole and any answer is as valid
 *   as any other.
 */
export function geocentricVectorToRaDec(v: Vector3): RaDec {
  const raDeg = normalizeDegrees(Math.atan2(v.y, v.x) * RADIANS_TO_DEGREES);
  const decDeg = Math.atan2(v.z, Math.sqrt(v.x * v.x + v.y * v.y)) * RADIANS_TO_DEGREES;
  return { raDeg, decDeg };
}

/**
 * Reduces an angle in degrees to `[0, 360)`.
 *
 * A minimal, private stand-in for stardroid-v2's `Angles.kt`
 * (`floorMod` + `normalizeDegrees`), which is out of scope for this
 * file's requested surface. JavaScript's `%` keeps the sign of its left
 * operand (like Kotlin's), so a plain `x % 360` can return a negative
 * result for negative `x` — the double-mod below corrects that. Once
 * `Angles.ts` itself gets ported, this local helper should be deleted in
 * favor of importing the real one.
 */
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Rotates an equatorial-convention geocentric vector (+Z = north
 * celestial pole) into oneSky's Three.js render-space convention.
 *
 * Presently the identity function: per the file-level doc comment
 * above, oneSky's render scene is required to be configured Z-up, which
 * makes the equatorial and render frames the same frame. This function
 * exists anyway as the single explicit seam between "celestial math"
 * and "what the renderer consumes" — if that convention is ever
 * revisited in favor of Three.js's stock Y-up default, this is the one
 * place to change (a -90° rotation about the shared X axis:
 * `new Vector3(v.x, v.z, -v.y)`), rather than every star, planet, and
 * camera-target call site scattered across the render layer.
 */
export function equatorialToRenderSpace(v: Vector3): Vector3 {
  return v;
}