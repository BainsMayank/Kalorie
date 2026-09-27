import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChoiceChips,
  PortionSummary,
  QuantityStepper,
  SourceBadge,
  sourceKind,
} from '@/components';
import type { FoodDetail } from '@/db/foods';
import { EntrySheet } from '@/features/log/EntrySheet';
import { formatAmount, formatKcal, formatQty } from '@/lib/format';
import { NUTRIENTS, type NutrientGroup, type NutrientValues } from '@/lib/nutrients';
import { isFreeNumberUnit } from '@/lib/units';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { FavouriteButton } from './FavouriteButton';
import { useFood } from './useFood';
import { usePortion } from './usePortion';

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

export function FoodDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const { id, slot } = useLocalSearchParams<{ id: string; slot?: string }>();
  const state = useFood(Number(id));

  if (state.status === 'found') return <FoodDetailView food={state.food} slotId={slot} />;
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

/** `slotId`: the meal slot the user tapped "+ Add" on, if any. */
function FoodDetailView({ food, slotId }: { food: FoodDetail; slotId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const day = useLogStore((state) => state.day);
  const {
    unit,
    qtyText,
    setQtyText,
    qty,
    grams,
    nutrients: portion,
    pickUnit,
    step,
  } = usePortion(food);
  const [adding, setAdding] = useState(false);

  const portionLabel = t('food.portion', { qty: formatQty(qty), unit: unit.label });

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name, ☆ and source */}
        <View style={[styles.rowCenter, { gap: spacing.sm }]}>
          <Text
            accessibilityRole="header"
            style={[
              styles.flex,
              { color: colors.text, fontSize: fontSize.title, fontWeight: '600' },
            ]}
          >
            {food.name}
          </Text>
          <FavouriteButton foodSource="base" foodId={String(food.id)} name={food.name} />
        </View>
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
          <ChoiceChips
            label={t('food.unit')}
            choices={food.units.map((u) => ({ value: u.unit, label: u.label }))}
            selected={unit.unit}
            onSelect={(value) => pickUnit(food.units.find((u) => u.unit === value)!)}
          />
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
            style={[
              styles.valueColumn,
              { color: colors.textSecondary, fontSize: fontSize.caption },
            ]}
            numberOfLines={2}
          >
            {portionLabel}
          </Text>
          <Text
            style={[
              styles.valueColumn,
              { color: colors.textSecondary, fontSize: fontSize.caption },
            ]}
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
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.xs,
            }}
          >
            {t('food.energyEstimated')}
          </Text>
        )}
      </ScrollView>

      {/* Add to log: opens the sheet with this amount, to pick the meal and time */}
      <View
        style={{
          padding: spacing.lg,
          paddingBottom: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: qty <= 0 }}
          disabled={qty <= 0}
          onPress={() => setAdding(true)}
          style={({ pressed }) => [
            styles.center,
            {
              minHeight: minTapTarget,
              borderRadius: radius.md,
              backgroundColor: colors.text,
              opacity: qty <= 0 ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.background, fontSize: fontSize.body, fontWeight: '600' }}>
            {t('food.addToLog')}
          </Text>
        </Pressable>
      </View>

      {adding && (
        <EntrySheet
          mode="add"
          food={food}
          day={day}
          slotId={slotId}
          start={{ unit: unit.unit, qty }}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            // Back to the search, ready for the next food ("Add more" flow, SPEC §2.4).
            if (router.canGoBack()) router.back();
          }}
        />
      )}
    </SafeAreaView>
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
  card: { borderWidth: StyleSheet.hairlineWidth },
  valueColumn: { width: 96, textAlign: 'right' },
});
