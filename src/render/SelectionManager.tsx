import { useEffect } from 'react';
import { useThree } from '@react-three/fiber/native';
import { getSatellitePosition } from '../astro/SatelliteService';
import { raDecToCartesian } from '../math/Coordinates';
import { useCelestialStore } from '../store/useCelestialStore';
import { useLocationStore } from '../store/useLocationStore';
import { useProminenceStore, ProminentEntity } from '../store/useProminenceStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useUIStore, UIStoreState } from '../store/useUIStore';
import { celestialGroupRef } from './sceneRefs';

export const HIT_RADIUS_PX = 35;

interface Coordinates {
  readonly raHours: number;
  readonly decDegrees: number;
}

function resolveCoordinates(entity: ProminentEntity, now: Date): Coordinates | null {
  if (entity.kind !== 'satellite') return entity;
  const { issTle } = useCelestialStore.getState();
  if (!issTle) return null;
  const { latitude, longitude } = useLocationStore.getState();
  return getSatellitePosition(issTle[0], issTle[1], now, { latitude, longitude });
}

function isLayerVisible(kind: ProminentEntity['kind'], ui: Pick<UIStoreState, 'showSolarSystem' | 'showSatellites'>): boolean {
  if (kind === 'satellite') return ui.showSatellites;
  return kind === 'star' || ui.showSolarSystem;
}

export function SelectionManager() {
  const { camera, size } = useThree();
  const lastTap = useSelectionStore((s) => s.lastTap);

  useEffect(() => {
    if (!lastTap || !celestialGroupRef.current) return;

    const rotation = celestialGroupRef.current.quaternion;
    const { topEntities } = useProminenceStore.getState();
    const ui = useUIStore.getState();
    const now = new Date();

    let closestEntity: ProminentEntity | null = null;
    let closestDistance = Infinity;

    for (const entity of topEntities) {
      if (!isLayerVisible(entity.kind, ui)) continue;
      const coordinates = resolveCoordinates(entity, now);
      if (!coordinates) continue;

      const vector = raDecToCartesian(coordinates.raHours, coordinates.decDegrees, 1).applyQuaternion(rotation);
      if (ui.showTerrain && vector.z < 0) continue;
      vector.project(camera);
      if (vector.z > 1) continue;

      const pixelX = ((vector.x + 1) / 2) * size.width;
      const pixelY = ((1 - vector.y) / 2) * size.height;
      const distance = Math.hypot(pixelX - lastTap.x, pixelY - lastTap.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    }

    useSelectionStore.getState().selectEntity(closestDistance <= HIT_RADIUS_PX ? closestEntity : null);
  }, [lastTap, camera, size]);

  return null;
}