import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatKcal } from '@/lib/format';
import type { TargetValues } from '@/lib/targets';
import { useTheme } from '@/theme';

/** The starting targets at a glance (onboarding step 4): calories, macros, fibre and limits. */
export function TargetsSummary({ targets }: { targets: TargetValues }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();
  const grams = (value: number | null) => t('targets.grams', { value: formatAmount(value) });

  const rows: [string, string][] = [];
  if (targets.protein_g !== null) rows.push([t('macros.protein'), grams(targets.protein_g)]);
  if (targets.carb_g !== null) rows.push([t('macros.carbs'), grams(targets.carb_g)]);
  if (targets.fat_g !== null) rows.push([t('macros.fat'), grams(targets.fat_g)]);
  if (targets.fibre_g !== null) rows.push([t('targets.fibre'), grams(targets.fibre_g)]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      {targets.kcal !== null && (
        <View style={styles.center}>
          <Text
            testID="target-kcal"
            maxFontSizeMultiplier={1.3}
            style={{ color: colors.text, fontSize: 40, fontWeight: '700' }}
          >
            {formatKcal(targets.kcal)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {t('targets.kcalPerDay')}
          </Text>
        </View>
      )}
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
            {label}
          </Text>
          <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
            {value}
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
        {t('targets.limitsLine', {
          sodium: formatAmount(targets.sodium_mg_limit),
          sugar: formatAmount(targets.sugar_g_limit),
          satFat: formatAmount(targets.sat_fat_g_limit),
          fat: formatAmount(targets.fat_g_limit),
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
