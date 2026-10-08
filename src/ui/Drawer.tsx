import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { expo } from '../../app.json';
import { useUIStore, type UIStoreState } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../theme/typography';
import { useLayout } from '../theme/useLayout';

const DRAWER_WIDTH_RATIO = 0.68;
const DRAWER_MAX_WIDTH = 320;
const OPEN_MS = 260;
const CLOSE_MS = 220;
const TRACK = { w: 56, h: 28, pad: 4 } as const;

const ui = () => useUIStore.getState();

interface ToggleSpec {
  readonly label: string;
  readonly isOn: (s: UIStoreState) => boolean;
  readonly toggle: () => void;
}

const TOGGLES: readonly ToggleSpec[] = [
  { label: 'Constellations', isOn: (s) => s.showConstellations, toggle: () => ui().toggleConstellations() },
  { label: 'Planets', isOn: (s) => s.showSolarSystem, toggle: () => ui().toggleSolarSystem() },
  { label: 'Terrain', isOn: (s) => s.showTerrain, toggle: () => ui().toggleTerrain() },
  { label: 'ISS', isOn: (s) => s.showSatellites, toggle: () => ui().toggleSatellites() },
];

function ToggleRow({ label, isOn, toggle }: ToggleSpec) {
  const { minTouchTarget } = useLayout();
  const on = useUIStore(isOn);
  const knob = <View style={styles.knob} />;
  const state = (
    <Text style={styles.switchLabel} maxFontSizeMultiplier={MAX_FONT_SCALE.caption}>{on ? 'ON' : 'OFF'}</Text>
  );
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      style={[styles.row, { minHeight: minTouchTarget }]}
    >
      <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE.body}>{label}</Text>
      <View style={styles.track}>
        {on ? state : knob}
        {on ? knob : state}
      </View>
    </Pressable>
  );
}

function NavRow({ label, onPress, disabled = false }: { label: string; onPress?: () => void; disabled?: boolean }) {
  const { minTouchTarget } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.row, { minHeight: minTouchTarget }]}
    >
      <Text
        style={[styles.rowLabel, disabled && { color: Colors.disabled }]}
        maxFontSizeMultiplier={MAX_FONT_SCALE.body}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Drawer() {
  const { width, insets } = useLayout();
  const open = useUIStore((s) => s.panel === 'drawer');
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  const unmount = useCallback(() => setMounted(false), []);
  const drawerWidth = Math.min(width * DRAWER_WIDTH_RATIO, DRAWER_MAX_WIDTH);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    } else {
      // Unmount only once the slide-out has actually finished on the UI thread.
      progress.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
  }, [open, progress, unmount]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * drawerWidth }] }));

  if (!mounted) return null;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable
          style={styles.scrimTap}
          onPress={() => ui().closePanel()}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { width: drawerWidth, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 20 },
          panelStyle,
        ]}
      >
        <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE.title}>Index</Text>
        <View style={styles.group}>
          {TOGGLES.map((spec) => (
            <ToggleRow key={spec.label} {...spec} />
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.group}>
          <NavRow label="About" onPress={() => ui().openPanel('credits')} />
          <NavRow label="Settings" disabled />
          <NavRow label="Tutorial" disabled />
        </View>
        <View style={styles.spacer} />
        <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{`v ${expo.version}`}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.scrim },
  scrimTap: { flex: 1 },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, paddingRight: 20, backgroundColor: Colors.surface },
  title: { ...Typography.title, color: Colors.textHeading, marginBottom: 12 },
  group: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { ...Typography.body, color: Colors.textPrimary },
  track: {
    width: TRACK.w, height: TRACK.h, padding: TRACK.pad, borderRadius: TRACK.h / 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.switchTrack,
  },
  knob: { width: TRACK.h - 2 * TRACK.pad, height: TRACK.h - 2 * TRACK.pad, borderRadius: (TRACK.h - 2 * TRACK.pad) / 2, backgroundColor: Colors.switchKnob },
  switchLabel: { ...Typography.caption, color: Colors.switchLabel, paddingHorizontal: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12, backgroundColor: Colors.divider },
  spacer: { flex: 1 },
  version: { ...Typography.small, color: Colors.textPrimary },
});