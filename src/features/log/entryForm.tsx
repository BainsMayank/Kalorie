// Pieces shared by the sheets that log or edit an entry (food and quick add): the meal and
// time pickers, and the Log / Done / Delete buttons.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoiceChips, TimePicker } from '@/components';
import type { LogEntry } from '@/db/user/schema';
import { autoSlot, clockMinute, defaultEntryMinute } from '@/lib/day';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { slotName } from './names';

/**
 * The meal and time of an entry. A new entry starts at the time now (or the start of the slot
 * "+ Add" was tapped on); its meal follows the time until the user picks one.
 */
export function useSlotAndTime(start: { entry: LogEntry } | { slotId?: string }) {
  const allSlots = useLogStore((state) => state.slots);
  const editing = 'entry' in start ? start.entry : null;
  const tapped = 'slotId' in start ? allSlots.find((s) => s.id === start.slotId) : undefined;

  // Visible slots, plus the entry's own slot even if it was hidden since.
  const slots = allSlots.filter((s) => !s.isHidden || s.id === editing?.slotId);
  const [minute, setMinute] = useState(() =>
    editing ? clockMinute(editing.loggedAt) : defaultEntryMinute(Date.now(), tapped),
  );
  const [slotId, setSlotId] = useState(
    () => editing?.slotId ?? tapped?.id ?? autoSlot(allSlots, minute)?.id ?? slots[0]?.id,
  );
  const [slotChosen, setSlotChosen] = useState(Boolean(editing || tapped));

  return {
    slots,
    slot: slots.find((s) => s.id === slotId),
    minute,
    changeTime: (next: number) => {
      setMinute(next);
      if (!slotChosen) setSlotId(autoSlot(allSlots, next)?.id ?? slotId);
    },
    pickSlot: (id: string) => {
      setSlotId(id);
      setSlotChosen(true);
    },
  };
}

/** "Meal" chips and the time picker. */
export function SlotAndTimeFields({ form }: { form: ReturnType<typeof useSlotAndTime> }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  return (
    <>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.body,
          marginTop: spacing.xl,
          marginBottom: spacing.sm,
        }}
      >
        {t('slots.label')}
      </Text>
      <ChoiceChips
        label={t('slots.label')}
        choices={form.slots.map((s) => ({ value: s.id, label: slotName(t, s) }))}
        selected={form.slot?.id ?? ''}
        onSelect={form.pickSlot}
      />
      <View style={{ marginTop: spacing.md }}>
        <TimePicker minute={form.minute} onChange={form.changeTime} />
      </View>
    </>
  );
}

/** Runs a save or delete: shows it as busy, and keeps the sheet open with a note if it fails. */
export function useSaveAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      onDone();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return { busy, failed, run };
}

/** The main button (Log to Lunch / Done), and Delete when editing. */
export function SheetFooter({
  label,
  enabled,
  onPress,
  onDelete,
  busy,
  failed,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  onDelete?: () => void;
  busy: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const canPress = enabled && !busy;
  return (
    <View style={{ gap: spacing.sm }}>
      {failed && (
        <Text style={{ color: colors.text, fontSize: fontSize.caption, textAlign: 'center' }}>
          {t('entry.saveProblem')}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPress }}
        disabled={!canPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.center,
          {
            minHeight: minTapTarget,
            borderRadius: radius.md,
            backgroundColor: colors.text,
            opacity: !canPress ? 0.4 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={{ color: colors.background, fontSize: fontSize.body, fontWeight: '600' }}>
          {label}
        </Text>
      </Pressable>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.center,
            {
              minHeight: minTapTarget,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            },
          ]}
        >
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('entry.delete')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
