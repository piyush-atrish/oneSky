import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { CameraManager } from './CameraManager';
import { HorizonLayer } from './HorizonLayer';
import { StarsLayer } from './StarsLayer';
import { ConstellationsLayer } from './ConstellationsLayer';
import { SolarSystemLayer } from './SolarSystemLayer';
import { SatelliteLayer } from './SatelliteLayer';
import { useLocationStore } from '../store/useLocationStore';
import { getTiltCorrection, getMeridianRotation } from '../math/HorizonRotation';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const ROTATION_UPDATE_INTERVAL_MS = 1000;

function CelestialSphere() {
  const groupRef = useRef<THREE.Group>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const cachedLatitudeRef = useRef<number | null>(null);
  const tiltCorrectionRef = useRef(new THREE.Quaternion());

  useFrame(() => {
    if (!groupRef.current) return;

    const now = Date.now();
    if (lastUpdateRef.current !== null && now - lastUpdateRef.current < ROTATION_UPDATE_INTERVAL_MS) {
      return;
    }
    lastUpdateRef.current = now;

    const { latitude, longitude } = useLocationStore.getState();

    if (cachedLatitudeRef.current !== latitude) {
      cachedLatitudeRef.current = latitude;
      tiltCorrectionRef.current.copy(getTiltCorrection(latitude));
    }

    const meridian = getMeridianRotation(new Date(now), longitude);
    groupRef.current.quaternion.copy(tiltCorrectionRef.current).multiply(meridian);
  });

  return (
    <group ref={groupRef}>
      <ConstellationsLayer />
      <StarsLayer />
      <SolarSystemLayer />
      <SatelliteLayer />
    </group>
  );
}

export function SkyCanvas() {
  useEffect(() => {
    useLocationStore.getState().fetchLocation();
  }, []);

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
      <color attach="background" args={['#000000']} />
      <CameraManager />
      <HorizonLayer />
      <CelestialSphere />
    </Canvas>
  );
}