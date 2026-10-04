import { create } from 'zustand';
import * as Location from 'expo-location';

export type LocationMode = 'gps' | 'manual' | 'default';

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
  readonly fetchLocation: () => Promise<void>;
  readonly setManualLocation: (latitude: number, longitude: number) => void;
  readonly setLocationMode: (mode: LocationMode) => void;
}

export const useLocationStore = create<LocationStoreState>()((set, get) => ({
  latitude: 0,
  longitude: 0,
  isGranted: false,
  isLoading: false,
  locationMode: 'default',
  cachedGps: null,
  fetchLocation: async () => {
    const cached = get().cachedGps;
    if (cached) {
      set({ latitude: cached.latitude, longitude: cached.longitude, isGranted: true, locationMode: 'gps' });
      return;
    }

    set({ isLoading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false, locationMode: 'default' });
        return;
      }

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