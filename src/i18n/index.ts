import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import hi from './hi.json';

// Every user-facing string lives in a JSON file here: English (`en.json`) and Hindi (`hi.json`,
// Devanagari). Adding a language means adding a file with the same keys and listing it below;
// `translations.test.ts` checks that every file has every key.
export const resources = {
  en: { translation: en },
  hi: { translation: hi },
} as const;

export type Language = keyof typeof resources;
export const LANGUAGES = Object.keys(resources) as Language[];

/** Profile → Language: follow the phone, or pick one. */
export const LANGUAGE_PREFERENCES = ['system', ...LANGUAGES] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

/** The phone's first language if Kalorie has it, else English. */
export function phoneLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code && code in resources ? (code as Language) : 'en';
}

/** The language a preference means right now. */
export function resolveLanguage(preference: LanguagePreference): Language {
  return preference === 'system' ? phoneLanguage() : preference;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: phoneLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes text
});

/** Switches the app's language; every screen re-renders with the new words. */
export async function applyLanguage(preference: LanguagePreference): Promise<void> {
  const language = resolveLanguage(preference);
  if (i18n.language !== language) await i18n.changeLanguage(language);
}

export default i18n;
