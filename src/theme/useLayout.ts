// src/theme/useLayout.ts
import { useMemo } from 'react';
import { useWindowDimensions, type Insets } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

export const MIN_TOUCH_TARGET = 48;
const TABLET_MIN_SHORT_SIDE = 600;

/** Symmetric hitSlop that grows a control of `size` dp up to the 48dp minimum. */
export function hitSlopFor(size: number): Insets {
  const pad = Math.max(0, (MIN_TOUCH_TARGET - size) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}

export interface Layout {
  readonly insets: EdgeInsets;
  readonly width: number;
  readonly height: number;
  readonly isTablet: boolean;
  readonly minTouchTarget: number;
  readonly hitSlopFor: (size: number) => Insets;
}

export function useLayout(): Layout {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return useMemo(
    () => ({
      insets,
      width,
      height,
      isTablet: Math.min(width, height) >= TABLET_MIN_SHORT_SIDE,
      minTouchTarget: MIN_TOUCH_TARGET,
      hitSlopFor,
    }),
    [insets, width, height],
  );
}