import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useUIStore } from '../store/useUIStore';

export function CreditsOverlay() {
  const showCredits = useUIStore((s) => s.showCredits);
  if (!showCredits) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.card}>
        <ScrollView>
          <Text style={styles.title}>About oneSky</Text>
          <Text style={styles.heading}>Star Catalog</Text>
          <Text style={styles.body}>HYG Database (Astronexus / codebox)</Text>
          <Text style={styles.heading}>Constellation Lines</Text>
          <Text style={styles.body}>Stellarium (Western Sky Culture v1.0)</Text>
        </ScrollView>
        <Pressable onPress={() => useUIStore.getState().toggleCredits()} style={styles.closeButton}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: 'rgba(20,20,25,0.95)',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  heading: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  closeLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});