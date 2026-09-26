import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import SkyMapScreen from './src/screens/SkyMapScreen';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

LogBox.ignoreLogs(['THREE.Clock:']);

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <SkyMapScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});