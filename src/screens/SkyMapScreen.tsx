import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SkyCanvas } from '../render/SkyCanvas';
import { useCameraStore } from '../store/useCameraStore';
import { HUDOverlay } from '../ui/HUDOverlay';
import { CreditsOverlay } from '../ui/Creditsoverlay';

const PAN_SENSITIVITY = 0.005;

export default function SkyMapScreen() {
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onChange((e) => {
        useCameraStore.getState().pan(e.changeX * PAN_SENSITIVITY, e.changeY * PAN_SENSITIVITY);
      });

    let startFov = 45;
    let currentFov = 45;

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        startFov = useCameraStore.getState().fov;
        currentFov = startFov;
      })
      .onChange((e) => {
        const targetFov = startFov / e.scale;
        const deltaFov = targetFov - currentFov;
        useCameraStore.getState().zoom(deltaFov);
        currentFov = targetFov;
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        console.log('Tapped at:', e.x, e.y);
      });

    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <SkyCanvas />
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false} />
        </GestureDetector>
        <HUDOverlay />
        <CreditsOverlay />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});