import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, Button, ChoiceChips } from '@/components';
import type { LoggedFood } from '@/db/foods';
import type { SavedThali } from '@/db/user/thalis';
import { loggedTick } from '@/features/log/haptics';
import { slotName } from '@/features/log/names';
import { defaultEntryMinute, timeOnDay, visibleSlots } from '@/lib/day';
import { formatKcal, formatQty } from '@/lib/format';
import { entryNutrients } from '@/lib/nutrition';
import { foodKey } from '@/lib/suggestions';
import { thaliEntries, thaliItemGrams, type ThaliChoice, type ThaliItem } from '@/lib/thali';
import { stepQuantity } from '@/lib/units';
import { useLogStore } from '@/stores/log';
import { useMyFoodsStore } from '@/stores/myFoods';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

type Props = {
  thali: SavedThali;
  /** The thali's foods by food key; a food that is gone is missing. */
  foods: Map<string, LoggedFood>;
  /** The day and meal to log to (the meal can be changed here). */
  day: string;
  slotId: string | undefined;
  onClose: () => void;
};

/** kcal of an item at an amount, with its oil level; `null` if unknown. */
function itemKcal(item: ThaliItem, food: LoggedFood | undefined, grams: number): number | null {
  if (!food) return null;
  const values = entryNutrients(
    {
      grams,
      oilLevel: item.oilLevel,
      quickKcal: null,
      quickProteinG: null,
      quickCarbG: null,
      quickFatG: null,
    },
    food.nutrients,
    food.oilStep,
  );
  return values.energy_kcal;
}

/** When the thali is eaten: now, or the slot's start if now is outside it (like one-tap ⊕). */
function loggingTime(day: string, slot: { startMin: number; endMin: number }): number {
  return timeOnDay(day, defaultEntryMinute(Date.now(), slot));
}

/** kcal of a whole thali at its saved amounts (foods that are gone count as none). */
export function thaliKcal(thali: SavedThali, foods: Map<string, LoggedFood>): number {
  return thali.items.reduce(
    (sum, item) =>
      sum + (itemKcal(item, foods.get(foodKey(item.foodSource, item.foodId)), item.grams) ?? 0),
    0,
  );
}

/**
 * A thali as a checklist (SPEC §2.9): tick what you're having, change any amount, pick the
 * meal, then log it all at once — one Undo takes it all back.
 */
export function ThaliSheet({ thali, foods, day, slotId, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const slots = visibleSlots(useLogStore((state) => state.slots));
  const addEntries = useLogStore((state) => state.addEntries);
  const deleteThali = useMyFoodsStore((state) => state.deleteThali);
  const hide = useHideNumbers();
  const [slot, setSlot] = useState(slotId ?? slots[0]?.id);
  const [choices, setChoices] = useState<ThaliChoice[]>(() =>
    thali.items.map((item) => {
      const food = foods.get(foodKey(item.foodSource, item.foodId));
      return {
        item,
        checked: food !== undefined,
        qty: item.qty,
        unitGrams: food?.units[item.unit]?.grams ?? null,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const target = slots.find((s) => s.id === slot);
  const picked = choices.filter((c) => c.checked && c.qty > 0);
  const totalKcal = picked.reduce((sum, c) => {
    const food = foods.get(foodKey(c.item.foodSource, c.item.foodId));
    return sum + (itemKcal(c.item, food, thaliItemGrams(c.item, c.qty, c.unitGrams)) ?? 0);
  }, 0);

  const update = (index: number, changes: Partial<ThaliChoice>) =>
    setChoices((list) => list.map((c, i) => (i === index ? { ...c, ...changes } : c)));

  const log = async () => {
    if (!target) return;
    setBusy(true);
    setFailed(false);
    try {
      await addEntries(
        thaliEntries(choices, { day, slotId: target.id, loggedAt: loggingTime(day, target) }),
        t('undo.loggedMany', { count: picked.length, slot: slotName(t, target) }),
      );
      loggedTick();
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title={thali.name}
      onClose={onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          {(failed || !hide) && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.caption,
                textAlign: 'center',
              }}
            >
              {failed ? t('entry.saveProblem') : t('thali.total', { kcal: formatKcal(totalKcal) })}
            </Text>
          )}
          <Button
            label={t('thali.log', {
              count: picked.length,
              slot: target ? slotName(t, target) : '',
            })}
            onPress={log}
            disabled={picked.length === 0 || !target || busy}
          />
          {!thali.builtin && (
            <Button
              label={t('thali.delete')}
              kind="text"
              onPress={() => {
                deleteThali(thali.id, t('undo.deletedThali', { name: thali.name })).catch(() => {});
                onClose();
              }}
            />
          )}
        </View>
      }
    >
      <ChoiceChips
        label={t('slots.label')}
        choices={slots.map((s) => ({ value: s.id, label: slotName(t, s) }))}
        selected={slot ?? ''}
        onSelect={setSlot}
        scroll
      />
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginTop: spacing.lg,
          marginBottom: spacing.xs,
        }}
      >
        {t('thali.pick')}
      </Text>
      {choices.map((choice, index) => (
        <ChecklistRow
          key={`${index}-${choice.item.foodId}`}
          choice={choice}
          food={foods.get(foodKey(choice.item.foodSource, choice.item.foodId))}
          onToggle={() => update(index, { checked: !choice.checked })}
          onStep={(direction) =>
            update(index, { qty: stepQuantity(choice.qty, choice.item.unit, direction) })
          }
        />
      ))}
    </BottomSheet>
  );
}

/** ☐ Mixed dal · 93 kcal, and − 1 katori + under it. */
function ChecklistRow({
  choice,
  food,
  onToggle,
  onStep,
}: {
  choice: ThaliChoice;
  food: LoggedFood | undefined;
  onToggle: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const { item, checked, qty } = choice;
  const missing = food === undefined;
  const unitLabel = food?.units[item.unit]?.label ?? item.unit;
  const amount = t('food.portion', { qty: formatQty(qty), unit: unitLabel });
  const kcal = itemKcal(item, food, thaliItemGrams(item, qty, choice.unitGrams));
  const kcalText = missing
    ? t('thali.missing')
    : hide
      ? null
      : t('food.kcal', { value: formatKcal(kcal) ?? t('food.unknown') });

  const stepButton = (direction: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(direction === 1 ? 'food.increase' : 'food.decrease')}, ${item.name}`}
      disabled={missing}
      onPress={() => onStep(direction)}
      style={({ pressed }) => [
        styles.center,
        {
          width: minTapTarget,
          height: minTapTarget,
          borderRadius: minTapTarget / 2,
          backgroundColor: pressed ? colors.border : colors.surfaceMuted,
          opacity: missing ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={direction === 1 ? 'add' : 'remove'} size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: missing }}
        accessibilityLabel={t('thali.checkLabel', { name: item.name })}
        disabled={missing}
        onPress={onToggle}
        style={[styles.row, { minHeight: minTapTarget, gap: spacing.sm }]}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={24}
          color={missing ? colors.iconInactive : colors.text}
        />
        <Text
          style={[
            styles.flex,
            { color: missing ? colors.textSecondary : colors.text, fontSize: fontSize.body },
          ]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {kcalText !== null && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {kcalText}
          </Text>
        )}
      </Pressable>
      {!missing && (
        <View style={[styles.row, { gap: spacing.md, paddingLeft: 24 + spacing.sm }]}>
          {stepButton(-1)}
          <Text
            accessibilityLabel={`${item.name}, ${amount}`}
            style={{
              color: colors.text,
              fontSize: fontSize.body,
              minWidth: 96,
              textAlign: 'center',
            }}
          >
            {amount}
          </Text>
          {stepButton(1)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
