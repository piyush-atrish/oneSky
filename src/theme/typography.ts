// src/theme/typography.ts
import type { TextStyle } from 'react-native';

// Keys match the font names registered by @expo-google-fonts/* via useFonts.
export const FontFamily = {
  display: 'Righteous_400Regular',
  regular: 'Roboto_400Regular',
  light: 'Roboto_300Light',
} as const;

export const Typography = {
  display: { fontFamily: FontFamily.display, fontSize: 65, lineHeight: 72 }, // wordmark
  title: { fontFamily: FontFamily.regular, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: FontFamily.regular, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 }, // minimum size
  description: { fontFamily: FontFamily.light, fontSize: 12, lineHeight: 18 }, // info callout body
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof Typography;

/** Upper bound for system font scaling, applied via `maxFontSizeMultiplier` on <Text>. */
export const MAX_FONT_SCALE: Record<TextVariant, number> = {
  display: 1.0,
  title: 1.3,
  heading: 1.3,
  body: 1.4,
  small: 1.3,
  caption: 1.15, // fixed-height pills
  description: 1.5,
};