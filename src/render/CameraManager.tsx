/**
 * CameraManager.tsx
 *
 * Bridges `useCameraStore`'s decoupled state into the actual R3F camera,
 * once per frame, entirely outside React's render cycle: `useFrame`
 * runs on every tick regardless of whether anything re-rendered, and
 * reading the store via `getState()` (rather than the reactive
 * `useCameraStore()` hook) means a pan/zoom gesture never triggers a
 * React re-render at all — only a direct mutation of the camera object
 * already sitting in the Three.js scene graph.
 */

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { useCameraStore } from '../store/useCameraStore';

/**
 * Pre-allocated once, at module scope, and reused every frame.
 *
 * Allocating a fresh `THREE.Vector3` inside `useFrame` would mean a new
 * object (and eventual GC pass) 60 times a second, forever — exactly
 * the kind of steady, avoidable allocation pressure that turns into
 * visible frame-time stutter as the GC catches up. One vector, mutated
 * in place via `.set()`/`.add()` every tick, costs nothing per frame.
 */
const lookAtTarget = new THREE.Vector3();

/**
 * A render-only, non-visual component: mount it once inside `<Canvas>`
 * and it drives the camera every frame from `useCameraStore`. Returns
 * `null` — its entire job happens as a `useFrame` side effect, not as
 * anything in the scene graph.
 */
export function CameraManager(): null {
  useFrame((state) => {
    const { azimuth, elevation, fov } = useCameraStore.getState();

    // Spherical → Cartesian, in this project's Z-up render convention —
    // the same shape as raDecToGeocentricVector in Coordinates.ts (swap
    // ra↔azimuth, dec↔elevation and it's the identical formula), just
    // computed directly on radians here rather than routed through a
    // function built for degree inputs, since az/el are already stored
    // in radians and converting to degrees only to convert straight
    // back inside that function would be pure overhead for no benefit.
    const cosElevation = Math.cos(elevation);
    lookAtTarget.set(
      cosElevation * Math.cos(azimuth),
      cosElevation * Math.sin(azimuth),
      Math.sin(elevation),
    );

    // Offsetting by the camera's own position (rather than assuming
    // it's fixed at the origin) costs nothing extra here — `.add()`
    // mutates the same pre-allocated vector — and keeps this correct
    // even if a later milestone lets the camera translate; today, with
    // the camera pinned at (0,0,0) per SkyCanvas.tsx, it's a no-op.
    lookAtTarget.add(state.camera.position);
    state.camera.lookAt(lookAtTarget);

    // fov only lives on PerspectiveCamera, not the base THREE.Camera
    // type useFrame's state is typed with — SkyCanvas.tsx's default
    // camera is constructed as one (see its `camera={{ fov: 45, ... }}`
    // config), so this assertion holds for as long as that stays true.
    const perspectiveCamera = state.camera as THREE.PerspectiveCamera;
    if (perspectiveCamera.fov !== fov) {
      perspectiveCamera.fov = fov;
      // Only called when fov actually changed — recomputing the
      // projection matrix unconditionally, 60 times a second, on a
      // value that's usually not moving (most frames are pure pan, no
      // pinch) would be pointless per-frame work.
      perspectiveCamera.updateProjectionMatrix();
    }
  });

  return null;
}