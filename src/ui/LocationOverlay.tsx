import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationStore, LocationMode } from '../store/useLocationStore';

const CITIES = [
  { label: 'New York', latitude: 40.7128, longitude: -74.006 },
  { label: 'London', latitude: 51.5074, longitude: -0.1278 },
  { label: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
];

const MODE_LABEL: Record<LocationMode, string> = {
  gps: 'GPS Active',
  manual: 'Manual Location',
  default: 'Default Location',
};

export function LocationOverlay() {
  const insets = useSafeAreaInsets();
  const locationMode = useLocationStore((s) => s.locationMode);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 12, paddingLeft: insets.left + 16 }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <Text style={styles.pillLabel}>{MODE_LABEL[locationMode]}</Text>
      </View>
      {locationMode !== 'gps' && (
        <View style={styles.cityRow}>
          {CITIES.map((city) => (
            <Pressable
              key={city.label}
              onPress={() => useLocationStore.getState().setManualLocation(city.latitude, city.longitude)}
              hitSlop={8}
              style={styles.cityButton}
            >
              <Text style={styles.cityLabel}>{city.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-start',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  cityButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  cityLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
});