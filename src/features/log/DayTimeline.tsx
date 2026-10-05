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
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { entryName, slotName } from './names';
import type { EntryView } from './useDayLog';

/**
 * "93 kcal", or "— kcal" when the food's energy is unknown. `null` with hide numbers on
 * (SPEC §8.3): the caller leaves the kcal out.
 */
export function useKcalText() {
  const { t } = useTranslation();
  const hide = useHideNumbers();
  return (kcal: number | null): string | null =>
    hide ? null : t('food.kcal', { value: formatKcal(kcal) ?? t('food.unknown') });
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

type Props =
  | {
      entries: EntryView[];
      readOnly?: false;
      onEdit: (entry: LogEntry) => void;
      onCopy: (slot: MealSlot, entries: LogEntry[]) => void;
      /** *Save as thali*: keep the meal to log again in one go. */
      onSaveThali: (slot: MealSlot, entries: EntryView[]) => void;
      /** Tells the screen to stop scrolling while a row is being swiped. */
      onSwipeChange: (swiping: boolean) => void;
    }
  | {
      entries: EntryView[];
      /** A past day opened from the calendar: meals to look at, with no buttons. */
      readOnly: true;
    };

/** What a meal card can do; `null` when it is read-only. */
type SlotActions = {
  onEdit: (entry: LogEntry) => void;
  onCopy: () => void;
  onSaveThali: () => void;
  onSwipeChange: (swiping: boolean) => void;
} | null;

/**
 * A day's meals, one card per slot (SPEC §2.2 timeline): the slot's name, when it was eaten,
 * its kcal and each entry. Tap an entry to edit it; swipe it left to delete (with Undo). A meal
 * can be copied to another day, or saved as a thali. Used by the Today and Log tabs.
 */
export function DayTimeline(props: Props) {
  const { entries } = props;
  const slots = useLogStore((state) => state.slots);
  // Read-only: only the meals that have something in them.
  const groups = groupBySlot(slots, entries).filter(
    (group) => !props.readOnly || group.entries.length > 0,
  );
  return (
    <>
      {groups.map(({ slot, entries: slotEntries }) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          entries={slotEntries}
          actions={
            props.readOnly
              ? null
              : {
                  onEdit: props.onEdit,
                  onCopy: () =>
                    props.onCopy(
                      slot,
                      slotEntries.map((e) => e.entry),
                    ),
                  onSaveThali: () => props.onSaveThali(slot, slotEntries),
                  onSwipeChange: props.onSwipeChange,
                }
          }
        />
      ))}
    </>
  );
}

function SlotCard({
  slot,
  entries,
  actions,
}: {
  slot: MealSlot;
  entries: EntryView[];
  actions: SlotActions;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const kcalText = useKcalText();
  const name = slotName(t, slot);
  const slotKcal = kcalText(sumNutrients(entries.map((e) => e.nutrients)).energy_kcal ?? 0);
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
              {slotKcal !== null && (
                <>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>·</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                    {slotKcal}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
        {actions && entries.length > 0 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('thali.saveMeal', { slot: name })}
              onPress={actions.onSaveThali}
              style={({ pressed }) => [
                styles.center,
                { width: minTapTarget, height: minTapTarget, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="bookmark-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('copy.meal', { slot: name })}
              onPress={actions.onCopy}
              style={({ pressed }) => [
                styles.center,
                { width: minTapTarget, height: minTapTarget, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="copy-outline" size={20} color={colors.text} />
            </Pressable>
          </>
        )}
        {actions && (
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
        )}
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
        entries.map((view) =>
          actions ? (
            <EntryRow
              key={view.entry.id}
              view={view}
              onEdit={actions.onEdit}
              onSwipeChange={actions.onSwipeChange}
            />
          ) : (
            <EntryLine key={view.entry.id} view={view} />
          ),
        )
      )}
    </View>
  );
}

/** An entry's name, amount ("1 katori") and kcal, as words. */
function useEntryWords(view: EntryView) {
  const { t } = useTranslation();
  const kcalText = useKcalText();
  const { entry } = view;
  return {
    name: entryName(t, entry),
    amount:
      entry.qty !== null && view.unitLabel !== null
        ? t('food.portion', { qty: formatQty(entry.qty), unit: view.unitLabel })
        : null,
    kcal: kcalText(view.nutrients.energy_kcal),
  };
}

/** The inside of an entry row: name and amount on the left, kcal on the right. */
function EntryText({ name, amount, kcal }: ReturnType<typeof useEntryWords>) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <>
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
      {kcal !== null && (
        <Text style={{ color: colors.text, fontSize: fontSize.body, marginLeft: spacing.md }}>
          {kcal}
        </Text>
      )}
    </>
  );
}

/** A read-only entry: nothing to tap or swipe. */
function EntryLine({ view }: { view: EntryView }) {
  const { colors, spacing, minTapTarget } = useTheme();
  const words = useEntryWords(view);
  return (
    <View
      accessible
      accessibilityLabel={[words.name, words.amount, words.kcal].filter(Boolean).join(', ')}
      style={[
        styles.row,
        {
          minHeight: minTapTarget,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}
    >
      <EntryText {...words} />
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
  const { colors, spacing, minTapTarget } = useTheme();
  const removeEntry = useLogStore((state) => state.removeEntry);
  const words = useEntryWords(view);
  const { name, amount, kcal } = words;
  const { entry } = view;
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
        <EntryText {...words} />
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
