import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { raDecToCartesian } from '../math/Coordinates';
import { useCelestialStore } from '../store/useCelestialStore';
import { useUIStore } from '../store/useUIStore';
import { getSatellitePosition } from '../astro/SatelliteService';

const UPDATE_INTERVAL_MS = 1000;

export function SatelliteLayer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    useCelestialStore.getState().fetchIssTle();
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;

    if (!useUIStore.getState().showSatellites) {
      meshRef.current.visible = false;
      return;
    }

    const now = Date.now();
    if (lastUpdateRef.current !== null && now - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
      return;
    }
    lastUpdateRef.current = now;

    const { issTle } = useCelestialStore.getState();
    if (!issTle) {
      meshRef.current.visible = false;
      return;
    }

    const position = getSatellitePosition(issTle[0], issTle[1], new Date(now));
    if (!position) return;

    const p = raDecToCartesian(position.raHours, position.decDegrees, 50);
    meshRef.current.position.set(p.x, p.y, p.z);
    meshRef.current.visible = true;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[0.25, 12, 12]} />
      <meshBasicMaterial color="#39ff14" />
    </mesh>
  );
}