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

import { TleHttpError } from './TleCache';

/** CelesTrak's current-data query for the ISS (NORAD 25544). Respect https://celestrak.org/usage-policy.php. */
const CELESTRAK_ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle';
/**
 * Optional cache proxy that answers `{ "line1": "...", "line2": "..." }` (see docs/TLE_PROXY_STRATEGY.md).
 * Set EXPO_PUBLIC_TLE_PROXY_URL when many devices share one network (for example a school), so that CelesTrak
 * sees one request per update cycle instead of one per device.
 */
const TLE_PROXY_URL = process.env.EXPO_PUBLIC_TLE_PROXY_URL ?? '';
const REQUEST_TIMEOUT_MS = 15_000;

async function getWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Downloads the ISS TLE. Throws TleHttpError for any non-200 answer so the caller can stop querying. */
export async function downloadIssTle(): Promise<[string, string]> {
  const res = await getWithTimeout(TLE_PROXY_URL || CELESTRAK_ISS_URL);
  if (res.status !== 200) {
    throw new TleHttpError(res.status, `Failed to fetch ISS TLE: ${res.status} ${res.statusText}`);
  }
  if (TLE_PROXY_URL) {
    const body = (await res.json()) as { line1?: unknown; line2?: unknown };
    if (typeof body.line1 !== 'string' || typeof body.line2 !== 'string') {
      throw new Error('Malformed TLE response from proxy');
    }
    return [body.line1, body.line2];
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