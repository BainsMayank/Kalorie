import { createContext, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import type { DayProps } from 'react-native-calendars/src/calendar/day';

import { useCalendarLocale } from '@/i18n/calendar';
import { formatDate } from '@/i18n/dates';
import { adherenceByDay, countAdherence, type Adherence } from '@/lib/adherence';
import { monthRange } from '@/lib/history';
import { useTheme, type Theme } from '@/theme';

import { useDayTotals, useTargetsFor } from './useHistory';

/** The fill behind a day's number (SPEC §5.6). Nothing logged: no fill. */
export function adherenceFill(colors: Theme['colors'], value: Adherence): string | undefined {
  switch (value) {
    case 'onTarget':
    case 'logged':
      return colors.onTargetFill;
    case 'near':
      return colors.nearFill;
    case 'far':
      return colors.farFill;
    case 'partial':
      return colors.partialFill;
    default:
      return undefined;
  }
}

type CalendarInfo = {
  colours: ReadonlyMap<string, Adherence>;
  today: string;
  onPick: (day: string) => void;
};

// The day cells read the colours from here: the calendar skips redrawing a day whose props are
// unchanged, but a change here still reaches every cell.
const CalendarContext = createContext<CalendarInfo>({
  colours: new Map(),
  today: '',
  onPick: () => {},
});

/** One day in the calendar: its number on a soft fill, today with a ring. */
function DayCell({ date, state }: DayProps & { date?: DateData }) {
  const { t } = useTranslation();
  const { colors, fontSize } = useTheme();
  const { colours, today, onPick } = useContext(CalendarContext);
  if (!date) return <View style={styles.cell} />;
  const day = date.dateString;
  const value = colours.get(day) ?? 'empty';
  const future = day > today;
  const otherMonth = state === 'disabled' && !future;
  const fill = adherenceFill(colors, value);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(t, day, today)}, ${t(`history.legend.${value}`)}`}
      accessibilityState={{ disabled: future }}
      disabled={future}
      onPress={() => onPick(day)}
      testID={`history-day-${day}`}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: fill,
          borderWidth: day === today ? 2 : 0,
          borderColor: colors.text,
          opacity: pressed ? 0.6 : otherMonth ? 0.5 : 1,
        },
      ]}
    >
      <Text
        // The cells are a fixed size to keep the month's grid; the date is read out in full.
        maxFontSizeMultiplier={1.4}
        style={{
          color: future ? colors.iconInactive : colors.text,
          fontSize: fontSize.body,
          fontWeight: day === today ? '700' : '400',
        }}
      >
        {date.day}
      </Text>
    </Pressable>
  );
}

/** The colours explained, one line each (SPEC §2.10). */
function Legend({ showLogged }: { showLogged: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const items: Adherence[] = ['onTarget', 'near', 'far', 'partial', 'empty'];
  if (showLogged) items.splice(1, 0, 'logged');

  return (
    <View style={[styles.legend, { gap: spacing.sm }]}>
      {items.map((value) => (
        <View key={value} style={[styles.row, { gap: spacing.xs }]}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: adherenceFill(colors, value), borderColor: colors.border },
            ]}
          />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {t(`history.legend.${value}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The history calendar (SPEC §2.10): each day coloured by how close its calories came to the
 * target that day, with a legend and a line for the month. Swipe or use ‹ › for other months.
 * Tapping a day opens it.
 */
export function HistoryCalendar({
  today,
  onPick,
}: {
  today: string;
  onPick: (day: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme, spacing, fontSize, radius } = useTheme();
  const language = useCalendarLocale();
  const [month, setMonth] = useState(today);
  const { from, to } = monthRange(month);
  const totals = useDayTotals(from, to);
  const targetsFor = useTargetsFor();

  const colours = useMemo(
    () =>
      adherenceByDay(
        from,
        to,
        totals.status === 'ready' ? totals.value : new Map(),
        (day) => targetsFor(day)?.kcal ?? null,
        today,
      ),
    [from, to, totals, targetsFor, today],
  );
  const counts = countAdherence(colours.values());
  const logged = colours.size - counts.empty;
  const context = useMemo(() => ({ colours, today, onPick }), [colours, today, onPick]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
      ]}
    >
      <CalendarContext.Provider value={context}>
        <Calendar
          // A new key when the theme or language changes: the calendar reads them once.
          key={`${scheme}-${language}`}
          current={today}
          firstDay={1}
          maxDate={today}
          enableSwipeMonths
          onMonthChange={(m: DateData) => setMonth(m.dateString)}
          dayComponent={DayCell}
          theme={{
            calendarBackground: colors.surface,
            monthTextColor: colors.text,
            textSectionTitleColor: colors.textSecondary,
            arrowColor: colors.text,
            textMonthFontWeight: '600',
          }}
        />
      </CalendarContext.Provider>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.body,
          paddingHorizontal: spacing.lg,
        }}
      >
        {logged === 0
          ? t('history.monthNone')
          : counts.logged > 0 && counts.onTarget === 0
            ? t('history.monthLogged', { count: logged })
            : t('history.monthSummary', { count: logged, onTarget: counts.onTarget })}
      </Text>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Legend showLogged={counts.logged > 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // 44 pt: the smallest comfortable tap target (7 fit across a 360 dp phone).
  cell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
});
