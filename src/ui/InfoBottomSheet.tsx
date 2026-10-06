import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSelectionStore } from '../store/useSelectionStore';
import { ProminentEntity } from '../store/useProminenceStore';

const SNAP_POINTS = ['25%'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function close(): void {
  useSelectionStore.getState().selectEntity(null);
}

function handleClose(): void {
  if (useSelectionStore.getState().selectedEntity) close();
}

export function InfoBottomSheet() {
  const selectedEntity = useSelectionStore((s) => s.selectedEntity);
  const sheetRef = useRef<BottomSheet>(null);
  const [displayed, setDisplayed] = useState<ProminentEntity | null>(null);

  if (selectedEntity && selectedEntity !== displayed) setDisplayed(selectedEntity);
  const entity = selectedEntity ?? displayed;

  useEffect(() => {
    if (selectedEntity) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [selectedEntity]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {entity && (
          <>
            <View style={styles.header}>
              <Text style={styles.name} accessibilityRole="header">
                {entity.name}
              </Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={`Close ${entity.name} details`}
                style={styles.closeButton}
              >
                <Text style={styles.closeLabel}>Close</Text>
              </Pressable>
            </View>
            <Row label="Type" value={capitalize(entity.kind)} />
            <Row label="Magnitude" value={entity.magnitude.toFixed(2)} />
            {entity.distance && <Row label="Distance" value={entity.distance} />}
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#14141a',
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    flex: 1,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginRight: 12,
  },
  closeButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.24)',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
  },
  value: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});