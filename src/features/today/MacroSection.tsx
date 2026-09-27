import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
// Imported from its own file: see CalorieRing.
import { PieChart } from 'react-native-gifted-charts/dist/PieChart';

import { formatAmount, formatPercent } from '@/lib/format';
import type { MacroKey, MacroSummary } from '@/lib/nutrition';
import { useTheme, type Theme } from '@/theme';

const PIE_RADIUS = 56;

/** The accent colour of each macro (SPEC §8.1). */
export function macroColor(colors: Theme['colors'], key: MacroKey): string {
  return key === 'protein' ? colors.protein : key === 'carbs' ? colors.carbs : colors.fat;
}

/**
 * The macro pie (protein / carbs / fat by share of calories) and, beside it, one bar per macro
 * with the grams eaten vs the target (SPEC §2.2).
 */
export function MacroSection({ macros }: { macros: MacroSummary[] }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();
  const slices = macros
    .filter((m) => (m.kcalShare ?? 0) > 0)
    .map((m) => ({ value: m.kcalShare!, color: macroColor(colors, m.key) }));

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
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
      >
        {t('today.macrosTitle')}
      </Text>
      <View style={[styles.row, { gap: spacing.lg }]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <PieChart
            radius={PIE_RADIUS}
            backgroundColor={colors.surface}
            strokeWidth={slices.length > 1 ? 2 : 0}
            strokeColor={colors.surface}
            data={slices.length > 0 ? slices : [{ value: 1, color: colors.border }]}
          />
        </View>
        <View style={[styles.flex, { gap: spacing.md }]}>
          {macros.map((m) => (
            <MacroBar key={m.key} macro={m} />
          ))}
        </View>
      </View>
    </View>
  );
}

function MacroBar({ macro }: { macro: MacroSummary }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const color = macroColor(colors, macro.key);
  const name = t(`macros.${macro.key}`);
  const eaten = formatAmount(macro.grams.eaten)!;
  const target = formatAmount(macro.grams.target)!;
  const share = macro.kcalShare === null ? null : formatPercent(macro.kcalShare);

  return (
    <View
      accessible
      accessibilityLabel={
        share === null
          ? t('today.macroLabelNoShare', { macro: name, eaten, target })
          : t('today.macroLabel', { macro: name, eaten, target, share })
      }
    >
      <View style={[styles.row, { gap: spacing.xs }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={{ color: colors.text, fontSize: fontSize.caption, fontWeight: '600' }}>
          {name}
        </Text>
        {share !== null && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {t('today.macroShare', { value: share })}
          </Text>
        )}
        <Text
          style={[
            styles.flex,
            { color: colors.textSecondary, fontSize: fontSize.caption, textAlign: 'right' },
          ]}
        >
          {t('today.macroGrams', { eaten, target })}
        </Text>
      </View>
      {/* The bar stops at full; "more than planned" is in the numbers, not an alarm colour. */}
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted, marginTop: spacing.xs }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: color, width: `${Math.round(macro.grams.fraction * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
