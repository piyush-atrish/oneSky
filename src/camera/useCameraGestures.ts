import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { MAX_FOV_DEG, MIN_FOV_DEG, useCameraStore } from '../store/useCameraStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { createPinchZoom } from './pinchZoom';

const PAN_SENSITIVITY = 0.005;

/**
 * The sky's gestures: drag to look around, pinch to zoom, tap to select.
 *
 * Callbacks run on the JS thread (`runOnJS(true)`) on purpose. The camera is applied by the render loop, which
 * also lives on the JS thread, so computing the zoom on the UI thread would only mean shipping the result back
 * every event; the work here is a handful of arithmetic operations and one store write, with no React render.
 */
export function useCameraGestures() {
  return useMemo(() => {
    let warned = false;
    const pinchZoom = createPinchZoom({
      min: MIN_FOV_DEG,
      max: MAX_FOV_DEG,
      readFov: () => useCameraStore.getState().fov,
      onOrphan: __DEV__
        ? () => {
            if (warned) return;
            warned = true;
            console.warn('[pinch] an update arrived before its start event; holding it back (event reordering)');
          }
        : undefined,
    });

    const pan = Gesture.Pan()
      .runOnJS(true)
      .onChange((e) => {
        useCameraStore.getState().pan(e.changeX * PAN_SENSITIVITY, e.changeY * PAN_SENSITIVITY);
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => pinchZoom.start())
      .onChange((e) => {
        const fov = pinchZoom.update(e.scale);
        if (fov !== null) useCameraStore.getState().setFov(fov);
      })
      .onEnd(() => pinchZoom.end())
      .onFinalize(() => pinchZoom.end());

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        useSelectionStore.getState().setLastTap(e.x, e.y);
      });

    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
  }, []);
}