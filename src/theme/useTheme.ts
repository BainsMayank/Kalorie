import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settings';

import { colors } from './colors';
import { resolveScheme } from './resolveScheme';
import { fontSize, minTapTarget, radius, spacing } from './spacing';

/** The current theme: phone setting, unless the user picked Light or Dark in Profile. */
export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.theme);
  const scheme = resolveScheme(preference, systemScheme);

  return useMemo(
    () => ({ scheme, colors: colors[scheme], spacing, radius, fontSize, minTapTarget }),
    [scheme],
  );
}

export type Theme = ReturnType<typeof useTheme>;
