import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components';
import type { LogEntry } from '@/db/user/schema';
import { formatDayName } from '@/i18n/dates';
import { timeOnDay } from '@/lib/day';
import { formatQty } from '@/lib/format';
import { parseAmount } from '@/lib/parse';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { SheetFooter, SlotAndTimeFields, useSaveAction, useSlotAndTime } from './entryForm';
import { loggedTick } from './haptics';
import { entryName, slotName } from './names';
import { useToday } from './useToday';

type Props = { onClose: () => void; onSaved: () => void } & (
  { mode: 'add'; day: string; slotId?: string } | { mode: 'edit'; entry: LogEntry }
);

/** A number as text for a field: 12.5 → "12.5", unknown → "". */
const toText = (value: number | null) => (value === null ? '' : formatQty(value));

/**
 * Quick add (SPEC §2.5): calories, and if you like protein, carbs and fat, with an optional
 * label ("Wedding buffet"). Saved without a food or grams, so it has no other nutrients.
 */
export function QuickAddSheet(props: Props) {
  const { onClose, onSaved } = props;
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const addEntry = useLogStore((state) => state.addEntry);
  const editEntry = useLogStore((state) => state.editEntry);
  const removeEntry = useLogStore((state) => state.removeEntry);
  const today = useToday();

  const editing = props.mode === 'edit' ? props.entry : null;
  const day = props.mode === 'edit' ? props.entry.day : props.day;
  const [label, setLabel] = useState(editing?.name ?? '');
  const [kcal, setKcal] = useState(toText(editing?.quickKcal ?? null));
  const [protein, setProtein] = useState(toText(editing?.quickProteinG ?? null));
  const [carbs, setCarbs] = useState(toText(editing?.quickCarbG ?? null));
  const [fat, setFat] = useState(toText(editing?.quickFatG ?? null));

  const form = useSlotAndTime(
    props.mode === 'edit' ? { entry: props.entry } : { slotId: props.slotId },
  );
  const action = useSaveAction(onSaved);

  const kcalValue = parseAmount(kcal);
  const macros = [protein, carbs, fat];
  // Calories are needed; the macros may be empty but must be numbers if typed.
  const valid =
    kcalValue !== null &&
    kcalValue > 0 &&
    macros.every((text) => text.trim() === '' || parseAmount(text) !== null);

  const save = () =>
    action.run(async () => {
      const values = {
        name: label.trim(),
        loggedAt: timeOnDay(day, form.minute),
        slotId: form.slot!.id,
        quickKcal: kcalValue,
        quickProteinG: parseAmount(protein),
        quickCarbG: parseAmount(carbs),
        quickFatG: parseAmount(fat),
      };
      if (editing) {
        await editEntry(editing.id, values);
      } else {
        await addEntry(
          { ...values, day, foodSource: 'quick', foodId: null, qty: null, unit: null, grams: null },
          t('undo.logged', { name: entryName(t, values), slot: slotName(t, form.slot!) }),
        );
        loggedTick();
      }
    });

  const field = (
    text: string,
    onChange: (text: string) => void,
    name: string,
    unit: string,
    big = false,
  ) => (
    <View style={styles.flex}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginBottom: spacing.xs,
        }}
      >
        {name}
      </Text>
      <View
        style={[
          styles.row,
          {
            minHeight: minTapTarget,
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          accessibilityLabel={name}
          placeholder={big ? '0' : t('quickAdd.optional')}
          placeholderTextColor={colors.iconInactive}
          style={[
            styles.flex,
            {
              color: colors.text,
              fontSize: big ? fontSize.title : fontSize.body,
              fontWeight: big ? '600' : '400',
              minHeight: minTapTarget,
            },
          ]}
        />
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>{unit}</Text>
      </View>
    </View>
  );

  const footer = (
    <SheetFooter
      label={
        editing
          ? t('entry.done')
          : t('entry.logTo', { slot: form.slot ? slotName(t, form.slot) : '' })
      }
      enabled={valid && form.slot !== undefined}
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
      title={editing ? t('quickAdd.editTitle') : t('quickAdd.title')}
      onClose={onClose}
      footer={footer}
    >
      {day !== today && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            marginBottom: spacing.md,
          }}
        >
          {t('entry.forDay', { day: formatDayName(t, day, today) })}
        </Text>
      )}
      <View style={{ gap: spacing.md }}>
        {field(kcal, setKcal, t('quickAdd.kcal'), t('nutrientUnits.kcal'), true)}
        <View style={[styles.row, { gap: spacing.sm }]}>
          {field(protein, setProtein, t('macros.protein'), t('nutrientUnits.g'))}
          {field(carbs, setCarbs, t('macros.carbs'), t('nutrientUnits.g'))}
          {field(fat, setFat, t('macros.fat'), t('nutrientUnits.g'))}
        </View>
        <View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginBottom: spacing.xs,
            }}
          >
            {t('quickAdd.label')}
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            accessibilityLabel={t('quickAdd.label')}
            placeholder={t('quickAdd.labelPlaceholder')}
            placeholderTextColor={colors.iconInactive}
            maxLength={60}
            style={{
              minHeight: minTapTarget,
              color: colors.text,
              fontSize: fontSize.body,
              borderRadius: radius.sm,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
            }}
          />
        </View>
      </View>
      <SlotAndTimeFields form={form} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
