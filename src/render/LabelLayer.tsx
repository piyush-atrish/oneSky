/**
 * On-sky name labels for dictionary entities.
 *
 * drei's <Text> (troika, web workers) and <Html> (DOM) do not run in React Native, and a glyph-mesh
 * alternative would put hundreds of triangles per name on the GPU. Instead the canvas only publishes one
 * small camera snapshot per frame (LabelLayer, inside <Canvas>), and ordinary React Native text
 * (LabelOverlay, outside it) positions itself from that snapshot on the UI thread. No React re-render
 * happens while the sky moves, and the text is crisp, in the app's own font.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { makeMutable, useAnimatedStyle } from 'react-native-reanimated';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import type { CelestialPositions } from '../astro/EphemerisService';
import type { EntityDetail } from '../data/entityDetails';
import { useCameraStore } from '../store/useCameraStore';
import { useCelestialStore } from '../store/useCelestialStore';
import { useUIStore } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import {
  FRAME_FOV, FRAME_HEIGHT, FRAME_LENGTH, FRAME_ROTATION_Z, FRAME_TERRAIN, FRAME_WIDTH,
  LABEL_ENTITIES, countVisibleLabels, getAnchorDirection, labelOpacity, projectLabel,
} from './entityGeometry';
import { celestialGroupRef } from './sceneRefs';

const GAP_X = 8; // label sits to the right of its object

// Written from the render loop, read on the UI thread by every label.
const labelFrame = makeMutable<number[]>([]);
const labelAnchors = makeMutable<number[]>([]);

function buildAnchors(positions: CelestialPositions | null): number[] {
  const anchors = new Array<number>(LABEL_ENTITIES.length * 3).fill(0);
  LABEL_ENTITIES.forEach((entity, i) => {
    const direction = getAnchorDirection(entity, positions);
    if (direction) {
      anchors[i * 3] = direction.x;
      anchors[i * 3 + 1] = direction.y;
      anchors[i * 3 + 2] = direction.z;
    }
  });
  return anchors;
}

const viewProjection = new THREE.Matrix4();
const skyRotation = new THREE.Matrix4();
const current = new Array<number>(FRAME_LENGTH).fill(0);
let published: number[] = [];

/** Mount inside <Canvas>, after the celestial sphere. Renders nothing; publishes the camera snapshot. */
export function LabelLayer(): null {
  // Moving bodies drift slowly, so anchors follow the ephemeris cadence, not the frame rate.
  useEffect(() => {
    const publish = () => {
      labelAnchors.value = buildAnchors(useCelestialStore.getState().positions);
    };
    publish();
    return useCelestialStore.subscribe((state, previous) => {
      if (state.positions !== previous.positions) publish();
    });
  }, []);

  useFrame(({ camera, size }) => {
    const group = celestialGroupRef.current;
    if (!group || !useUIStore.getState().showLabels) return;

    camera.updateMatrixWorld(); // pick up this frame's lookAt rather than the previous render's
    skyRotation.makeRotationFromQuaternion(group.quaternion);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(skyRotation);

    for (let i = 0; i < 16; i++) current[i] = viewProjection.elements[i];
    current[FRAME_ROTATION_Z] = skyRotation.elements[2];
    current[FRAME_ROTATION_Z + 1] = skyRotation.elements[6];
    current[FRAME_ROTATION_Z + 2] = skyRotation.elements[10];
    current[FRAME_WIDTH] = size.width;
    current[FRAME_HEIGHT] = size.height;
    current[FRAME_TERRAIN] = useUIStore.getState().showTerrain ? 1 : 0;
    current[FRAME_FOV] = (camera as THREE.PerspectiveCamera).fov;

    if (published.length === FRAME_LENGTH && current.every((value, i) => value === published[i])) return;
    published = current.slice();
    labelFrame.value = published;
  });

  return null;
}

function Label({ index, entity }: { index: number; entity: EntityDetail }) {
  const { labelMaxFov } = entity;
  const halfLine = (entity.type === 'planet' || entity.type === 'moon' ? Typography.small : Typography.caption).lineHeight / 2;

  const animated = useAnimatedStyle(() => {
    const frame = labelFrame.value;
    const point = projectLabel(frame, labelAnchors.value, index);
    if (!point) return { opacity: 0 };
    return {
      opacity: labelOpacity(frame[FRAME_FOV], labelMaxFov),
      transform: [{ translateX: point.x + GAP_X }, { translateY: point.y - halfLine }],
    };
  });

  const style = entity.type === 'constellation' ? styles.constellation : entity.type === 'star' ? styles.star : styles.body;
  return (
    <Animated.Text style={[styles.label, style, animated]} numberOfLines={1} allowFontScaling={false}>
      {entity.name}
    </Animated.Text>
  );
}

/** Mount outside the canvas, above the touch layer and below the HUD. Never intercepts touches. */
export function LabelOverlay() {
  const enabled = useUIStore((s) => s.showLabels);
  // Only labels that are at all visible at this zoom are mounted; this changes a handful of times per zoom sweep.
  const count = useCameraStore((s) => countVisibleLabels(s.fov));
  if (!enabled || count === 0) return null;

  return (
    <View style={styles.root} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {LABEL_ENTITIES.slice(0, count).map((entity, i) => (
        <Label key={entity.id} index={i} entity={entity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  label: {
    position: 'absolute', left: 0, top: 0, opacity: 0,
    textShadowColor: Colors.background, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 },
  },
  body: { ...Typography.small, color: Colors.textPrimary },
  star: { ...Typography.caption, color: Colors.textPrimary },
  constellation: { ...Typography.caption, color: Colors.primaryAccent, letterSpacing: 1, textTransform: 'uppercase' },
});