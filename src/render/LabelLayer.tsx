/**
 * On-sky name labels for dictionary entities.
 *
 * drei's <Text> (troika, web workers) and <Html> (DOM) do not run in React Native, so labels are ordinary
 * React Native text positioned from a per-frame camera snapshot. Cost is kept independent of the dictionary
 * size and of zoom:
 *
 *  - A FIXED pool of LABEL_SLOTS text views is mounted once. Nothing mounts or unmounts during a gesture.
 *  - Which entities occupy the slots is decided at most every SELECTION_INTERVAL_MS, on the JS thread, by
 *    `selectLabels` (eligible, on screen, most important first, collision-free). That is a few dozen
 *    microseconds of arithmetic, and it re-renders React only when the assignment actually changes.
 *  - Each frame, only the slots in use are repositioned, on the UI thread, from the camera snapshot.
 *  - Fading is a single time-based animation per slot, started only when a slot turns on or off.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { makeMutable, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as THREE from 'three';
import { create } from 'zustand';
import { useFrame } from '@react-three/fiber/native';
import type { CelestialPositions } from '../astro/EphemerisService';
import type { EntityDetail } from '../data/entityDetails';
import { useCelestialStore } from '../store/useCelestialStore';
import { useUIStore } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import {
  FRAME_FOV, FRAME_HEIGHT, FRAME_LENGTH, FRAME_ROTATION_Z, FRAME_TERRAIN, FRAME_WIDTH,
  LABEL_ENTITIES, LABEL_FADE_MS, LABEL_GAP_X, LABEL_HEIGHT, LABEL_SLOTS,
  emptySlots, getAnchorDirection, projectAnchor, selectLabels,
} from './entityGeometry';
import { celestialGroupRef } from './sceneRefs';

const SELECTION_INTERVAL_MS = 100;

// Read on the UI thread by the slots.
const labelFrame = makeMutable<number[]>([]); // camera snapshot, written only on frames where it changed
const slotData = makeMutable<number[]>(new Array(LABEL_SLOTS * 4).fill(0)); // per slot: anchor x, y, z, then 1 if shown

// Read by React: which entity each slot's text shows (-1 = none). Replaced only when it changes.
const useSlotEntities = create<{ entities: readonly number[] }>(() => ({ entities: new Array<number>(LABEL_SLOTS).fill(-1) }));

const viewProjection = new THREE.Matrix4();
const skyRotation = new THREE.Matrix4();
const current = new Array<number>(FRAME_LENGTH).fill(0);
let published: number[] = [];
let anchors: number[] = [];
let anchorsChanged = true;
let slots = emptySlots();
let lastSelectionAt = 0;

function buildAnchors(positions: CelestialPositions | null): number[] {
  const out = new Array<number>(LABEL_ENTITIES.length * 3).fill(0);
  LABEL_ENTITIES.forEach((entity, i) => {
    const direction = getAnchorDirection(entity, positions);
    if (direction) {
      out[i * 3] = direction.x;
      out[i * 3 + 1] = direction.y;
      out[i * 3 + 2] = direction.z;
    }
  });
  return out;
}

function publishSlots(): void {
  const data = new Array<number>(LABEL_SLOTS * 4).fill(0);
  slots.forEach((slot, i) => {
    if (slot.entity < 0) return;
    data[i * 4] = anchors[slot.entity * 3];
    data[i * 4 + 1] = anchors[slot.entity * 3 + 1];
    data[i * 4 + 2] = anchors[slot.entity * 3 + 2];
    data[i * 4 + 3] = slot.on ? 1 : 0;
  });
  slotData.value = data;

  const entities = slots.map((slot) => slot.entity);
  if (entities.some((entity, i) => entity !== useSlotEntities.getState().entities[i])) useSlotEntities.setState({ entities });
}

/** Mount inside <Canvas>, after the celestial sphere. Renders nothing; publishes the camera snapshot and the slot assignment. */
export function LabelLayer(): null {
  // Moving bodies drift slowly, so anchors follow the ephemeris cadence, not the frame rate.
  useEffect(() => {
    const refresh = () => {
      anchors = buildAnchors(useCelestialStore.getState().positions);
      anchorsChanged = true;
    };
    refresh();
    return useCelestialStore.subscribe((state, previous) => {
      if (state.positions !== previous.positions) refresh();
    });
  }, []);

  useFrame(({ camera, size }) => {
    const group = celestialGroupRef.current;
    const { showLabels, showTerrain } = useUIStore.getState();
    if (!group || !showLabels) return;

    camera.updateMatrixWorld(); // pick up this frame's lookAt rather than the previous render's
    skyRotation.makeRotationFromQuaternion(group.quaternion);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(skyRotation);

    for (let i = 0; i < 16; i++) current[i] = viewProjection.elements[i];
    current[FRAME_ROTATION_Z] = skyRotation.elements[2];
    current[FRAME_ROTATION_Z + 1] = skyRotation.elements[6];
    current[FRAME_ROTATION_Z + 2] = skyRotation.elements[10];
    current[FRAME_WIDTH] = size.width;
    current[FRAME_HEIGHT] = size.height;
    current[FRAME_TERRAIN] = showTerrain ? 1 : 0;
    current[FRAME_FOV] = (camera as THREE.PerspectiveCamera).fov;

    if (published.length !== FRAME_LENGTH || !current.every((value, i) => value === published[i])) {
      published = current.slice();
      labelFrame.value = published;
    }

    const now = Date.now();
    if (now - lastSelectionAt < SELECTION_INTERVAL_MS) return;
    lastSelectionAt = now;
    const result = selectLabels(published, anchors, slots, now);
    slots = result.slots;
    if (result.changed || anchorsChanged) {
      anchorsChanged = false;
      publishSlots();
    }
  });

  return null;
}

function Slot({ index, entity }: { index: number; entity: EntityDetail | undefined }) {
  const fade = useSharedValue(0);

  // One time-based fade per on/off change; no per-frame work.
  useAnimatedReaction(
    () => slotData.value[index * 4 + 3],
    (shown) => {
      fade.value = withTiming(shown ? 1 : 0, { duration: LABEL_FADE_MS });
    },
  );

  const animated = useAnimatedStyle(() => {
    const data = slotData.value;
    const point = projectAnchor(labelFrame.value, data[index * 4], data[index * 4 + 1], data[index * 4 + 2]);
    if (!point) return { opacity: 0 };
    return { opacity: fade.value, transform: [{ translateX: point.x + LABEL_GAP_X }, { translateY: point.y - LABEL_HEIGHT / 2 }] };
  });

  const style = entity?.type === 'constellation' ? styles.constellation : entity?.type === 'star' ? styles.star : styles.body;
  return (
    <Animated.Text style={[styles.label, style, animated]} numberOfLines={1} allowFontScaling={false}>
      {entity?.name ?? ''}
    </Animated.Text>
  );
}

/** Mount outside the canvas, above the touch layer and below the HUD. Never intercepts touches. */
export function LabelOverlay() {
  const enabled = useUIStore((s) => s.showLabels);
  const entities = useSlotEntities((s) => s.entities);
  if (!enabled) return null;

  return (
    <View style={styles.root} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {entities.map((entity, i) => (
        <Slot key={i} index={i} entity={LABEL_ENTITIES[entity]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  label: {
    position: 'absolute', left: 0, top: 0, opacity: 0, lineHeight: LABEL_HEIGHT,
    textShadowColor: Colors.background, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 },
  },
  body: { ...Typography.small, lineHeight: LABEL_HEIGHT, color: Colors.textPrimary },
  star: { ...Typography.caption, lineHeight: LABEL_HEIGHT, color: Colors.textPrimary },
  constellation: { ...Typography.caption, lineHeight: LABEL_HEIGHT, color: Colors.primaryAccent, letterSpacing: 1, textTransform: 'uppercase' },
});