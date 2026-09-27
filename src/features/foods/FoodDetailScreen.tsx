import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SourceBadge, sourceKind } from '@/components';
import type { FoodDetail, FoodUnitOption } from '@/db/foods';
import { formatAmount, formatKcal, formatQty } from '@/lib/format';
import { NUTRIENTS, type NutrientGroup, type NutrientValues } from '@/lib/nutrients';
import { nutrientsForGrams } from '@/lib/nutrition';
import { isFreeNumberUnit, quantityForNewUnit, quantityStep } from '@/lib/units';
import { useTheme } from '@/theme';

import { useFood } from './useFood';

type NutrientUnit = (typeof NUTRIENTS)[number]['unit'];

/** Table sections, top to bottom. Energy sits with the macros. */
const SECTIONS: { title: 'macro' | 'other' | 'mineral' | 'vitamin'; groups: NutrientGroup[] }[] = [
  { title: 'macro', groups: ['energy', 'macro'] },
  { title: 'other', groups: ['other'] },
  { title: 'mineral', groups: ['mineral'] },
  { title: 'vitamin', groups: ['vitamin'] },
];

/** "1,840" / "4.5" / null, depending on the nutrient's unit. */
function formatNutrient(value: number | null, unit: NutrientUnit): string | null {
  return unit === 'kcal' ? formatKcal(value) : formatAmount(value);
}

/** Reads a typed amount: "1.5" or "1,5" → 1.5; anything else → 0. */
function parseQty(text: string): number {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function FoodDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useFood(Number(id));

  if (state.status === 'found') return <FoodDetailView food={state.food} />;
  const message =
    state.status === 'missing'
      ? t('food.notFound')
      : state.status === 'error'
        ? t('search.unavailable')
        : null;
  return (
    <View style={[styles.flex, { backgroundColor: colors.background, padding: spacing.lg }]}>
      {message && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>{message}</Text>
      )}
    </View>
  );
}

function FoodDetailView({ food }: { food: FoodDetail }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();

  const [unit, setUnit] = useState<FoodUnitOption>(
    () => food.units.find((u) => u.unit === food.defaultUnit) ?? food.units[0],
  );
  const [qtyText, setQtyText] = useState(() =>
    formatQty(unit.unit === food.defaultUnit ? food.defaultQty : 1),
  );
  const qty = parseQty(qtyText);
  const grams = qty * unit.grams;
  const portion = nutrientsForGrams(food.nutrients, grams);

  const pickUnit = (next: FoodUnitOption) => {
    setQtyText(formatQty(quantityForNewUnit(next.unit, next.grams, grams)));
    setUnit(next);
  };
  const step = (direction: 1 | -1) => {
    const size = quantityStep(unit.unit);
    // Snap to the step size, and never go below one step.
    const next = Math.max(size, Math.round((qty + direction * size) / size) * size);
    setQtyText(formatQty(next));
  };

  const portionLabel = t('food.portion', { qty: formatQty(qty), unit: unit.label });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name and source */}
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
      >
        {food.name}
      </Text>
      {food.nameHi && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: 2 }}>
          {food.nameHi}
        </Text>
      )}
      <View style={[styles.rowCenter, { marginTop: spacing.sm, gap: spacing.sm }]}>
        <SourceBadge source={food.source} />
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t(`sources.long.${sourceKind(food.source)}`)}
        </Text>
      </View>

      {/* Portion: unit chips and amount */}
      <View
        style={[
          styles.card,
          {
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <UnitChips units={food.units} selected={unit} onSelect={pickUnit} />
        <QuantityStepper
          value={qtyText}
          onChange={setQtyText}
          onStep={step}
          freeNumber={isFreeNumberUnit(unit.unit)}
          unitLabel={unit.label}
        />
        {unit.unit !== 'g' && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              textAlign: 'center',
              marginTop: spacing.xs,
            }}
          >
            {t('food.grams', { grams: formatAmount(grams) })}
          </Text>
        )}
        <PortionSummary nutrients={portion} />
      </View>

      {/* Full nutrient table */}
      <View style={[styles.rowCenter, { marginTop: spacing.xl, paddingHorizontal: spacing.xs }]}>
        <View style={styles.flex} />
        <Text
          style={[styles.valueColumn, { color: colors.textSecondary, fontSize: fontSize.caption }]}
          numberOfLines={2}
        >
          {portionLabel}
        </Text>
        <Text
          style={[styles.valueColumn, { color: colors.textSecondary, fontSize: fontSize.caption }]}
        >
          {t('food.per100g')}
        </Text>
      </View>
      {SECTIONS.map((section) => (
        <NutrientSection
          key={section.title}
          title={t(`food.groups.${section.title}`)}
          groups={section.groups}
          portion={portion}
          per100g={food.nutrients}
        />
      ))}

      <Text
        style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.lg }}
      >
        {t('food.unknownNote')}
      </Text>
      {food.energyEstimated && (
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.xs }}
        >
          {t('food.energyEstimated')}
        </Text>
      )}
    </ScrollView>
  );
}

function UnitChips({
  units,
  selected,
  onSelect,
}: {
  units: FoodUnitOption[];
  selected: FoodUnitOption;
  onSelect: (unit: FoodUnitOption) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('food.unit')}
      style={[styles.wrap, { gap: spacing.sm }]}
    >
      {units.map((u) => {
        const isSelected = u.unit === selected.unit;
        return (
          <Pressable
            key={u.unit}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={u.label}
            onPress={() => onSelect(u)}
            style={[
              styles.center,
              {
                minHeight: minTapTarget,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg * 2,
                borderWidth: 1,
                borderColor: isSelected ? colors.text : colors.border,
                backgroundColor: isSelected ? colors.text : colors.surface,
              },
            ]}
          >
            <Text
              style={{
                color: isSelected ? colors.background : colors.text,
                fontSize: fontSize.body,
              }}
            >
              {u.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuantityStepper({
  value,
  onChange,
  onStep,
  freeNumber,
  unitLabel,
}: {
  value: string;
  onChange: (text: string) => void;
  onStep: (direction: 1 | -1) => void;
  freeNumber: boolean;
  unitLabel: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const button = (direction: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(direction === 1 ? 'food.increase' : 'food.decrease')}
      onPress={() => onStep(direction)}
      style={({ pressed }) => [
        styles.center,
        {
          width: minTapTarget,
          height: minTapTarget,
          borderRadius: minTapTarget / 2,
          backgroundColor: pressed ? colors.border : colors.surfaceMuted,
        },
      ]}
    >
      <Ionicons name={direction === 1 ? 'add' : 'remove'} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <View
      style={[
        styles.rowCenter,
        { justifyContent: 'center', marginTop: spacing.lg, gap: spacing.md },
      ]}
    >
      {button(-1)}
      <View style={[styles.rowCenter, { gap: spacing.sm }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={t('food.amount')}
          style={{
            minWidth: freeNumber ? 88 : 64,
            minHeight: minTapTarget,
            textAlign: 'center',
            color: colors.text,
            fontSize: fontSize.title,
            fontWeight: '600',
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: spacing.sm,
          }}
        />
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{unitLabel}</Text>
      </View>
      {button(1)}
    </View>
  );
}

/** Big kcal number and protein / carbs / fat for the chosen portion. */
function PortionSummary({ nutrients }: { nutrients: NutrientValues }) {
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
      <View style={[styles.rowCenter, { marginTop: spacing.sm, gap: spacing.lg }]}>
        {macros.map((m) => (
          <View key={m.key} style={[styles.rowCenter, { gap: spacing.xs }]}>
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

function NutrientSection({
  title,
  groups,
  portion,
  per100g,
}: {
  title: string;
  groups: NutrientGroup[];
  portion: NutrientValues;
  per100g: NutrientValues;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const unknown = t('food.unknown');
  const show = (value: number | null, unit: NutrientUnit) => {
    const text = formatNutrient(value, unit);
    return text === null
      ? unknown
      : t('food.amountWithUnit', { value: text, unit: t(`nutrientUnits.${unit}`) });
  };

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          fontWeight: '600',
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
          paddingHorizontal: spacing.xs,
        }}
      >
        {title}
      </Text>
      {NUTRIENTS.filter((n) => groups.includes(n.group)).map((n) => (
        <View
          key={n.key}
          style={[
            styles.rowCenter,
            {
              minHeight: 36,
              paddingHorizontal: spacing.xs,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
            {t(`nutrients.${n.key}`)}
          </Text>
          <Text style={[styles.valueColumn, { color: colors.text, fontSize: fontSize.body }]}>
            {show(portion[n.key], n.unit)}
          </Text>
          <Text
            style={[styles.valueColumn, { color: colors.textSecondary, fontSize: fontSize.body }]}
          >
            {show(per100g[n.key], n.unit)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  valueColumn: { width: 96, textAlign: 'right' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
