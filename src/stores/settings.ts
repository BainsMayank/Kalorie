import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/user/settings';
import { LANGUAGE_PREFERENCES, applyLanguage, type LanguagePreference } from '@/i18n';
import { ALL_ALERTS_ON, parseAlertToggles, type AlertKey, type AlertToggles } from '@/lib/alerts';
import { DIET_PREFERENCES, type DietPreference } from '@/lib/micros';
import {
  REMINDERS_OFF,
  parseReminders,
  serializeReminders,
  type ReminderSettings,
} from '@/lib/reminders';
import {
  DEFAULT_GLASS_ML,
  DEFAULT_WATER_GOAL_ML,
  GLASS_ML_RANGE,
  WATER_GOAL_RANGE,
  parseMl,
} from '@/lib/water';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/resolveScheme';

// The database is the source of truth. This store keeps a copy in memory so screens
// can read settings instantly, and writes every change back to user.db.

type SettingsState = {
  theme: ThemePreference;
  /** The app's language: the phone's, or one picked in Profile. */
  language: LanguagePreference;
  /**
   * Hide numbers (SPEC §8.3): shapes and words instead of kcal, grams, percentages and weight.
   * Logging works the same.
   */
  hideNumbers: boolean;
  /** Which limit alerts are on (SPEC §4.2 `alerts_enabled`). */
  alertsEnabled: AlertToggles;
  /** Also send a phone notification when a limit is reached. Off by default. */
  alertNotifications: boolean;
  /** One tap on + in the water row adds this much (SPEC §4.2 `water_glass_ml`). */
  waterGlassMl: number;
  /** The day's water goal (SPEC §4.2 `water_goal_ml`). */
  waterGoalMl: number;
  /** What the person eats (Profile): vegetarian foods are suggested first. */
  diet: DietPreference;
  /** Meal-time and pending-scans reminders (SPEC §5.12). All off by default. */
  reminders: ReminderSettings;
  /** True once settings have been read from user.db. */
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: LanguagePreference) => Promise<void>;
  setHideNumbers: (hide: boolean) => Promise<void>;
  setAlertEnabled: (alert: AlertKey, enabled: boolean) => Promise<void>;
  setAlertNotifications: (enabled: boolean) => Promise<void>;
  setDiet: (diet: DietPreference) => Promise<void>;
  setReminders: (reminders: ReminderSettings) => Promise<void>;
  /** Saves the glass size and the water goal (from Goals). */
  setWater: (glassMl: number, goalMl: number) => Promise<void>;
};

export const DEFAULT_SETTINGS = {
  theme: 'system' as ThemePreference,
  language: 'system' as LanguagePreference,
  hideNumbers: false,
  alertsEnabled: ALL_ALERTS_ON,
  alertNotifications: false,
  waterGlassMl: DEFAULT_GLASS_ML,
  waterGoalMl: DEFAULT_WATER_GOAL_ML,
  diet: 'any' as DietPreference,
  reminders: REMINDERS_OFF,
};

function parseDiet(value: unknown): DietPreference {
  return DIET_PREFERENCES.includes(value as DietPreference)
    ? (value as DietPreference)
    : DEFAULT_SETTINGS.diet;
}

function parseLanguage(value: unknown): LanguagePreference {
  return LANGUAGE_PREFERENCES.includes(value as LanguagePreference)
    ? (value as LanguagePreference)
    : DEFAULT_SETTINGS.language;
}

function parseTheme(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_SETTINGS.theme;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const stored = await readAllSettings();
    const language = parseLanguage(stored.language);
    await applyLanguage(language);
    set({
      theme: parseTheme(stored.theme),
      language,
      hideNumbers: stored.hide_numbers === true,
      alertsEnabled: parseAlertToggles(stored.alerts_enabled),
      alertNotifications: stored.alert_notifications === true,
      waterGlassMl: parseMl(stored.water_glass_ml, GLASS_ML_RANGE, DEFAULT_GLASS_ML),
      waterGoalMl: parseMl(stored.water_goal_ml, WATER_GOAL_RANGE, DEFAULT_WATER_GOAL_ML),
      diet: parseDiet(stored.diet_preference),
      reminders: parseReminders(stored.reminders),
      loaded: true,
    });
  },

  setTheme: async (theme) => {
    await writeSetting('theme', theme);
    set({ theme });
  },

  setLanguage: async (language) => {
    await writeSetting('language', language);
    await applyLanguage(language);
    set({ language });
  },

  setHideNumbers: async (hide) => {
    await writeSetting('hide_numbers', hide);
    set({ hideNumbers: hide });
  },

  setAlertEnabled: async (alert, enabled) => {
    const alertsEnabled = { ...get().alertsEnabled, [alert]: enabled };
    await writeSetting('alerts_enabled', alertsEnabled);
    set({ alertsEnabled });
  },

  setAlertNotifications: async (enabled) => {
    await writeSetting('alert_notifications', enabled);
    set({ alertNotifications: enabled });
  },

  setDiet: async (diet) => {
    await writeSetting('diet_preference', diet);
    set({ diet });
  },

  setReminders: async (reminders) => {
    await writeSetting('reminders', serializeReminders(reminders));
    set({ reminders });
  },

  setWater: async (glassMl, goalMl) => {
    const waterGlassMl = parseMl(glassMl, GLASS_ML_RANGE, get().waterGlassMl);
    const waterGoalMl = parseMl(goalMl, WATER_GOAL_RANGE, get().waterGoalMl);
    await writeSetting('water_glass_ml', waterGlassMl);
    await writeSetting('water_goal_ml', waterGoalMl);
    set({ waterGlassMl, waterGoalMl });
  },
}));

/** True when hide-numbers mode is on (SPEC §8.3). */
export function useHideNumbers(): boolean {
  return useSettingsStore((state) => state.hideNumbers);
}
