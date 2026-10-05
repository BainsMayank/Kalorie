import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SourceBadge } from '@/components';
import { formatKcal, formatQty } from '@/lib/format';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

import { FavouriteButton } from './FavouriteButton';
import { foodRoute } from './foodRoute';
import type { SearchHit } from './searchAll';
import { useFoodSearch } from './useFoodSearch';

function ResultRow({
  food,
  onPress,
  withStar,
}: {
  food: SearchHit;
  onPress: () => void;
  withStar: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();

  // "1 katori · 93 kcal", or just "1 katori" when kcal is unknown or numbers are hidden.
  const amount = t('food.portion', {
    qty: formatQty(food.defaultQty),
    unit: food.defaultUnitLabel,
  });
  const kcal =
    hide || food.energyKcalPer100g === null || food.defaultGrams === null
      ? null
      : formatKcal((food.energyKcalPer100g * food.defaultGrams) / 100);
  const portion = kcal === null ? amount : t('search.resultPortion', { portion: amount, kcal });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border, paddingRight: spacing.xs }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          food.addedBy
            ? `${food.name}, ${portion}, ${t('group.sharedBy', { name: food.addedBy })}`
            : `${food.name}, ${portion}`
        }
        onPress={onPress}
        style={({ pressed }) => [
          styles.flex,
          styles.rowInner,
          {
            minHeight: minTapTarget + spacing.md,
            paddingLeft: spacing.lg,
            paddingVertical: spacing.md,
            opacity: pressed ? 0.6 : 1,
          },
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
            {portion}
          </Text>
          {food.addedBy !== undefined && (
            <Text
              style={{ color: colors.textSecondary, fontSize: fontSize.caption }}
              numberOfLines={1}
            >
              {food.addedBy
                ? t('group.sharedBy', { name: food.addedBy })
                : t('group.food.sharedInGroup')}
            </Text>
          )}
        </View>
        <View style={{ marginLeft: spacing.md }}>
          <SourceBadge source={food.addedBy !== undefined ? 'group' : food.source} />
        </View>
      </Pressable>
      {withStar ? (
        <FavouriteButton foodSource={food.foodSource} foodId={food.foodId} name={food.name} />
      ) : (
        <View style={{ width: spacing.sm }} />
      )}
    </View>
  );
}

type Props = {
  /** The meal slot being logged to; it is passed on to the food screen. */
  slot?: string;
  /** Shown above the search box (the slot chips). */
  header?: ReactNode;
  /** Shown under the search box (Quick add). */
  actions?: ReactNode;
  /** Shown instead of the hint while nothing is typed (suggestions, recents, favourites). */
  renderEmpty?: () => ReactNode;
  /**
   * Picking a food for something else (a recipe's ingredient): tapping a result calls this
   * instead of opening the food, and there are no ☆.
   */
  onPick?: (hit: SearchHit) => void;
  /** A food to leave out of the results ("custom:<uuid>"): a recipe can't contain itself. */
  excludeKey?: string;
};

/**
 * Search every food as you type (SPEC §2.3): foods.db, and the person's recipes and products.
 * Tapping a result opens the food's details.
 */
export function FoodSearchScreen({
  slot,
  header,
  actions,
  renderEmpty,
  onPick,
  excludeKey,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);
  const results = excludeKey ? search.results.filter((r) => r.key !== excludeKey) : search.results;

  let message: string | null = null;
  if (search.status === 'error') message = t('search.unavailable');
  else if (search.status === 'idle' && !renderEmpty) message = t('search.hint');
  else if (search.status === 'done' && results.length === 0) {
    message = t('search.noResults', { query: query.trim() });
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {header}
        <View
          style={[
            styles.searchBar,
            {
              marginBottom: spacing.sm,
              minHeight: minTapTarget,
              paddingLeft: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t('search.label')}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            style={[
              styles.flex,
              {
                color: colors.text,
                fontSize: fontSize.body,
                paddingHorizontal: spacing.sm,
                minHeight: minTapTarget,
              },
            ]}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.clear')}
              onPress={() => setQuery('')}
              hitSlop={8}
              style={[styles.center, { width: minTapTarget, height: minTapTarget }]}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        {actions}
      </View>

      {search.status === 'idle' && renderEmpty ? (
        renderEmpty()
      ) : message !== null ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.body,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
          }}
        >
          {message}
        </Text>
      ) : (
        <FlashList
          data={results}
          keyExtractor={(food) => food.key}
          renderItem={({ item }) => (
            <ResultRow
              food={item}
              withStar={!onPick}
              onPress={() =>
                onPick
                  ? onPick(item)
                  : router.push(foodRoute(item.foodSource, item.foodId, slot, { log: true }))
              }
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
