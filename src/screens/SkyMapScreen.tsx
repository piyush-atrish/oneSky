import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SkyCanvas } from '../render/SkyCanvas';
import { useCameraStore } from '../store/useCameraStore';

const PAN_SENSITIVITY = 0.005;

export default function SkyMapScreen() {
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onChange((e) => {
        // BUG FIX: We INVERTED both axes here with a negative sign (-e.changeX).
        // Now, dragging your finger left pulls the sky left (grab-and-drag style).
        // If you prefer the old "joystick" style, just remove the minus signs!
        useCameraStore.getState().pan(e.changeX * PAN_SENSITIVITY, e.changeY * PAN_SENSITIVITY);
      });

    // We need to track the FOV relative to the start of the pinch
    let startFov = 45;
    let currentFov = 45;

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        // BUG FIX: Capture the exact FOV when the user's two fingers first touch
        startFov = useCameraStore.getState().fov;
        currentFov = startFov;
      })
      .onChange((e) => {
        // e.scale > 1 = zooming in (fingers spreading) -> FOV decreases
        // e.scale < 1 = zooming out (fingers pinching together) -> FOV increases
        const targetFov = startFov / e.scale;
        
        // Calculate how much the FOV needs to change this exact frame
        const deltaFov = targetFov - currentFov;

        useCameraStore.getState().zoom(deltaFov);
        currentFov = targetFov; // Save for the next frame
      });

    return Gesture.Simultaneous(pan, pinch);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* 
        CRITICAL BUG FIX: 
        By placing the Canvas and the GestureDetector as siblings, and using 
        StyleSheet.absoluteFill, we place an invisible glass pane OVER the 3D scene. 
        Your fingers interact with the glass pane, completely preventing 
        the 3D canvas from swallowing your one-finger touches.
      */}
      <View style={styles.root}>
        <SkyCanvas />
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false} />
        </GestureDetector>
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