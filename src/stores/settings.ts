import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/user/settings';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/resolveScheme';

// The database is the source of truth. This store keeps a copy in memory so screens
// can read settings instantly, and writes every change back to user.db.

type SettingsState = {
  theme: ThemePreference;
  /** True once settings have been read from user.db. */
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
};

export const DEFAULT_SETTINGS = {
  theme: 'system' as ThemePreference,
};

function parseTheme(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_SETTINGS.theme;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const stored = await readAllSettings();
    set({ theme: parseTheme(stored.theme), loaded: true });
  },

  setTheme: async (theme) => {
    await writeSetting('theme', theme);
    set({ theme });
  },
}));
