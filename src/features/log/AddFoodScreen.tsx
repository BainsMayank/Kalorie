import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoiceChips, UndoBar } from '@/components';
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
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
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
    <View style={[styles.row, { marginBottom: spacing.xs }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('add.quickAdd')}
        onPress={() => setQuickAdd(true)}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: minTapTarget,
            paddingHorizontal: spacing.lg,
            gap: spacing.xs,
            borderRadius: radius.lg * 2,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          },
        ]}
      >
        <Ionicons name="flash-outline" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('add.quickAdd')}</Text>
      </Pressable>
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
