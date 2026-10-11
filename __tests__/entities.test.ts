import * as THREE from 'three';
import type { CelestialPositions } from '../src/astro/EphemerisService';
import { ENTITY_DETAILS, getEntityDetail } from '../src/data/entityDetails';
import { CONSTELLATION_LINES } from '../src/data/constellationLines';
import { STAR_CATALOG } from '../src/data/starCatalog';
import {
  FRAME_LENGTH, LABEL_ENTITIES, countVisibleLabels, getAnchorDirection, labelOpacity, pickEntityId, projectLabel,
  type PickFilters,
} from '../src/render/entityGeometry';
import { raDecToCartesian } from '../src/math/Coordinates';
import { useSelectionStore } from '../src/store/useSelectionStore';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const WIDTH = 400;
const HEIGHT = 800;
const FILTERS: PickFilters = { showSolarSystem: true, showConstellations: true, showTerrain: false };
const IDENTITY = new THREE.Quaternion();
// Every star on Orion's lines: lines connected to its seed.
const ORION = (() => {
  const orion = getEntityDetail('orion');
  const seen = new Set<number>(orion?.type === 'constellation' ? orion.seedStars : []);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [a, b] of CONSTELLATION_LINES) {
      if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
    }
  }
  return seen;
})();

function cameraLookingAt(direction: THREE.Vector3, fov = 45): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, WIDTH / HEIGHT, 0.1, 100);
  camera.up.set(0, 0, 1);
  camera.lookAt(direction);
  camera.updateMatrixWorld();
  return camera;
}

const view = (camera: THREE.Camera, rotation = IDENTITY) => ({ camera, width: WIDTH, height: HEIGHT, rotation });

function screenOf(direction: THREE.Vector3, camera: THREE.Camera) {
  const p = direction.clone().project(camera);
  return { x: ((p.x + 1) / 2) * WIDTH, y: ((1 - p.y) / 2) * HEIGHT };
}

function hipDirection(hip: number): THREE.Vector3 {
  const star = STAR_CATALOG.find(([id]) => id === hip)!;
  return raDecToCartesian(star[1], star[2], 1);
}

describe('entity dictionary', () => {
  it('keys match ids and every entity is complete', () => {
    for (const [key, entity] of Object.entries(ENTITY_DETAILS)) {
      expect(entity.id).toBe(key);
      expect(entity.name.length).toBeGreaterThan(0);
      expect(entity.description.length).toBeGreaterThan(40);
      expect(entity.facts.length).toBeGreaterThan(0);
      expect(entity.labelMaxFov).toBeGreaterThan(10);
    }
  });

  it('has all three categories, and a planet for each body', () => {
    const types = new Set(Object.values(ENTITY_DETAILS).map((e) => e.type));
    expect(types).toEqual(new Set(['star', 'planet', 'moon', 'constellation']));
    const bodies = Object.values(ENTITY_DETAILS).flatMap((e) => (e.type === 'planet' ? [e.body] : []));
    expect(bodies.sort()).toEqual(['jupiter', 'mars', 'mercury', 'neptune', 'saturn', 'uranus', 'venus']);
  });

  it('resolves a sky position for every catalog star and constellation', () => {
    for (const entity of Object.values(ENTITY_DETAILS)) {
      if (entity.type === 'star' && 'hip' in entity.anchor) expect(getAnchorDirection(entity, null)).not.toBeNull();
      if (entity.type === 'constellation') {
        const center = getAnchorDirection(entity, null);
        expect(center).not.toBeNull();
        expect(center!.length()).toBeCloseTo(1, 5);
      }
    }
  });

  it('looks ids up safely', () => {
    expect(getEntityDetail('sirius')?.name).toBe('Sirius');
    expect(getEntityDetail('constructor')).toBeNull();
    expect(getEntityDetail('nope')).toBeNull();
  });
});

describe('selection store', () => {
  it('opens only for dictionary ids', () => {
    useSelectionStore.getState().clearSelection();
    expect(useSelectionStore.getState().selectEntity('HIP 1')).toBe(false);
    expect(useSelectionStore.getState().selectedEntity).toBeNull();
    expect(useSelectionStore.getState().selectEntity('orion')).toBe(true);
    expect(useSelectionStore.getState().selectedEntity?.name).toBe('Orion');
    expect(useSelectionStore.getState().selectEntity('unknown')).toBe(false);
    expect(useSelectionStore.getState().selectedEntity?.name).toBe('Orion');
  });
});

describe('pickEntityId', () => {
  const sirius = hipDirection(32349);
  const camera = cameraLookingAt(sirius);

  it('picks a star under the tap, and nothing elsewhere', () => {
    const at = screenOf(sirius, camera);
    expect(pickEntityId({ x: at.x + 10, y: at.y }, view(camera), FILTERS, null)).toBe('sirius');
    expect(pickEntityId({ x: at.x, y: at.y + 300 }, view(camera), FILTERS, null)).toBeNull();
  });

  it('ignores objects hidden below the horizon when terrain is on', () => {
    const at = screenOf(sirius, camera); // Sirius is at negative declination: below z=0 with no sky rotation
    expect(pickEntityId(at, view(camera), { ...FILTERS, showTerrain: true }, null)).toBeNull();
  });

  it('ignores objects behind the camera', () => {
    const away = cameraLookingAt(sirius.clone().negate());
    const mirrored = screenOf(sirius, away);
    expect(pickEntityId(mirrored, view(away), FILTERS, null)).toBeNull();
  });

  it('picks a planet from the ephemeris, and respects the solar system toggle', () => {
    const mars = raDecToCartesian(10, 5, 1);
    const far = { raHours: 22, decDegrees: -40, distanceAu: 1 };
    const positions = { sun: far, moon: far, mars: { raHours: 10, decDegrees: 5, distanceAu: 1.5 } } as unknown as CelestialPositions;
    const cam = cameraLookingAt(mars);
    expect(pickEntityId(screenOf(mars, cam), view(cam), FILTERS, positions)).toBe('mars');
    expect(pickEntityId(screenOf(mars, cam), view(cam), { ...FILTERS, showSolarSystem: false }, positions)).toBeNull();
  });

  it('picks a constellation by its line, and respects the constellations toggle', () => {
    // Use the Orion segment whose midpoint is farthest from every dictionary star, so no star can win.
    const stars = Object.values(ENTITY_DETAILS).flatMap((e) => (e.type === 'star' ? [getAnchorDirection(e, null)] : []));
    let best: THREE.Vector3 | null = null;
    let bestGap = 0;
    for (const [a, b] of CONSTELLATION_LINES) {
      if (!ORION.has(a)) continue;
      const mid = hipDirection(a).add(hipDirection(b)).normalize();
      const gap = Math.min(...stars.map((d) => (d ? Math.acos(Math.min(1, d.dot(mid))) : Infinity)));
      if (gap > bestGap) { bestGap = gap; best = mid; }
    }
    const cam = cameraLookingAt(best!);
    const tap = screenOf(best!, cam);
    expect(pickEntityId(tap, view(cam), FILTERS, null)).toBe('orion');
    expect(pickEntityId(tap, view(cam), { ...FILTERS, showConstellations: false }, null)).toBeNull();
  });

  it('prefers a star over a constellation line it sits on', () => {
    const rigel = hipDirection(24436);
    const cam = cameraLookingAt(rigel);
    expect(pickEntityId(screenOf(rigel, cam), view(cam), FILTERS, null)).toBe('rigel');
  });
});

describe('label projection', () => {
  function frameFor(camera: THREE.PerspectiveCamera, rotation: THREE.Quaternion, terrain: boolean): number[] {
    const rot = new THREE.Matrix4().makeRotationFromQuaternion(rotation);
    const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(rot);
    const frame = new Array<number>(FRAME_LENGTH).fill(0);
    m.elements.forEach((v, i) => (frame[i] = v));
    frame[16] = rot.elements[2];
    frame[17] = rot.elements[6];
    frame[18] = rot.elements[10];
    frame[19] = WIDTH;
    frame[20] = HEIGHT;
    frame[21] = terrain ? 1 : 0;
    frame[22] = camera.fov;
    return frame;
  }
  const flat = (v: THREE.Vector3) => [v.x, v.y, v.z];

  it('matches three.js projection, including a rotated sky', () => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.4);
    const dir = new THREE.Vector3(1, 0.2, 0.3).normalize();
    const camera = cameraLookingAt(dir.clone().applyQuaternion(rotation));
    const frame = frameFor(camera, rotation, false);
    const expected = screenOf(dir.clone().applyQuaternion(rotation), camera);
    const point = projectLabel(frame, flat(dir), 0)!;
    expect(point.x).toBeCloseTo(expected.x, 3);
    expect(point.y).toBeCloseTo(expected.y, 3);
  });

  it('hides behind-camera, off-screen, unknown and below-horizon anchors', () => {
    const dir = new THREE.Vector3(1, 0, 0.5).normalize();
    const camera = cameraLookingAt(dir);
    const frame = frameFor(camera, IDENTITY, true);
    expect(projectLabel(frame, flat(dir.clone().negate()), 0)).toBeNull();
    expect(projectLabel(frame, flat(new THREE.Vector3(0, 1, 0.5).normalize()), 0)).toBeNull();
    expect(projectLabel(frame, [0, 0, 0], 0)).toBeNull();
    expect(projectLabel([], flat(dir), 0)).toBeNull();
    const low = new THREE.Vector3(1, 0, -0.3).normalize();
    const lowFrame = frameFor(cameraLookingAt(low), IDENTITY, true);
    expect(projectLabel(lowFrame, flat(low), 0)).toBeNull();
    expect(projectLabel(frameFor(cameraLookingAt(low), IDENTITY, false), flat(low), 0)).not.toBeNull();
  });
});

describe('label level of detail', () => {
  it('fades with zoom and orders entities by how long they stay visible', () => {
    expect(labelOpacity(10, 60)).toBe(1);
    expect(labelOpacity(56, 60)).toBeCloseTo(0.5, 5);
    expect(labelOpacity(60, 60)).toBe(0);
    expect(labelOpacity(75, 60)).toBe(0);
    for (let i = 1; i < LABEL_ENTITIES.length; i++) {
      expect(LABEL_ENTITIES[i - 1].labelMaxFov).toBeGreaterThanOrEqual(LABEL_ENTITIES[i].labelMaxFov);
    }
  });

  it('shows nothing zoomed all the way out, and everything zoomed all the way in', () => {
    expect(countVisibleLabels(75)).toBe(0);
    expect(countVisibleLabels(10)).toBe(LABEL_ENTITIES.length);
    expect(countVisibleLabels(45)).toBeGreaterThan(0);
  });
});
