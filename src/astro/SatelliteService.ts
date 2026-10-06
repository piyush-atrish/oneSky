import * as satellite from 'satellite.js';
import * as Astronomy from 'astronomy-engine';

export interface EquatorialPosition {
  readonly raHours: number;
  readonly decDegrees: number;
}

export interface ObserverLocation {
  readonly latitude: number;
  readonly longitude: number;
}

const ISS_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle';

export async function downloadIssTle(): Promise<[string, string]> {
  const res = await fetch(ISS_TLE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ISS TLE: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  const line1 = lines.find((line) => line.startsWith('1 '));
  const line2 = lines.find((line) => line.startsWith('2 '));
  if (!line1 || !line2) {
    throw new Error('Malformed TLE response from CelesTrak');
  }
  return [line1, line2];
}

export function getSatellitePosition(
  tleLine1: string,
  tleLine2: string,
  date: Date,
  observer?: ObserverLocation,
): EquatorialPosition | null {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const positionAndVelocity = satellite.propagate(satrec, date);
  if (!positionAndVelocity) return null;

  let { x, y, z } = positionAndVelocity.position;
  if (observer) {
    const observerEci = satellite.ecfToEci(
      satellite.geodeticToEcf({
        latitude: satellite.degreesToRadians(observer.latitude),
        longitude: satellite.degreesToRadians(observer.longitude),
        height: 0,
      }),
      satellite.gstime(date),
    );
    x -= observerEci.x;
    y -= observerEci.y;
    z -= observerEci.z;
  }
  const temeVector = new Astronomy.Vector(x, y, z, Astronomy.MakeTime(date));
  const rotation = Astronomy.Rotation_EQD_EQJ(date);
  const equatorialVector = Astronomy.RotateVector(rotation, temeVector);
  const equator = Astronomy.EquatorFromVector(equatorialVector);

  return { raHours: equator.ra, decDegrees: equator.dec };
}