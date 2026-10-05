import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UndoBar } from '@/components';
import { AlertCard } from '@/features/alerts/AlertCard';
import { useLimitAlerts } from '@/features/alerts/useLimitAlerts';
import { PendingScansCard } from '@/features/barcode/PendingScansCard';
import { StreakLine } from '@/features/habits/StreakLine';
import { WeeklyCheckinCard } from '@/features/habits/WeeklyCheckinCard';
import { DayTimeline } from '@/features/log/DayTimeline';
import { useDaySheets } from '@/features/log/useDaySheets';
import { useToday } from '@/features/log/useToday';
import { NutrientsLink } from '@/features/nutrients/NutrientsLink';
import { WaterRow } from '@/features/water/WaterRow';
import { suggestTargets } from '@/lib/targets';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';
import { bodyProfile, useGoalsStore } from '@/stores/goals';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { CalorieRing } from './CalorieRing';
import { DayHeader } from './DayHeader';
import { EmptyDay } from './EmptyDay';
import { MacroSection } from './MacroSection';
import { TopContributors } from './TopContributors';
import { useDaySummary } from './useDaySummary';

/**
 * The Today tab (SPEC §2.2), top to bottom: the day with ‹ › and a small streak line, the
 * calorie ring, notice cards (limits, the weekly check-in, pending scans), the macro pie with grams
 * vs target, the top foods for each macro, water, and the meals. Pull down to read again.
 * It shows the same day as the Log tab, so "+ Add" always goes to the day on screen.
 */
export function TodayScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const day = useLogStore((state) => state.day);
  const setDay = useLogStore((state) => state.setDay);
  const today = useToday();
  const { log, entries, targets, summary } = useDaySummary(day);
  const router = useRouter();
  // No calorie target because age, height or weight were skipped: say where to add them.
  const missingBody = useGoalsStore(
    (state) =>
      state.profile?.goal !== 'track' &&
      suggestTargets(bodyProfile(state.profile, state.weightKg)).noKcalReason === 'missing',
  );
  const sheets = useDaySheets(day);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Left open overnight: when a new day starts (4 am), move along with it.
  const lastToday = useRef(today);
  useEffect(() => {
    if (lastToday.current === today) return;
    if (useLogStore.getState().day === lastToday.current) setDay(today);
    lastToday.current = today;
  }, [today, setDay]);

  const limitAlerts = useLimitAlerts(day, day === today, summary.totals, targets);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        useLogStore.getState().load(),
        log.reload(),
        useBarcodeQueueStore
          .getState()
          .retry()
          .catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const openEntry = (entryId: string) => {
    const view = entries.find((e) => e.entry.id === entryId);
    if (view) sheets.edit(view.entry);
  };

  const sectionTitle = (text: string) => (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
    >
      {text}
    </Text>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="today-scroll"
        scrollEnabled={scrollEnabled}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.textSecondary}
            colors={[colors.text]}
            progressBackgroundColor={colors.surface}
          />
        }
        // Extra room at the bottom so the Undo bar never covers the last meal.
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, gap: spacing.lg }}
      >
        <DayHeader day={day} today={today} onChange={setDay} />
        {day === today && <StreakLine today={today} />}

        {log.status === 'error' && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('log.loadProblem')}
          </Text>
        )}

        {log.status === 'ready' && (
          <>
            <CalorieRing kcal={summary.kcal} entryCount={entries.length} />
            {targets?.kcal == null && missingBody && (
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/goals')}
                style={{ minHeight: minTapTarget, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: fontSize.caption,
                    textAlign: 'center',
                    textDecorationLine: 'underline',
                  }}
                >
                  {t('today.addBodyForTarget')}
                </Text>
              </Pressable>
            )}
            <AlertCard alerts={limitAlerts.alerts} onDismiss={() => void limitAlerts.dismiss()} />
            {day === today && <WeeklyCheckinCard today={today} />}
            {day === today && <PendingScansCard />}

            {summary.isEmpty ? (
              <>
                <EmptyDay isToday={day === today} />
                <WaterRow day={day} />
              </>
            ) : (
              <>
                <MacroSection macros={summary.macros} />
                <TopContributors macros={summary.macros} onOpenEntry={openEntry} />
                <NutrientsLink day={day} period="day" />
                <WaterRow day={day} />
                {sectionTitle(t('today.mealsTitle'))}
                <DayTimeline
                  entries={entries}
                  onEdit={sheets.edit}
                  onCopy={(slot, slotEntries) => sheets.copy(slotEntries, slot)}
                  onSaveThali={sheets.saveThali}
                  onSwipeChange={(swiping) => setScrollEnabled(!swiping)}
                />
              </>
            )}
          </>
        )}
      </ScrollView>

      <UndoBar placement="tabs" />
      {sheets.sheets}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
