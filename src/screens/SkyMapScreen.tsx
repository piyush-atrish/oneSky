import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCameraGestures } from '../camera/useCameraGestures';
import { LabelOverlay } from '../render/LabelLayer';
import { SkyCanvas } from '../render/SkyCanvas';
import { HUDOverlay } from '../ui/HUDOverlay';
import { CreditsOverlay } from '../ui/CreditsOverlay';
import { InfoBottomSheet } from '../ui/InfoBottomSheet';
import { CompassOverlay } from '../render/CompassLayer';

export default function SkyMapScreen() {
  const gesture = useCameraGestures();

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <SkyCanvas />
        <GestureDetector gesture={gesture}>
          <View collapsable={false} style={styles.touchLayer} />
        </GestureDetector>
        <LabelOverlay />
        <CompassOverlay/>
        <HUDOverlay />
        <CreditsOverlay />
        <InfoBottomSheet />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
});