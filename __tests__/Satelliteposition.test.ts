import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { getSatellitePosition } from '../src/astro/SatelliteService';
import { raDecToCartesian } from '../src/math/Coordinates';
import { getHorizonRotation } from '../src/math/HorizonRotation';

const LINE1 = '1 25544U 98067A   24281.94613913  .00060656  00000+0  10827-2 0  9995';
const LINE2 = '2 25544  51.6396 116.8808 0009356  47.4323  95.8615 15.49426003476038';
const OBSERVER = { latitude: 28.6, longitude: 77.2 };
const START = Date.UTC(2024, 9, 7, 22, 42, 26);
const MIN_ELEVATION_RAD = (20 * Math.PI) / 180;

function lookAngles(date: Date) {
  const position = satellite.propagate(satellite.twoline2satrec(LINE1, LINE2), date)!.position;
  const observer = {
    latitude: satellite.degreesToRadians(OBSERVER.latitude),
    longitude: satellite.degreesToRadians(OBSERVER.longitude),
    height: 0,
  };
  return satellite.ecfToLookAngles(observer, satellite.eciToEcf(position, satellite.gstime(date)));
}

function expectedDirection(date: Date): THREE.Vector3 {
  const { azimuth, elevation } = lookAngles(date);
  return new THREE.Vector3(Math.cos(elevation) * Math.sin(azimuth), Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation));
}

function sceneDirection(date: Date, observer?: typeof OBSERVER): THREE.Vector3 {
  const position = getSatellitePosition(LINE1, LINE2, date, observer);
  if (!position) throw new Error('propagation failed');
  return raDecToCartesian(position.raHours, position.decDegrees, 1).applyQuaternion(
    getHorizonRotation(date, OBSERVER.latitude, OBSERVER.longitude),
  );
}

const angleDeg = (a: THREE.Vector3, b: THREE.Vector3): number => (a.angleTo(b) * 180) / Math.PI;

const visibleDates = Array.from({ length: 1440 }, (_, minute) => new Date(START + minute * 60_000)).filter(
  (date) => lookAngles(date).elevation > MIN_ELEVATION_RAD,
);

describe('getSatellitePosition observer correction', () => {
  it('finds visible pass samples', () => {
    expect(visibleDates.length).toBeGreaterThan(0);
  });

  it('matches satellite.js look angles when given the observer', () => {
    for (const date of visibleDates) {
      expect(angleDeg(sceneDirection(date, OBSERVER), expectedDirection(date))).toBeLessThan(0.6);
    }
  });

  it('is far from the true direction when computed geocentrically', () => {
    for (const date of visibleDates) {
      expect(angleDeg(sceneDirection(date), expectedDirection(date))).toBeGreaterThan(20);
    }
  });
});