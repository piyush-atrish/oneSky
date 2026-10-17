import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber/native';
import { useUIStore } from '../store/useUIStore';
import { GROUND_FRAGMENT_SHADER, GROUND_STYLE, GROUND_VERTEX_SHADER, createGroundUniforms } from './groundGrid';

const GROUND_RADIUS = 500;
/**
 * How far below the camera the ground sits. Keep it small: stars live on a 50-unit sphere, so a deeper ground
 * would let stars below the horizon show over it. The compass markers rest on the edge this produces, and the
 * grid is sized in multiples of it (see groundGrid.ts), so changing it rescales everything consistently.
 */
export const GROUND_OFFSET = 0.2;

/** The terrain: an opaque dark ground with a polar grid. The N / E / S / W markers live in CompassLayer. */
export function HorizonLayer() {
  const showTerrain = useUIStore((s) => s.showTerrain);
  const pixelRatio = useThree((s) => s.viewport.dpr);
  const uniforms = useMemo(() => createGroundUniforms(GROUND_OFFSET, pixelRatio), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lines are measured in device pixels; keep them about 0.9 dp wide at any pixel ratio.
  useEffect(() => {
    uniforms.uWidthPx.value = GROUND_STYLE.lineWidthDp * pixelRatio;
  }, [uniforms, pixelRatio]);

  if (!showTerrain) return null;
  return (
    <mesh position={[0, 0, -GROUND_OFFSET]}>
      <circleGeometry args={[GROUND_RADIUS, 64]} />
      <shaderMaterial vertexShader={GROUND_VERTEX_SHADER} fragmentShader={GROUND_FRAGMENT_SHADER} uniforms={uniforms} />
    </mesh>
  );
}