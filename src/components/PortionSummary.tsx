import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatKcal } from '@/lib/format';
import type { NutrientValues } from '@/lib/nutrients';
import { useTheme } from '@/theme';

/** Big kcal number and protein / carbs / fat for a portion. */
export function PortionSummary({ nutrients }: { nutrients: NutrientValues }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const unknown = t('food.unknown');
  const macros = [
    { key: 'protein', value: nutrients.protein_g, color: colors.protein },
    { key: 'carbs', value: nutrients.carb_g, color: colors.carbs },
    { key: 'fat', value: nutrients.fat_g, color: colors.fat },
  ] as const;

  return (
    <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '700' }}>
        {t('food.kcal', { value: formatKcal(nutrients.energy_kcal) ?? unknown })}
      </Text>
      <View style={[styles.row, { marginTop: spacing.sm, gap: spacing.lg }]}>
        {macros.map((m) => (
          <View key={m.key} style={[styles.row, { gap: spacing.xs }]}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
              {t(`macros.${m.key}`)}{' '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {t('food.amountWithUnit', {
                  value: formatAmount(m.value) ?? unknown,
                  unit: t('nutrientUnits.g'),
                })}
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
