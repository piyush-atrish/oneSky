/**
 * TerrainLayer.tsx
 *
 * The opaque ground-terrain plane that occludes the lower half of the
 * sky dome — the piece of oneSky's design that doesn't exist in
 * stardroid-v2 at all (see the project briefing's "UX & Visual
 * Orientation" section): a full 360° celestial sphere with no horizon
 * reference is disorienting on a touch-only, sensor-free MVP, so this
 * gives the viewer a fixed "down."
 */

/**
 * A large, flat, opaque plane standing in for the ground.
 *
 * Because the render scene is Z-up (see `SkyCanvas.tsx` /
 * `Coordinates.ts` for why), `THREE.PlaneGeometry`'s default
 * orientation — generated flat in the local XY-plane, facing +Z — is
 * *already* horizontal. No rotation prop needed; adding one would
 * actually be wrong here; it'd be compensating for a Y-up assumption
 * this scene deliberately doesn't make.
 *
 * Sized 1000×1000 units against a camera whose `far` plane is 100 —
 * i.e. an order of magnitude past anything the camera can ever see —
 * specifically so the horizon never visibly "ends" at an edge no matter
 * which way the camera pans.
 */
export function TerrainLayer(){
  return (
    <mesh position={[0, 0, -2]}>
      <planeGeometry args={[1000, 1000]} />
      {/* depthTest/depthWrite are both already `true` by default on
          every Three.js material; set explicitly here (rather than
          left implicit) because this mesh's whole job is occlusion —
          the values it needs are exactly the defaults, but stating
          that is worth more than relying on it silently. */}
      <meshBasicMaterial color="#051005" depthTest={true} depthWrite={true} />
    </mesh>
  );
}