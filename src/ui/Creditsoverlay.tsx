import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expo } from '../../app.json';
import { LICENSE_TEXTS, NOTICES } from '../data/thirdPartyNotices';
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
      'The interface icons were drawn for oneSky.',
      'Planetary facts from the NASA NSSDCA planetary fact sheets.',
    ],
  },
  {
    heading: 'Data licence',
    lines: [
      'The star, constellation and description data in oneSky are adapted from CC BY-SA 4.0 sources and are shared under the same licence.',
      'Data files and build scripts: https://github.com/piyush-atrish/onesky-data',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    ],
  },
  { heading: 'Satellite orbits', lines: ['Orbital elements from CelesTrak.'] },
  { heading: 'Astronomy', lines: ['astronomy-engine (MIT)', 'satellite.js (MIT)'] },
  { heading: 'Built with', lines: ['React Native', 'Expo', 'Three.js and React Three Fiber', 'Reanimated', 'Zustand'] },
];

const NATIVE_NOTE =
  'The Android app also contains open-source native components that ship with React Native and Expo, used under their own licences (mostly MIT, BSD and Apache-2.0).';

const textTitle = (key: string) => (key === 'MIT' ? 'MIT licence (standard text)' : `Licence text: ${key}`);

/** Full licence notices for the open-source packages bundled into the app. */
function LicencesView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <ErrorCard
      title="Open-source licences"
      message="oneSky is built with the open-source software listed below."
      actions={[
        { label: 'Back', variant: 'secondary', onPress: onBack },
        { label: 'Close', variant: 'primary', onPress: onClose },
      ]}
    >
      <Text style={[styles.line, styles.gap]} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{NATIVE_NOTE}</Text>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
          Packages
        </Text>
        {NOTICES.map((n) => (
          <View key={`${n.name}@${n.version}`} style={styles.notice}>
            <Text style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>
              {n.name} {n.version} ({n.license})
            </Text>
            {n.copyright ? (
              <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{n.copyright}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {Object.entries(LICENSE_TEXTS).map(([key, text]) => (
        <View key={key} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
            {textTitle(key)}
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE.small}>{text}</Text>
        </View>
      ))}
    </ErrorCard>
  );
}

/** The "About" screen. Opened from the drawer or the tools fan; closed by its button or the Android back key. */
export function CreditsOverlay() {
  const open = useUIStore((s) => s.panel === 'credits');
  const [view, setView] = useState<'about' | 'licences'>('about');
  useEffect(() => {
    if (!open) setView('about');
  }, [open]);
  if (!open) return null;

  const close = () => useUIStore.getState().closePanel();
  if (view === 'licences') return <LicencesView onBack={() => setView('about')} onClose={close} />;

  return (
    <ErrorCard
      title="About oneSky"
      message={`Version ${expo.version}`}
      actions={[
        { label: 'Open-source licences', variant: 'secondary', onPress: () => setView('licences') },
        { label: 'Close', variant: 'primary', onPress: close },
      ]}
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
  sub: { ...Typography.small, color: Colors.textPrimary, marginTop: 2, opacity: 0.8 },
  notice: { marginTop: 8 },
  gap: { marginTop: 12 },
});