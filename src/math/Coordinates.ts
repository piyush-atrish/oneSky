/**
 * Coordinates.ts
 *
 * Equatorial (right ascension / declination) -> Cartesian conversion for
 * the celestial sphere, plus the B-V colour-index -> RGB mapping used to
 * tint stars.
 *
 * Frame convention: the north celestial pole (dec = +90 deg) sits on +Z,
 * RA = 0h / dec = 0 deg on +X, RA = 6h / dec = 0 deg on +Y. This is the
 * standard spherical-to-Cartesian relation for equatorial coordinates
 * (see e.g. Meeus, "Astronomical Algorithms", ch. 13 on coordinate
 * transformations). Three.js defaults to a Y-up scene, so oneSky's scene
 * is configured Z-up and the equatorial frame is used as-is, with no
 * axis permutation anywhere in the render layer.
 */

import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const HOURS_TO_DEG = 15;

/**
 * Converts RA (hours) and Dec (degrees) to a point on a sphere of the
 * given radius, in the Z-up equatorial frame described above.
 * RA wraps naturally (24h == 0h); Dec beyond +/-90 continues across the pole.
 */
export function raDecToCartesian(raHours: number, decDegrees: number, radius = 100): THREE.Vector3 {
  const ra = raHours * HOURS_TO_DEG * DEG_TO_RAD;
  const dec = decDegrees * DEG_TO_RAD;
  const horizontal = radius * Math.cos(dec);
  return new THREE.Vector3(horizontal * Math.cos(ra), horizontal * Math.sin(ra), radius * Math.sin(dec));
}

// Piecewise-linear approximation of star colour across B-V, from O/B
// (blue-white) through G (Sun-like, ~0.6) to M (orange-red). A small set
// of representative stops, linearly interpolated; not a physical
// blackbody / CIE computation.
const BV_COLOR_STOPS: readonly [bv: number, r: number, g: number, b: number][] = [
  [-0.4, 0.61, 0.7, 1.0],
  [-0.1, 0.79, 0.85, 1.0],
  [0.0, 1.0, 0.95, 1.0],
  [0.3, 1.0, 0.98, 0.9],
  [0.6, 1.0, 0.9, 0.7],
  [1.0, 1.0, 0.75, 0.5],
  [1.5, 1.0, 0.55, 0.35],
  [2.0, 1.0, 0.4, 0.3],
];

/** Maps a B-V colour index (clamped to [-0.4, 2.0]) to an RGB colour. */
export function bvToRGB(bv: number): THREE.Color {
  const clamped = Math.min(2.0, Math.max(-0.4, bv));
  let i = 0;
  while (i < BV_COLOR_STOPS.length - 2 && clamped > BV_COLOR_STOPS[i + 1][0]) i++;
  const [bv0, r0, g0, b0] = BV_COLOR_STOPS[i];
  const [bv1, r1, g1, b1] = BV_COLOR_STOPS[i + 1];
  const t = (clamped - bv0) / (bv1 - bv0);
  return new THREE.Color(r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t);
}