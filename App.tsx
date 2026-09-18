import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import SkyMapScreen from './src/screens/SkyMapScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SkyMapScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});