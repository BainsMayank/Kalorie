import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatPercent } from '@/lib/format';
import type { MacroSummary } from '@/lib/nutrition';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { macroColor } from './MacroSection';

/**
 * "Top contributors": for each macro, the 3 foods that gave the most of it, with grams and
 * their % of the day's total for that macro (SPEC §2.2). Tapping a food opens its entry;
 * without `onOpenEntry` (a past day, read-only) the foods are just listed. Hide numbers: the
 * foods in order, without grams or %.
 */
export function TopContributors({
  macros,
  onOpenEntry,
}: {
  macros: MacroSummary[];
  onOpenEntry?: (entryId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: colors.text,
          fontSize: fontSize.body,
          fontWeight: '600',
          paddingHorizontal: spacing.lg,
        }}
      >
        {t('today.topTitle')}
      </Text>
      {macros.map((macro) => (
        <MacroFoods key={macro.key} macro={macro} onOpenEntry={onOpenEntry} />
      ))}
    </View>
  );
}

function MacroFoods({
  macro,
  onOpenEntry,
}: {
  macro: MacroSummary;
  onOpenEntry?: (entryId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const name = t(`macros.${macro.key}`);

  return (
    <View>
      <View style={[styles.row, { gap: spacing.xs, paddingHorizontal: spacing.lg }]}>
        <View style={[styles.dot, { backgroundColor: macroColor(colors, macro.key) }]} />
        <Text
          accessibilityRole="header"
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, fontWeight: '600' }}
        >
          {name}
        </Text>
      </View>
      {macro.top.length === 0 ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
          }}
        >
          {t('today.topNone')}
        </Text>
      ) : (
        macro.top.map((food) => {
          const grams = formatAmount(food.amount)!;
          const percent = formatPercent(food.share);
          return (
            <Pressable
              key={food.foodKey}
              accessibilityRole={onOpenEntry ? 'button' : 'text'}
              accessibilityLabel={
                hide
                  ? t('today.topLabelHidden', { name: food.name, macro: name })
                  : t('today.topLabel', { name: food.name, grams, percent, macro: name })
              }
              accessibilityHint={onOpenEntry ? t('log.entryHint') : undefined}
              disabled={!onOpenEntry}
              onPress={() => onOpenEntry?.(food.entryId)}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: minTapTarget,
                  paddingHorizontal: spacing.lg,
                  gap: spacing.md,
                  backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}
              >
                {food.name}
              </Text>
              {!hide && (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                  {t('today.topAmount', { grams, percent })}
                </Text>
              )}
              {onOpenEntry && (
                <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
              )}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
