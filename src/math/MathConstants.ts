/**
 * MathConstants.ts
 *
 * Fundamental angular-conversion and floating-point-precision constants
 * shared by every module in `src/math/`.
 *
 * This mirrors stardroid-v2's pure-Kotlin `:core:math` `MathConstants.kt`
 * (plus the tolerance stardroid-v2 bakes into `Vector3.normalized()`) on
 * purpose: it has zero dependencies — not on React Native, not on
 * Three.js, not on anything — so it can be reused unchanged when the
 * astronomy layer (sidereal time, precession, observer local frames) is
 * ported in a later milestone.
 */

/** Multiply a value in degrees by this to convert it to radians. */
export const DEGREES_TO_RADIANS: number = Math.PI / 180;

/** Multiply a value in radians by this to convert it to degrees. */
export const RADIANS_TO_DEGREES: number = 180 / Math.PI;

/**
 * Multiply by this to convert hours (as in right-ascension "HHh MMm
 * SSs" notation) to degrees. 24h of RA spans the full 360° circle, so
 * 1 hour = 15°.
 */
export const HOURS_TO_DEGREES: number = 15;

/** Multiply by this to convert degrees to hours. Inverse of {@link HOURS_TO_DEGREES}. */
export const DEGREES_TO_HOURS: number = 1 / 15;

/**
 * A full circle, in radians (2π). Not consumed by `Vector3.ts` or
 * `Coordinates.ts` directly, but included here — rather than redefined
 * ad hoc later — because every angle-wrapping helper in the astronomy
 * layer (`normalizeRadians`, sidereal time, etc.) will need it, and this
 * file is the shared home for that kind of constant.
 */
export const TWO_PI: number = 2 * Math.PI;

/**
 * The zero-vector guard threshold used by {@link Vector3.normalized}.
 *
 * A vector shorter than this is treated as the zero vector rather than
 * divided by a near-zero length (which would otherwise blow up to
 * `Infinity`/`NaN`). This is not an arbitrary choice: it matches
 * stardroid-v2's own `Vector3.normalized()` guard exactly, so behavior
 * at this edge case stays bit-for-bit consistent with the source of
 * truth we're porting from — useful once astronomy-layer code that was
 * validated against stardroid-v2's test fixtures starts depending on it.
 */
export const VECTOR_NORMALIZE_EPSILON: number = 1e-6;