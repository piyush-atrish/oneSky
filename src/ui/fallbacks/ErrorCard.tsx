import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../../theme/typography';
import { useLayout } from '../../theme/useLayout';

const GUTTER = 24;
const CARD_MAX_WIDTH = 420;

export interface ErrorCardAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly busy?: boolean;
}

export interface ErrorCardProps {
  readonly title: string;
  readonly message: string;
  readonly actions?: readonly ErrorCardAction[];
  /** Extra content between the message and the actions. */
  readonly children?: ReactNode;
  /** 'screen' fills its parent on a charcoal backdrop; 'modal' floats over the app on a scrim. */
  readonly presentation?: 'screen' | 'modal';
  /** Modal only: Android back button. */
  readonly onRequestClose?: () => void;
}

function ActionButton({ label, onPress, variant = 'secondary', disabled = false, busy = false }: ErrorCardAction) {
  const { minTouchTarget } = useLayout();
  const primary = variant === 'primary';
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.button,
        { minHeight: minTouchTarget },
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && styles.pressed,
      ]}
    >
      {busy && <ActivityIndicator color={Colors.textPrimary} style={styles.spinner} />}
      <Text
        style={[styles.buttonLabel, disabled && !busy && { color: Colors.disabled }]}
        maxFontSizeMultiplier={MAX_FONT_SCALE.body}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ErrorCard({ title, message, actions = [], children, presentation = 'screen', onRequestClose }: ErrorCardProps) {
  const { insets } = useLayout();
  const isModal = presentation === 'modal';

  const body = (
    <View
      style={[styles.backdrop, { backgroundColor: isModal ? Colors.scrim : Colors.backgroundSplash }]}
      accessibilityViewIsModal
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + GUTTER,
            paddingBottom: insets.bottom + GUTTER,
            paddingLeft: insets.left + GUTTER,
            paddingRight: insets.right + GUTTER,
          },
        ]}
      >
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE.title}>
            {title}
          </Text>
          <Text style={styles.message} maxFontSizeMultiplier={MAX_FONT_SCALE.body}>
            {message}
          </Text>
          {children}
          {actions.length > 0 && (
            <View style={styles.actions}>
              {actions.map((action) => (
                <ActionButton key={action.label} {...action} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (!isModal) return body;
  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={onRequestClose}>
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: CARD_MAX_WIDTH, padding: GUTTER, borderRadius: 16, backgroundColor: Colors.surface },
  title: { ...Typography.title, color: Colors.textHeading },
  message: { ...Typography.body, color: Colors.textPrimary, marginTop: 12 },
  actions: { marginTop: GUTTER, gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  buttonPrimary: { backgroundColor: Colors.surfaceMuted, borderColor: Colors.primaryAccent },
  buttonSecondary: { backgroundColor: 'transparent', borderColor: Colors.textPrimary },
  buttonLabel: { ...Typography.body, color: Colors.textPrimary, textAlign: 'center' },
  spinner: { marginRight: 8 },
  pressed: { opacity: 0.8 },
});