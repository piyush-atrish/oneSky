/**
 * SkyCanvas.tsx
 *
 * The root React Three Fiber canvas. Owns three things: enforcing the
 * Z-up render convention documented in `Coordinates.ts`, configuring
 * the fixed Milestone-1 camera, and hosting `TerrainLayer`/`StarsLayer`
 * in their final draw-order position.
 */

import * as THREE from 'three';
import { Canvas, type RootState } from '@react-three/fiber/native';
import { TerrainLayer } from './TerrainLayer';
import { StarsLayer } from './StarsLayer';

/**
 * Global Z-up enforcement.
 *
 * This MUST run before any `THREE.Object3D` — the default camera R3F
 * constructs for this canvas included — is instantiated, because
 * `Object3D` reads `DEFAULT_UP` once, at construction time, and copies
 * it into its own `.up`; it does not keep watching the static for
 * later changes. Top-level statements in an ES module run exactly once,
 * the first time the module is imported, and before anything else in
 * the module (including `SkyCanvas` itself) runs — which is exactly the
 * ordering guarantee this needs. See `Coordinates.ts` for *why* Z-up:
 * in short, it lets the equatorial math (+Z = celestial pole) reach the
 * renderer with no per-vertex rotation, at the cost of moving off
 * Three.js's Y-up default.
 *
 * The `camera` prop below sets `up: [0, 0, 1]` explicitly too. That's
 * not redundant so much as defensive: it guarantees this canvas's own
 * camera is correct even in the hypothetical case that some other
 * module got imported first and raced this assignment — belt-and-
 * suspenders, not dead code.
 */

/**
 * The app's root canvas: a fixed camera at the observer's origin,
 * looking toward the Milestone-1 test scene's star cluster, over a
 * black background, with the ground terrain and star field mounted in
 * their final draw-order position.
 */
export function SkyCanvas(){

  THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
  
  return (
    <Canvas
      camera={{
        fov: 45,
        position: [0, 0, 0],
        up: [0, 0, 1],
        near: 0.1,
        far: 100,
      }}
      onCreated={(state : RootState) => {
        // Re-assert `up` immediately before `lookAt`, colocated with it:
        // `Object3D.lookAt()` computes its resulting orientation *using
        // the object's current `.up`* as the reference for "which way is
        // roll-neutral" — get the order backwards (rotate first, correct
        // `up` after) and the camera still points at the right target,
        // but with the wrong roll. Keeping these two lines adjacent
        // means that invariant can't drift apart later even if this
        // callback grows.

        state.camera.up.set(0, 0, 1);
        state.camera.lookAt(0, 1, 0);
      }}
    >
      {/* Deep-space black. Declarative rather than an imperative
          `scene.background = ...` in onCreated, so it stays reactive
          if this ever needs to respond to props/state later. */}
      <color attach="background" args={['#000000']} />
      <TerrainLayer />
      <StarsLayer />
    </Canvas>
  );
}