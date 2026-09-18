/**
 * TestSceneData.ts
 *
 * Hardcoded star fixtures for Milestone 1's debug scene — mirrors
 * stardroid-v2's `app/src/debug/.../testscene/TestScene.kt`, which
 * drives the renderer with a synthetic sky before the real catalog/data
 * layer exists.
 *
 * One structural difference from the source, worth calling out: stardroid-v2's
 * `TestScene.buildStarsScene()`/`testLabels()` build raw `Vector3` render
 * primitives directly — there's no intermediate RA/Dec-typed fixture,
 * because by that point in the Kotlin app the catalog has already done
 * the RaDec → Vector3 conversion. oneSky doesn't have that indirection
 * yet, so `StarData` here is deliberately RA/Dec-shaped (matching the
 * real catalog format this fixture stands in for) rather than
 * pre-projected — `StarsLayer.tsx` is expected to call
 * `raDecToGeocentricVector` from `Coordinates.ts` on each entry, the
 * same way it eventually will for real catalog data. Keeping the
 * conversion out of this file is what makes it a fixture and not a
 * render primitive.
 */

import { RADIANS_TO_DEGREES } from '../math/MathConstants';

/**
 * A single star's catalog-shaped data: where it is, and how bright.
 *
 * `magnitude` follows the astronomical convention of *lower is
 * brighter* (Sirius, the brightest star in Earth's night sky, is
 * negative) — this is a fixture-data quirk to carry through to the
 * renderer's point-size/brightness mapping later, not a bug.
 */
export interface StarData {
  /** Right ascension, in degrees. */
  readonly raDeg: number;
  /** Declination, in degrees. */
  readonly decDeg: number;
  /** Apparent visual magnitude. Lower is brighter; Sirius is negative. */
  readonly magnitude: number;
  /** Display name, for the small set of stars worth labeling. Unnamed for bulk/stress-test stars. */
  readonly name?: string;
}

/**
 * The seven named stars from stardroid-v2's `TestScene.testLabels()` —
 * Orion's three belt stars plus Betelgeuse and Bellatrix at its
 * shoulders, Rigel at its foot, and Sirius just outside the test
 * camera's 45° FOV boundary. Values cross-checked against the source
 * and copied verbatim; the RA h/m annotations are carried over from
 * stardroid-v2's own comments as a sanity check (88.8° = 5h 55m, etc.
 * at 15°/hour).
 */
export const DEBUG_NAMED_STARS: readonly StarData[] = [
  // RA 5h 55m
  { name: 'Betelgeuse', raDeg: 88.8, decDeg: 7.4, magnitude: 0.42 },
  // RA 5h 14m
  { name: 'Rigel', raDeg: 78.5, decDeg: -8.2, magnitude: 0.13 },
  // RA 5h 25m
  { name: 'Bellatrix', raDeg: 81.3, decDeg: 6.3, magnitude: 1.64 },
  // RA 5h 32m — Orion's belt
  { name: 'Mintaka', raDeg: 83.0, decDeg: -0.3, magnitude: 2.21 },
  // RA 5h 36m — Orion's belt
  { name: 'Alnilam', raDeg: 84.1, decDeg: -1.2, magnitude: 1.65 },
  // RA 5h 41m — Orion's belt
  { name: 'Alnitak', raDeg: 85.2, decDeg: -1.9, magnitude: 1.74 },
  // RA 6h 45m
  { name: 'Sirius', raDeg: 101.3, decDeg: -16.7, magnitude: -1.46 },
];

/**
 * Generates `count` unnamed stars, uniformly distributed over the
 * celestial sphere, with a magnitude distribution weighted toward faint
 * stars — for exercising the "no CPU point culling" architecture (a
 * batched `THREE.BufferGeometry`/`THREE.Points` draw call, GPU-side
 * frustum discard) the way stardroid-v2's own `TestScene` (100k points,
 * `STAR_COUNT`) exercises its GLES renderer.
 *
 * The uniform-sphere distribution here is mathematically the same
 * distribution stardroid-v2's `buildStarsScene()` generates, just
 * derived in RA/Dec space instead of Cartesian space, to match this
 * file's RA/Dec-shaped {@link StarData} (see the file-level doc
 * comment): stardroid-v2 draws `z = cos(theta)` uniformly from
 * `[-1, 1]` directly; `decDeg` below draws `sin(dec)` uniformly from
 * that same range via `asin`, and since `z = sin(dec)` in this
 * project's equatorial convention ({@link raDecToGeocentricVector} in
 * `Coordinates.ts`), the two are the identical distribution.
 *
 * One deliberate deviation from the source worth flagging: stardroid-v2
 * seeds its `Random(42L)` specifically so repeated runs are
 * byte-identical (D28/D29 calls this out — reproducible screenshots for
 * its perf gate). `Math.random()` can't be seeded, so this function is
 * *not* reproducible run-to-run. That's fine for "does the frame rate
 * hold at 100k points" spot-checks, but if a later milestone wants a
 * deterministic perf-regression suite, this will need a small seedable
 * PRNG (e.g. a `count`-and-`seed`-parameterized mulberry32) swapped in
 * for `Math.random()` — worth a follow-up rather than guessing at it now.
 *
 * @param count Number of stars to generate. Defaults to 100,000,
 *   matching stardroid-v2's `TestScene.STAR_COUNT`.
 */
export function generateStressTestStars(count: number = 100_000): StarData[] {
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    const raDeg = Math.random() * 360;
    const decDeg = Math.asin(Math.random() * 2 - 1) * RADIANS_TO_DEGREES;
    const magnitude = -1.5 + 9.5 * Math.sqrt(Math.random());
    stars.push({ raDeg, decDeg, magnitude });
  }
  return stars;
}