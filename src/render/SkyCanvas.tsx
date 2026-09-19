/**
 * SkyCanvas.tsx
 *
 * The root React Three Fiber canvas. Owns two things now: enforcing the
 * Z-up render convention documented in `Coordinates.ts`, and hosting
 * `CameraManager`/`TerrainLayer`/`StarsLayer` in their final draw-order
 * position. Ongoing camera orientation is no longer this file's job —
 * as of Milestone 2, `CameraManager` drives it every frame from
 * `useCameraStore`; this file only sets the camera's *initial*,
 * static configuration (fov/position/up/near/far) via the `camera` prop.
 */

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber/native';
import { CameraManager } from './CameraManager';
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
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

/**
 * The app's root canvas: a camera at the observer's origin (orientation
 * now owned by `CameraManager`, not set here), over a black background,
 * with the camera driver, ground terrain, and star field mounted in
 * their final draw-order position.
 */
export function SkyCanvas(){
  return (
    <Canvas
      camera={{
        fov: 45,
        position: [0, 0, 0],
        up: [0, 0, 1],
        near: 0.1,
        far: 100,
      }}
    >
      {/* Deep-space black. Declarative rather than an imperative
          `scene.background = ...` in onCreated, so it stays reactive
          if this ever needs to respond to props/state later. */}
      <color attach="background" args={['#000000']} />
      {/*
        No more `onCreated`/`lookAt` here — it was removed, not just
        left unused, because it would be actively wrong to keep: R3F
        renders the first frame immediately after `onCreated` fires, and
        CameraManager's `useFrame` runs on every one of those frames,
        including that first one — so any orientation set in `onCreated`
        would be overwritten before it was ever visible. One `up.set()`
        re-assertion doesn't need to live here either anymore: it was
        only ever colocated with the `lookAt` call it protected: now
        that CameraManager is the sole owner of orientation, its own
        `useFrame` is the place that ordering guarantee belongs (see its
        source for how it's still upheld there).

        WORTH CONFIRMING: `CameraManager`'s default look direction
        (azimuth 0 → world +X) is not the same direction the old
        `lookAt(0, 1, 0)` pointed (+Y — roughly where this milestone's
        Orion test-star cluster sits, RA ~78-101° in this project's
        az≈ra identity mapping). Since `useCameraStore`'s default
        azimuth is out of scope for this change, the app will now boot
        looking at empty sky near RA 0° instead of the star cluster,
        until that default is revisited.
      */}
      <CameraManager />
      <TerrainLayer />
      <StarsLayer />
    </Canvas>
  );
}