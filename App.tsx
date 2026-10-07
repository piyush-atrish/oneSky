import 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Righteous_400Regular } from '@expo-google-fonts/righteous';
import { Roboto_300Light, Roboto_400Regular } from '@expo-google-fonts/roboto';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SkyMapScreen from './src/screens/SkyMapScreen';
import { useAppReadyStore } from './src/store/useAppReadyStore';
import { Colors } from './src/theme/colors';
import { LoadingScreen } from './src/ui/LoadingScreen';

LogBox.ignoreLogs(['THREE.Clock:']);
SplashScreen.preventAutoHideAsync().catch(() => {});

const FONTS = { Righteous_400Regular, Roboto_300Light, Roboto_400Regular };

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const fontsSettled = fontsLoaded || fontError !== null; // a font failure must not strand the app
  const engineStarted = useAppReadyStore((s) => s.engineStarted);
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    useAppReadyStore.getState().start();
  }, []);

  useEffect(() => {
    if (fontsSettled) useAppReadyStore.getState().completeGate('fonts');
  }, [fontsSettled]);

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const dismissLoading = useCallback(() => setShowLoading(false), []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        {engineStarted && <SkyMapScreen />}
        {showLoading && fontsSettled && <LoadingScreen onShown={hideSplash} onFinished={dismissLoading} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});    