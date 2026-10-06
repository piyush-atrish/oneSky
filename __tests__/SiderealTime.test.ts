import * as Astronomy from 'astronomy-engine';
import { getLocalSiderealTime } from '../src/astro/TimeMath';

jest.mock('astronomy-engine', () => {
  const actual = jest.requireActual('astronomy-engine');
  return { ...actual, SiderealTime: jest.fn(actual.SiderealTime) };
});

const siderealTime = jest.mocked(Astronomy.SiderealTime);

const SIDEREAL_RATE = 1.00273790935;
const EXTRA_HOURS_PER_SOLAR_DAY = 24 * SIDEREAL_RATE - 24;
const BASE_DATE = new Date('2026-06-21T12:00:00Z');

function circularDistance(a: number, b: number, period: number): number {
  const diff = Math.abs(a - b) % period;
  return Math.min(diff, period - diff);
}

function forwardDifference(later: number, earlier: number): number {
  return (((later - earlier) % 24) + 24) % 24;
}

beforeEach(() => siderealTime.mockClear());

describe('getLocalSiderealTime wrapping (stubbed Greenwich sidereal time)', () => {
  it.each([
    [0, 0, 0],
    [12, 0, 12],
    [23.999, 0, 23.999],
    [23.5, 15, 0.5],
    [0.5, -15, 23.5],
    [6, 90, 12],
    [6, -90, 0],
    [5, -90, 23],
    [20, 180, 8],
    [4, -180, 16],
    [0, 360, 0],
    [0, -360, 0],
    [10, 720, 10],
    [1, -720, 1],
  ])('GAST %f h at longitude %f° → %f h', (gast, longitude, expected) => {
    siderealTime.mockReturnValueOnce(gast);
    expect(getLocalSiderealTime(BASE_DATE, longitude)).toBeCloseTo(expected, 9);
  });

  it('never returns 24 for an infinitesimal negative offset', () => {
    siderealTime.mockReturnValueOnce(0);
    const lst = getLocalSiderealTime(BASE_DATE, -1e-20);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(24);
  });

  it('wraps a sum just above 24 back near 0', () => {
    siderealTime.mockReturnValueOnce(23.999999);
    expect(getLocalSiderealTime(BASE_DATE, 0.0000225)).toBeCloseTo(0.0000005, 9);
  });

  it('forwards only the date to Astronomy.SiderealTime', () => {
    getLocalSiderealTime(BASE_DATE, 77);
    expect(siderealTime).toHaveBeenCalledTimes(1);
    expect(siderealTime).toHaveBeenCalledWith(BASE_DATE);
  });

  it('propagates NaN for a NaN longitude', () => {
    expect(Number.isNaN(getLocalSiderealTime(BASE_DATE, NaN))).toBe(true);
  });
});

describe('getLocalSiderealTime astronomy', () => {
  it('matches the known sidereal time at the J2000.0 epoch', () => {
    expect(getLocalSiderealTime(new Date('2000-01-01T12:00:00Z'), 0)).toBeCloseTo(18.697, 2);
  });

  it('is deterministic and independent of how the instant is expressed', () => {
    const utc = new Date('2026-06-21T12:00:00Z');
    const offset = new Date('2026-06-21T17:30:00+05:30');
    expect(getLocalSiderealTime(utc, 33.3)).toBe(getLocalSiderealTime(offset, 33.3));
    expect(getLocalSiderealTime(utc, 33.3)).toBe(getLocalSiderealTime(utc, 33.3));
  });

  it.each([-540, -180, -90, -15, -0.5, 0, 0.5, 15, 90, 180, 360, 540])(
    'offsets LST by longitude/15 hours at longitude %f°',
    (longitude) => {
      const greenwich = getLocalSiderealTime(BASE_DATE, 0);
      expect(circularDistance(getLocalSiderealTime(BASE_DATE, longitude), greenwich + longitude / 15, 24)).toBeLessThan(1e-9);
    },
  );

  it('stays within [0, 24) across epochs and extreme longitudes', () => {
    const dates = [
      '1900-01-01T00:00:00Z',
      '1969-07-20T20:17:40Z',
      '2000-01-01T12:00:00Z',
      '2024-02-29T23:59:59Z',
      '2026-10-06T00:00:00Z',
      '2100-12-31T23:59:59Z',
    ].map((iso) => new Date(iso));
    const longitudes = [-540, -180, -179.999999, -90, -0.000001, 0, 0.000001, 90, 179.999999, 180, 540];
    for (const date of dates) {
      for (const longitude of longitudes) {
        const lst = getLocalSiderealTime(date, longitude);
        expect(lst).toBeGreaterThanOrEqual(0);
        expect(lst).toBeLessThan(24);
      }
    }
  });

  it('advances by the sidereal rate over one solar hour', () => {
    const later = new Date(BASE_DATE.getTime() + 3600_000);
    expect(forwardDifference(getLocalSiderealTime(later, 0), getLocalSiderealTime(BASE_DATE, 0))).toBeCloseTo(SIDEREAL_RATE, 5);
  });

  it('gains about 3m56s per solar day', () => {
    const later = new Date(BASE_DATE.getTime() + 86_400_000);
    expect(forwardDifference(getLocalSiderealTime(later, 0), getLocalSiderealTime(BASE_DATE, 0))).toBeCloseTo(EXTRA_HOURS_PER_SOLAR_DAY, 3);
  });

  it.each([
    ['2024-02-28T12:00:00Z', '2024-02-29T12:00:00Z'],
    ['2024-02-29T12:00:00Z', '2024-03-01T12:00:00Z'],
    ['2025-02-28T12:00:00Z', '2025-03-01T12:00:00Z'],
    ['2025-12-31T12:00:00Z', '2026-01-01T12:00:00Z'],
  ])('advances by exactly one sidereal-day excess across %s → %s', (from, to) => {
    expect(forwardDifference(getLocalSiderealTime(new Date(to), 0), getLocalSiderealTime(new Date(from), 0))).toBeCloseTo(
      EXTRA_HOURS_PER_SOLAR_DAY,
      3,
    );
  });

  it('is continuous across the new-year boundary', () => {
    const before = getLocalSiderealTime(new Date('2025-12-31T23:59:59Z'), 0);
    const after = getLocalSiderealTime(new Date('2026-01-01T00:00:00Z'), 0);
    expect(forwardDifference(after, before)).toBeCloseTo(SIDEREAL_RATE / 3600, 6);
  });

  it('is continuous across the 0h/24h wrap of sidereal time', () => {
    let previous = getLocalSiderealTime(new Date('2026-06-21T00:00:00Z'), 0);
    let wrapped = false;
    for (let minute = 1; minute <= 24 * 60; minute++) {
      const current = getLocalSiderealTime(new Date(Date.UTC(2026, 5, 21, 0, minute)), 0);
      if (current < previous) wrapped = true;
      expect(forwardDifference(current, previous)).toBeCloseTo(SIDEREAL_RATE / 60, 5);
      previous = current;
    }
    expect(wrapped).toBe(true);
  });

  it('returns the same LST at the antimeridian from either side', () => {
    expect(circularDistance(getLocalSiderealTime(BASE_DATE, 180), getLocalSiderealTime(BASE_DATE, -180), 24)).toBeLessThan(1e-9);
  });
});