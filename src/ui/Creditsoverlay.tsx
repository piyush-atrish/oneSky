import { StyleSheet, Text, View } from 'react-native';
import { expo } from '../../app.json';
import { useUIStore } from '../store/useUIStore';
import { Colors } from '../theme/colors';
import { MAX_FONT_SCALE, Typography } from '../theme/typography';
import { ErrorCard } from './fallbacks/ErrorCard';

interface Section {
  readonly heading: string;
  readonly lines: readonly string[];
}

const SECTIONS: readonly Section[] = [
  {
    heading: 'Star catalog',
    lines: [
      'HYG Database v4.1 by David Nash (Astronexus), compiled from the Hipparcos, Yale Bright Star and Gliese catalogs. Licence: CC BY-SA 4.0.',
      'Modified for oneSky: filtered, deduplicated and reformatted.',
      'Contains data from the ESA Hipparcos mission.',
      'https://github.com/astronexus/HYG-Database',
    ],
  },
  {
    heading: 'Constellation lines and names',
    lines: [
      'Stellarium “modern” sky culture, by the Stellarium team. Licence: CC BY-SA 4.0.',
      'Modified for oneSky: converted to pairs of Hipparcos star numbers.',
      'https://github.com/Stellarium/stellarium',
    ],
  },
  {
    heading: 'Information',
    lines: [
      'Object descriptions were written for oneSky.',
      'Planetary facts from the NASA NSSDCA planetary fact sheets.',
    ],
  },
  {
    heading: 'Data licence',
    lines: [
      'The star, constellation and description data in oneSky are adapted from CC BY-SA 4.0 sources and are shared under the same licence.',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    ],
  },
  { heading: 'Satellite orbits', lines: ['Orbital elements from CelesTrak.'] },
  { heading: 'Astronomy', lines: ['astronomy-engine (MIT)', 'satellite.js (MIT)'] },
  { heading: 'Built with', lines: ['React Native', 'Expo', 'Three.js and React Three Fiber', 'Reanimated', 'Zustand'] },
];

/** The "About" screen. Opened from the drawer or the tools fan; closed by its button or the Android back key. */
export function CreditsOverlay() {
  const open = useUIStore((s) => s.panel === 'credits');
  if (!open) return null;

  return (
    <ErrorCard
      title="About oneSky"
      message={`Version ${expo.version}`}
      actions={[{ label: 'Close', variant: 'primary', onPress: () => useUIStore.getState().closePanel() }]}
    >
      {SECTIONS.map(({ heading, lines }) => (
        <View key={heading} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
            {heading}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{line}</Text>
          ))}
        </View>
      ))}
    </ErrorCard>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  heading: { ...Typography.heading, color: Colors.textPrimary },
  line: { ...Typography.small, color: Colors.textPrimary, marginTop: 2 },
});