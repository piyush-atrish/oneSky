import { useUIStore } from '../store/useUIStore';

const GROUND_RADIUS = 500;
/** How far below the camera the ground sits. The compass markers rest on the edge this produces. */
export const GROUND_OFFSET = 0.2;

/** The terrain: an opaque ground disk. The N / E / S / W markers live in CompassLayer. */
export function HorizonLayer() {
  const showTerrain = useUIStore((s) => s.showTerrain);

  if (!showTerrain) return null;
  return (
    <mesh position={[0, 0, -GROUND_OFFSET]}>
      <circleGeometry args={[GROUND_RADIUS, 64]} />
      <meshBasicMaterial color="#051005" />
    </mesh>
  );
}