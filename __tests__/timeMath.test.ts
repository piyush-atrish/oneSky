import * as Astronomy from 'astronomy-engine';
import { getLocalSiderealTime } from '../src/astro/TimeMath';

function modularDistance(a: number, b: number, modulus: number): number {
  const diff = Math.abs(a - b) % modulus;
  return Math.min(diff, modulus - diff);
}

describe('getLocalSiderealTime', () => {
  const date = new Date('2026-06-21T12:00:00Z');

  it('matches Astronomy.SiderealTime at longitude 0 (Greenwich)', () => {
    const gast = Astronomy.SiderealTime(date);
    expect(getLocalSiderealTime(date, 0)).toBeCloseTo(gast, 9);
  });

  it('shifts forward by exactly 6 hours at +90 degrees longitude', () => {
    const gast = Astronomy.SiderealTime(date);
    const lst = getLocalSiderealTime(date, 90);
    expect(modularDistance(lst, gast + 6, 24)).toBeLessThan(1e-9);
  });

  it('shifts back by exactly 6 hours at -90 degrees longitude', () => {
    const gast = Astronomy.SiderealTime(date);
    const lst = getLocalSiderealTime(date, -90);
    expect(modularDistance(lst, gast - 6, 24)).toBeLessThan(1e-9);
  });

  it('returns an identical LST for the antimeridian at +180 and -180 degrees', () => {
    expect(getLocalSiderealTime(date, 180)).toBe(getLocalSiderealTime(date, -180));
  });

  it('wraps cleanly into [0, 24) when the raw sum is negative', () => {
    const gast = Astronomy.SiderealTime(date);
    const boundaryLongitude = -(gast * 15) - 0.5;
    const lst = getLocalSiderealTime(date, boundaryLongitude);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(24);
  });

  it('wraps cleanly into [0, 24) when the raw sum exceeds 24', () => {
    const gast = Astronomy.SiderealTime(date);
    const boundaryLongitude = (24 - gast) * 15 + 0.5;
    const lst = getLocalSiderealTime(date, boundaryLongitude);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(24);
  });
});