import { useMemo } from 'react';
import * as THREE from 'three';
import { useUIStore } from '../store/useUIStore';

const GROUND_RADIUS = 500;
const GROUND_OFFSET = 0.2;
const MARKER_RADIUS = 42;
const GLYPH_SIZE = 2.5;

type Segment = [[number, number], [number, number]];

const GLYPHS: Record<string, Segment[]> = {
  N: [
    [[-0.3, -0.5], [-0.3, 0.5]],
    [[-0.3, 0.5], [0.3, -0.5]],
    [[0.3, -0.5], [0.3, 0.5]],
  ],
  E: [
    [[-0.3, -0.5], [-0.3, 0.5]],
    [[-0.3, 0.5], [0.3, 0.5]],
    [[-0.3, 0], [0.15, 0]],
    [[-0.3, -0.5], [0.3, -0.5]],
  ],
  S: [
    [[0.3, 0.5], [-0.3, 0.5]],
    [[-0.3, 0.5], [-0.3, 0]],
    [[-0.3, 0], [0.3, 0]],
    [[0.3, 0], [0.3, -0.5]],
    [[0.3, -0.5], [-0.3, -0.5]],
  ],
  W: [
    [[-0.3, 0.5], [-0.15, -0.5]],
    [[-0.15, -0.5], [0, 0.1]],
    [[0, 0.1], [0.15, -0.5]],
    [[0.15, -0.5], [0.3, 0.5]],
  ],
};

const CARDINALS: { label: keyof typeof GLYPHS; direction: THREE.Vector3 }[] = [
  { label: 'N', direction: new THREE.Vector3(0, 1, 0) },
  { label: 'E', direction: new THREE.Vector3(1, 0, 0) },
  { label: 'S', direction: new THREE.Vector3(0, -1, 0) },
  { label: 'W', direction: new THREE.Vector3(-1, 0, 0) },
];

const WORLD_UP = new THREE.Vector3(0, 0, 1);

function buildMarkerPositions(): Float32Array {
  const points: number[] = [];

  for (const { label, direction } of CARDINALS) {
    const position = direction.clone().multiplyScalar(MARKER_RADIUS);
    const right = new THREE.Vector3().crossVectors(direction, WORLD_UP).normalize();

    for (const [a, b] of GLYPHS[label]) {
      const pa = position
        .clone()
        .addScaledVector(right, a[0] * GLYPH_SIZE)
        .addScaledVector(WORLD_UP, a[1] * GLYPH_SIZE);
      const pb = position
        .clone()
        .addScaledVector(right, b[0] * GLYPH_SIZE)
        .addScaledVector(WORLD_UP, b[1] * GLYPH_SIZE);
      points.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
  }

  return new Float32Array(points);
}

export function HorizonLayer() {
  const showTerrain = useUIStore((s) => s.showTerrain);
  const markerPositions = useMemo(buildMarkerPositions, []);

  return (
    <>
      {showTerrain && (
        <mesh position={[0, 0, -GROUND_OFFSET]}>
          <circleGeometry args={[GROUND_RADIUS, 64]} />
          <meshBasicMaterial color="#051005" />
        </mesh>
      )}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[markerPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
    </>
  );
}