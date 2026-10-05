import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components';
import { formatWhole } from '@/lib/format';
import { averageWater } from '@/lib/history';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

import { TrendCard, dayLabel } from './TrendCard';

/** Water (SPEC §2.11): a bar per day against the goal. */
export function WaterCard({
  days,
  water,
}: {
  days: readonly string[];
  water: ReadonlyMap<string, number>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const goal = useSettingsStore((state) => state.waterGoalMl);
  const average = averageWater(days, water);
  const summary =
    average === null
      ? t('trends.waterNone')
      : t('trends.waterAverage', { average: formatWhole(average), goal: formatWhole(goal) });

  return (
    <TrendCard title={t('water.title')} summary={summary}>
      <BarChart
        accessibilityLabel={summary}
        formatValue={formatWhole}
        bars={days.map((day, i) => ({
          key: day,
          value: water.get(day) ?? null,
          color: colors.water,
          target: goal,
          label: dayLabel(t, days, i),
        }))}
      />
    </TrendCard>
  );
}
