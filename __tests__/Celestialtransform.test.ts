import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { raDecToCartesian } from '../src/math/Coordinates';
import { getHorizonRotation } from '../src/math/HorizonRotation';

interface StarFixture {
  readonly name: string;
  readonly hip: number;
  readonly raHours: number;
  readonly decDegrees: number;
}

const POLARIS: StarFixture = { name: 'Polaris', hip: 11767, raHours: 2.52975, decDegrees: 89.264109 };
const SIRIUS: StarFixture = { name: 'Sirius', hip: 32349, raHours: 6.752481, decDegrees: -16.716116 };

const BENCHMARK_DATE = new Date('2026-06-21T12:00:00Z');
const LONDON = { latitude: 51.5, longitude: -0.1 };

function expectedEnu(altitudeDeg: number, azimuthDeg: number): THREE.Vector3 {
  const altRad = (altitudeDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(altRad) * Math.sin(azRad), Math.cos(altRad) * Math.cos(azRad), Math.sin(altRad));
}

function toHorizonVector(star: StarFixture, date: Date, latitude: number, longitude: number): THREE.Vector3 {
  const rotation = getHorizonRotation(date, latitude, longitude);
  const vector = raDecToCartesian(star.raHours, star.decDegrees, 1);
  return vector.applyQuaternion(rotation);
}

describe('equatorial-to-horizon transformation', () => {
  it.each([POLARIS, SIRIUS])('matches Astronomy.Horizon() for $name from London', (star) => {
    const got = toHorizonVector(star, BENCHMARK_DATE, LONDON.latitude, LONDON.longitude);
    const observer = new Astronomy.Observer(LONDON.latitude, LONDON.longitude, 0);
    const horizon = Astronomy.Horizon(BENCHMARK_DATE, observer, star.raHours, star.decDegrees);
    const expected = expectedEnu(horizon.altitude, horizon.azimuth);

    expect(got.x).toBeCloseTo(expected.x, 9);
    expect(got.y).toBeCloseTo(expected.y, 9);
    expect(got.z).toBeCloseTo(expected.z, 9);
  });

  it('matches Astronomy.Horizon() across a grid of observers and times', () => {
    const observers = [
      { latitude: 0, longitude: 0 },
      { latitude: -33.9, longitude: 151.2 },
      { latitude: 28.6, longitude: 77.2 },
      { latitude: 89, longitude: 10 },
      { latitude: -80, longitude: -45 },
    ];
    const dates = [BENCHMARK_DATE, new Date('2026-01-15T03:22:00Z'), new Date('2026-11-02T18:00:00Z')];

    for (const observerLocation of observers) {
      for (const date of dates) {
        for (const star of [POLARIS, SIRIUS]) {
          const got = toHorizonVector(star, date, observerLocation.latitude, observerLocation.longitude);
          const observer = new Astronomy.Observer(observerLocation.latitude, observerLocation.longitude, 0);
          const horizon = Astronomy.Horizon(date, observer, star.raHours, star.decDegrees);
          const expected = expectedEnu(horizon.altitude, horizon.azimuth);

          expect(got.distanceTo(expected)).toBeLessThan(1e-8);
        }
      }
    }
  });

  it('aligns the celestial pole with local Zenith for an observer at the North Pole', () => {
    const rotation = getHorizonRotation(BENCHMARK_DATE, 90, 0);
    for (const raHours of [0, 6, 12, 18, 23.5]) {
      const pole = raDecToCartesian(raHours, 90, 1).applyQuaternion(rotation);
      expect(pole.x).toBeCloseTo(0, 9);
      expect(pole.y).toBeCloseTo(0, 9);
      expect(pole.z).toBeCloseTo(1, 9);
    }
  });
});