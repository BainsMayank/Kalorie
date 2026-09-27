import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';

// Every user-facing string lives in a JSON file here. The app is English-only for now;
// adding a language later means adding a file and listing it in `resources`.
export const resources = {
  en: { translation: en },
} as const;

type Language = keyof typeof resources;

function phoneLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code && code in resources ? (code as Language) : 'en';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: phoneLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes text
});

export default i18n;
