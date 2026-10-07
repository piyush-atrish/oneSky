import { create } from 'zustand';
import * as Location from 'expo-location';

export type LocationMode = 'gps' | 'manual' | 'default';
/** 'unknown' until the startup check has run; 'undetermined' means the system has never been asked. */
export type PermissionState = 'unknown' | 'undetermined' | 'granted' | 'denied';

interface CachedGps {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocationStoreState {
  readonly latitude: number;
  readonly longitude: number;
  readonly isGranted: boolean;
  readonly isLoading: boolean;
  readonly locationMode: LocationMode;
  readonly cachedGps: CachedGps | null;
  readonly permission: PermissionState;
  readonly canAskAgain: boolean;
  /** Startup entry point: reads the permission without prompting, and fetches only if already granted. */
  readonly initLocation: () => Promise<void>;
  /** Requests permission if needed (this is what triggers the system prompt), then fetches a fix. */
  readonly fetchLocation: () => Promise<void>;
  readonly setManualLocation: (latitude: number, longitude: number) => void;
  readonly setLocationMode: (mode: LocationMode) => void;
}

const toPermission = (status: Location.PermissionStatus): PermissionState => {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  return status === Location.PermissionStatus.DENIED ? 'denied' : 'undetermined';
};

export type LocationFallback = 'rationale' | 'denied' | 'no-fix' | 'locating';

/**
 * Why (if at all) the app has no usable location right now. Pure and primitive-valued, so it is cheap as a
 * store selector. 'gps' and 'manual' both mean the location is resolved.
 */
export function selectLocationFallback(s: LocationStoreState): LocationFallback | null {
  if (s.locationMode !== 'default') return null;
  if (s.isLoading) return 'locating';
  switch (s.permission) {
    case 'undetermined': return 'rationale';
    case 'denied': return 'denied';
    case 'granted': return 'no-fix';
    default: return null; // 'unknown': startup check hasn't run yet
  }
}

export const useLocationStore = create<LocationStoreState>()((set, get) => ({
  latitude: 0,
  longitude: 0,
  isGranted: false,
  isLoading: false,
  locationMode: 'default',
  cachedGps: null,
  permission: 'unknown',
  canAskAgain: true,
  initLocation: async () => {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      const permission = toPermission(status);
      set({ permission, canAskAgain });
      if (permission === 'granted') await get().fetchLocation();
    } catch {
      set({ permission: 'denied', canAskAgain: true });
    }
  },
  fetchLocation: async () => {
    const cached = get().cachedGps;
    if (cached) {
      set({ latitude: cached.latitude, longitude: cached.longitude, isGranted: true, permission: 'granted', locationMode: 'gps' });
      return;
    }

    set({ isLoading: true });
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      const permission = toPermission(status);
      if (permission !== 'granted') {
        set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false, locationMode: 'default', permission, canAskAgain });
        return;
      }
      set({ permission, canAskAgain });

      const lastKnown = await Location.getLastKnownPositionAsync();
      const position = lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      const { latitude, longitude } = position.coords;
      set({
        latitude,
        longitude,
        isGranted: true,
        isLoading: false,
        locationMode: 'gps',
        cachedGps: { latitude, longitude },
      });
    } catch {
      set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false, locationMode: 'default' });
    }
  },
  setManualLocation: (latitude, longitude) => {
    set({ latitude, longitude, isGranted: false, isLoading: false, locationMode: 'manual' });
  },
  setLocationMode: (mode) => set({ locationMode: mode }),
}));