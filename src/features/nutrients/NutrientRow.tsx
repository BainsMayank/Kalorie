import Ionicons from '@expo/vector-icons/Ionicons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bandText } from '@/i18n/bands';
import { formatAmount, formatPercent } from '@/lib/format';
import type { MicroRow } from '@/lib/micros';
import { NUTRIENTS, type NutrientKey } from '@/lib/nutrients';
import { useHideNumbers } from '@/stores/settings';
import { useTheme, type ColorTokens } from '@/theme';

/** A nutrient's unit as words ("mg", "µg"). */
export function unitOf(t: TFunction, nutrient: NutrientKey): string {
  const unit = NUTRIENTS.find((n) => n.key === nutrient)?.unit ?? 'g';
  return t(`nutrientUnits.${unit}`);
}

/** The amount with its unit, "≈ 12 mg" when some foods have no data. */
export function amountText(t: TFunction, row: MicroRow): string | null {
  if (row.total === null) return null;
  const values = { value: formatAmount(row.total), unit: unitOf(t, row.nutrient) };
  return row.incomplete ? t('micros.approxAmount', values) : t('micros.amount', values);
}

/**
 * "41% of 29 mg" or "73% of the 2,000 mg limit"; null without a goal or a total. With hide
 * numbers on (SPEC §8.3), words instead: "Nearly there", "Around your daily limit".
 */
export function goalText(t: TFunction, row: MicroRow, hideNumbers = false): string | null {
  if (row.share === null || !row.goal) return null;
  if (hideNumbers) return bandText(t, row.share, row.goal.kind);
  const values = {
    percent: formatPercent(row.share),
    unit: unitOf(t, row.nutrient),
    need: formatAmount(row.goal.amount),
    limit: formatAmount(row.goal.amount),
  };
  return row.goal.kind === 'need' ? t('micros.ofNeed', values) : t('micros.ofLimit', values);
}

/**
 * The bar's colour. Fibre has its own accent (SPEC §8.1); everything else stays monochrome.
 * An incomplete total is drawn lighter: it is a floor, not the whole amount. Never red, even
 * above a limit or the safe upper level.
 */
function barColor(colors: ColorTokens, row: MicroRow): string {
  if (row.incomplete) return colors.textSecondary;
  return row.nutrient === 'fibre_g' ? colors.fibre : colors.text;
}

/** A bar that fills up to the need or limit (it stops at full; the % says the rest). */
export function NutrientBar({ row }: { row: MicroRow }) {
  const { colors, radius } = useTheme();
  if (row.share === null) return null;
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm }]}>
      <View
        testID={`bar-${row.nutrient}`}
        style={{
          width: `${Math.min(1, row.share) * 100}%`,
          height: '100%',
          borderRadius: radius.sm,
          backgroundColor: barColor(colors, row),
        }}
      />
    </View>
  );
}

/**
 * One nutrient (SPEC §2.12): name, amount, a bar towards the need or limit with its %, and, when
 * some foods eaten have no data for it, "≈" and "based on X of Y foods". Tap → the nutrient sheet.
 * Hide numbers: no amount, and words instead of the %.
 */
export function NutrientRow({ row, onPress }: { row: MicroRow; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const name = t(`nutrients.${row.nutrient}`);
  const amount = hide ? null : amountText(t, row);
  const goal = goalText(t, row, hide);
  const notes = [
    row.total === null && row.coverage.foods > 0 ? t('micros.noData') : null,
    row.incomplete && row.total !== null
      ? t('micros.basedOn', { known: row.coverage.knownFoods, count: row.coverage.foods })
      : null,
    row.aboveTul ? t('micros.aboveTul') : null,
  ].filter((n): n is string => n !== null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, amount, goal, ...notes].filter(Boolean).join('. ')}
      accessibilityHint={t('micros.rowHint')}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: minTapTarget,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>{name}</Text>
        {amount && (
          <Text
            style={{ color: colors.text, fontSize: fontSize.body, fontVariant: ['tabular-nums'] }}
          >
            {amount}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
      </View>
      <NutrientBar row={row} />
      {(goal || notes.length > 0) && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {[goal, ...notes].filter(Boolean).join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 8, overflow: 'hidden' },
});
