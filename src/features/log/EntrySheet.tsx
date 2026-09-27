import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  BottomSheet,
  ChoiceChips,
  PortionSummary,
  QuantityStepper,
  SourceBadge,
} from '@/components';
import type { FoodDetail } from '@/db/foods';
import type { LogEntry } from '@/db/user/schema';
import { usePortion } from '@/features/foods/usePortion';
import { formatDayName } from '@/i18n/dates';
import { timeOnDay } from '@/lib/day';
import { formatAmount } from '@/lib/format';
import { isFreeNumberUnit } from '@/lib/units';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { SheetFooter, SlotAndTimeFields, useSaveAction, useSlotAndTime } from './entryForm';
import { loggedTick } from './haptics';
import { entryName, slotName } from './names';
import { useToday } from './useToday';

type Props = {
  food: FoodDetail;
  onClose: () => void;
  /** After the entry was saved or deleted. */
  onSaved: () => void;
} & (
  | {
      mode: 'add';
      /** The day the entry goes to. */
      day: string;
      /** The slot the user tapped "+ Add" on; otherwise it is picked by the time. */
      slotId?: string;
      /** The amount chosen on the food screen. */
      start: { unit: string; qty: number };
    }
  | { mode: 'edit'; entry: LogEntry }
);

/**
 * Amount, unit, meal and time for a food, then Log (SPEC §2.4) — or, for an entry that is
 * already logged, Done and Delete (SPEC §2.6). Grams are worked out when saving.
 */
export function EntrySheet(props: Props) {
  const { food, onClose, onSaved } = props;
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const addEntry = useLogStore((state) => state.addEntry);
  const editEntry = useLogStore((state) => state.editEntry);
  const removeEntry = useLogStore((state) => state.removeEntry);
  const today = useToday();

  const editing = props.mode === 'edit' ? props.entry : null;
  const day = props.mode === 'edit' ? props.entry.day : props.day;

  const portion = usePortion(
    food,
    props.mode === 'add'
      ? props.start
      : food.units.some((u) => u.unit === props.entry.unit)
        ? { unit: props.entry.unit!, qty: props.entry.qty ?? 1 }
        : { unit: 'g', qty: Math.round(props.entry.grams ?? 0) }, // the unit is gone: show grams
  );
  const form = useSlotAndTime(
    props.mode === 'edit' ? { entry: props.entry } : { slotId: props.slotId },
  );
  const action = useSaveAction(onSaved);

  const save = () =>
    action.run(async () => {
      const amount = {
        loggedAt: timeOnDay(day, form.minute),
        slotId: form.slot!.id,
        qty: portion.qty,
        unit: portion.unit.unit,
        grams: portion.grams,
      };
      if (editing) {
        await editEntry(editing.id, amount);
      } else {
        await addEntry(
          { ...amount, day, foodSource: 'base', foodId: String(food.id), name: food.name },
          t('undo.logged', { name: food.name, slot: slotName(t, form.slot!) }),
        );
        loggedTick();
      }
    });

  const footer = (
    <SheetFooter
      label={
        editing
          ? t('entry.done')
          : t('entry.logTo', { slot: form.slot ? slotName(t, form.slot) : '' })
      }
      enabled={portion.qty > 0 && form.slot !== undefined}
      onPress={save}
      onDelete={
        editing
          ? () =>
              action.run(() =>
                removeEntry(editing.id, t('undo.deleted', { name: entryName(t, editing) })),
              )
          : undefined
      }
      busy={action.busy}
      failed={action.failed}
    />
  );

  return (
    <BottomSheet
      title={editing ? t('entry.editTitle') : food.name}
      onClose={onClose}
      footer={footer}
    >
      <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.lg }]}>
        {editing && (
          <Text
            style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}
            numberOfLines={2}
          >
            {food.name}
          </Text>
        )}
        <SourceBadge source={food.source} />
        {day !== today && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
            {t('entry.forDay', { day: formatDayName(t, day, today) })}
          </Text>
        )}
      </View>

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
      <SlotAndTimeFields form={form} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
