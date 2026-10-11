/**
 * Sky geometry shared by tap picking and label placement. Pure: no React, no stores. Callers pass in the
 * current ephemeris, so everything here is testable with a plain three.js camera.
 */
import * as THREE from 'three';
import type { CelestialPositions } from '../astro/EphemerisService';
import { CONSTELLATION_LINES } from '../data/constellationLines';
import { ENTITY_DETAILS, type ConstellationDetail, type EntityDetail } from '../data/entityDetails';
import { STAR_CATALOG } from '../data/starCatalog';
import { raDecToCartesian } from '../math/Coordinates';

// ---------------------------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------------------------

const starDirections = new Map<number, THREE.Vector3>();
let starDirectionsBuilt = false;

function starDirection(hip: number): THREE.Vector3 | null {
  if (!starDirectionsBuilt) {
    for (const [id, raHours, decDegrees] of STAR_CATALOG) {
      if (id !== 0) starDirections.set(id, raDecToCartesian(raHours, decDegrees, 1));
    }
    starDirectionsBuilt = true;
  }
  return starDirections.get(hip) ?? null;
}

interface Figure {
  readonly segments: readonly (readonly [THREE.Vector3, THREE.Vector3])[];
  readonly center: THREE.Vector3;
}

let lineGraph: Map<number, number[]> | null = null;
const figures = new Map<string, Figure | null>();

function buildFigure(detail: ConstellationDetail): Figure | null {
  if (!lineGraph) {
    lineGraph = new Map();
    for (const [a, b] of CONSTELLATION_LINES) {
      (lineGraph.get(a) ?? lineGraph.set(a, []).get(a)!).push(b);
      (lineGraph.get(b) ?? lineGraph.set(b, []).get(b)!).push(a);
    }
  }
  const members = new Set<number>(detail.seedStars);
  const stack = [...detail.seedStars];
  while (stack.length) {
    for (const next of lineGraph.get(stack.pop()!) ?? []) {
      if (!members.has(next)) {
        members.add(next);
        stack.push(next);
      }
    }
  }

  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  for (const [a, b] of CONSTELLATION_LINES) {
    if (!members.has(a) || !members.has(b)) continue;
    const from = starDirection(a);
    const to = starDirection(b);
    if (from && to) segments.push([from, to]);
  }
  if (segments.length === 0) return null;

  const center = new THREE.Vector3();
  for (const hip of members) {
    const direction = starDirection(hip);
    if (direction) center.add(direction);
  }
  return { segments, center: center.normalize() };
}

function figureOf(detail: ConstellationDetail): Figure | null {
  if (!figures.has(detail.id)) figures.set(detail.id, buildFigure(detail));
  return figures.get(detail.id) ?? null;
}

/** Unit direction of an entity (or a constellation's label point) before the sky rotation, or null if unknown. */
export function getAnchorDirection(detail: EntityDetail, positions: CelestialPositions | null): THREE.Vector3 | null {
  switch (detail.type) {
    case 'constellation':
      return figureOf(detail)?.center ?? null;
    case 'moon':
      return positions ? raDecToCartesian(positions.moon.raHours, positions.moon.decDegrees, 1) : null;
    case 'planet': {
      const p = positions?.[detail.body];
      return p ? raDecToCartesian(p.raHours, p.decDegrees, 1) : null;
    }
    case 'star':
      if ('hip' in detail.anchor) return starDirection(detail.anchor.hip);
      return positions ? raDecToCartesian(positions.sun.raHours, positions.sun.decDegrees, 1) : null;
  }
}

// ---------------------------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------------------------

export const HIT_RADIUS_PX = 35;
export const LINE_HIT_RADIUS_PX = 24;

export interface PickView {
  readonly camera: THREE.Camera;
  readonly width: number;
  readonly height: number;
  /** The celestial group's rotation. */
  readonly rotation: THREE.Quaternion;
}

export interface PickFilters {
  readonly showSolarSystem: boolean;
  readonly showConstellations: boolean;
  readonly showTerrain: boolean;
}

const ENTITY_LIST: readonly EntityDetail[] = Object.values(ENTITY_DETAILS);
const scratch = [new THREE.Vector3(), new THREE.Vector3()] as const;

/** Screen position of a sky direction, or null when it is behind the camera or hidden below the horizon. */
function toScreen(direction: THREE.Vector3, view: PickView, terrain: boolean, out: THREE.Vector3): boolean {
  out.copy(direction).applyQuaternion(view.rotation);
  if (terrain && out.z < 0) return false;
  out.project(view.camera);
  if (out.z > 1) return false;
  out.x = ((out.x + 1) / 2) * view.width;
  out.y = ((1 - out.y) / 2) * view.height;
  return true;
}

function distanceToSegment(px: number, py: number, a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function isVisible(detail: EntityDetail, filters: PickFilters): boolean {
  switch (detail.type) {
    case 'constellation': return filters.showConstellations;
    case 'planet':
    case 'moon': return filters.showSolarSystem;
    case 'star': return 'hip' in detail.anchor || filters.showSolarSystem;
  }
}

/**
 * The dictionary entity under a tap, or null. Stars and planets win over constellation lines: the nearest
 * point within HIT_RADIUS_PX, else the nearest line within LINE_HIT_RADIUS_PX.
 */
export function pickEntityId(
  tap: { readonly x: number; readonly y: number },
  view: PickView,
  filters: PickFilters,
  positions: CelestialPositions | null,
): string | null {
  const [a, b] = scratch;
  let bestId: string | null = null;
  let bestDistance = HIT_RADIUS_PX;

  for (const detail of ENTITY_LIST) {
    if (detail.type === 'constellation' || !isVisible(detail, filters)) continue;
    const direction = getAnchorDirection(detail, positions);
    if (!direction || !toScreen(direction, view, filters.showTerrain, a)) continue;
    const distance = Math.hypot(a.x - tap.x, a.y - tap.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = detail.id;
    }
  }
  if (bestId) return bestId;

  bestDistance = LINE_HIT_RADIUS_PX;
  for (const detail of ENTITY_LIST) {
    if (detail.type !== 'constellation' || !isVisible(detail, filters)) continue;
    for (const [from, to] of figureOf(detail)?.segments ?? []) {
      const fromVisible = toScreen(from, view, filters.showTerrain, a);
      const toVisible = toScreen(to, view, filters.showTerrain, b);
      if (!fromVisible || !toVisible) continue;
      const distance = distanceToSegment(tap.x, tap.y, a, b);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = detail.id;
      }
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------------------------
// Labels: level of detail and projection
// ---------------------------------------------------------------------------------------------

/** Dictionary entities that get a label, widest-visible first, so "visible at this zoom" is a prefix. */
export const LABEL_ENTITIES: readonly EntityDetail[] = [...ENTITY_LIST].sort((x, y) => y.labelMaxFov - x.labelMaxFov);

/** Degrees of zoom over which a label fades from hidden to fully visible. */
export const LABEL_FADE_DEGREES = 8;

/** How many labels (a prefix of LABEL_ENTITIES) are at all visible at this field of view. */
export function countVisibleLabels(fov: number): number {
  let count = 0;
  while (count < LABEL_ENTITIES.length && LABEL_ENTITIES[count].labelMaxFov > fov) count++;
  return count;
}

/**
 * Per-frame snapshot published by the canvas for the label overlay (a flat number array so it crosses to
 * the UI thread cheaply): column-major projection*view*skyRotation, the rotation's z row, and the viewport.
 */
export const FRAME_ROTATION_Z = 16;
export const FRAME_WIDTH = 19;
export const FRAME_HEIGHT = 20;
export const FRAME_TERRAIN = 21;
export const FRAME_FOV = 22;
export const FRAME_LENGTH = 23;

export interface LabelPoint {
  readonly x: number;
  readonly y: number;
}

/** Screen position of anchor `index` (3 numbers per anchor, all zero meaning unknown), or null if not drawn. */
export function projectLabel(frame: readonly number[], anchors: readonly number[], index: number): LabelPoint | null {
  'worklet';
  if (frame.length < FRAME_LENGTH) return null;
  const x = anchors[index * 3];
  const y = anchors[index * 3 + 1];
  const z = anchors[index * 3 + 2];
  if (x === undefined || (x === 0 && y === 0 && z === 0)) return null;

  const w = frame[3] * x + frame[7] * y + frame[11] * z + frame[15];
  if (w <= 0) return null;
  const ndcX = (frame[0] * x + frame[4] * y + frame[8] * z + frame[12]) / w;
  const ndcY = (frame[1] * x + frame[5] * y + frame[9] * z + frame[13]) / w;
  if (ndcX < -1.05 || ndcX > 1.05 || ndcY < -1.05 || ndcY > 1.05) return null;
  if (frame[FRAME_TERRAIN] === 1 && frame[16] * x + frame[17] * y + frame[18] * z < 0) return null;

  return { x: ((ndcX + 1) / 2) * frame[FRAME_WIDTH], y: ((1 - ndcY) / 2) * frame[FRAME_HEIGHT] };
}

/** 0 at or above the label's maximum field of view, rising to 1 over LABEL_FADE_DEGREES of zoom. */
export function labelOpacity(fov: number, maxFov: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (maxFov - fov) / LABEL_FADE_DEGREES));
}