import { create } from 'zustand';
import * as Location from 'expo-location';

export interface LocationStoreState {
  readonly latitude: number;
  readonly longitude: number;
  readonly isGranted: boolean;
  readonly isLoading: boolean;
  readonly fetchLocation: () => Promise<void>;
}

export const useLocationStore = create<LocationStoreState>()((set) => ({
  latitude: 0,
  longitude: 0,
  isGranted: false,
  isLoading: false,
  fetchLocation: async () => {
    set({ isLoading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        isGranted: true,
        isLoading: false,
      });
    } catch {
      set({ latitude: 0, longitude: 0, isGranted: false, isLoading: false });
    }
  },
}));