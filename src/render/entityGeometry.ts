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
// Labels: priority, projection and collision-free selection
// ---------------------------------------------------------------------------------------------

/** How much an entity matters; also the order in which labels claim screen space. */
function labelPriority(entity: EntityDetail): number {
  const typeBonus = entity.type === 'planet' || entity.type === 'moon' ? 3 : entity.type === 'star' ? 2 : 1;
  return entity.labelMaxFov * 10 + typeBonus;
}

/** Dictionary entities that get a label, most important first. The index is the entity's anchor slot. */
export const LABEL_ENTITIES: readonly EntityDetail[] = [...ENTITY_LIST].sort((a, b) => labelPriority(b) - labelPriority(a));

/**
 * Zoom no longer fades labels. It only drops the faintest names from very wide views: an entity is eligible
 * while the field of view is below `labelMaxFov + LABEL_FOV_HEADROOM`. With the generated dictionary that is
 * 85 degrees for planets, 80 for constellations and the brightest stars, then 73 / 65 / 57 for fainter stars:
 * every tier is eligible at the default 45 degrees, and the top tiers at the widest 75. Collisions are
 * resolved by `selectLabels`.
 */
export const LABEL_FOV_HEADROOM = 25;

/** The most labels ever on screen, and the number of text views the overlay ever mounts. */
export const LABEL_SLOTS = 16;
export const LABEL_GAP_X = 8;
export const LABEL_HEIGHT = 16;
export const LABEL_FADE_MS = 180;

const RETIRE_MS = LABEL_FADE_MS + 80; // a slot is reused only after its old text has faded out
const FRESH_PAD = 6; // breathing room a new label needs from its neighbors...
const KEPT_PAD = -2; // ...and the overlap an already visible one tolerates, so labels do not flicker
const CHAR_WIDTH = { star: 6.6, planet: 7.8, moon: 7.8, constellation: 9.4 } as const; // dp per character at the label fonts

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

/** Screen position of a sky direction (all zeros meaning unknown), or null if it is not drawn. */
export function projectAnchor(frame: readonly number[], x: number, y: number, z: number): LabelPoint | null {
  'worklet';
  if (frame.length < FRAME_LENGTH || (x === 0 && y === 0 && z === 0)) return null;

  const w = frame[3] * x + frame[7] * y + frame[11] * z + frame[15];
  if (w <= 0) return null;
  const ndcX = (frame[0] * x + frame[4] * y + frame[8] * z + frame[12]) / w;
  const ndcY = (frame[1] * x + frame[5] * y + frame[9] * z + frame[13]) / w;
  if (ndcX < -1.05 || ndcX > 1.05 || ndcY < -1.05 || ndcY > 1.05) return null;
  if (frame[FRAME_TERRAIN] === 1 && frame[16] * x + frame[17] * y + frame[18] * z < 0) return null;

  return { x: ((ndcX + 1) / 2) * frame[FRAME_WIDTH], y: ((1 - ndcY) / 2) * frame[FRAME_HEIGHT] };
}

/** Screen position of anchor `index` in a flat array of three numbers per anchor. */
export function projectLabel(frame: readonly number[], anchors: readonly number[], index: number): LabelPoint | null {
  'worklet';
  const x = anchors[index * 3];
  if (x === undefined) return null;
  return projectAnchor(frame, x, anchors[index * 3 + 1], anchors[index * 3 + 2]);
}

export interface LabelSlot {
  /** Index into LABEL_ENTITIES, or -1 when the slot is free. */
  readonly entity: number;
  readonly on: boolean;
  /** When the slot's label was told to fade out. */
  readonly offAt: number;
}

export const emptySlots = (): LabelSlot[] => Array.from({ length: LABEL_SLOTS }, () => ({ entity: -1, on: false, offAt: 0 }));

/**
 * Chooses which labels to show: eligible, on screen, most important first, skipping any that would overlap a
 * label already chosen, at most LABEL_SLOTS. Labels already showing tolerate slight overlap (hysteresis), and a
 * slot keeps its entity until the old label has faded out, so text never swaps while visible.
 */
export function selectLabels(
  frame: readonly number[],
  anchors: readonly number[],
  previous: readonly LabelSlot[],
  now: number,
): { slots: LabelSlot[]; changed: boolean } {
  const fov = frame[FRAME_FOV];
  const width = frame[FRAME_WIDTH];
  const height = frame[FRAME_HEIGHT];

  const slotOf = new Map<number, number>();
  previous.forEach((slot, i) => {
    if (slot.entity >= 0) slotOf.set(slot.entity, i);
  });
  let freeSlots = previous.filter((s) => s.entity < 0 || (!s.on && now - s.offAt > RETIRE_MS)).length;

  const boxes: (readonly [number, number, number, number])[] = [];
  const chosen = new Set<number>();
  for (let e = 0; e < LABEL_ENTITIES.length && chosen.size < LABEL_SLOTS; e++) {
    const entity = LABEL_ENTITIES[e];
    if (fov >= entity.labelMaxFov + LABEL_FOV_HEADROOM) continue;
    const point = projectLabel(frame, anchors, e);
    if (!point) continue;

    const left = point.x + LABEL_GAP_X;
    const right = left + CHAR_WIDTH[entity.type] * entity.name.length;
    const top = point.y - LABEL_HEIGHT / 2;
    if (right < 0 || left > width || top + LABEL_HEIGHT < 0 || top > height) continue;

    const slot = slotOf.get(e);
    if (slot === undefined && freeSlots === 0) continue;
    const pad = slot !== undefined && previous[slot].on ? KEPT_PAD : FRESH_PAD;
    const collides = boxes.some((b) => left - pad < b[2] && b[0] < right + pad && top - pad < b[3] && b[1] < top + LABEL_HEIGHT + pad);
    if (collides) continue;

    boxes.push([left, top, right, top + LABEL_HEIGHT]);
    chosen.add(e);
    if (slot === undefined) freeSlots--;
  }

  const next: LabelSlot[] = previous.map((slot) => {
    if (slot.entity < 0) return slot;
    if (chosen.has(slot.entity)) return slot.on ? slot : { ...slot, on: true };
    if (slot.on) return { entity: slot.entity, on: false, offAt: now };
    return now - slot.offAt > RETIRE_MS ? { entity: -1, on: false, offAt: 0 } : slot;
  });
  for (const e of chosen) {
    if (slotOf.has(e)) continue;
    const free = next.findIndex((slot) => slot.entity < 0);
    if (free >= 0) next[free] = { entity: e, on: true, offAt: 0 };
  }

  return { slots: next, changed: next.some((s, i) => s.entity !== previous[i].entity || s.on !== previous[i].on) };
}