import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ChoiceChips, OptionCard } from '@/components';
import { PACES, type Goal } from '@/lib/targets';
import { useTheme } from '@/theme';

const GOALS: Goal[] = ['lose', 'maintain', 'gain', 'track'];

/** Pace chips' labels: lose has Gentle / Steady, gain only 0.25 kg a week (SPEC §2.1). */
function paceLabel(goal: Goal, pace: number): 'gentle' | 'steady' | 'gain' {
  if (goal === 'gain') return 'gain';
  return pace === 0.25 ? 'gentle' : 'steady';
}

/** Lose · Maintain · Gain · Just track, with the pace under Lose and Gain. */
export function GoalPicker({
  goal,
  pace,
  onChange,
}: {
  goal: Goal | null;
  pace: number | null;
  onChange: (goal: Goal, pace: number) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('about.goal')}
      style={{ gap: spacing.sm }}
    >
      {GOALS.map((option) => {
        const paces = PACES[option];
        const current = pace !== null && paces.includes(pace) ? pace : paces[0];
        return (
          <OptionCard
            key={option}
            title={t(`about.goalOptions.${option}.title`)}
            detail={t(`about.goalOptions.${option}.detail`)}
            selected={goal === option}
            onPress={() => onChange(option, current)}
          >
            {(option === 'lose' || option === 'gain') && (
              <ChoiceChips
                label={t('about.pace')}
                choices={paces.map((p) => ({
                  value: String(p),
                  label: t(`about.paceOptions.${paceLabel(option, p)}`),
                }))}
                selected={String(current)}
                onSelect={(value) => onChange(option, Number(value))}
              />
            )}
          </OptionCard>
        );
      })}
    </View>
  );
}
