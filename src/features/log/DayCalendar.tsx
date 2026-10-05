import { Calendar } from 'react-native-calendars';

import { useCalendarLocale } from '@/i18n/calendar';
import { useTheme } from '@/theme';

/**
 * A month calendar in the app's colours and language (Monday first); tapping a day picks it.
 * `maxDate` greys out the days after it.
 */
export function DayCalendar({
  day,
  onPick,
  maxDate,
}: {
  day: string;
  onPick: (day: string) => void;
  maxDate?: string;
}) {
  const { colors, scheme } = useTheme();
  const language = useCalendarLocale();
  return (
    <Calendar
      // A new key when the theme or language changes: the calendar reads them once.
      key={`${scheme}-${language}`}
      current={day}
      maxDate={maxDate}
      firstDay={1}
      markedDates={{ [day]: { selected: true } }}
      onDayPress={(picked: { dateString: string }) => onPick(picked.dateString)}
      theme={{
        calendarBackground: colors.surface,
        dayTextColor: colors.text,
        monthTextColor: colors.text,
        textSectionTitleColor: colors.textSecondary,
        textDisabledColor: colors.iconInactive,
        todayTextColor: colors.text,
        selectedDayBackgroundColor: colors.text,
        selectedDayTextColor: colors.background,
        arrowColor: colors.text,
        textDayFontWeight: '400',
        textMonthFontWeight: '600',
      }}
    />
  );
}
