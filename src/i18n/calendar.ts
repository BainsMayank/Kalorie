import { useTranslation } from 'react-i18next';
import { LocaleConfig } from 'react-native-calendars';

import { MONTHS, WEEKDAYS } from './dates';
import i18n, { LANGUAGES } from './index';

// Month and weekday names for react-native-calendars, in every language Kalorie has. Registered
// once when this file loads; the calendar follows the app's language from then on.
for (const language of LANGUAGES) {
  const t = i18n.getFixedT(language);
  LocaleConfig.locales[language] = {
    monthNames: MONTHS.map((m) => t(`date.monthsLong.${m}`)),
    monthNamesShort: MONTHS.map((m) => t(`date.months.${m}`)),
    dayNames: WEEKDAYS.map((d) => t(`date.weekdaysLong.${d}`)),
    dayNamesShort: WEEKDAYS.map((d) => t(`date.weekdays.${d}`)),
    today: t('date.today'),
  };
}
LocaleConfig.defaultLocale = i18n.language;
i18n.on('languageChanged', (language) => {
  LocaleConfig.defaultLocale = language;
});

/**
 * The app's language code, for a calendar's `key`: the calendar reads its month and weekday
 * names once, so a new key redraws an open calendar when the language changes.
 */
export function useCalendarLocale(): string {
  return useTranslation().i18n.language;
}
