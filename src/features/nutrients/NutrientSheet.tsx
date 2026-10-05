import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components';
import type { CommonFood } from '@/db/foods';
import { formatAmount, formatPercent, formatQty } from '@/lib/format';
import {
  hasRichFoods,
  rankRichFoods,
  shareOf,
  type DietPreference,
  type MicroRow,
} from '@/lib/micros';
import { topContributors, type DayEntry } from '@/lib/nutrition';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { NutrientBar, amountText, goalText, unitOf } from './NutrientRow';

/** How many foods "Where it came from" lists (SPEC §2.12: top 3). */
const TOP_FOODS = 3;

type Props = {
  row: MicroRow;
  /** The entries the row adds up. */
  entries: readonly DayEntry[];
  /** Logged days the row is an average over; 1 for a single day. */
  dayCount: number;
  /** `null` while foods.db is being read. */
  commonFoods: readonly CommonFood[] | null;
  diet: DietPreference;
  onOpenFood: (foodId: number) => void;
  onClose: () => void;
};

/**
 * One nutrient up close: the amount against the need or limit, what's unknown and why, the foods
 * it came from, and everyday foods rich in it (vegetarian first if that's what the person eats).
 * Hide numbers: words instead of the amount and %, and foods listed without amounts.
 */
export function NutrientSheet({
  row,
  entries,
  dayCount,
  commonFoods,
  diet,
  onOpenFood,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const unit = unitOf(t, row.nutrient);
  // Hide numbers: the heading says roughly where it is ("Nearly there") instead of the amount.
  const amount = hide ? goalText(t, row, true) : amountText(t, row);
  const caption = { color: colors.textSecondary, fontSize: fontSize.caption } as const;
  const heading = (text: string) => (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
    >
      {text}
    </Text>
  );

  const goalLine =
    row.share === null || !row.goal || hide
      ? null
      : t(row.goal.kind === 'need' ? 'micros.needLine' : 'micros.limitLine', {
          percent: formatPercent(row.share),
          need: formatAmount(row.goal.amount),
          limit: formatAmount(row.goal.amount),
          unit,
        });
  const headline = amount ?? (row.total === null ? t('micros.noData') : null);
  const top = topContributors(entries, row.nutrient, TOP_FOODS);
  const rich =
    commonFoods && hasRichFoods(row) ? rankRichFoods(commonFoods, row.nutrient, diet) : [];

  return (
    <BottomSheet title={t(`nutrients.${row.nutrient}`)} onClose={onClose}>
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <View style={{ gap: spacing.xs }}>
          {headline && (
            <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}>
              {headline}
            </Text>
          )}
          {dayCount > 1 && <Text style={caption}>{t('micros.average')}</Text>}
          <NutrientBar row={row} />
          {goalLine && <Text style={caption}>{goalLine}</Text>}
        </View>

        {row.incomplete && (
          <View
            style={{
              gap: spacing.xs,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
              {t('micros.incompleteTitle')}
            </Text>
            <Text style={{ color: colors.text, fontSize: fontSize.caption }}>
              {t('micros.incompleteBody', {
                known: row.coverage.knownFoods,
                count: row.coverage.foods,
              })}
            </Text>
            <Text style={caption}>
              {t('micros.missing', { names: row.coverage.missing.join(', ') })}
            </Text>
            {row.coverage.quickAdds > 0 && <Text style={caption}>{t('micros.quickNote')}</Text>}
          </View>
        )}

        {row.aboveTul && (
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            {t('micros.aboveTulNote')}
          </Text>
        )}

        {entries.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            {heading(t('micros.fromTitle'))}
            {top.length === 0 ? (
              <Text style={caption}>{t('micros.fromNone')}</Text>
            ) : (
              top.map((food) => {
                const values = {
                  name: food.name,
                  amount: formatAmount(food.amount / dayCount),
                  unit,
                  percent: formatPercent(food.share),
                };
                return (
                  <View
                    key={food.foodKey}
                    accessible
                    accessibilityLabel={t(
                      hide ? 'micros.fromLabelHidden' : 'micros.fromLabel',
                      values,
                    )}
                    style={[styles.row, { minHeight: 36, gap: spacing.md }]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}
                    >
                      {food.name}
                    </Text>
                    {!hide && <Text style={caption}>{t('micros.fromAmount', values)}</Text>}
                  </View>
                );
              })
            )}
          </View>
        )}

        {hasRichFoods(row) && commonFoods && (
          <View style={{ gap: spacing.xs }}>
            {heading(t('micros.richTitle'))}
            {rich.length === 0 && <Text style={caption}>{t('micros.richNone')}</Text>}
            {rich.map(({ food, amount: given }) => {
              const portion = t('food.portion', {
                qty: formatQty(food.qty),
                unit: food.unitLabel,
              });
              const share = shareOf(given, row.goal?.amount ?? null);
              const values = {
                portion,
                amount: formatAmount(given),
                unit,
                percent: share === null ? '' : formatPercent(share),
              };
              const detail = hide
                ? portion
                : t(share === null ? 'micros.richAmount' : 'micros.richAmountShare', values);
              return (
                <Pressable
                  key={food.foodId}
                  accessibilityRole="button"
                  accessibilityLabel={`${food.name}: ${detail}`}
                  accessibilityHint={t('micros.richHint')}
                  onPress={() => onOpenFood(food.foodId)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      minHeight: minTapTarget,
                      gap: spacing.md,
                      backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontSize: fontSize.body }}>
                      {food.name}
                    </Text>
                    <Text style={caption}>{detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
                </Pressable>
              );
            })}
            {rich.length > 0 && <Text style={caption}>{t(`micros.richNote.${diet}`)}</Text>}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
