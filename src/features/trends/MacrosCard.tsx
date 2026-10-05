import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components';
import { macroColor } from '@/features/today/MacroSection';
import { bandText } from '@/i18n/bands';
import { barChartMax } from '@/lib/chart';
import { formatAmount, formatWhole } from '@/lib/format';
import type { DayTotals, PeriodStats } from '@/lib/history';
import { MACROS } from '@/lib/nutrition';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { TrendCard, dayLabel } from './TrendCard';

type Props = {
  days: readonly string[];
  totals: ReadonlyMap<string, DayTotals>;
  stats: PeriodStats;
};

/**
 * Macros (SPEC §2.11): average grams a day vs the target for protein, carbs and fat, and a line
 * per macro through the logged days. Days with nothing logged are gaps, not zeros. Hide numbers:
 * the lines stay, and each average vs its target is said in words.
 */
export function MacrosCard({ days, totals, stats }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const hide = useHideNumbers();

  const lines = MACROS.map((m) => {
    const name = t(`macros.${m.key}`);
    const average = stats.average[m.nutrient];
    const target = stats.averageTarget[m.nutrient];
    const text =
      average === null
        ? null
        : hide
          ? target === null || target <= 0
            ? null
            : bandText(t, average / target, 'target')
          : target === null
            ? t('trends.macroAverageNoTarget', { average: formatAmount(average) })
            : t('trends.macroAverage', {
                average: formatAmount(average),
                target: formatAmount(target),
              });
    return { ...m, name, text };
  });

  const series = MACROS.map((m) => ({
    key: m.key,
    color: macroColor(colors, m.key),
    line: true,
    breakGaps: true,
    dot: days.length <= 7 ? 3 : 2,
    points: stats.counted.map((day) => ({ x: days.indexOf(day), y: totals.get(day)![m.nutrient] })),
  }));
  const max = barChartMax(series.flatMap((s) => s.points.map((p) => p.y)));
  const label = lines.map((l) => (l.text === null ? l.name : `${l.name}: ${l.text}`)).join('. ');

  return (
    <TrendCard
      title={t('trends.macros')}
      summary={stats.countedDays === 0 ? t('trends.nothingYet') : t('trends.perDay')}
    >
      {stats.countedDays > 0 && (
        <>
          <View style={{ gap: spacing.xs }}>
            {lines.map((line) => (
              <View key={line.key} style={[styles.row, { gap: spacing.xs }]}>
                <View style={[styles.dot, { backgroundColor: macroColor(colors, line.key) }]} />
                <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
                  {line.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                  {line.text}
                </Text>
              </View>
            ))}
          </View>
          <LineChart
            accessibilityLabel={label}
            series={series}
            days={days.length}
            min={0}
            max={max}
            formatValue={hide ? undefined : formatWhole}
            xLabels={days
              .map((_, i) => ({ x: i, text: dayLabel(t, days, i) }))
              .filter((l) => l.text !== '')}
          />
        </>
      )}
    </TrendCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
