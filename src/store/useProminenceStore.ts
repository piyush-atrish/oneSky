import { create } from 'zustand';
import { STAR_CATALOG } from '../data/starCatalog';
import { useCelestialStore } from './useCelestialStore';
import { CelestialPositions } from '../astro/EphemerisService';

export type ProminentEntityKind = 'star' | 'sun' | 'moon' | 'planet' | 'satellite';

export interface ProminentEntity {
  readonly kind: ProminentEntityKind;
  readonly name: string;
  readonly magnitude: number;
  readonly raHours: number;
  readonly decDegrees: number;
}

export interface ProminenceStoreState {
  readonly topEntities: ProminentEntity[];
}

const TOP_COUNT = 30;
const SUN_MAGNITUDE = -26.74;

const PLANET_MAGNITUDES: Record<Exclude<keyof CelestialPositions, 'sun' | 'moon'>, number> = {
  mercury: 0.0,
  venus: -4.0,
  mars: -0.5,
  jupiter: -2.2,
  saturn: 0.5,
  uranus: 5.7,
  neptune: 7.8,
};

const PLANET_NAMES = Object.keys(PLANET_MAGNITUDES) as (keyof typeof PLANET_MAGNITUDES)[];

const SATELLITE_SLOT: ProminentEntity = {
  kind: 'satellite',
  name: 'ISS',
  magnitude: -3,
  raHours: 0,
  decDegrees: 0,
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function moonMagnitude(phaseAngle: number): number {
  const photometricAngle = Math.abs(((phaseAngle % 360) + 360) % 360 - 180);
  return -12.73 + 0.026 * photometricAngle + 4e-9 * photometricAngle ** 4;
}

function buildTopEntities(positions: CelestialPositions): ProminentEntity[] {
  const entities: ProminentEntity[] = [
    { kind: 'sun', name: 'Sun', magnitude: SUN_MAGNITUDE, raHours: positions.sun.raHours, decDegrees: positions.sun.decDegrees },
    {
      kind: 'moon',
      name: 'Moon',
      magnitude: moonMagnitude(positions.moon.phaseAngle),
      raHours: positions.moon.raHours,
      decDegrees: positions.moon.decDegrees,
    },
  ];

  for (const name of PLANET_NAMES) {
    const position = positions[name];
    entities.push({
      kind: 'planet',
      name: capitalize(name),
      magnitude: PLANET_MAGNITUDES[name],
      raHours: position.raHours,
      decDegrees: position.decDegrees,
    });
  }

  for (const [hipId, raHours, decDegrees, magnitude] of STAR_CATALOG) {
    entities.push({ kind: 'star', name: `HIP ${hipId}`, magnitude, raHours, decDegrees });
  }

  entities.sort((a, b) => a.magnitude - b.magnitude);
  return [...entities.slice(0, TOP_COUNT - 1), SATELLITE_SLOT];
}

export const useProminenceStore = create<ProminenceStoreState>()(() => ({
  topEntities: [],
}));

useCelestialStore.subscribe((state, prevState) => {
  if (!state.positions || state.lastComputed === prevState.lastComputed) return;
  useProminenceStore.setState({ topEntities: buildTopEntities(state.positions) });
});