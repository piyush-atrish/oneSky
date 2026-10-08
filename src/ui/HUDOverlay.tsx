import { useEffect, type FC, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import AboutIcon from '../../assets/icons/about-icon.svg';
import ConstellationIcon from '../../assets/icons/constellation-icon.svg';
import IssIcon from '../../assets/icons/ISS-icon.svg';
import LocationIcon from '../../assets/icons/location-icon.svg';
import MenuIcon from '../../assets/icons/menu-icon.svg';
import PlanetIcon from '../../assets/icons/planet-icon.svg';
import TerrainIcon from '../../assets/icons/terrain-icon.svg';
import ToolIcon from '../../assets/icons/tool-icon.svg';
import { useUIStore, type UIStoreState } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { useLayout } from '../theme/useLayout';
import { Drawer } from './Drawer';
import { LocationOverlay } from './LocationOverlay';

const EDGE = 16;
const FAB_SIZE = 51; // tool icon's own size
const CIRCLE = 40;
const FAB_RADIUS = 62; // arc radius from the tools button's center; chord between neighbors stays > CIRCLE
const ARC_STEP = Math.PI / 4;
const FAB_WIDTH = FAB_SIZE / 2 + FAB_RADIUS + CIRCLE / 2;
const FAB_HEIGHT = 2 * FAB_RADIUS + CIRCLE;
const CX = FAB_SIZE / 2; // tools button center inside the fan area
const CY = FAB_HEIGHT / 2;

const ui = () => useUIStore.getState();
const alwaysOn = () => true;

interface FabItemSpec {
  readonly label: string;
  readonly Icon: FC<SvgProps>;
  readonly iconSize: { readonly w: number; readonly h: number };
  readonly angle: number; // radians from the tools button: 0 = right, negative = up
  readonly isOn?: (s: UIStoreState) => boolean; // omitted for non-toggle actions
  readonly onPress: () => void;
}

const FAB_ITEMS: readonly FabItemSpec[] = [
  { label: 'Constellations', Icon: ConstellationIcon, iconSize: { w: 31, h: 25 }, angle: -2 * ARC_STEP, isOn: (s) => s.showConstellations, onPress: () => ui().toggleConstellations() },
  { label: 'Planets', Icon: PlanetIcon, iconSize: { w: 31, h: 24 }, angle: -ARC_STEP, isOn: (s) => s.showSolarSystem, onPress: () => ui().toggleSolarSystem() },
  { label: 'ISS', Icon: IssIcon, iconSize: { w: 30, h: 25 }, angle: 0, isOn: (s) => s.showSatellites, onPress: () => ui().toggleSatellites() },
  { label: 'Terrain', Icon: TerrainIcon, iconSize: { w: 23, h: 20 }, angle: ARC_STEP, isOn: (s) => s.showTerrain, onPress: () => ui().toggleTerrain() },
  { label: 'About', Icon: AboutIcon, iconSize: { w: 22, h: 22 }, angle: 2 * ARC_STEP, onPress: () => ui().openPanel('credits') },
];

function IconButton({ label, onPress, expanded, children }: { label: string; onPress: () => void; expanded: boolean; children: ReactNode }) {
  const { minTouchTarget } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      style={[styles.iconButton, { minWidth: minTouchTarget, minHeight: minTouchTarget }]}
    >
      {children}
    </Pressable>
  );
}

function FabItem({ spec, progress, open }: { spec: FabItemSpec; progress: SharedValue<number>; open: boolean }) {
  const { hitSlopFor } = useLayout();
  const on = useUIStore(spec.isOn ?? alwaysOn);
  const { Icon } = spec;
  const dx = Math.cos(spec.angle) * FAB_RADIUS;
  const dy = Math.sin(spec.angle) * FAB_RADIUS;
  const animated = useAnimatedStyle(() => {
    const rest = 1 - progress.value;
    return {
      opacity: progress.value,
      transform: [{ translateX: -dx * rest }, { translateY: -dy * rest }, { scale: 0.5 + 0.5 * progress.value }],
    };
  });
  const isToggle = spec.isOn !== undefined;

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[styles.fabItem, { left: CX + dx - CIRCLE / 2, top: CY + dy - CIRCLE / 2 }, animated]}
    >
      <Pressable
        onPress={spec.onPress}
        hitSlop={hitSlopFor(CIRCLE)}
        accessibilityRole={isToggle ? 'switch' : 'button'}
        accessibilityLabel={spec.label}
        accessibilityState={isToggle ? { checked: on } : undefined}
        style={[styles.circle, { backgroundColor: on ? Colors.fab : Colors.fabInactive }]}
      >
        <Icon width={spec.iconSize.w} height={spec.iconSize.h} />
      </Pressable>
    </Animated.View>
  );
}

export function HUDOverlay() {
  const { insets } = useLayout();
  const panel = useUIStore((s) => s.panel);
  const fabOpen = panel === 'fab';
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(fabOpen ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [fabOpen, progress]);

  const anyOpen = panel !== null;
  useEffect(() => {
    if (!anyOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ui().closePanel();
      return true;
    });
    return () => sub.remove();
  }, [anyOpen]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Only exists while a light menu is open, so the sky is untouched the rest of the time. */}
      {(fabOpen || panel === 'location') && (
        <Pressable
          style={styles.outsideTap}
          onPress={() => ui().closePanel()}
          accessible={false}
          importantForAccessibility="no"
        />
      )}

      <View
        style={[styles.topBar, { paddingTop: insets.top + 8, paddingLeft: insets.left + EDGE, paddingRight: insets.right + EDGE }]}
        pointerEvents="box-none"
      >
        <IconButton label="Open menu" expanded={panel === 'drawer'} onPress={() => ui().togglePanel('drawer')}>
          <MenuIcon width={40} height={47} />
        </IconButton>
        <View style={styles.topRight} pointerEvents="box-none">
          <IconButton label="Choose location" expanded={panel === 'location'} onPress={() => ui().togglePanel('location')}>
            <LocationIcon width={27} height={33} />
          </IconButton>
          <LocationOverlay />
        </View>
      </View>

      <View
        style={[styles.fabArea, { left: insets.left + EDGE, bottom: insets.bottom + EDGE }]}
        pointerEvents="box-none"
      >
        {FAB_ITEMS.map((spec) => (
          <FabItem key={spec.label} spec={spec} progress={progress} open={fabOpen} />
        ))}
        <Pressable
          onPress={() => ui().togglePanel('fab')}
          accessibilityRole="button"
          accessibilityLabel="Layers and tools"
          accessibilityState={{ expanded: fabOpen }}
          style={styles.fab}
        >
          <ToolIcon width={FAB_SIZE} height={FAB_SIZE} />
        </Pressable>
      </View>

      <Drawer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  outsideTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topRight: { alignItems: 'flex-end' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  fabArea: { position: 'absolute', width: FAB_WIDTH, height: FAB_HEIGHT },
  fab: { position: 'absolute', left: 0, top: CY - FAB_SIZE / 2, width: FAB_SIZE, height: FAB_SIZE },
  fabItem: { position: 'absolute', width: CIRCLE, height: CIRCLE },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
});