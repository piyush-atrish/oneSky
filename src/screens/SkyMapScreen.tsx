import { StyleSheet, View } from 'react-native';
import { SkyCanvas } from '../render/SkyCanvas';

export default function SkyMapScreen() {
  return (
    <View style={styles.container}>
      {/* 
        The canvas takes up the full screen. 
        Gesture handlers for Milestone 2 will wrap this later. 
      */}
      <SkyCanvas />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});