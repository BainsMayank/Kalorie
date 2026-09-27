import { Calendar } from 'react-native-calendars';

import { useTheme } from '@/theme';

/** A month calendar in the app's colours (Monday first); tapping a day picks it. */
export function DayCalendar({ day, onPick }: { day: string; onPick: (day: string) => void }) {
  const { colors, scheme } = useTheme();
  return (
    <Calendar
      // A new key when the theme changes, because the calendar reads its colours once.
      key={scheme}
      current={day}
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
