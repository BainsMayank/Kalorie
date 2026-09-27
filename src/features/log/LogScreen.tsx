import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UndoBar } from '@/components';
import type { LogEntry, MealSlot } from '@/db/user/schema';
import { sumNutrients } from '@/lib/nutrition';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { CopySheet } from './CopySheet';
import { DateSwitcher } from './DateSwitcher';
import { DayTimeline, useKcalText } from './DayTimeline';
import { EditEntrySheet } from './EditEntrySheet';
import { useDayLog } from './useDayLog';

/** What the Copy sheet copies: one meal, or the whole day. */
type Copying = { slot?: MealSlot; entries: LogEntry[] };

/**
 * The Log tab (SPEC §2.10): the chosen day's entries grouped by meal slot, with kcal per
 * entry, per slot and for the day. Tap an entry to edit it; swipe it left to delete (with
 * Undo). A meal or the whole day can be copied to another day.
 */
export function LogScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const day = useLogStore((state) => state.day);
  const log = useDayLog(day);
  const kcalText = useKcalText();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [copying, setCopying] = useState<Copying | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const entries = log.status === 'ready' ? log.entries : [];
  const dayKcal = sumNutrients(entries.map((e) => e.nutrients)).energy_kcal;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        // Extra room at the bottom so the Undo bar never covers the last meal.
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, gap: spacing.lg }}
      >
        <DateSwitcher />

        {log.status === 'error' ? (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('log.loadProblem')}
          </Text>
        ) : (
          <>
            {entries.length > 0 && (
              <View style={styles.row}>
                <Text
                  style={[styles.flex, { color: colors.textSecondary, fontSize: fontSize.body }]}
                >
                  {t('log.dayTotal')}{' '}
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {kcalText(dayKcal ?? 0)}
                  </Text>
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('copy.day')}
                  onPress={() => setCopying({ entries: entries.map((e) => e.entry) })}
                  style={({ pressed }) => [
                    styles.row,
                    { minHeight: minTapTarget, gap: spacing.xs, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                    {t('copy.day')}
                  </Text>
                </Pressable>
              </View>
            )}
            <DayTimeline
              entries={entries}
              onEdit={setEditing}
              onCopy={(slot, slotEntries) => setCopying({ slot, entries: slotEntries })}
              onSwipeChange={(swiping) => setScrollEnabled(!swiping)}
            />
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
  row: { flexDirection: 'row', alignItems: 'center' },
});
