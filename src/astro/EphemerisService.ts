import * as Astronomy from 'astronomy-engine';

export interface CelestialPosition {
  readonly raHours: number;
  readonly decDegrees: number;
  readonly distanceAu: number;
}

export interface MoonPosition extends CelestialPosition {
  readonly phaseAngle: number;
}

export interface CelestialPositions {
  readonly sun: CelestialPosition;
  readonly moon: MoonPosition;
  readonly mercury: CelestialPosition;
  readonly venus: CelestialPosition;
  readonly mars: CelestialPosition;
  readonly jupiter: CelestialPosition;
  readonly saturn: CelestialPosition;
  readonly uranus: CelestialPosition;
  readonly neptune: CelestialPosition;
}

export function getGeocentricPosition(body: Astronomy.Body, date: Date): CelestialPosition {
  const vector = Astronomy.GeoVector(body, date, true);
  const equator = Astronomy.EquatorFromVector(vector);
  return { raHours: equator.ra, decDegrees: equator.dec, distanceAu: equator.dist };
}

export function getMoonPhaseAngle(date: Date): number {
  return Astronomy.MoonPhase(date);
}

export function computeCelestialPositions(date: Date): CelestialPositions {
  return {
    sun: getGeocentricPosition(Astronomy.Body.Sun, date),
    moon: {
      ...getGeocentricPosition(Astronomy.Body.Moon, date),
      phaseAngle: getMoonPhaseAngle(date),
    },
    mercury: getGeocentricPosition(Astronomy.Body.Mercury, date),
    venus: getGeocentricPosition(Astronomy.Body.Venus, date),
    mars: getGeocentricPosition(Astronomy.Body.Mars, date),
    jupiter: getGeocentricPosition(Astronomy.Body.Jupiter, date),
    saturn: getGeocentricPosition(Astronomy.Body.Saturn, date),
    uranus: getGeocentricPosition(Astronomy.Body.Uranus, date),
    neptune: getGeocentricPosition(Astronomy.Body.Neptune, date),
  };
}