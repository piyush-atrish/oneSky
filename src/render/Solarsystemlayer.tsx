import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { raDecToCartesian } from '../math/Coordinates';
import { useCelestialStore } from '../store/useCelestialStore';
import { useUIStore } from '../store/useUIStore';
import { CelestialPosition, CelestialPositions } from '../astro/EphemerisService';

const UPDATE_INTERVAL_MS = 5000;

const BODY_CONFIG: Record<keyof CelestialPositions, { color: string; scale: number }> = {
  sun: { color: '#ffdd00', scale: 2.0 },
  moon: { color: '#e0e0e0', scale: 1.5 },
  mercury: { color: '#9c9c9c', scale: 0.5 },
  venus: { color: '#f5deb3', scale: 1.3 },
  mars: { color: '#ff4422', scale: 1.0 },
  jupiter: { color: '#e0c496', scale: 1.2 },
  saturn: { color: '#f4e5b8', scale: 0.9 },
  uranus: { color: '#7fdbff', scale: 0.6 },
  neptune: { color: '#4166f5', scale: 0.5 },
};

const BODY_NAMES = Object.keys(BODY_CONFIG) as (keyof CelestialPositions)[];

const MOON_VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MOON_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  void main() {
    float lit = smoothstep(-0.05, 0.05, dot(normalize(vNormal), uSunDirection));
    gl_FragColor = vec4(mix(uColor * 0.05, uColor, lit), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface MoonMeshProps {
  readonly position: [number, number, number];
  readonly sunDirection: THREE.Vector3;
  readonly color: string;
  readonly scale: number;
}

function MoonMesh({ position, sunDirection, color, scale }: MoonMeshProps) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
    }),
    [color],
  );

  useLayoutEffect(() => {
    uniforms.uSunDirection.value.copy(sunDirection);
  }, [uniforms, sunDirection]);

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.4 * scale, 32, 32]} />
      <shaderMaterial
        vertexShader={MOON_VERTEX_SHADER}
        fragmentShader={MOON_FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function SolarSystemLayer() {
  useFrame(() => {
    if (!useUIStore.getState().showSolarSystem) return;

    const { lastComputed, updatePositions } = useCelestialStore.getState();
    if (lastComputed === null || Date.now() - lastComputed > UPDATE_INTERVAL_MS) {
      updatePositions(new Date());
    }
  });

  const showSolarSystem = useUIStore((s) => s.showSolarSystem);
  const positions = useCelestialStore((s) => s.positions);
  if (!showSolarSystem || !positions) return null;

  const sunDirection = raDecToCartesian(positions.sun.raHours, positions.sun.decDegrees, 1);

  return (
    <>
      {BODY_NAMES.map((name) => {
        const { color, scale } = BODY_CONFIG[name];
        const position: CelestialPosition = positions[name];
        const p = raDecToCartesian(position.raHours, position.decDegrees, 50);
        const meshPosition: [number, number, number] = [p.x, p.y, p.z];

        if (name === 'moon') {
          return (
            <MoonMesh
              key={name}
              position={meshPosition}
              sunDirection={sunDirection}
              color={color}
              scale={scale}
            />
          );
        }

        return (
          <mesh key={name} position={meshPosition}>
            <sphereGeometry args={[0.4 * scale, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}