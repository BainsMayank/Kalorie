import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton, UndoBar } from '@/components';
import { sumNutrients } from '@/lib/nutrition';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { DateSwitcher } from './DateSwitcher';
import { DayTimeline, useKcalText } from './DayTimeline';
import { RecentlyDeletedSheet } from './RecentlyDeletedSheet';
import { useDayLog, useDeletedEntries } from './useDayLog';
import { useDaySheets } from './useDaySheets';

/**
 * The Log tab (SPEC §2.10): the chosen day's entries grouped by meal slot, with kcal per
 * entry, per slot and for the day. Tap an entry to edit it; swipe it left to delete (with
 * Undo). A meal or the whole day can be copied to another day.
 */
export function LogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const day = useLogStore((state) => state.day);
  const log = useDayLog(day);
  const kcalText = useKcalText();
  const sheets = useDaySheets(day);
  const deleted = useDeletedEntries(day);
  const [showDeleted, setShowDeleted] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const entries = log.status === 'ready' ? log.entries : [];
  const dayKcal = kcalText(sumNutrients(entries.map((e) => e.nutrients)).energy_kcal ?? 0);

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        // Extra room at the bottom so the Undo bar never covers the last meal.
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, gap: spacing.lg }}
      >
        <DateSwitcher />
        <View style={styles.start}>
          <PillButton
            icon="barcode-outline"
            label={t('log.scan')}
            onPress={() => router.push('/scan')}
          />
        </View>

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
                  {dayKcal !== null && (
                    <>
                      {t('log.dayTotal')}{' '}
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{dayKcal}</Text>
                    </>
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('copy.day')}
                  onPress={() => sheets.copy(entries.map((e) => e.entry))}
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
              onEdit={sheets.edit}
              onCopy={(slot, slotEntries) => sheets.copy(slotEntries, slot)}
              onSaveThali={sheets.saveThali}
              onSwipeChange={(swiping) => setScrollEnabled(!swiping)}
            />
            {deleted.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('log.deleted', { count: deleted.length })}
                onPress={() => setShowDeleted(true)}
                style={({ pressed }) => [
                  styles.row,
                  { minHeight: minTapTarget, gap: spacing.xs, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                  {t('log.deleted', { count: deleted.length })}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <UndoBar placement="tabs" />
      {sheets.sheets}
      {showDeleted && deleted.length > 0 && (
        <RecentlyDeletedSheet entries={deleted} onClose={() => setShowDeleted(false)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
});
