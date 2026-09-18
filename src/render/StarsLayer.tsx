/**
 * StarsLayer.tsx
 *
 * The batched star point cloud: every named debug star plus the 100k-star
 * stress-test field, flattened once into a single `Float32Array` and
 * handed to the GPU as one `THREE.Points` draw call — the concrete
 * implementation of the "no CPU point culling" law: nothing here loops
 * over stars per-frame, only once, at mount, to build the buffer.
 */

import { useMemo } from 'react';
import { DEBUG_NAMED_STARS, generateStressTestStars, type StarData } from '../debug/TestSceneData';
import { raDecToGeocentricVector } from '../math/Coordinates';

/**
 * Distance (in scene units) each star is placed from the origin.
 *
 * Chosen well inside the camera's `far = 100` plane (see
 * `SkyCanvas.tsx`) and well outside `near = 0.1`, with generous margin
 * on both sides — there's no reason to hug either clip plane.
 */
const STAR_FIELD_RADIUS = 50;

export function StarsLayer(){
  const positions = useMemo<Float32Array>(() => {
    // Combining and generating here, inside the memo, rather than at
    // module scope, keeps the 100k-star stress field's generation tied
    // to this component's own mount/render lifecycle: it happens lazily,
    // once, the first time StarsLayer actually renders — not eagerly at
    // bundle-import time regardless of whether this component is used.
    const allStars: readonly StarData[] = [...DEBUG_NAMED_STARS, ...generateStressTestStars()];

    const array = new Float32Array(allStars.length * 3);
    for (let i = 0; i < allStars.length; i++) {
      const star = allStars[i];
      // raDecToGeocentricVector's contract already guarantees a unit
      // vector (verified in Coordinates.ts's own round-trip checks), so
      // there's nothing to re-normalize here. Reading .x/.y/.z straight
      // off it and scaling inline — rather than calling vec.scale(50),
      // which would allocate a second Vector3 per star just to be
      // immediately unpacked into the array below — skips ~100k
      // needless allocations across the full stress-test field.
      const vec = raDecToGeocentricVector(star.raDeg, star.decDeg);
      const offset = i * 3;
      array[offset] = vec.x * STAR_FIELD_RADIUS;
      array[offset + 1] = vec.y * STAR_FIELD_RADIUS;
      array[offset + 2] = vec.z * STAR_FIELD_RADIUS;
    }
    return array;
  }, []);

  const starCount = positions.length / 3;
    return(
        <points>
            <bufferGeometry>
                <bufferAttribute 
                attach="attributes-position" 
                count={positions.length / 3} 
                args={[positions, 3]} 
                />
            </bufferGeometry>
            <pointsMaterial 
                size={0.1} 
                color="#ffffff" 
                sizeAttenuation={true} 
                depthTest={true} 
                depthWrite={true} 
            />
        </points>
  );
}