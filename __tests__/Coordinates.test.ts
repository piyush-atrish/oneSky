import * as THREE from 'three';
import { bvToRGB, raDecToCartesian } from '../src/math/Coordinates';

// Reference positions are J2000 values from standard star catalogues
// (SIMBAD / Hipparcos). Phase 1 licence cleanup: this file no longer
// depends on any external project's fixtures.
const POLARIS = { raHours: 2 + 31 / 60 + 49.09 / 3600, decDeg: 89 + 15 / 60 + 50.8 / 3600 };
const SIRIUS = { raHours: 6 + 45 / 60 + 8.917 / 3600, decDeg: -(16 + 42 / 60 + 58.02 / 3600) };

describe('raDecToCartesian - real stars (independent references)', () => {
  it('puts Polaris about 0.74 degrees from the north celestial pole', () => {
    const v = raDecToCartesian(POLARIS.raHours, POLARIS.decDeg, 1);
    const angleFromPoleDeg = (Math.acos(v.z / v.length()) * 180) / Math.PI;
    expect(Math.abs(angleFromPoleDeg - 0.74)).toBeLessThan(0.02);
  });

  it('puts Sirius in the RA 90-180 degree quadrant, south of the equator', () => {
    const v = raDecToCartesian(SIRIUS.raHours, SIRIUS.decDeg, 1);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeGreaterThan(0);
    expect(v.z).toBeLessThan(0);
    expect((Math.asin(v.z) * 180) / Math.PI).toBeCloseTo(SIRIUS.decDeg, 6);
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