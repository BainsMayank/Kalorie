import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceChips } from '@/components';
import { HistoryCalendar } from '@/features/history/HistoryCalendar';
import { useDayTotals, useTargetsFor, useWaterByDay } from '@/features/history/useHistory';
import { useToday } from '@/features/log/useToday';
import { NutrientsLink } from '@/features/nutrients/NutrientsLink';
import { periodDays, periodStats } from '@/lib/history';
import { useTheme } from '@/theme';

import { CaloriesCard } from './CaloriesCard';
import { MacrosCard } from './MacrosCard';
import { WaterCard } from './WaterCard';
import { WeightCard } from './WeightCard';

type TrendsView = 'calendar' | 'week' | 'month';

/** Days in the Week and Month views. */
const PERIOD_DAYS = { week: 7, month: 30 } as const;

/**
 * The Trends tab (SPEC §2.10–2.11): *Calendar* shows each day's colour and opens a day;
 * *Week* and *Month* show calories, macros, weight and water over the last 7 or 30 days.
 */
export function TrendsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const router = useRouter();
  const today = useToday();
  const [view, setView] = useState<TrendsView>('calendar');

  const openDay = useCallback(
    (day: string) => router.push({ pathname: '/day/[day]', params: { day } }),
    [router],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.lg }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
        >
          {t('tabs.trends')}
        </Text>
        <ChoiceChips<TrendsView>
          label={t('trends.view')}
          choices={[
            { value: 'calendar', label: t('trends.calendar') },
            { value: 'week', label: t('trends.week') },
            { value: 'month', label: t('trends.month') },
          ]}
          selected={view}
          onSelect={setView}
        />
        {view === 'calendar' ? (
          <HistoryCalendar today={today} onPick={openDay} />
        ) : (
          <Period days={PERIOD_DAYS[view]} today={today} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The Week or Month view: the last `days` days, today included. */
function Period({ days: length, today }: { days: number; today: string }) {
  const { t } = useTranslation();
  const { colors, fontSize } = useTheme();
  const days = useMemo(() => periodDays(today, length), [today, length]);
  const totals = useDayTotals(days[0], today);
  const water = useWaterByDay(days[0], today);
  const targetsFor = useTargetsFor();
  const stats = useMemo(
    () => (totals.status === 'ready' ? periodStats(days, totals.value, targetsFor, today) : null),
    [days, totals, targetsFor, today],
  );

  if (totals.status === 'error' || water.status === 'error') {
    return (
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
        {t('log.loadProblem')}
      </Text>
    );
  }
  if (totals.status !== 'ready' || water.status !== 'ready' || !stats) return null;

  return (
    <>
      <CaloriesCard days={days} totals={totals.value} stats={stats} targetsFor={targetsFor} />
      <MacrosCard days={days} totals={totals.value} stats={stats} />
      {stats.countedDays > 0 && (
        <NutrientsLink day={today} period={length === PERIOD_DAYS.week ? 'week' : 'month'} />
      )}
      <WeightCard days={days} today={today} />
      <WaterCard days={days} water={water.value} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
