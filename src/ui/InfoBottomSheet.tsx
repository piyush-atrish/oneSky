import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ENTITY_TYPE_LABEL, type EntityDetail } from '../data/entityDetails';
import { useSelectionStore } from '../store/useSelectionStore';
import { Colors } from '../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../theme/typography';
import { useLayout } from '../theme/useLayout';

const SHEET_MAX_HEIGHT_RATIO = 0.6;
const SHEET_MAX_WIDTH = 640;
const OPEN_MS = 280;
const CLOSE_MS = 220;
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 900;

const clear = () => useSelectionStore.getState().clearSelection();

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.factLabel} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{label}</Text>
      <Text style={styles.factValue} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{value}</Text>
    </View>
  );
}

/** Text-only details for the selected dictionary entity. Drag the header down, or tap Close, to dismiss. */
export function InfoBottomSheet() {
  const { height, insets, minTouchTarget } = useLayout();
  const selected = useSelectionStore((s) => s.selectedEntity);
  // Kept after deselection so the content stays on screen while the sheet slides out.
  const [shown, setShown] = useState<EntityDetail | null>(selected);
  const translateY = useSharedValue(height);
  const unmount = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (selected) {
      setShown(selected);
      translateY.value = withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(height, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
  }, [selected, height, translateY, unmount]);

  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clear();
      return true;
    });
    return () => sub.remove();
  }, [selected]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onChange((e) => {
          translateY.value = Math.max(0, translateY.value + e.changeY);
        })
        .onEnd((e) => {
          if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            translateY.value = withTiming(height, { duration: 200 }, (finished) => {
              if (finished) runOnJS(clear)();
            });
          } else {
            translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
          }
        }),
    [height, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!shown) return null;

  return (
    <Animated.View
      style={[styles.sheet, { maxHeight: height * SHEET_MAX_HEIGHT_RATIO, paddingBottom: insets.bottom + 16 }, sheetStyle]}
      accessibilityLiveRegion="polite"
    >
      <GestureDetector gesture={drag}>
        <View collapsable={false}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text accessibilityRole="header" style={styles.name} maxFontSizeMultiplier={MAX_FONT_SCALE.title}>
                {shown.name}
              </Text>
              <Text style={styles.meta} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>
                {`${ENTITY_TYPE_LABEL[shown.type]} · ${shown.subtitle}`}
              </Text>
            </View>
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={`Close ${shown.name} details`}
              style={[styles.close, { minWidth: minTouchTarget, minHeight: minTouchTarget }]}
            >
              <Text style={styles.closeLabel} maxFontSizeMultiplier={MAX_FONT_SCALE.body}>Close</Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.description} maxFontSizeMultiplier={MAX_FONT_SCALE.body}>{shown.description}</Text>
        <View style={styles.facts}>
          {shown.facts.map((fact) => (
            <FactRow key={fact.label} {...fact} />
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', maxWidth: SHEET_MAX_WIDTH, alignSelf: 'center',
    paddingHorizontal: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: Colors.surfaceMuted,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, marginTop: 10, marginBottom: 6, borderRadius: 2, backgroundColor: Colors.disabled },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  titleBlock: { flex: 1, marginRight: 12 },
  name: { ...Typography.title, color: Colors.textHeading },
  meta: { ...Typography.small, color: Colors.textPrimary, marginTop: 2 },
  close: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.textPrimary },
  closeLabel: { ...Typography.body, color: Colors.textPrimary },
  scroll: { flexShrink: 1 },
  description: { ...Typography.body, color: Colors.textPrimary },
  facts: { marginTop: 12 },
  fact: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
  },
  factLabel: { ...Typography.small, color: Colors.textPrimary },
  factValue: { ...Typography.small, color: Colors.textHeading, flexShrink: 1, textAlign: 'right' },
});