import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCelestialStore } from '../../store/useCelestialStore';
import { useUIStore } from '../../store/useUIStore';
import { Colors } from '../../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../../theme/typography';
import { useLayout } from '../../theme/useLayout';

const PADDING_V = 6;
const BADGE_HEIGHT = Typography.caption.lineHeight + PADDING_V * 2;

const retry = () => void useCelestialStore.getState().fetchIssTle();

/** Quiet top-center pill shown while satellite data is unavailable. Tap to retry. Never blocks the sky. */
export function OfflineBadge() {
  const { insets, hitSlopFor } = useLayout();
  const status = useCelestialStore((s) => s.tleStatus);
  const showSatellites = useUIStore((s) => s.showSatellites);

  const visible = showSatellites && (status === 'failed' || status === 'retrying');
  const label = status === 'retrying' ? 'Retrying…' : 'Offline · satellite unavailable';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      {visible && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)}>
          <Pressable
            onPress={retry}
            disabled={status === 'retrying'}
            hitSlop={hitSlopFor(BADGE_HEIGHT)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Double tap to retry"
            accessibilityLiveRegion="polite"
            style={styles.pill}
          >
            <View style={styles.dot} />
            <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE.caption}>{label}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: PADDING_V, borderRadius: 999, backgroundColor: Colors.surfaceMuted },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8, backgroundColor: Colors.primaryAccent },
  label: { ...Typography.caption, color: Colors.textPrimary },
});