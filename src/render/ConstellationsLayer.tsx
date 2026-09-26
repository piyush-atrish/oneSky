import { useMemo } from 'react';
import { STAR_CATALOG } from '../data/starCatalog';
import { CONSTELLATION_LINES } from '../data/constellationLines';
import { raDecToCartesian } from '../math/Coordinates';
import { useUIStore } from '../store/useUIStore';

export function ConstellationsLayer() {
  const visible = useUIStore((s) => s.showConstellations);

  const positions = useMemo(() => {
    const starsByHip = new Map<number, { ra: number; dec: number }>();
    STAR_CATALOG.forEach(([hipId, ra, dec]) => {
      if (hipId === 0) return;
      starsByHip.set(hipId, { ra, dec });
    });

    const points: number[] = [];
    CONSTELLATION_LINES.forEach(([hipA, hipB]) => {
      const starA = starsByHip.get(hipA);
      const starB = starsByHip.get(hipB);
      if (!starA || !starB) return;

      const a = raDecToCartesian(starA.ra, starA.dec, 50);
      const b = raDecToCartesian(starB.ra, starB.dec, 50);
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });

    return new Float32Array(points);
  }, []);

  return (
    <lineSegments visible={visible}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" opacity={0.15} transparent={true} depthWrite={false} />
    </lineSegments>
  );
}