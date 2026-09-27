import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomSheet, ChoiceChips } from '@/components';
import type { LogEntry, MealSlot } from '@/db/user/schema';
import { formatDate } from '@/i18n/dates';
import { addDays } from '@/lib/day';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { DayCalendar } from './DayCalendar';
import { DayChips } from './DayChips';
import { SheetFooter, useSaveAction } from './entryForm';
import { slotName } from './names';
import { useToday } from './useToday';

type Props = {
  /** The entries to copy, in order. */
  entries: LogEntry[];
  /** The day they are on. */
  fromDay: string;
  /** Copying one meal: its slot (the copy can go to another slot). Leave out for a whole day. */
  slot?: MealSlot;
  onClose: () => void;
};

/** Copy a meal or a whole day to another day (SPEC §5.11), with Undo afterwards. */
export function CopySheet({ entries, fromDay, slot, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const slots = useLogStore((state) => state.slots).filter((s) => !s.isHidden || s.id === slot?.id);
  const copy = useLogStore((state) => state.copy);
  const today = useToday();

  // Copying today's food goes to tomorrow by default; any other day's comes to today.
  const [day, setDay] = useState(fromDay === today ? addDays(today, 1) : today);
  const [slotId, setSlotId] = useState(slot?.id);
  const [picking, setPicking] = useState(false);
  const action = useSaveAction(onClose);

  const label = (text: string) => (
    <Text
      style={{ color: colors.textSecondary, fontSize: fontSize.body, marginBottom: spacing.sm }}
    >
      {text}
    </Text>
  );

  return (
    <BottomSheet
      title={slot ? t('copy.mealTitle', { slot: slotName(t, slot) }) : t('copy.dayTitle')}
      onClose={onClose}
      footer={
        <SheetFooter
          label={t('copy.button', { count: entries.length })}
          enabled={entries.length > 0}
          onPress={() =>
            action.run(() =>
              copy(
                entries,
                { day, slotId },
                t('undo.copied', { count: entries.length, day: formatDate(t, day, today) }),
              ),
            )
          }
          busy={action.busy}
          failed={action.failed}
        />
      }
    >
      {label(t('copy.dayLabel'))}
      <DayChips
        value={day}
        today={today}
        onChange={(next) => {
          setDay(next);
          setPicking(false);
        }}
        onPickDate={() => setPicking((open) => !open)}
        withTomorrow
      />
      {picking && (
        <View style={{ marginTop: spacing.md }}>
          <DayCalendar
            day={day}
            onPick={(picked) => {
              setDay(picked);
              setPicking(false);
            }}
          />
        </View>
      )}

      {slot && slotId && (
        <View style={{ marginTop: spacing.xl }}>
          {label(t('slots.label'))}
          <ChoiceChips
            label={t('slots.label')}
            choices={slots.map((s) => ({ value: s.id, label: slotName(t, s) }))}
            selected={slotId}
            onSelect={setSlotId}
          />
        </View>
      )}
    </BottomSheet>
  );
}
