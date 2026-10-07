// src/ui/LoadingScreen.tsx
import { useCallback, useEffect, useRef, type FC } from 'react';
import { PixelRatio, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { expo } from '../../app.json';
import CloudLeft from '../../assets/cloudleft.svg';
import CloudRight from '../../assets/cloudright.svg';
import LogoMark from '../../assets/logo-mark.svg';
import Telescope from '../../assets/telescope.svg';
import { useAppReadyStore } from '../store/useAppReadyStore';
import { Colors } from '../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../theme/typography';
import { useLayout } from '../theme/useLayout';

const ENTER_MS = 2500;
const EXIT_MS = 350;

// Cluster geometry lives in the logo's viewBox units (296x266). It is converted to exact pixel numbers
// from one `unit` (px per viewBox unit); no percentage or aspectRatio layout touches the SVGs.
const VB = { w: 296, h: 266 } as const;
const STAGE_WIDTH_RATIO = 0.76;
const STAGE_HEIGHT_RATIO = 0.4;
const STAGE_MAX_WIDTH = 380;
const WORDMARK_TOP = 229.5; // viewBox units; the wordmark's vertical center sits on the stage's bottom edge
const WORDMARK_RISE = 0.32; // starts this fraction of the screen height lower

interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const place = ({ x, y, w, h }: Rect, unit: number): ViewStyle => ({
  position: 'absolute', left: x * unit, top: y * unit, width: w * unit, height: h * unit,
});

interface FlyerSpec {
  readonly id: string;
  readonly Svg: FC<SvgProps>;
  readonly rect: Rect;
  readonly fromX: number; // start offset, fraction of screen width
  readonly fromY: number; // start offset, fraction of screen height
  readonly delay: number; // 0..1 slice of the entrance
}

const CLOUDS: readonly FlyerSpec[] = [
  { id: 'cloud-left', Svg: CloudLeft, rect: { x: 0, y: 131, w: 137, h: 111 }, fromX: -0.34, fromY: 0, delay: 0 },
  { id: 'cloud-right', Svg: CloudRight, rect: { x: 159, y: 29, w: 137, h: 111 }, fromX: 0.34, fromY: -0.05, delay: 0.1 },
];
const SCOPE: FlyerSpec = {
  id: 'telescope', Svg: Telescope, rect: { x: 237, y: 194, w: 59, h: 61 }, fromX: 0.2, fromY: 0.01, delay: 0.2,
};

interface FlyerProps {
  readonly spec: FlyerSpec;
  readonly unit: number;
  readonly progress: SharedValue<number>;
  readonly screenW: number;
  readonly screenH: number;
}

function Flyer({ spec: { Svg, rect, fromX, fromY, delay }, unit, progress, screenW, screenH }: FlyerProps) {
  const animated = useAnimatedStyle(() => {
    const remaining = 1 - interpolate(progress.value, [delay, 1], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: remaining * fromX * screenW }, { translateY: remaining * fromY * screenH }] };
  });
  return (
    <Animated.View style={[place(rect, unit), animated]}>
      <Svg width={rect.w * unit} height={rect.h * unit} />
    </Animated.View>
  );
}

interface LoadingScreenProps {
  /** Fires once, after the first layout; hide the native splash here. */
  readonly onShown: () => void;
  /** Fires on the JS thread only after the exit fade has actually finished on the UI thread. */
  readonly onFinished: () => void;
}

export function LoadingScreen({ onShown, onFinished }: LoadingScreenProps) {
  const { width, height, insets } = useLayout();
  const isReady = useAppReadyStore((s) => s.isReady);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const exit = useSharedValue(0);
  const shown = useRef(false);

  const onShownRef = useRef(onShown);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onShownRef.current = onShown;
    onFinishedRef.current = onFinished;
  }, [onShown, onFinished]);
  
  const finish = useCallback(() => onFinishedRef.current(), []);
  const entranceFinished = useCallback(() => useAppReadyStore.getState().entranceFinished(), []);

  const stageWidth = PixelRatio.roundToNearestPixel(
    Math.min(width * STAGE_WIDTH_RATIO, height * STAGE_HEIGHT_RATIO, STAGE_MAX_WIDTH),
  );
  const unit = stageWidth / VB.w;
  const stageHeight = VB.h * unit;

  useEffect(() => {
    // The screen is deliberately inert until this completes: heavy engine init is released only afterwards.
    progress.value = withTiming(
      1,
      { duration: reduceMotion ? 0 : ENTER_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(entranceFinished)();
      },
    );
  }, [progress, reduceMotion, entranceFinished]);

  useEffect(() => {
    if (!isReady) return;
    exit.value = withTiming(1, { duration: reduceMotion ? 0 : EXIT_MS }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [isReady, reduceMotion, exit, finish]);

  const handleLayout = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    onShownRef.current();
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: (1 - interpolate(progress.value, [0.2, 1], [0, 1], Extrapolation.CLAMP)) * WORDMARK_RISE * height,
    }],
  }));

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`oneSky ${expo.version}, loading`}
    >
      <View style={styles.main}>
        <View style={{ width: stageWidth, height: stageHeight }}>
          {CLOUDS.map((spec) => (
            <Flyer key={spec.id} spec={spec} unit={unit} progress={progress} screenW={width} screenH={height} />
          ))}
          <View style={styles.mark}>
            <LogoMark width={stageWidth} height={stageHeight} />
          </View>
          <Flyer spec={SCOPE} unit={unit} progress={progress} screenW={width} screenH={height} />
          <Animated.View style={[styles.wordmarkSlot, { top: WORDMARK_TOP * unit }, wordmarkStyle]}>
            <Text
              style={{
                ...Typography.display,
                fontSize: Typography.display.fontSize * unit,
                lineHeight: Typography.display.lineHeight * unit,
                color: Colors.wordmark,
                includeFontPadding: false,
              }}
              maxFontSizeMultiplier={MAX_FONT_SCALE.display}
              numberOfLines={1}
            >
              one sky
            </Text>
          </Animated.View>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE.title}>{`v ${expo.version}`}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.backgroundSplash, overflow: 'hidden' },
  main: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  mark: { position: 'absolute', top: 0, left: 0 },
  wordmarkSlot: { position: 'absolute', left: 0 },
  version: { ...Typography.title, color: Colors.textOnSplash },
});