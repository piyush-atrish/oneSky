import { useEffect } from 'react';
import { useThree } from '@react-three/fiber/native';
import { useCelestialStore } from '../store/useCelestialStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useUIStore } from '../store/useUIStore';
import { pickEntityId } from './entityGeometry';
import { celestialGroupRef } from './sceneRefs';

export { HIT_RADIUS_PX } from './entityGeometry';

/**
 * Resolves each tap against the dictionary. A tap that lands on nothing in the dictionary changes nothing:
 * the sheet neither opens nor closes.
 */
export function SelectionManager(): null {
  const { camera, size } = useThree();
  const lastTap = useSelectionStore((s) => s.lastTap);

  useEffect(() => {
    const group = celestialGroupRef.current;
    if (!lastTap || !group) return;

    const { showSolarSystem, showConstellations, showTerrain } = useUIStore.getState();
    const id = pickEntityId(
      lastTap,
      { camera, width: size.width, height: size.height, rotation: group.quaternion },
      { showSolarSystem, showConstellations, showTerrain },
      useCelestialStore.getState().positions,
    );
    if (id) useSelectionStore.getState().selectEntity(id);
  }, [lastTap, camera, size]);

  return null;
}