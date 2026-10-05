import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ChoiceChips, SourceBadge } from '@/components';
import { FavouriteButton } from '@/features/foods/FavouriteButton';
import { foodRoute } from '@/features/foods/foodRoute';
import { ThaliSheet, thaliKcal } from '@/features/thalis/ThaliSheet';
import { defaultEntryMinute, timeOnDay } from '@/lib/day';
import { formatKcal, formatQty } from '@/lib/format';
import { useLogStore } from '@/stores/log';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { loggedTick } from './haptics';
import { slotName } from './names';
import { useQuickPicks, type QuickPick, type ThaliPick } from './useQuickPicks';
import { useToday } from './useToday';

type Tab = 'recent' | 'favourites' | 'myFoods' | 'thalis';

const EMPTY_NOTE: Record<
  Tab,
  'add.recentEmpty' | 'add.favouritesEmpty' | 'add.myFoodsEmpty' | 'add.thalisEmpty'
> = {
  recent: 'add.recentEmpty',
  favourites: 'add.favouritesEmpty',
  myFoods: 'add.myFoodsEmpty',
  thalis: 'add.thalisEmpty',
};

type Item =
  | { type: 'heading'; key: string; text: string }
  | { type: 'pick'; key: string; pick: QuickPick }
  | { type: 'thali'; key: string; pick: ThaliPick }
  | { type: 'newRecipe'; key: string }
  | { type: 'tabs'; key: string }
  | { type: 'note'; key: string; text: string };

/** "1 katori · 93 kcal" for a pick's amount; just "1 katori" with hide numbers on. */
function usePortionText() {
  const { t } = useTranslation();
  const hide = useHideNumbers();
  return (pick: QuickPick) => {
    const { portion, food } = pick;
    const amount = t('food.portion', {
      qty: formatQty(portion.qty),
      unit: food.units[portion.unit]?.label ?? portion.unit,
    });
    const kcal = food.nutrients.energy_kcal;
    return kcal === null || hide
      ? amount
      : t('search.resultPortion', {
          portion: amount,
          kcal: formatKcal((kcal * portion.grams) / 100),
        });
  };
}

/**
 * The Add food screen before anything is typed: foods usually logged in this slot (one tap
 * adds them at the usual amount), then Recent · Favourites · My foods · Thalis tabs (SPEC §2.3).
 */
export function QuickPicks({ slotId, day }: { slotId: string | undefined; day: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize } = useTheme();
  const today = useToday();
  const picks = useQuickPicks(slotId, today);
  const slot = useLogStore((state) => state.slots.find((s) => s.id === slotId));
  const [tab, setTab] = useState<Tab>('recent');
  const [openThali, setOpenThali] = useState<ThaliPick | null>(null);

  if (picks.status !== 'ready') {
    return picks.status === 'error' ? (
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.body, padding: spacing.lg }}>
        {t('search.unavailable')}
      </Text>
    ) : null;
  }

  const items: Item[] = [];
  // Nothing logged yet: say what the search understands, above the starter suggestions.
  if (picks.recents.length === 0) items.push({ type: 'note', key: 'hint', text: t('search.hint') });
  if (picks.suggestions.length > 0 && slot) {
    items.push({
      type: 'heading',
      key: 'suggested',
      text: t('add.suggested', { slot: slotName(t, slot) }),
    });
    for (const pick of picks.suggestions) items.push({ type: 'pick', key: `s-${pick.key}`, pick });
  }
  items.push({ type: 'tabs', key: 'tabs' });
  if (tab === 'myFoods') items.push({ type: 'newRecipe', key: 'new-recipe' });
  if (tab === 'thalis') {
    // The person's own thalis (or how to save one), then the built-in starters.
    for (const pick of picks.thalis) {
      items.push({ type: 'thali', key: `thali-${pick.thali.id}`, pick });
    }
    if (picks.thalis.length === 0) {
      items.push({ type: 'note', key: 'empty-thalis', text: t(EMPTY_NOTE.thalis) });
    }
    if (picks.starterThalis.length > 0) {
      items.push({ type: 'heading', key: 'starter-thalis', text: t('add.starterThalis') });
      for (const pick of picks.starterThalis) {
        items.push({ type: 'thali', key: `thali-${pick.thali.id}`, pick });
      }
    }
  } else {
    const list =
      tab === 'recent' ? picks.recents : tab === 'favourites' ? picks.favourites : picks.myFoods;
    for (const pick of list) items.push({ type: 'pick', key: `${tab}-${pick.key}`, pick });
    if (list.length === 0) {
      items.push({ type: 'note', key: `empty-${tab}`, text: t(EMPTY_NOTE[tab]) });
    }
  }

  const renderItem = (item: Item) => {
    switch (item.type) {
      case 'heading':
        return (
          <Text
            key={item.key}
            accessibilityRole="header"
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              fontWeight: '600',
              textTransform: 'uppercase',
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xs,
            }}
          >
            {item.text}
          </Text>
        );
      case 'tabs':
        return (
          <View
            key={item.key}
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xl,
              paddingBottom: spacing.sm,
            }}
          >
            <ChoiceChips
              label={t('add.lists')}
              choices={[
                { value: 'recent', label: t('add.recent') },
                { value: 'favourites', label: t('add.favourites') },
                { value: 'myFoods', label: t('add.myFoods') },
                { value: 'thalis', label: t('add.thalis') },
              ]}
              selected={tab}
              onSelect={setTab}
            />
          </View>
        );
      case 'note':
        return (
          <Text
            key={item.key}
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.body,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
            }}
          >
            {item.text}
          </Text>
        );
      case 'pick':
        return <PickRow key={item.key} pick={item.pick} slotId={slotId} day={day} />;
      case 'thali':
        return <ThaliRow key={item.key} pick={item.pick} onPress={() => setOpenThali(item.pick)} />;
      case 'newRecipe':
        return (
          <View key={item.key} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Button
              label={t('add.newRecipe')}
              kind="secondary"
              onPress={() => router.push('/recipe')}
            />
          </View>
        );
    }
  };

  // A plain scroll view: the lists are short (8 suggestions, 30 recents, the favourites), and
  // unlike a recycling list it always lays out right when the slot changes.
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 96 }} // room for the Undo bar
      >
        {items.map(renderItem)}
      </ScrollView>
      {openThali && (
        <ThaliSheet
          thali={openThali.thali}
          foods={openThali.foods}
          day={day}
          slotId={slotId}
          onClose={() => setOpenThali(null)}
        />
      )}
    </>
  );
}

/** A thali: its name, how many foods and their kcal. Tap to open the checklist. */
function ThaliRow({ pick, onPress }: { pick: ThaliPick; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const summary = hide
    ? t('add.thaliItemsHidden', { count: pick.thali.items.length })
    : t('add.thaliItems', {
        count: pick.thali.items.length,
        kcal: formatKcal(thaliKcal(pick.thali, pick.foods)),
      });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pick.thali.name}, ${summary}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.flex}>
        <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
          {pick.thali.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
          {summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
    </Pressable>
  );
}

/** A food with its amount: tap to open it, ☆ to star it, + to log it right away. */
function PickRow({
  pick,
  slotId,
  day,
}: {
  pick: QuickPick;
  slotId: string | undefined;
  day: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const addEntry = useLogStore((state) => state.addEntry);
  const slot = useLogStore((state) => state.slots.find((s) => s.id === slotId));
  const portionText = usePortionText();
  const { food, portion } = pick;
  const text = portionText(pick);

  const logNow = () => {
    if (!slot) return;
    addEntry(
      {
        day,
        loggedAt: timeOnDay(day, defaultEntryMinute(Date.now(), slot)),
        slotId: slot.id,
        foodSource: pick.foodSource,
        foodId: pick.foodId,
        name: food.name,
        qty: portion.qty,
        unit: portion.unit,
        grams: portion.grams,
      },
      t('undo.logged', { name: food.name, slot: slotName(t, slot) }),
    )
      .then(loggedTick)
      .catch(() => {});
  };

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: minTapTarget + spacing.md,
          paddingLeft: spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${text}`}
        onPress={() => router.push(foodRoute(pick.foodSource, pick.foodId, slotId, { log: true }))}
        style={({ pressed }) => [
          styles.flex,
          styles.row,
          { paddingVertical: spacing.md, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
            {food.name}
          </Text>
          <Text
            style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}
            numberOfLines={2}
          >
            {text}
          </Text>
        </View>
        <View style={{ marginLeft: spacing.sm }}>
          <SourceBadge source={food.source} />
        </View>
      </Pressable>
      <FavouriteButton foodSource={pick.foodSource} foodId={pick.foodId} name={food.name} />
      {slot && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.logPortion', {
            portion: t('food.portion', {
              qty: formatQty(portion.qty),
              unit: food.units[portion.unit]?.label ?? portion.unit,
            }),
            name: food.name,
            slot: slotName(t, slot),
          })}
          onPress={logNow}
          style={({ pressed }) => [
            styles.center,
            {
              width: minTapTarget,
              height: minTapTarget,
              marginRight: spacing.sm,
              opacity: pressed ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
