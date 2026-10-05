import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ChoiceChips } from '@/components';
import type { OilLevel } from '@/lib/oil';
import { useTheme } from '@/theme';

const LEVELS = [
  { value: '-1', key: 'less' },
  { value: '0', key: 'normal' },
  { value: '1', key: 'more' },
] as const;

/**
 * Oil / ghee: Less · Normal · More (SPEC §2.4, §5.5), for dishes cooked with oil or ghee. Moves
 * only the fat and calories.
 */
export function OilLevelChips({
  value,
  onChange,
}: {
  value: OilLevel;
  onChange: (level: OilLevel) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text
        style={{ color: colors.textSecondary, fontSize: fontSize.body, marginBottom: spacing.sm }}
      >
        {t('oil.label')}
      </Text>
      <ChoiceChips
        label={t('oil.label')}
        choices={LEVELS.map((l) => ({ value: l.value, label: t(`oil.${l.key}`) }))}
        selected={String(value) as (typeof LEVELS)[number]['value']}
        onSelect={(next) => onChange(Number(next) as OilLevel)}
      />
      <Text
        style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.xs }}
      >
        {t('oil.hint')}
      </Text>
    </View>
  );
}
