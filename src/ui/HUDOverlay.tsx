import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../store/useUIStore';

export function HUDOverlay() {
  const insets = useSafeAreaInsets();
  const showConstellations = useUIStore((s) => s.showConstellations);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 12, paddingRight: insets.right + 16 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => useUIStore.getState().toggleConstellations()}
        hitSlop={8}
        style={[styles.button, showConstellations && styles.buttonActive]}
      >
        <Text style={styles.label}>Constellations</Text>
      </Pressable>
      <Pressable
        onPress={() => useUIStore.getState().toggleCredits()}
        hitSlop={8}
        style={[styles.button, styles.creditsButton]}
      >
        <Text style={styles.label}>About</Text>
      </Pressable>
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
    alignItems: 'flex-end',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  buttonActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  creditsButton: {
    marginTop: 8,
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});