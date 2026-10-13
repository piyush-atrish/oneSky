import * as THREE from 'three';
import { getTiltCorrection } from '../src/math/HorizonRotation';
import {
  COMPASS_FRAME_LENGTH, COMPASS_POINTS, MARKER_HEIGHT, compassAnchors, placeCompassMarker,
} from '../src/render/compassGeometry';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const W = 390, H = 844, FAR = 100, GROUND = 0.2;
const FOOT = H - 34 - 24;
const anchors = compassAnchors(FAR, GROUND);
const N = 0, E = 1, S = 2, WEST = 3;

/** The camera exactly as CameraManager poses it: azimuth 0 looks along +X, elevation raises the gaze. */
function camera(azimuth: number, elevation: number, fov = 45) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, FAR);
  cam.up.set(0, 0, 1);
  cam.lookAt(new THREE.Vector3(Math.cos(elevation) * Math.cos(azimuth), Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation)));
  cam.updateMatrixWorld();
  return cam;
}
function frameOf(cam: THREE.PerspectiveCamera): number[] {
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return [...m.elements, W, H];
}
const anchorAt = (i: number) => new THREE.Vector3(anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]);
const place = (frame: number[], i: number) => placeCompassMarker(frame, anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2], FOOT);
/** Where three.js says the ground edge is, in dp from the top. */
function horizonPx(cam: THREE.PerspectiveCamera, i: number) {
  const p = anchorAt(i).project(cam);
  return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, behind: p.z > 1 };
}

describe('compass anchors', () => {
  it('are unit vectors on the ground edge: N +Y, E +X, S -Y, W -X, a hair below horizontal', () => {
    COMPASS_POINTS.forEach((p, i) => {
      const a = anchorAt(i);
      expect(a.length()).toBeCloseTo(1, 9);
      expect(a.x).toBeCloseTo(p.dx, 3);
      expect(a.y).toBeCloseTo(p.dy, 3);
      expect(a.z).toBeLessThan(0);
      expect(a.z).toBeGreaterThan(-0.01);
      expect(Math.asin(-a.z) * (180 / Math.PI)).toBeCloseTo((Math.atan2(GROUND, FAR) * 180) / Math.PI, 3); // 0.115 degrees
    });
  });

  it('agree with the sky math: the north celestial pole is on the N side at every latitude', () => {
    for (const latitude of [80, 51.5, 28.6, 0, -33.9]) {
      const pole = new THREE.Vector3(0, 0, 1).applyQuaternion(getTiltCorrection(latitude));
      expect(pole.dot(anchorAt(N))).toBeGreaterThan(0);
      expect(pole.dot(anchorAt(S))).toBeLessThan(0);
      expect(Math.abs(pole.x)).toBeLessThan(1e-9);
    }
  });
});

describe('placement', () => {
  it('matches three.js projection of the ground edge', () => {
    for (const [az, el, fov] of [[0, 0, 45], [0.3, 0.1, 30], [Math.PI / 2, -0.05, 60], [-1, 0.2, 75]] as const) {
      const cam = camera(az, el, fov);
      const frame = frameOf(cam);
      for (let i = 0; i < 4; i++) {
        const expected = horizonPx(cam, i);
        const got = place(frame, i);
        if (expected.behind) { expect(got).toBeNull(); continue; }
        if (got && got.y < FOOT) {
          expect(got.x).toBeCloseTo(expected.x, 3);
          expect(got.y).toBeCloseTo(expected.y, 3);
        }
      }
    }
  });

  it('opens clean: in the default view the marker is whole, centered, and rests on the terrain edge', () => {
    const cam = camera(0, 0); // the default pose, facing +X
    const e = place(frameOf(cam), E)!;
    expect(e.x).toBeCloseTo(W / 2, 3);
    expect(Math.abs(e.y - H / 2)).toBeLessThan(3); // on the terrain edge (0.115 degrees, about 2 dp, below true horizontal)
    expect(e.y - MARKER_HEIGHT).toBeGreaterThan(0); // the whole marker is on screen
    expect(e.opacity).toBe(1);
    expect(place(frameOf(cam), N)).toBeNull(); // 90 degrees to the side: out of the field of view
  });

  it('never sits below the horizon, so terrain can never cover it, from any camera pose or zoom', () => {
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let shown = 0;
    for (let k = 0; k < 4000; k++) {
      const cam = camera(rnd() * Math.PI * 2, -1.3 + rnd() * 2.8, 10 + rnd() * 65);
      const frame = frameOf(cam);
      for (let i = 0; i < 4; i++) {
        const marker = place(frame, i);
        const truth = horizonPx(cam, i);
        if (truth.behind) { expect(marker).toBeNull(); continue; }
        if (!marker) continue;
        expect(marker.y).toBeLessThanOrEqual(truth.y + 1e-6);
        expect(marker.opacity).toBeGreaterThanOrEqual(0);
        expect(marker.opacity).toBeLessThanOrEqual(1);
        if (marker.opacity > 0.5) shown++;
      }
    }
    expect(shown).toBeGreaterThan(100); // the property was exercised on plenty of visible markers, not vacuously
  });

  it('rides the foot of the view while the horizon sinks, then fades away', () => {
    let last = 2;
    let pinned = false;
    for (let el = 0.2; el <= 1.3; el += 0.02) {
      const marker = place(frameOf(camera(0, el)), E);
      if (!marker) continue;
      expect(marker.y).toBeLessThanOrEqual(FOOT + 1e-9);
      if (Math.abs(marker.y - FOOT) < 1e-9) pinned = true;
      expect(marker.opacity).toBeLessThanOrEqual(last + 1e-9); // only ever fades as the camera tips further up
      last = marker.opacity;
    }
    expect(pinned).toBe(true);
    expect(last).toBe(0);
  });

  it('fades out as the horizon leaves through the top when looking down', () => {
    expect(place(frameOf(camera(0, -0.1)), E)!.opacity).toBe(1);
    expect(place(frameOf(camera(0, -0.5)), E)!.opacity).toBe(0);
  });

  it('fades near the side edges instead of being cut off', () => {
    const cam = camera(0, 0);
    const frame = frameOf(cam);
    const seen: number[] = [];
    for (let az = 0; az < 0.3; az += 0.002) {
      const m = place(frameOf(camera(-az, 0)), E);
      if (m && m.x > 0 && m.x < W) seen.push(m.opacity);
    }
    expect(seen[0]).toBe(1);
    expect(Math.min(...seen)).toBeLessThan(0.1);
    expect(frame.length).toBe(COMPASS_FRAME_LENGTH);
  });

  it('is hidden until anchors and a frame exist', () => {
    expect(placeCompassMarker([], 0, 1, 0, FOOT)).toBeNull();
    expect(placeCompassMarker(frameOf(camera(0, 0)), undefined, 0, 0, FOOT)).toBeNull();
  });
});

describe('what the old 3D markers did wrong', () => {
  it('put 42% of every letter below the terrain', () => {
    const glyphSize = 2.5; // HorizonLayer's GLYPH_SIZE: letters spanned z in [-0.5, 0.5] * glyphSize around the horizon
    const bottom = -0.5 * glyphSize;
    const hidden = (-GROUND - bottom) / glyphSize;
    expect(hidden).toBeCloseTo(0.42, 2);
  });
});