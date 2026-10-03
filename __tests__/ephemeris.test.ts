import { getMoonPhaseAngle, computeCelestialPositions, CelestialPositions } from '../src/astro/EphemerisService';
import { getSatellitePosition } from '../src/astro/SatelliteService';

function angularDistanceFromZero(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  return Math.min(wrapped, 360 - wrapped);
}

describe('getMoonPhaseAngle', () => {
  it('matches the published New Moon of 2000-01-06 18:13:42 UTC', () => {
    const newMoon = new Date('2000-01-06T18:13:42Z');
    const phase = getMoonPhaseAngle(newMoon);
    expect(angularDistanceFromZero(phase)).toBeLessThan(0.1);
  });
});

describe('getSatellitePosition', () => {
  const tleLine1 = '1 25544U 98067A   24281.94613913  .00060656  00000+0  10827-2 0  9995';
  const tleLine2 = '2 25544  51.6396 116.8808 0009356  47.4323  95.8615 15.49426003476038';
  const nearEpoch = new Date('2024-10-07T22:42:26Z');

  it('does not return null for a valid TLE propagated near its own epoch', () => {
    const position = getSatellitePosition(tleLine1, tleLine2, nearEpoch);
    expect(position).not.toBeNull();
  });

  it('returns RA/Dec within the ISS orbital inclination bound', () => {
    const position = getSatellitePosition(tleLine1, tleLine2, nearEpoch);
    expect(position!.raHours).toBeGreaterThanOrEqual(0);
    expect(position!.raHours).toBeLessThan(24);
    expect(Math.abs(position!.decDegrees)).toBeLessThanOrEqual(51.7);
  });
});

describe('computeCelestialPositions', () => {
  const benchmarkDate = new Date('2000-01-06T18:13:42Z');
  const positions = computeCelestialPositions(benchmarkDate);

  it.each(Object.keys(positions) as (keyof CelestialPositions)[])(
    '%s has RA in [0, 24) and Dec in [-90, 90]',
    (name) => {
      const position = positions[name];
      expect(position.raHours).toBeGreaterThanOrEqual(0);
      expect(position.raHours).toBeLessThan(24);
      expect(position.decDegrees).toBeGreaterThanOrEqual(-90);
      expect(position.decDegrees).toBeLessThanOrEqual(90);
    },
  );
});