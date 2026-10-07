import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { selectLocationFallback, useLocationStore, type LocationFallback } from '../../store/useLocationStore';
import { ErrorCard, type ErrorCardAction } from './ErrorCard';

export const PRESET_CITIES = [
  { label: 'New York', latitude: 40.7128, longitude: -74.006 },
  { label: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { label: 'London', latitude: 51.5074, longitude: -0.1278 },
] as const;

const COPY: Record<LocationFallback, { title: string; message: string }> = {
  rationale: {
    title: 'See the sky above you',
    message: 'oneSky uses your location to show the stars overhead right now. It is only used on your device to calculate the sky.',
  },
  denied: {
    title: 'Location is off',
    message: "Without it we can't tell which sky is above you. Turn location on, or pick a city to explore its sky.",
  },
  'no-fix': {
    title: 'No location fix',
    message: "Your phone couldn't find a GPS signal, which is common indoors. Try again near a window, or pick a city.",
  },
  locating: {
    title: 'Finding your location',
    message: 'This can take a few seconds, and longer indoors. You can pick a city instead.',
  },
};

const requestLocation = () => void useLocationStore.getState().fetchLocation();

/** Full-screen state shown whenever the app has no resolved location. It unmounts itself once one exists. */
export function LocationPermissionScreen() {
  const reason = useLocationStore(selectLocationFallback);
  const canAskAgain = useLocationStore((s) => s.canAskAgain);
  const [choosingCity, setChoosingCity] = useState(false);

  useEffect(() => {
    if (reason === null) setChoosingCity(false);
  }, [reason]);

  // Coming back from system settings: re-check, so granting permission there resolves this screen.
  useEffect(() => {
    if (reason !== 'denied') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useLocationStore.getState().initLocation();
    });
    return () => sub.remove();
  }, [reason]);

  if (reason === null) return null;

  if (choosingCity) {
    const actions: ErrorCardAction[] = [
      ...PRESET_CITIES.map((city) => ({
        label: city.label,
        variant: 'primary' as const,
        onPress: () => useLocationStore.getState().setManualLocation(city.latitude, city.longitude),
      })),
      { label: 'Back', variant: 'secondary', onPress: () => setChoosingCity(false) },
    ];
    return <ErrorCard title="Choose a city" message="Pick a place to see its sky. You can change this later." actions={actions} />;
  }

  let primary: ErrorCardAction;
  switch (reason) {
    case 'rationale':
      primary = { label: 'Allow location', variant: 'primary', onPress: requestLocation };
      break;
    case 'denied':
      primary = canAskAgain
        ? { label: 'Try again', variant: 'primary', onPress: requestLocation }
        : { label: 'Open settings', variant: 'primary', onPress: () => void Linking.openSettings() };
      break;
    case 'no-fix':
      primary = { label: 'Try again', variant: 'primary', onPress: requestLocation };
      break;
    case 'locating':
      primary = { label: 'Locating…', variant: 'primary', busy: true, onPress: () => {} };
      break;
  }

  return (
    <ErrorCard
      {...COPY[reason]}
      actions={[primary, { label: 'Choose a city instead', variant: 'secondary', onPress: () => setChoosingCity(true) }]}
    />
  );
}