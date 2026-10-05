import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceChips, PillButton, UndoBar } from '@/components';
import { FoodSearchScreen } from '@/features/foods/FoodSearchScreen';
import { formatDayName } from '@/i18n/dates';
import { autoSlot, clockMinute, visibleSlots } from '@/lib/day';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { slotName } from './names';
import { QuickAddSheet } from './QuickAddSheet';
import { QuickPicks } from './QuickPicks';
import { useToday } from './useToday';

/**
 * Add food (SPEC §2.3): pick the meal, then search — or, before typing, one tap on a
 * suggested, recent or favourite food. Quick add is for calories without a food.
 */
export function AddFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize } = useTheme();
  const { slot: tappedSlot } = useLocalSearchParams<{ slot?: string }>();
  const slots = visibleSlots(useLogStore((state) => state.slots));
  const day = useLogStore((state) => state.day);
  const today = useToday();
  const [slotId, setSlotId] = useState(
    () => tappedSlot ?? autoSlot(slots, clockMinute(Date.now()))?.id,
  );
  const [quickAdd, setQuickAdd] = useState(false);

  const header = (
    <View style={{ marginBottom: spacing.md }}>
      <ChoiceChips
        label={t('slots.label')}
        choices={slots.map((s) => ({ value: s.id, label: slotName(t, s) }))}
        selected={slotId ?? ''}
        onSelect={setSlotId}
        scroll
      />
      {day !== today && (
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.sm }}
        >
          {t('entry.forDay', { day: formatDayName(t, day, today) })}
        </Text>
      )}
    </View>
  );

  const actions = (
    <View style={[styles.row, { marginBottom: spacing.xs, gap: spacing.sm }]}>
      <PillButton
        icon="flash-outline"
        label={t('add.quickAdd')}
        onPress={() => setQuickAdd(true)}
      />
      <PillButton
        icon="barcode-outline"
        label={t('add.scan')}
        onPress={() => router.push({ pathname: '/scan', params: slotId ? { slot: slotId } : {} })}
      />
    </View>
  );

  return (
    <>
      <FoodSearchScreen
        slot={slotId}
        header={header}
        actions={actions}
        renderEmpty={() => <QuickPicks slotId={slotId} day={day} />}
      />
      <UndoBar placement="screen" />
      {quickAdd && (
        <QuickAddSheet
          mode="add"
          day={day}
          slotId={slotId}
          onClose={() => setQuickAdd(false)}
          onSaved={() => setQuickAdd(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
