import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { CameraManager } from './CameraManager';
import { TerrainLayer } from './TerrainLayer';
import { StarsLayer } from './StarsLayer';
import { ConstellationsLayer } from './ConstellationsLayer';
import { SolarSystemLayer } from './Solarsystemlayer';
import { SatelliteLayer } from './SatelliteLayer';
import { useLocationStore } from '../store/useLocationStore';
import { getLocalSiderealTime } from '../astro/TimeMath';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const ROTATION_UPDATE_INTERVAL_MS = 1000;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const HORIZON_CORRECTION = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -Math.PI / 2);

function CelestialSphere() {
  const groupRef = useRef<THREE.Group>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const cachedLatitudeRef = useRef<number | null>(null);
  const tiltCorrectionRef = useRef(new THREE.Quaternion());
  const meridianRef = useRef(new THREE.Quaternion());

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
      const latRad = (latitude * Math.PI) / 180;
      const tilt = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -(Math.PI / 2 - latRad));
      tiltCorrectionRef.current.copy(HORIZON_CORRECTION).multiply(tilt);
    }

    const lstHours = getLocalSiderealTime(new Date(now), longitude);
    const lstRad = (lstHours * 15 * Math.PI) / 180;
    meridianRef.current.setFromAxisAngle(Z_AXIS, -lstRad);

    groupRef.current.quaternion.copy(tiltCorrectionRef.current).multiply(meridianRef.current);
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
      <TerrainLayer />
      <CelestialSphere />
    </Canvas>
  );
}