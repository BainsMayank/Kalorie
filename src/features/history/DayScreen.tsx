import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components';
import { DayTimeline } from '@/features/log/DayTimeline';
import { useToday } from '@/features/log/useToday';
import { CalorieRing } from '@/features/today/CalorieRing';
import { EmptyDay } from '@/features/today/EmptyDay';
import { MacroSection } from '@/features/today/MacroSection';
import { TopContributors } from '@/features/today/TopContributors';
import { useDaySummary } from '@/features/today/useDaySummary';
import { NutrientsLink } from '@/features/nutrients/NutrientsLink';
import { WaterRow } from '@/features/water/WaterRow';
import { formatDate, formatDayName } from '@/i18n/dates';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

/** A day as 'YYYY-MM-DD', or null for anything else in the link. */
function validDay(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * A past day opened from the calendar (`app/day/[day].tsx`): the same layout as Today — ring,
 * macros, top foods, water, meals — to look at only. *Edit* opens that day in the Log tab.
 */
export function DayScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const params = useLocalSearchParams<{ day: string }>();
  const today = useToday();
  const day = validDay(params.day) ?? today;
  const navigation = useNavigation();
  const router = useRouter();
  const setDay = useLogStore((state) => state.setDay);
  const { log, entries, summary } = useDaySummary(day);

  const name = formatDayName(t, day, today);
  const date = formatDate(t, day, today);
  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  const edit = () => {
    setDay(day);
    router.dismissTo('/log');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.lg }}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Text
          accessibilityRole="header"
          style={[styles.flex, { color: colors.text, fontSize: fontSize.title, fontWeight: '600' }]}
        >
          {date}
        </Text>
        <PillButton
          icon="create-outline"
          label={t('history.edit')}
          accessibilityLabel={t('history.editLabel', { date })}
          onPress={edit}
        />
      </View>

      {log.status === 'error' && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
          {t('log.loadProblem')}
        </Text>
      )}

      {log.status === 'ready' && (
        <>
          <CalorieRing kcal={summary.kcal} entryCount={entries.length} />
          {summary.isEmpty ? (
            <EmptyDay isToday={day === today} readOnly />
          ) : (
            <>
              <MacroSection macros={summary.macros} />
              <TopContributors macros={summary.macros} />
              <NutrientsLink day={day} period="day" />
            </>
          )}
          <WaterRow day={day} readOnly />
          {!summary.isEmpty && (
            <>
              <Text
                accessibilityRole="header"
                style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
              >
                {t('today.mealsTitle')}
              </Text>
              <DayTimeline entries={entries} readOnly />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
