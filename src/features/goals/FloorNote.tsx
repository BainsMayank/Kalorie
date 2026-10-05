import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { PillButton } from '@/components';
import { formatKcal } from '@/lib/format';
import type { FloorCheck } from '@/lib/targets';
import { useTheme } from '@/theme';

/**
 * Shown when a calorie target is below the safe floor (SPEC §6 rule 6): kind words, the number we
 * would suggest, and a button to use it. It never blocks keeping the lower number.
 */
export function FloorNote({
  check,
  onUse,
}: {
  check: FloorCheck | null;
  onUse: (kcal: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();
  if (!check?.below) return null;
  const suggestion = formatKcal(check.suggestion)!;

  return (
    <View
      testID="floor-note"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: colors.notice,
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>
        {t('floor.note', { floor: suggestion })}
      </Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <PillButton
          strong
          label={t('floor.use', { floor: suggestion })}
          onPress={() => onUse(check.suggestion)}
        />
      </View>
    </View>
  );
}
