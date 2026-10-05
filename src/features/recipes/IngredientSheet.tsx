import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet, Button, ChoiceChips, PortionSummary, QuantityStepper } from '@/components';
import type { FoodDetail } from '@/db/foods';
import { usePortion } from '@/features/foods/usePortion';
import { formatAmount } from '@/lib/format';
import { isFatIngredient } from '@/lib/recipe';
import { isFreeNumberUnit } from '@/lib/units';
import { useTheme } from '@/theme';

import { newDraftItem, type DraftItem } from './draft';

type Props = {
  onClose: () => void;
  /** The ingredient with its amount, ready for the draft. */
  onSave: (item: DraftItem) => void;
} & ({ mode: 'add'; food: FoodDetail } | { mode: 'edit'; item: DraftItem; onRemove: () => void });

/**
 * How much of a food goes into the recipe: unit, amount, and whether it is the oil or ghee that
 * Less / More oil scales (SPEC §2.9 — oil, ghee and butter are ticked on their own).
 */
export function IngredientSheet(props: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const editing = props.mode === 'edit' ? props.item : null;
  const food = editing ? editing.food : (props as { food: FoodDetail }).food;
  const portion = usePortion(food, editing ? { unit: editing.unit, qty: editing.qty } : undefined);
  const [isFat, setIsFat] = useState(() => editing?.isFat ?? isFatIngredient(food.name));

  const save = () => {
    const amount = { food, qty: portion.qty, unit: portion.unit.unit, grams: portion.grams, isFat };
    props.onSave(editing ? { ...amount, key: editing.key } : newDraftItem(amount));
  };

  return (
    <BottomSheet
      title={food.name}
      onClose={props.onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            label={editing ? t('entry.done') : t('recipe.addToRecipe')}
            onPress={save}
            disabled={portion.qty <= 0}
          />
          {props.mode === 'edit' && (
            <Button label={t('recipe.remove')} kind="secondary" onPress={props.onRemove} />
          )}
        </View>
      }
    >
      <ChoiceChips
        label={t('food.unit')}
        choices={food.units.map((u) => ({ value: u.unit, label: u.label }))}
        selected={portion.unit.unit}
        onSelect={(value) => portion.pickUnit(food.units.find((u) => u.unit === value)!)}
      />
      <QuantityStepper
        value={portion.qtyText}
        onChange={portion.setQtyText}
        onStep={portion.step}
        freeNumber={isFreeNumberUnit(portion.unit.unit)}
        unitLabel={portion.unit.label}
      />
      {portion.unit.unit !== 'g' && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            textAlign: 'center',
            marginTop: spacing.xs,
          }}
        >
          {t('food.grams', { grams: formatAmount(portion.grams) })}
        </Text>
      )}
      <PortionSummary nutrients={portion.nutrients} />

      <View style={[styles.row, { marginTop: spacing.xl, minHeight: 48, gap: spacing.md }]}>
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('recipe.isFat')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {t('recipe.isFatHint')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('recipe.isFat')}
          value={isFat}
          onValueChange={setIsFat}
          trackColor={{ true: colors.text, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
