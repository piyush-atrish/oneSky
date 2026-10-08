import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import TriangleIcon from '../../assets/icons/triangle-icon.svg';
import { useLocationStore } from '../store/useLocationStore';
import { useUIStore } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../theme/typography';
import { useLayout } from '../theme/useLayout';
import { PRESET_CITIES } from './fallbacks/LocationPermissionScreen';

interface RowProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly role?: 'radio' | 'button';
  readonly expanded?: boolean;
}

/** A compact pill inside a full-height touch row, so the visual stays small and the target stays >= 48dp. */
function Row({ label, onPress, selected = false, role = 'radio', expanded }: RowProps) {
  const { minTouchTarget } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { checked: selected } : { expanded }}
      style={[styles.row, { minHeight: minTouchTarget }]}
    >
      {selected && <TriangleIcon width={9} height={11} style={styles.marker} />}
      <View style={styles.pill}>
        <Text style={styles.pillLabel} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{label}</Text>
      </View>
    </Pressable>
  );
}

function pickCurrentLocation() {
  const { permission, canAskAgain, isLoading, fetchLocation } = useLocationStore.getState();
  if (isLoading) return;
  useUIStore.getState().closePanel();
  if (permission === 'denied' && !canAskAgain) void Linking.openSettings();
  else void fetchLocation();
}

/** Dropdown rendered under the location button (inside the HUD's top-right column). */
export function LocationOverlay() {
  const open = useUIStore((s) => s.panel === 'location');
  const mode = useLocationStore((s) => s.locationMode);
  const isLoading = useLocationStore((s) => s.isLoading);
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const permission = useLocationStore((s) => s.permission);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    setManualOpen(open && useLocationStore.getState().locationMode === 'manual');
  }, [open]);

  const activeCity = mode === 'manual' ? PRESET_CITIES.find((c) => c.latitude === latitude && c.longitude === longitude) : undefined;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {open && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.list}>
          <Row label={isLoading ? 'Locating…' : 'Current Location'} selected={mode === 'gps'} onPress={pickCurrentLocation} />
          <Row
            label={manualOpen ? 'Manual Location ▴' : 'Manual Location ▾'}
            role="button"
            expanded={manualOpen}
            onPress={() => setManualOpen((v) => !v)}
          />
          {manualOpen &&
            PRESET_CITIES.map((city) => (
              <Row
                key={city.label}
                label={city.label}
                selected={activeCity?.label === city.label}
                onPress={() => {
                  useLocationStore.getState().setManualLocation(city.latitude, city.longitude);
                  useUIStore.getState().closePanel();
                }}
              />
            ))}
          {permission === 'denied' && mode !== 'gps' && (
            <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE.caption}>Location access is off</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end' },
  list: { alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  marker: { marginRight: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.surfaceMuted },
  pillLabel: { ...Typography.small, color: Colors.textPrimary },
  hint: { ...Typography.caption, color: Colors.textPrimary, marginTop: 2, paddingRight: 4 },
});