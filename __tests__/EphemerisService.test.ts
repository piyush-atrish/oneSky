import * as Astronomy from 'astronomy-engine';
import {
  CelestialPositions,
  computeCelestialPositions,
  getGeocentricPosition,
  getMoonPhaseAngle,
} from '../src/astro/EphemerisService';

jest.mock('astronomy-engine', () => {
  const actual = jest.requireActual('astronomy-engine');
  return {
    ...actual,
    GeoVector: jest.fn(actual.GeoVector),
    EquatorFromVector: jest.fn(actual.EquatorFromVector),
    MoonPhase: jest.fn(actual.MoonPhase),
  };
});

const actual = jest.requireActual<typeof Astronomy>('astronomy-engine');
const geoVector = jest.mocked(Astronomy.GeoVector);
const equatorFromVector = jest.mocked(Astronomy.EquatorFromVector);
const moonPhase = jest.mocked(Astronomy.MoonPhase);

const { Body } = Astronomy;
const BODY_ORDER = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune];
const FAKE_VECTOR = { x: 1, y: 2, z: 3 } as unknown as Astronomy.Vector;
const DAY_MS = 86_400_000;
const GRID = Array.from({ length: 160 }, (_, i) => new Date(Date.UTC(2000, 0, 1) + i * 91 * DAY_MS));

function circularDistance(a: number, b: number, period: number): number {
  const diff = Math.abs(a - b) % period;
  return Math.min(diff, period - diff);
}

function forwardDifference(later: number, earlier: number, period: number): number {
  return (((later - earlier) % period) + period) % period;
}

beforeEach(() => jest.clearAllMocks());

afterEach(() => {
  geoVector.mockImplementation(actual.GeoVector);
  equatorFromVector.mockImplementation(actual.EquatorFromVector);
  moonPhase.mockImplementation(actual.MoonPhase);
});

describe('getGeocentricPosition wiring', () => {
  const date = new Date('2026-01-01T00:00:00Z');

  it('requests an aberration-corrected vector and maps the equatorial result', () => {
    geoVector.mockReturnValueOnce(FAKE_VECTOR);
    equatorFromVector.mockReturnValueOnce({ ra: 6.5, dec: -12.25, dist: 2.5, vec: FAKE_VECTOR } as unknown as Astronomy.EquatorialCoordinates);
    expect(getGeocentricPosition(Body.Mars, date)).toEqual({ raHours: 6.5, decDegrees: -12.25, distanceAu: 2.5 });
    expect(geoVector).toHaveBeenCalledWith(Body.Mars, date, true);
    expect(equatorFromVector).toHaveBeenCalledWith(FAKE_VECTOR);
  });

  it.each([
    [0, 90],
    [0, -90],
    [0, 0],
    [12, 0],
    [23.999999, 45],
  ])('passes boundary RA %f h / Dec %f° through unchanged', (ra, dec) => {
    geoVector.mockReturnValueOnce(FAKE_VECTOR);
    equatorFromVector.mockReturnValueOnce({ ra, dec, dist: 1 } as unknown as Astronomy.EquatorialCoordinates);
    const position = getGeocentricPosition(Body.Venus, date);
    expect(position.raHours).toBe(ra);
    expect(position.decDegrees).toBe(dec);
  });
});

describe('getMoonPhaseAngle wiring', () => {
  it.each([0, 90, 180, 359.9999])('returns the Astronomy.MoonPhase value %f untouched', (phase) => {
    const date = new Date('2026-01-01T00:00:00Z');
    moonPhase.mockReturnValueOnce(phase);
    expect(getMoonPhaseAngle(date)).toBe(phase);
    expect(moonPhase).toHaveBeenCalledWith(date);
  });
});

describe('computeCelestialPositions wiring', () => {
  const date = new Date('2026-03-14T09:26:53Z');

  beforeEach(() => {
    geoVector.mockImplementation((body) => ({ body }) as unknown as Astronomy.Vector);
    equatorFromVector.mockImplementation((vector) => {
      const index = BODY_ORDER.indexOf((vector as unknown as { body: Astronomy.Body }).body);
      return { ra: index, dec: index + 0.5, dist: index + 0.25 } as unknown as Astronomy.EquatorialCoordinates;
    });
    moonPhase.mockReturnValueOnce(123.4);
  });

  it('queries exactly the nine bodies once each, with aberration, for the given date', () => {
    computeCelestialPositions(date);
    expect(geoVector).toHaveBeenCalledTimes(9);
    expect(geoVector.mock.calls.map(([body]) => body).sort()).toEqual([...BODY_ORDER].sort());
    expect(geoVector.mock.calls.every(([, d, aberration]) => d === date && aberration === true)).toBe(true);
  });

  it('maps each body to its own key', () => {
    const positions = computeCelestialPositions(date);
    BODY_ORDER.forEach((body, index) => {
      const key = body.toLowerCase() as keyof CelestialPositions;
      expect(positions[key]).toMatchObject({ raHours: index, decDegrees: index + 0.5, distanceAu: index + 0.25 });
    });
  });

  it('adds the phase angle to the Moon only', () => {
    const positions = computeCelestialPositions(date);
    expect(positions.moon.phaseAngle).toBe(123.4);
    expect(moonPhase).toHaveBeenCalledTimes(1);
    expect(moonPhase).toHaveBeenCalledWith(date);
    for (const key of Object.keys(positions).filter((k) => k !== 'moon')) {
      expect(positions[key as keyof CelestialPositions]).not.toHaveProperty('phaseAngle');
    }
  });
});

describe('getGeocentricPosition astronomy', () => {
  it.each([
    ['March equinox', '2024-03-20T03:06:00Z', 0, 0],
    ['June solstice', '2024-06-20T20:51:00Z', 6, 23.44],
    ['September equinox', '2024-09-22T12:44:00Z', 12, 0],
    ['December solstice', '2024-12-21T09:21:00Z', 18, -23.44],
  ])('places the Sun correctly at the %s', (_label, iso, expectedRa, expectedDec) => {
    const position = getGeocentricPosition(Body.Sun, new Date(iso));
    expect(circularDistance(position.raHours, expectedRa, 24)).toBeLessThan(0.1);
    expect(Math.abs(position.decDegrees - expectedDec)).toBeLessThan(0.3);
  });

  it('moves the Sun from the southern to the northern sky across the March equinox', () => {
    expect(getGeocentricPosition(Body.Sun, new Date('2024-03-19T00:00:00Z')).decDegrees).toBeLessThan(0);
    expect(getGeocentricPosition(Body.Sun, new Date('2024-03-22T00:00:00Z')).decDegrees).toBeGreaterThan(0);
  });

  it('moves the Sun from the northern to the southern sky across the September equinox', () => {
    expect(getGeocentricPosition(Body.Sun, new Date('2024-09-20T00:00:00Z')).decDegrees).toBeGreaterThan(0);
    expect(getGeocentricPosition(Body.Sun, new Date('2024-09-25T00:00:00Z')).decDegrees).toBeLessThan(0);
  });

  it('keeps the Sun within the ecliptic declination band all year', () => {
    for (let day = 0; day < 366; day++) {
      const { decDegrees } = getGeocentricPosition(Body.Sun, new Date(Date.UTC(2024, 0, 1) + day * DAY_MS));
      expect(Math.abs(decDegrees)).toBeLessThan(23.6);
    }
  });

  it('wraps Sun right ascension monotonically through 24h → 0h at the March equinox', () => {
    const start = Date.UTC(2024, 2, 19);
    const samples = Array.from({ length: 72 }, (_, hour) => getGeocentricPosition(Body.Sun, new Date(start + hour * 3600_000)).raHours);
    expect(samples.every((ra) => ra >= 0 && ra < 24)).toBe(true);
    expect(Math.max(...samples)).toBeGreaterThan(23.8);
    expect(Math.min(...samples)).toBeLessThan(0.2);
    for (let i = 1; i < samples.length; i++) {
      const step = forwardDifference(samples[i], samples[i - 1], 24);
      expect(step).toBeGreaterThan(0.001);
      expect(step).toBeLessThan(0.005);
    }
  });

  it('reports the Sun at perihelion and aphelion distances', () => {
    expect(getGeocentricPosition(Body.Sun, new Date('2024-01-03T00:38:00Z')).distanceAu).toBeCloseTo(0.9833, 3);
    expect(getGeocentricPosition(Body.Sun, new Date('2024-07-05T05:06:00Z')).distanceAu).toBeCloseTo(1.0167, 3);
  });

  it('applies aberration: differs from the geometric position but matches the aberrated one', () => {
    const date = new Date('2024-03-20T03:06:00Z');
    const aberrated = actual.EquatorFromVector(actual.GeoVector(Body.Sun, date, true));
    const geometric = actual.EquatorFromVector(actual.GeoVector(Body.Sun, date, false));
    const position = getGeocentricPosition(Body.Sun, date);
    expect(position.raHours).toBeCloseTo(aberrated.ra, 12);
    expect(position.raHours).not.toBeCloseTo(geometric.ra, 6);
  });

  it('keeps the Moon within lunar distance and declination limits', () => {
    for (const date of GRID) {
      const { raHours, decDegrees, distanceAu } = getGeocentricPosition(Body.Moon, date);
      expect(distanceAu).toBeGreaterThan(0.0023);
      expect(distanceAu).toBeLessThan(0.0028);
      expect(Math.abs(decDegrees)).toBeLessThan(30);
      expect(raHours).toBeGreaterThanOrEqual(0);
      expect(raHours).toBeLessThan(24);
    }
  });

  it.each([
    [Body.Sun, 0.98, 1.02],
    [Body.Mercury, 0.5, 1.5],
    [Body.Venus, 0.25, 1.75],
    [Body.Mars, 0.35, 2.7],
    [Body.Jupiter, 3.9, 6.5],
    [Body.Saturn, 7.9, 11.2],
    [Body.Uranus, 17.1, 21.3],
    [Body.Neptune, 28.7, 31.4],
  ])('keeps %s within its geocentric distance range [%f, %f] AU with valid RA/Dec', (body, minAu, maxAu) => {
    for (const date of GRID) {
      const { raHours, decDegrees, distanceAu } = getGeocentricPosition(body, date);
      expect(distanceAu).toBeGreaterThan(minAu);
      expect(distanceAu).toBeLessThan(maxAu);
      expect(raHours).toBeGreaterThanOrEqual(0);
      expect(raHours).toBeLessThan(24);
      expect(decDegrees).toBeGreaterThanOrEqual(-90);
      expect(decDegrees).toBeLessThanOrEqual(90);
    }
  });
});

describe('getMoonPhaseAngle astronomy', () => {
  it.each([
    ['New Moon', '2024-01-11T11:57:00Z', 0],
    ['First Quarter', '2024-01-18T03:53:00Z', 90],
    ['Full Moon', '2024-01-25T17:54:00Z', 180],
    ['Last Quarter', '2024-02-02T23:18:00Z', 270],
  ])('matches the published %s time', (_label, iso, expected) => {
    expect(circularDistance(getMoonPhaseAngle(new Date(iso)), expected, 360)).toBeLessThan(0.5);
  });

  it('wraps from just under 360° to just over 0° across the New Moon', () => {
    const before = getMoonPhaseAngle(new Date('2024-01-11T09:57:00Z'));
    const after = getMoonPhaseAngle(new Date('2024-01-11T13:57:00Z'));
    expect(before).toBeGreaterThan(358);
    expect(before).toBeLessThan(360);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(2);
  });

  it('advances 9°–16° per day and stays in [0, 360)', () => {
    let previous = getMoonPhaseAngle(new Date(Date.UTC(2024, 0, 1)));
    for (let day = 1; day <= 60; day++) {
      const current = getMoonPhaseAngle(new Date(Date.UTC(2024, 0, 1) + day * DAY_MS));
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThan(360);
      const step = forwardDifference(current, previous, 360);
      expect(step).toBeGreaterThan(9);
      expect(step).toBeLessThan(16);
      previous = current;
    }
  });

  it('stays within [0, 360) across distant epochs', () => {
    const dates = [new Date('1900-01-01T00:00:00Z'), new Date('1969-07-20T20:17:40Z'), new Date('2100-12-31T23:59:59Z'), ...GRID];
    for (const date of dates) {
      const phase = getMoonPhaseAngle(date);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(360);
    }
  });
});

describe('computeCelestialPositions astronomy', () => {
  const date = new Date('2026-06-21T12:00:00Z');

  it('returns exactly the nine expected bodies', () => {
    expect(Object.keys(computeCelestialPositions(date)).sort()).toEqual(
      ['jupiter', 'mars', 'mercury', 'moon', 'neptune', 'saturn', 'sun', 'uranus', 'venus'],
    );
  });

  it('is deterministic for a given instant', () => {
    expect(computeCelestialPositions(date)).toEqual(computeCelestialPositions(new Date(date.getTime())));
  });

  it('agrees with the individual position and phase functions', () => {
    const positions = computeCelestialPositions(date);
    expect(positions.sun).toEqual(getGeocentricPosition(Body.Sun, date));
    expect(positions.neptune).toEqual(getGeocentricPosition(Body.Neptune, date));
    expect(positions.moon.phaseAngle).toBe(getMoonPhaseAngle(date));
  });

  it('keeps every body in valid RA/Dec range across epochs, including pre-1970 and far-future dates', () => {
    const dates = [new Date('1900-01-01T00:00:00Z'), new Date('1969-07-20T20:17:40Z'), new Date('2100-12-31T23:59:59Z'), ...GRID.slice(0, 40)];
    for (const d of dates) {
      for (const position of Object.values(computeCelestialPositions(d))) {
        expect(position.raHours).toBeGreaterThanOrEqual(0);
        expect(position.raHours).toBeLessThan(24);
        expect(position.decDegrees).toBeGreaterThanOrEqual(-90);
        expect(position.decDegrees).toBeLessThanOrEqual(90);
      }
    }
  });
});