import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OptionCard } from '@/components';
import { ACTIVITY_LEVELS, type ActivityLevel } from '@/lib/targets';
import { useTheme } from '@/theme';

/** The 5 activity levels as cards with plain examples (SPEC §2.1). */
export function ActivityPicker({
  selected,
  onSelect,
}: {
  selected: ActivityLevel | null;
  onSelect: (activity: ActivityLevel) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('about.activity')}
      style={{ gap: spacing.sm }}
    >
      {ACTIVITY_LEVELS.map((level) => (
        <OptionCard
          key={level}
          title={t(`about.activityOptions.${level}.title`)}
          detail={t(`about.activityOptions.${level}.detail`)}
          selected={selected === level}
          onPress={() => onSelect(level)}
        />
      ))}
    </View>
  );
}
