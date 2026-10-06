import { create } from 'zustand';
import { STAR_CATALOG } from '../data/starCatalog';
import { useCelestialStore } from './useCelestialStore';
import { useLocationStore } from './useLocationStore';
import { CelestialPositions } from '../astro/EphemerisService';
import { getSatellitePosition } from '../astro/SatelliteService';

export type ProminentEntityKind = 'star' | 'sun' | 'moon' | 'planet' | 'satellite';

export interface ProminentEntity {
  readonly kind: ProminentEntityKind;
  readonly name: string;
  readonly magnitude: number;
  readonly raHours: number;
  readonly decDegrees: number;
  readonly distance?: string;
}

export interface ProminenceStoreState {
  readonly topEntities: ProminentEntity[];
}

const TOP_COUNT = 30;
const SUN_MAGNITUDE = -26.74;
const ISS_MAGNITUDE = -3;
const KM_PER_AU = 149597870.7;

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAu(au: number): string {
  return `${au.toFixed(2)} AU`;
}

function formatKm(au: number): string {
  return `${String(Math.round(au * KM_PER_AU)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`;
}

function moonMagnitude(phaseAngle: number): number {
  const photometricAngle = Math.abs((((phaseAngle % 360) + 360) % 360) - 180);
  return -12.73 + 0.026 * photometricAngle + 4e-9 * photometricAngle ** 4;
}

function buildIssEntity(issTle: [string, string] | null): ProminentEntity | null {
  if (!issTle) return null;
  const { latitude, longitude } = useLocationStore.getState();
  const position = getSatellitePosition(issTle[0], issTle[1], new Date(), { latitude, longitude });
  if (!position) return null;
  return {
    kind: 'satellite',
    name: 'ISS',
    magnitude: ISS_MAGNITUDE,
    raHours: position.raHours,
    decDegrees: position.decDegrees,
  };
}

function buildTopEntities(
  positions: CelestialPositions,
  issTle: [string, string] | null,
): ProminentEntity[] {
  const entities: ProminentEntity[] = [
    {
      kind: 'sun',
      name: 'Sun',
      magnitude: SUN_MAGNITUDE,
      raHours: positions.sun.raHours,
      decDegrees: positions.sun.decDegrees,
      distance: formatAu(positions.sun.distanceAu),
    },
    {
      kind: 'moon',
      name: 'Moon',
      magnitude: moonMagnitude(positions.moon.phaseAngle),
      raHours: positions.moon.raHours,
      decDegrees: positions.moon.decDegrees,
      distance: formatKm(positions.moon.distanceAu),
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
      distance: formatAu(position.distanceAu),
    });
  }

  for (const [hipId, raHours, decDegrees, magnitude] of STAR_CATALOG) {
    entities.push({ kind: 'star', name: `HIP ${hipId}`, magnitude, raHours, decDegrees });
  }

  const iss = buildIssEntity(issTle);
  if (iss) entities.push(iss);

  entities.sort((a, b) => a.magnitude - b.magnitude);
  return entities.slice(0, TOP_COUNT);
}

export const useProminenceStore = create<ProminenceStoreState>()(() => ({
  topEntities: [],
}));

useCelestialStore.subscribe((state, prevState) => {
  if (!state.positions) return;
  if (state.lastComputed === prevState.lastComputed && state.issTle === prevState.issTle) return;
  useProminenceStore.setState({ topEntities: buildTopEntities(state.positions, state.issTle) });
});