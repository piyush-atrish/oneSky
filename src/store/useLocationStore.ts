import { create } from 'zustand';
import * as Location from 'expo-location';

export type LocationMode = 'gps' | 'manual' | 'default';

export interface LocationStoreState {
  readonly latitude: number;
  readonly longitude: number;
  readonly isGranted: boolean;
  readonly isLoading: boolean;
  readonly locationMode: LocationMode;
  readonly fetchLocation: () => Promise<void>;
  readonly setManualLocation: (latitude: number, longitude: number) => void;
}

export const useLocationStore = create<LocationStoreState>()((set) => ({
  latitude: 0,
  longitude: 0,
  isGranted: false,
  isLoading: false,
  locationMode: 'default',
  fetchLocation: async () => {
    set({ isLoading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false, locationMode: 'default' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        isGranted: true,
        isLoading: false,
        locationMode: 'gps',
      });
    } catch {
      set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false, locationMode: 'default' });
    }
  },
  setManualLocation: (latitude, longitude) => {
    set({ latitude, longitude, isGranted: false, isLoading: false, locationMode: 'manual' });
  },
}));