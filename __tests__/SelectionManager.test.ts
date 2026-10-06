import * as THREE from 'three';
import { getSatellitePosition } from '../src/astro/SatelliteService';
import { HIT_RADIUS_PX, SelectionManager } from '../src/render/SelectionManager';
import { celestialGroupRef } from '../src/render/sceneRefs';
import type { ProminentEntity } from '../src/store/useProminenceStore';

const mockSelectEntity = jest.fn();
const mockCamera = { matrixWorldInverse: new THREE.Matrix4(), projectionMatrix: new THREE.Matrix4() };
const DEFAULT_UI = { showSolarSystem: true, showSatellites: true, showTerrain: true };
let mockLastTap: { x: number; y: number } | null = null;
let mockEntities: ProminentEntity[] = [];
let mockIssTle: [string, string] | null = null;
let mockZ = 0;
let mockUi = DEFAULT_UI;

jest.mock('react', () => ({ useEffect: (effect: () => void) => effect() }));

jest.mock('@react-three/fiber/native', () => ({
  useThree: () => ({ camera: mockCamera, size: { width: 200, height: 200 } }),
}));

jest.mock('../src/math/Coordinates', () => ({
  raDecToCartesian: (ra: number, dec: number) => new (jest.requireActual<typeof THREE>('three').Vector3)(ra, dec, mockZ),
}));

jest.mock('../src/astro/SatelliteService', () => ({ getSatellitePosition: jest.fn() }));

jest.mock('../src/store/useSelectionStore', () => ({
  useSelectionStore: Object.assign(
    (selector: (state: { lastTap: typeof mockLastTap }) => unknown) => selector({ lastTap: mockLastTap }),
    { getState: () => ({ selectEntity: mockSelectEntity }) },
  ),
}));

jest.mock('../src/store/useProminenceStore', () => ({
  useProminenceStore: { getState: () => ({ topEntities: mockEntities }) },
}));

jest.mock('../src/store/useCelestialStore', () => ({
  useCelestialStore: { getState: () => ({ issTle: mockIssTle }) },
}));

jest.mock('../src/store/useUIStore', () => ({ useUIStore: { getState: () => mockUi } }));

jest.mock('../src/store/useLocationStore', () => ({
  useLocationStore: { getState: () => ({ latitude: 28.6, longitude: 77.2 }) },
}));

const CENTER = { x: 100, y: 100 };

function entity(name: string, ndcX: number, ndcY: number, kind: ProminentEntity['kind'] = 'star'): ProminentEntity {
  return { kind, name, magnitude: 0, raHours: ndcX, decDegrees: ndcY };
}

function tapAt(x: number, y: number): void {
  mockLastTap = { x, y };
  SelectionManager();
}

beforeEach(() => {
  jest.resetAllMocks();
  celestialGroupRef.current = { quaternion: new THREE.Quaternion() } as unknown as THREE.Group;
  mockLastTap = null;
  mockEntities = [];
  mockIssTle = null;
  mockZ = 0;
  mockUi = DEFAULT_UI;
});

describe('SelectionManager hit testing', () => {
  const left = entity('Left', 0, 0);
  const right = entity('Right', 0.5, 0);

  it('selects the nearest entity to the tap', () => {
    mockEntities = [left, right];
    tapAt(CENTER.x + 10, CENTER.y);
    expect(mockSelectEntity).toHaveBeenLastCalledWith(left);
    tapAt(CENTER.x + 40, CENTER.y);
    expect(mockSelectEntity).toHaveBeenLastCalledWith(right);
  });

  it('selects an entity exactly at the hit radius', () => {
    mockEntities = [left];
    tapAt(CENTER.x + HIT_RADIUS_PX, CENTER.y);
    expect(mockSelectEntity).toHaveBeenCalledWith(left);
  });

  it('dispatches null when the nearest entity is beyond the hit radius', () => {
    mockEntities = [left];
    tapAt(CENTER.x + HIT_RADIUS_PX + 1, CENTER.y);
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });

  it('does nothing without a tap', () => {
    mockEntities = [left];
    SelectionManager();
    expect(mockSelectEntity).not.toHaveBeenCalled();
  });

  it('uses cached coordinates for non-satellite entities', () => {
    mockEntities = [left];
    mockIssTle = ['1', '2'];
    tapAt(CENTER.x, CENTER.y);
    expect(getSatellitePosition).not.toHaveBeenCalled();
  });
});

describe('SelectionManager visibility filtering', () => {
  const star = entity('Star', 0, 0);

  it('ignores objects below the horizon while terrain is shown', () => {
    mockZ = -0.5;
    mockEntities = [star];
    tapAt(CENTER.x, CENTER.y);
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });

  it('selects objects below the horizon once terrain is hidden', () => {
    mockZ = -0.5;
    mockUi = { ...DEFAULT_UI, showTerrain: false };
    mockEntities = [star];
    tapAt(CENTER.x, CENTER.y);
    expect(mockSelectEntity).toHaveBeenCalledWith(star);
  });

  it.each(['sun', 'moon', 'planet'] as const)('ignores a hidden %s layer but keeps stars selectable', (kind) => {
    mockUi = { ...DEFAULT_UI, showSolarSystem: false };
    mockEntities = [entity('Body', 0, 0, kind)];
    tapAt(CENTER.x, CENTER.y);
    expect(mockSelectEntity).toHaveBeenLastCalledWith(null);
    mockEntities = [star];
    tapAt(CENTER.x, CENTER.y);
    expect(mockSelectEntity).toHaveBeenLastCalledWith(star);
  });

  it('selects solar-system bodies while their layer is visible', () => {
    const moon = entity('Moon', 0, 0, 'moon');
    mockEntities = [moon];
    tapAt(CENTER.x, CENTER.y);
    expect(mockSelectEntity).toHaveBeenCalledWith(moon);
  });

  it('ignores the ISS without computing its position when satellites are hidden', () => {
    mockUi = { ...DEFAULT_UI, showSatellites: false };
    mockEntities = [entity('ISS', 0, 0, 'satellite')];
    mockIssTle = ['1 line', '2 line'];
    tapAt(CENTER.x, CENTER.y);
    expect(getSatellitePosition).not.toHaveBeenCalled();
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });
});

describe('SelectionManager live ISS position', () => {
  const iss = entity('ISS', 0.9, 0.9, 'satellite');

  beforeEach(() => {
    mockEntities = [iss];
    mockIssTle = ['1 line', '2 line'];
    jest.mocked(getSatellitePosition).mockReturnValue({ raHours: 0, decDegrees: 0 });
  });

  it('hits the live observer-relative ISS position instead of the stale cached one', () => {
    tapAt(CENTER.x, CENTER.y);
    expect(getSatellitePosition).toHaveBeenCalledWith('1 line', '2 line', expect.any(Date), { latitude: 28.6, longitude: 77.2 });
    expect(mockSelectEntity).toHaveBeenCalledWith(iss);
  });

  it('misses the stale cached position', () => {
    tapAt(190, 10);
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });

  it('ignores the ISS without a TLE rather than using cached coordinates', () => {
    mockIssTle = null;
    tapAt(190, 10);
    expect(getSatellitePosition).not.toHaveBeenCalled();
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });

  it('ignores the ISS when propagation fails', () => {
    jest.mocked(getSatellitePosition).mockReturnValue(null);
    tapAt(190, 10);
    expect(mockSelectEntity).toHaveBeenCalledWith(null);
  });
});