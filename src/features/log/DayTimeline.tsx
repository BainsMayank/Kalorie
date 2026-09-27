import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SwipeableRow } from '@/components';
import type { LogEntry, MealSlot } from '@/db/user/schema';
import { formatTime } from '@/i18n/dates';
import { clockMinute } from '@/lib/day';
import { formatKcal, formatQty } from '@/lib/format';
import { sumNutrients } from '@/lib/nutrition';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { entryName, slotName } from './names';
import type { EntryView } from './useDayLog';

/** "93 kcal", or "— kcal" when the food's energy is unknown. */
export function useKcalText() {
  const { t } = useTranslation();
  return (kcal: number | null) => t('food.kcal', { value: formatKcal(kcal) ?? t('food.unknown') });
}

/**
 * Visible slots in order, each with its entries. A hidden slot still shows if the day has
 * entries in it, and an entry whose slot no longer exists goes to the last slot (never lost).
 */
export function groupBySlot(
  slots: readonly MealSlot[],
  entries: readonly EntryView[],
): { slot: MealSlot; entries: EntryView[] }[] {
  const shown = slots.filter((s) => !s.isHidden || entries.some((e) => e.entry.slotId === s.id));
  const bySlot = new Map<string, EntryView[]>(shown.map((s) => [s.id, []]));
  for (const view of entries) {
    const list = bySlot.get(view.entry.slotId) ?? bySlot.get(shown[shown.length - 1]?.id ?? '');
    list?.push(view);
  }
  return shown.map((slot) => ({ slot, entries: bySlot.get(slot.id) ?? [] }));
}

type Props = {
  entries: EntryView[];
  onEdit: (entry: LogEntry) => void;
  onCopy: (slot: MealSlot, entries: LogEntry[]) => void;
  /** Tells the screen to stop scrolling while a row is being swiped. */
  onSwipeChange: (swiping: boolean) => void;
};

/**
 * A day's meals, one card per slot (SPEC §2.2 timeline): the slot's name, when it was eaten,
 * its kcal and each entry. Tap an entry to edit it; swipe it left to delete (with Undo).
 * Used by the Today and Log tabs.
 */
export function DayTimeline({ entries, onEdit, onCopy, onSwipeChange }: Props) {
  const slots = useLogStore((state) => state.slots);
  return (
    <>
      {groupBySlot(slots, entries).map(({ slot, entries: slotEntries }) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          entries={slotEntries}
          onEdit={onEdit}
          onCopy={() =>
            onCopy(
              slot,
              slotEntries.map((e) => e.entry),
            )
          }
          onSwipeChange={onSwipeChange}
        />
      ))}
    </>
  );
}

function SlotCard({
  slot,
  entries,
  onEdit,
  onCopy,
  onSwipeChange,
}: {
  slot: MealSlot;
  entries: EntryView[];
  onEdit: (entry: LogEntry) => void;
  onCopy: () => void;
  onSwipeChange: (swiping: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const kcalText = useKcalText();
  const name = slotName(t, slot);
  const slotKcal = sumNutrients(entries.map((e) => e.nutrients)).energy_kcal;
  // The meal's time: when its first item was eaten.
  const firstAt = entries.length > 0 ? Math.min(...entries.map((e) => e.entry.loggedAt)) : null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={[styles.row, { paddingLeft: spacing.lg, minHeight: minTapTarget + spacing.sm }]}>
        <View style={styles.flex}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
          >
            {name}
          </Text>
          {firstAt !== null && (
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {formatTime(t, clockMinute(firstAt))}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>·</Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {kcalText(slotKcal ?? 0)}
              </Text>
            </View>
          )}
        </View>
        {entries.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('copy.meal', { slot: name })}
            onPress={onCopy}
            style={({ pressed }) => [
              styles.center,
              { width: minTapTarget, height: minTapTarget, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="copy-outline" size={20} color={colors.text} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('log.addTo', { slot: name })}
          onPress={() => router.push({ pathname: '/add', params: { slot: slot.id } })}
          style={({ pressed }) => [
            styles.row,
            {
              minHeight: minTapTarget,
              paddingHorizontal: spacing.lg,
              gap: spacing.xs,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('log.add')}</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          {t('log.emptySlot')}
        </Text>
      ) : (
        entries.map((view) => (
          <EntryRow key={view.entry.id} view={view} onEdit={onEdit} onSwipeChange={onSwipeChange} />
        ))
      )}
    </View>
  );
}

function EntryRow({
  view,
  onEdit,
  onSwipeChange,
}: {
  view: EntryView;
  onEdit: (entry: LogEntry) => void;
  onSwipeChange: (swiping: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const removeEntry = useLogStore((state) => state.removeEntry);
  const kcalText = useKcalText();
  const { entry } = view;

  const amount =
    entry.qty !== null && view.unitLabel !== null
      ? t('food.portion', { qty: formatQty(entry.qty), unit: view.unitLabel })
      : null;
  const kcal = kcalText(view.nutrients.energy_kcal);
  const name = entryName(t, entry);
  const remove = () => {
    removeEntry(entry.id, t('undo.deleted', { name })).catch(() => {});
  };

  return (
    <SwipeableRow actionLabel={t('entry.delete')} onAction={remove} onSwipeChange={onSwipeChange}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[name, amount, kcal].filter(Boolean).join(', ')}
        accessibilityHint={t('log.entryHint')}
        accessibilityActions={[{ name: 'delete', label: t('entry.delete') }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') remove();
        }}
        onPress={() => onEdit(entry)}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: minTapTarget + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          },
        ]}
      >
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
            {name}
          </Text>
          {amount && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
              {amount}
            </Text>
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: fontSize.body, marginLeft: spacing.md }}>
          {kcal}
        </Text>
      </Pressable>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
