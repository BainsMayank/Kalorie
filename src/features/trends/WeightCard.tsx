import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LineChart, PillButton } from '@/components';
import { formatDayName } from '@/i18n/dates';
import { lineChartRange } from '@/lib/chart';
import { formatKg, formatKgChange } from '@/lib/format';
import { daysBetween, trendDirection, weeklyChange, weightTrend } from '@/lib/trend';
import { useGoalsStore } from '@/stores/goals';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { TrendCard, dayLabel } from './TrendCard';
import { WeightSheet } from './WeightSheet';

/** How many recent weigh-ins are listed under the chart. */
const RECENT = 3;

type Editing = { mode: 'add' } | { mode: 'edit'; day: string; kg: number };

/**
 * Weight (SPEC §2.11): weigh-ins as dots with a smooth trend line through them (SPEC §5.7), the
 * trend's change per week as a calm number, *Add weight*, and the latest weigh-ins to change.
 * Hide numbers (SPEC §8.3): the dots and line stay, the text says only the direction, and the
 * weigh-ins are listed by day (open one to see or change it).
 */
export function WeightCard({ days, today }: { days: readonly string[]; today: string }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const weighIns = useGoalsStore((state) => state.weighIns);
  const hide = useHideNumbers();
  const [editing, setEditing] = useState<Editing | null>(null);

  // The trend runs over every weigh-in, so it is already settled when the period starts.
  const points = useMemo(
    () => weightTrend(weighIns.map((w) => ({ day: w.day, kg: w.weightKg }))),
    [weighIns],
  );
  const inPeriod = points.filter((p) => p.day >= days[0] && p.day <= days[days.length - 1]);
  const last = points[points.length - 1];
  const change = weeklyChange(points);

  let changeText: string;
  if (change === null) changeText = t('weight.changeWaiting');
  else if (trendDirection(change) === 'steady') changeText = t('weight.steady');
  else changeText = t('weight.change', { value: formatKgChange(change) });

  const range = lineChartRange(inPeriod.flatMap((p) => [p.kg, p.trendKg]));
  const x = (day: string) => daysBetween(days[0], day);
  let summary: string;
  if (!last) summary = t('weight.none');
  else if (hide)
    summary = t(
      change === null ? 'weight.direction.waiting' : `weight.direction.${trendDirection(change)}`,
    );
  else summary = t('weight.trendLine', { kg: formatKg(last.trendKg), change: changeText });

  return (
    <TrendCard title={t('weight.title')} summary={summary}>
      {inPeriod.length > 0 && (
        <LineChart
          accessibilityLabel={summary}
          days={days.length}
          min={range.min}
          max={range.max}
          formatValue={hide ? undefined : (v) => formatKg(v)}
          xLabels={days
            .map((_, i) => ({ x: i, text: dayLabel(t, days, i) }))
            .filter((l) => l.text !== '')}
          series={[
            {
              key: 'weighIns',
              color: colors.weight,
              faded: true,
              dot: 4,
              points: inPeriod.map((p) => ({ x: x(p.day), y: p.kg })),
            },
            {
              key: 'trend',
              color: colors.weight,
              line: true,
              dot: inPeriod.length === 1 ? 3 : 0,
              points: inPeriod.map((p) => ({ x: x(p.day), y: p.trendKg })),
            },
          ]}
        />
      )}
      {last && inPeriod.length === 0 && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('weight.noneInPeriod')}
        </Text>
      )}

      <View style={styles.start}>
        <PillButton
          icon="add"
          label={t('weight.add')}
          onPress={() => setEditing({ mode: 'add' })}
        />
      </View>

      {weighIns
        .slice(-RECENT)
        .reverse()
        .map((w) => {
          const name = formatDayName(t, w.day, today);
          const kg = hide ? null : t('weight.kg', { value: formatKg(w.weightKg) });
          return (
            <Pressable
              key={w.id}
              accessibilityRole="button"
              accessibilityLabel={kg === null ? name : `${name}, ${kg}`}
              accessibilityHint={t('weight.editHint')}
              onPress={() => setEditing({ mode: 'edit', day: w.day, kg: w.weightKg })}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: minTapTarget,
                  gap: spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
                {name}
              </Text>
              {kg !== null && (
                <Text style={{ color: colors.text, fontSize: fontSize.body }}>{kg}</Text>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
            </Pressable>
          );
        })}

      {editing?.mode === 'add' && (
        <WeightSheet
          mode="add"
          today={today}
          startKg={last?.kg ?? null}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.mode === 'edit' && (
        <WeightSheet
          mode="edit"
          today={today}
          day={editing.day}
          kg={editing.kg}
          onClose={() => setEditing(null)}
        />
      )}
    </TrendCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
});
