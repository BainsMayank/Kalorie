import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UndoBar } from '@/components';
import type { LogEntry, MealSlot } from '@/db/user/schema';
import { CopySheet } from '@/features/log/CopySheet';
import { DayTimeline } from '@/features/log/DayTimeline';
import { EditEntrySheet } from '@/features/log/EditEntrySheet';
import { entryName } from '@/features/log/names';
import { useDayLog, type EntryView } from '@/features/log/useDayLog';
import { useToday } from '@/features/log/useToday';
import { daySummary } from '@/lib/nutrition';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { CalorieRing } from './CalorieRing';
import { DayHeader } from './DayHeader';
import { EmptyDay } from './EmptyDay';
import { MacroSection } from './MacroSection';
import { TopContributors } from './TopContributors';
import { useDayTargets } from './useDayTargets';

const NO_ENTRIES: EntryView[] = [];

/**
 * The Today tab (SPEC §2.2), top to bottom: the day with ‹ ›, the calorie ring, the macro pie
 * with grams vs target, the top foods for each macro, and the meals. Pull down to read again.
 * It shows the same day as the Log tab, so "+ Add" always goes to the day on screen.
 */
export function TodayScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const day = useLogStore((state) => state.day);
  const setDay = useLogStore((state) => state.setDay);
  const today = useToday();
  const log = useDayLog(day);
  const { targets, isPlaceholder } = useDayTargets(day);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [copying, setCopying] = useState<{ slot: MealSlot; entries: LogEntry[] } | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Left open overnight: when a new day starts (4 am), move along with it.
  const lastToday = useRef(today);
  useEffect(() => {
    if (lastToday.current === today) return;
    if (useLogStore.getState().day === lastToday.current) setDay(today);
    lastToday.current = today;
  }, [today, setDay]);

  const entries = log.status === 'ready' ? log.entries : NO_ENTRIES;
  const summary = useMemo(
    () =>
      daySummary(
        entries.map((view) => ({
          entryId: view.entry.id,
          foodSource: view.entry.foodSource,
          foodId: view.entry.foodId,
          name: entryName(t, view.entry),
          nutrients: view.nutrients,
        })),
        targets,
      ),
    [entries, targets, t],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([useLogStore.getState().load(), log.reload()]);
    } finally {
      setRefreshing(false);
    }
  };

  const openEntry = (entryId: string) => {
    const view = entries.find((e) => e.entry.id === entryId);
    if (view) setEditing(view.entry);
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

        {log.status === 'error' && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('log.loadProblem')}
          </Text>
        )}

        {log.status === 'ready' && (
          <>
            <CalorieRing kcal={summary.kcal} />
            {isPlaceholder && (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.caption,
                  textAlign: 'center',
                }}
              >
                {t('today.placeholderTargets')}
              </Text>
            )}

            {summary.isEmpty ? (
              <EmptyDay isToday={day === today} />
            ) : (
              <>
                <MacroSection macros={summary.macros} />
                <TopContributors macros={summary.macros} onOpenEntry={openEntry} />
                {sectionTitle(t('today.mealsTitle'))}
                <DayTimeline
                  entries={entries}
                  onEdit={setEditing}
                  onCopy={(slot, slotEntries) => setCopying({ slot, entries: slotEntries })}
                  onSwipeChange={(swiping) => setScrollEnabled(!swiping)}
                />
              </>
            )}
          </>
        )}
      </ScrollView>

      <UndoBar placement="tabs" />
      {editing && <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />}
      {copying && (
        <CopySheet
          entries={copying.entries}
          slot={copying.slot}
          fromDay={day}
          onClose={() => setCopying(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
