// src/theme/colors.ts
const palette = {
  crimson: '#AD343E',
  amber: '#F2AF29',
  cream: '#E0E0CE',
  charcoal: '#474747',
  panelGrey: '#D9D9D9',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const Colors = {
  palette,

  // Surfaces
  background: palette.black, // sky / main screen
  backgroundSplash: palette.charcoal, // loading screen
  surface: palette.crimson, // drawer, info callout
  surfaceMuted: palette.charcoal, // location pills
  surfaceLight: palette.panelGrey, // callout text panel, switch track
  fab: palette.cream, // fan-out circles
  scrim: 'rgba(0,0,0,0.5)',

  // Accents
  primaryAccent: palette.amber, // icons, headings
  secondaryAccent: palette.crimson, // logo, active-choice marker

  // Text
  textPrimary: palette.cream, // small text on crimson / charcoal (4.7:1 on crimson)
  textHeading: palette.amber, // large headings only (3.3:1 on crimson)
  textOnLight: palette.black, // on panelGrey / cream
  textOnSplash: palette.white, // version label on charcoal
  wordmark: palette.black,

  // Controls
  switchTrack: palette.panelGrey,
  switchKnob: palette.black,
  switchLabel: palette.black,
  disabled: 'rgba(224,224,206,0.4)',
  fabInactive: palette.charcoal,
  divider: 'rgba(224,224,206,0.6)',
} as const;

export type ColorToken = keyof typeof Colors;