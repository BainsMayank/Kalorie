import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components';
import type { Adherence } from '@/lib/adherence';
import { formatKcal, formatWhole } from '@/lib/format';
import type { DayTotals, DayTrendTargets, PeriodStats } from '@/lib/history';
import { useHideNumbers } from '@/stores/settings';
import { useTheme, type Theme } from '@/theme';

import { TrendCard, dayLabel } from './TrendCard';

/** A calorie bar's colour: green on target, soft blue away from it, grey when partly logged. */
function barColor(colors: Theme['colors'], value: Adherence | undefined): string {
  if (value === 'onTarget') return colors.onTrack;
  if (value === 'near' || value === 'far') return colors.offTarget;
  if (value === 'partial') return colors.partial;
  return colors.textSecondary; // logged without a target
}

type Props = {
  days: readonly string[];
  totals: ReadonlyMap<string, DayTotals>;
  stats: PeriodStats;
  targetsFor: (day: string) => DayTrendTargets | null;
};

/**
 * Calories (SPEC §2.11): a bar per day, the target as a dashed line, and the average. Hide
 * numbers: the bars and the line stay; the text counts days on target instead of kcal.
 */
export function CaloriesCard({ days, totals, stats, targetsFor }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hide = useHideNumbers();
  const average = stats.average.kcal;
  const target = stats.averageTarget.kcal;

  let summary: string;
  if (average === null) summary = t('trends.nothingYet');
  else if (hide)
    summary =
      target === null
        ? t('trends.loggedDays', { count: stats.countedDays })
        : t('trends.kcalOnTarget', { onTarget: stats.onTargetDays, count: stats.countedDays });
  else if (target === null)
    summary = t('trends.kcalAverageNoTarget', {
      average: formatKcal(average),
      count: stats.countedDays,
    });
  else
    summary = t('trends.kcalAverage', {
      average: formatKcal(average),
      target: formatKcal(target),
      onTarget: stats.onTargetDays,
      count: stats.countedDays,
    });

  return (
    <TrendCard title={t('trends.calories')} summary={summary}>
      <BarChart
        accessibilityLabel={summary}
        formatValue={hide ? undefined : formatWhole}
        bars={days.map((day, i) => ({
          key: day,
          value: totals.get(day)?.kcal ?? null,
          color: barColor(colors, stats.adherence.get(day)),
          target: targetsFor(day)?.kcal ?? null,
          label: dayLabel(t, days, i),
        }))}
      />
    </TrendCard>
  );
}
