import * as THREE from 'three';
import {
  bvToRGB,
  equatorialToRenderSpace,
  geocentricVectorToRaDec,
  raDecToCartesian,
  raDecToGeocentricVector,
} from '../src/math/Coordinates';
import { Vector3 } from '../src/math/Vector3';

function circularDistance(a: number, b: number, period: number): number {
  const diff = Math.abs(a - b) % period;
  return Math.min(diff, period - diff);
}

function toThree(v: Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

const RA_DEG_GRID = [0, 30, 45, 90, 135, 180, 225, 270, 315, 359.999];
const DEC_DEG_GRID = [-89, -60, -30, 0, 30, 60, 89];
const GRID = RA_DEG_GRID.flatMap((ra) => DEC_DEG_GRID.map((dec) => [ra, dec]));

describe('raDecToGeocentricVector', () => {
  it.each([
    [0, 0, 1, 0, 0],
    [90, 0, 0, 1, 0],
    [180, 0, -1, 0, 0],
    [270, 0, 0, -1, 0],
    [0, 90, 0, 0, 1],
    [0, -90, 0, 0, -1],
    [123, 90, 0, 0, 1],
    [45, -90, 0, 0, -1],
  ])('(%d°, %d°) → (%d, %d, %d)', (ra, dec, x, y, z) => {
    const v = raDecToGeocentricVector(ra, dec);
    expect(v.x).toBeCloseTo(x, 12);
    expect(v.y).toBeCloseTo(y, 12);
    expect(v.z).toBeCloseTo(z, 12);
  });

  it('returns a Vector3 instance', () => {
    expect(raDecToGeocentricVector(10, 20)).toBeInstanceOf(Vector3);
  });

  it('produces unit vectors, including out-of-range right ascensions', () => {
    for (const ra of [...RA_DEG_GRID, -720, -1, 361, 720.5]) {
      for (const dec of DEC_DEG_GRID) {
        expect(raDecToGeocentricVector(ra, dec).length).toBeCloseTo(1, 12);
      }
    }
  });

  it('lies exactly on the celestial equator for dec = 0', () => {
    for (const ra of RA_DEG_GRID) expect(raDecToGeocentricVector(ra, 0).z).toBeCloseTo(0, 15);
  });

  it('places northern declinations above and southern below the equatorial plane', () => {
    for (const ra of RA_DEG_GRID) {
      expect(raDecToGeocentricVector(ra, 0.001).z).toBeGreaterThan(0);
      expect(raDecToGeocentricVector(ra, -0.001).z).toBeLessThan(0);
    }
  });

  it('computes the expected components at dec = 30°', () => {
    const v = raDecToGeocentricVector(0, 30);
    expect(v.x).toBeCloseTo(Math.cos(Math.PI / 6), 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(0.5, 12);
  });

  it.each([
    [360, 0],
    [-360, 0],
    [720, 0],
    [-90, 270],
    [450, 90],
  ])('treats ra %d° and %d° as the same direction', (a, b) => {
    expect(toThree(raDecToGeocentricVector(a, 25)).distanceTo(toThree(raDecToGeocentricVector(b, 25)))).toBeLessThan(1e-12);
  });

  it('collapses every right ascension to the same point at the poles', () => {
    for (const ra of RA_DEG_GRID) {
      expect(toThree(raDecToGeocentricVector(ra, 90)).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-12);
      expect(toThree(raDecToGeocentricVector(ra, -90)).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-12);
    }
  });

  it('continues across the pole when declination exceeds 90°', () => {
    const over = toThree(raDecToGeocentricVector(0, 100));
    const across = toThree(raDecToGeocentricVector(180, 80));
    expect(over.distanceTo(across)).toBeLessThan(1e-12);
  });
});

describe('geocentricVectorToRaDec', () => {
  it.each([
    [1, 0, 0, 0, 0],
    [0, 1, 0, 90, 0],
    [-1, 0, 0, 180, 0],
    [0, -1, 0, 270, 0],
    [1, 1, 0, 45, 0],
    [-1, 1, 0, 135, 0],
    [-1, -1, 0, 225, 0],
    [1, -1, 0, 315, 0],
    [1, 0, 1, 0, 45],
    [1, 0, -1, 0, -45],
  ])('(%d, %d, %d) → ra %d°, dec %d°', (x, y, z, ra, dec) => {
    const result = geocentricVectorToRaDec(new Vector3(x, y, z));
    expect(circularDistance(result.raDeg, ra, 360)).toBeLessThan(1e-9);
    expect(result.decDeg).toBeCloseTo(dec, 9);
  });

  it('is invariant to vector magnitude', () => {
    const reference = geocentricVectorToRaDec(new Vector3(1, 2, 3));
    for (const scale of [1e-3, 5, 1e6]) {
      const scaled = geocentricVectorToRaDec(new Vector3(scale, 2 * scale, 3 * scale));
      expect(scaled.raDeg).toBeCloseTo(reference.raDeg, 9);
      expect(scaled.decDeg).toBeCloseTo(reference.decDeg, 9);
    }
  });

  it('reports dec = ±90° and ra = 0 exactly on the poles', () => {
    const north = geocentricVectorToRaDec(new Vector3(0, 0, 1));
    const south = geocentricVectorToRaDec(new Vector3(0, 0, -1));
    expect(north.decDeg).toBeCloseTo(90, 12);
    expect(south.decDeg).toBeCloseTo(-90, 12);
    expect(north.raDeg).toBe(0);
    expect(south.raDeg).toBe(0);
  });

  it('returns the origin direction for the zero vector instead of NaN', () => {
    expect(geocentricVectorToRaDec(new Vector3(0, 0, 0))).toEqual({ raDeg: 0, decDeg: 0 });
  });

  it('keeps right ascension in [0, 360) for infinitesimal negative y', () => {
    for (const y of [-1e-20, -1e-14, -1e-12, -1e-6]) {
      const { raDeg } = geocentricVectorToRaDec(new Vector3(1, y, 0));
      expect(raDeg).toBeGreaterThanOrEqual(0);
      expect(raDeg).toBeLessThan(360);
    }
    expect(geocentricVectorToRaDec(new Vector3(1, -1e-6, 0)).raDeg).toBeGreaterThan(359.99);
  });

  it('bounds ra to [0, 360) and dec to [-90, 90] for arbitrary vectors', () => {
    const components = [-3, -1, 0, 0.5, 2];
    for (const x of components) {
      for (const y of components) {
        for (const z of components) {
          if (x === 0 && y === 0 && z === 0) continue;
          const { raDeg, decDeg } = geocentricVectorToRaDec(new Vector3(x, y, z));
          expect(raDeg).toBeGreaterThanOrEqual(0);
          expect(raDeg).toBeLessThan(360);
          expect(decDeg).toBeGreaterThanOrEqual(-90);
          expect(decDeg).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it.each(GRID)('round-trips (%f°, %f°) through the vector form', (ra, dec) => {
    const result = geocentricVectorToRaDec(raDecToGeocentricVector(ra, dec));
    expect(circularDistance(result.raDeg, ra, 360)).toBeLessThan(1e-9);
    expect(result.decDeg).toBeCloseTo(dec, 9);
  });

  it('wraps ra = 360° round-trip back to 0°', () => {
    const result = geocentricVectorToRaDec(raDecToGeocentricVector(360, 10));
    expect(circularDistance(result.raDeg, 0, 360)).toBeLessThan(1e-9);
    expect(result.raDeg).toBeLessThan(360);
  });

  it('preserves declination (not right ascension) at the poles through a round trip', () => {
    expect(geocentricVectorToRaDec(raDecToGeocentricVector(77, 90)).decDeg).toBeCloseTo(90, 9);
    expect(geocentricVectorToRaDec(raDecToGeocentricVector(77, -90)).decDeg).toBeCloseTo(-90, 9);
  });
});

describe('equatorialToRenderSpace', () => {
  it('is the identity for the Z-up convention', () => {
    const v = new Vector3(0.1, -0.2, 0.3);
    expect(equatorialToRenderSpace(v)).toBe(v);
  });
});

describe('raDecToCartesian', () => {
  it('returns a THREE.Vector3 with a default radius of 100', () => {
    const v = raDecToCartesian(3.3, 41);
    expect(v).toBeInstanceOf(THREE.Vector3);
    expect(v.length()).toBeCloseTo(100, 9);
  });

  it.each([
    [0, 0, 100, 0, 0],
    [6, 0, 0, 100, 0],
    [12, 0, -100, 0, 0],
    [18, 0, 0, -100, 0],
    [3, 0, 100 * Math.SQRT1_2, 100 * Math.SQRT1_2, 0],
    [0, 90, 0, 0, 100],
    [0, -90, 0, 0, -100],
  ])('(%fh, %f°) → (%f, %f, %f)', (ra, dec, x, y, z) => {
    const v = raDecToCartesian(ra, dec);
    expect(v.x).toBeCloseTo(x, 9);
    expect(v.y).toBeCloseTo(y, 9);
    expect(v.z).toBeCloseTo(z, 9);
  });

  it('scales linearly with radius, including zero and negative radii', () => {
    const unit = raDecToCartesian(5.5, -33, 1);
    const scaled = raDecToCartesian(5.5, -33, 7);
    expect(scaled.distanceTo(unit.clone().multiplyScalar(7))).toBeLessThan(1e-12);
    expect(raDecToCartesian(5.5, -33, 0).length()).toBe(0);
    expect(raDecToCartesian(5.5, -33, -1).distanceTo(unit.clone().negate())).toBeLessThan(1e-12);
  });

  it('treats 24h as 0h and negative hours as their positive complement', () => {
    expect(raDecToCartesian(24, 20, 1).distanceTo(raDecToCartesian(0, 20, 1))).toBeLessThan(1e-12);
    expect(raDecToCartesian(-6, 20, 1).distanceTo(raDecToCartesian(18, 20, 1))).toBeLessThan(1e-12);
    expect(raDecToCartesian(30, 20, 1).distanceTo(raDecToCartesian(6, 20, 1))).toBeLessThan(1e-12);
  });

  it('lies on the celestial equator (z = 0) for dec = 0 at every hour angle', () => {
    for (let hour = 0; hour < 24; hour += 0.5) expect(raDecToCartesian(hour, 0, 1).z).toBeCloseTo(0, 15);
  });

  it('collapses all right ascensions onto the poles', () => {
    for (let hour = 0; hour < 24; hour += 3) {
      expect(raDecToCartesian(hour, 90, 1).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-12);
      expect(raDecToCartesian(hour, -90, 1).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-12);
    }
  });

  it('continues across the pole when declination exceeds 90°', () => {
    expect(raDecToCartesian(0, 100, 1).distanceTo(raDecToCartesian(12, 80, 1))).toBeLessThan(1e-12);
  });

  it.each(GRID)('agrees with raDecToGeocentricVector at (%f°, %f°)', (raDeg, dec) => {
    const a = raDecToCartesian(raDeg / 15, dec, 1);
    const b = toThree(raDecToGeocentricVector(raDeg, dec));
    expect(a.distanceTo(b)).toBeLessThan(1e-12);
  });
});

describe('bvToRGB', () => {
  it.each([
    [-0.4, 0.61, 0.7, 1.0],
    [-0.1, 0.79, 0.85, 1.0],
    [0.0, 1.0, 0.95, 1.0],
    [0.3, 1.0, 0.98, 0.9],
    [0.6, 1.0, 0.9, 0.7],
    [1.0, 1.0, 0.75, 0.5],
    [1.5, 1.0, 0.55, 0.35],
    [2.0, 1.0, 0.4, 0.3],
  ])('returns the calibrated color exactly at stop B-V = %f', (bv, r, g, b) => {
    const color = bvToRGB(bv);
    expect(color.r).toBeCloseTo(r, 12);
    expect(color.g).toBeCloseTo(g, 12);
    expect(color.b).toBeCloseTo(b, 12);
  });

  it.each([
    [-0.25, 0.7, 0.775, 1.0],
    [0.15, 1.0, 0.965, 0.95],
    [0.65, 1.0, 0.88125, 0.675],
    [1.75, 1.0, 0.475, 0.325],
  ])('linearly interpolates between stops at B-V = %f', (bv, r, g, b) => {
    const color = bvToRGB(bv);
    expect(color.r).toBeCloseTo(r, 12);
    expect(color.g).toBeCloseTo(g, 12);
    expect(color.b).toBeCloseTo(b, 12);
  });

  it.each([
    [-5, -0.4],
    [-Infinity, -0.4],
    [3, 2.0],
    [Infinity, 2.0],
  ])('clamps B-V = %f to the nearest calibrated end (%f)', (input, clamped) => {
    const a = bvToRGB(input);
    const b = bvToRGB(clamped);
    expect([a.r, a.g, a.b]).toEqual([b.r, b.g, b.b]);
  });

  it('keeps every channel within [0, 1] across and beyond the calibrated range', () => {
    for (let bv = -1; bv <= 3; bv += 0.05) {
      const { r, g, b } = bvToRGB(bv);
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is continuous with no jumps at segment boundaries', () => {
    for (let bv = -0.4; bv < 2.0; bv += 0.01) {
      const a = bvToRGB(bv);
      const b = bvToRGB(bv + 1e-6);
      expect(Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)).toBeLessThan(1e-4);
    }
  });

  it('shifts from blue-white to red: red never decreases, blue never increases', () => {
    let previous = bvToRGB(-0.4);
    for (let bv = -0.39; bv <= 2.0; bv += 0.01) {
      const current = bvToRGB(bv);
      expect(current.r).toBeGreaterThanOrEqual(previous.r - 1e-12);
      expect(current.b).toBeLessThanOrEqual(previous.b + 1e-12);
      previous = current;
    }
  });
});