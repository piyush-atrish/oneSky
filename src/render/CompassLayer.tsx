/**
 * N / E / S / W markers resting on the horizon.
 *
 * The old markers were line-segment letters in the 3D scene, centered on the horizon, so their lower half sat
 * below the terrain and was cut off. drei's <Text> and <Html> do not run in React Native, and a text texture
 * needs a canvas that React Native does not have, so the markers are real text in the app's own font, placed
 * by the same technique as the sky labels:
 *
 *  - CompassLayer (inside <Canvas>) publishes the camera's projection*view matrix, only on frames where it
 *    changed.
 *  - CompassOverlay (outside it) positions four Animated.Text markers from that snapshot on the UI thread.
 *
 * A marker rests a fixed number of pixels above the terrain edge at every zoom level, which 3D geometry
 * cannot do; per frame it costs four UI-thread style updates.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, { makeMutable, useAnimatedStyle } from 'react-native-reanimated';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { Colors } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import { useLayout } from '../theme/useLayout';
import {
  COMPASS_FRAME_LENGTH, COMPASS_POINTS, LETTER_HEIGHT, MARKER_GAP, MARKER_HEIGHT, MARKER_WIDTH, TICK_HEIGHT,
  compassAnchors, placeCompassMarker,
} from './compassGeometry';
import { GROUND_OFFSET } from './HorizonLayer';

/** Keep resting markers this far above the bottom edge (plus the safe-area inset). */
const FOOT_CLEARANCE = 24;
const LETTER_SIZE = 22;

const compassFrame = makeMutable<number[]>([]);
const anchors = makeMutable<number[]>([]);

const viewProjection = new THREE.Matrix4();
const current = new Array<number>(COMPASS_FRAME_LENGTH).fill(0);
let published: number[] = [];

/** Mount inside <Canvas>, after <CameraManager />. Renders nothing; publishes the camera snapshot. */
export function CompassLayer(): null {
  useFrame(({ camera, size }) => {
    if (anchors.value.length === 0) anchors.value = compassAnchors(camera.far, GROUND_OFFSET);

    camera.updateMatrixWorld(); // this frame's lookAt, not the previous render's
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    for (let i = 0; i < 16; i++) current[i] = viewProjection.elements[i];
    current[16] = size.width;
    current[17] = size.height;

    if (published.length === COMPASS_FRAME_LENGTH && current.every((value, i) => value === published[i])) return;
    published = current.slice();
    compassFrame.value = published;
  });

  return null;
}

function Marker({ index, label, footY }: { index: number; label: string; footY: number }) {
  const animated = useAnimatedStyle(() => {
    const a = anchors.value;
    const placement = placeCompassMarker(compassFrame.value, a[index * 3], a[index * 3 + 1], a[index * 3 + 2], footY);
    if (!placement) return { opacity: 0 };
    return {
      opacity: placement.opacity,
      transform: [{ translateX: placement.x - MARKER_WIDTH / 2 }, { translateY: placement.y - MARKER_HEIGHT }],
    };
  });

  const north = label === 'N';
  const color = north ? Colors.primaryAccent : Colors.textPrimary;
  return (
    <Animated.View style={[styles.marker, animated]}>
      <Text style={[styles.letter, { color, opacity: north ? 1 : 0.88 }]} allowFontScaling={false}>
        {label}
      </Text>
      <View style={[styles.tick, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/** Mount outside the canvas, below the sky labels. Never intercepts touches. */
export function CompassOverlay() {
  const { height, insets } = useLayout();
  const footY = height - insets.bottom - FOOT_CLEARANCE;

  return (
    <View style={styles.root} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {COMPASS_POINTS.map((point, i) => (
        <Marker key={point.label} index={i} label={point.label} footY={footY} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  marker: { position: 'absolute', left: 0, top: 0, width: MARKER_WIDTH, height: MARKER_HEIGHT, alignItems: 'center', opacity: 0 },
  letter: {
    fontFamily: FontFamily.display,
    fontSize: LETTER_SIZE,
    lineHeight: LETTER_HEIGHT,
    includeFontPadding: false,
    textShadowColor: Colors.background,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  tick: { width: 1.5, height: TICK_HEIGHT, marginTop: MARKER_GAP, borderRadius: 1, opacity: 0.6 },
});