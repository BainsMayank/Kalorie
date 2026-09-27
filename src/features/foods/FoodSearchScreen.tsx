import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SourceBadge } from '@/components';
import type { FoodSearchResult } from '@/db/foods';
import { formatKcal, formatQty } from '@/lib/format';
import { useTheme } from '@/theme';

import { FavouriteButton } from './FavouriteButton';
import { useFoodSearch } from './useFoodSearch';

function ResultRow({ food, onPress }: { food: FoodSearchResult; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();

  // "1 katori · 93 kcal", or just "1 katori" when kcal is unknown.
  const amount = t('food.portion', {
    qty: formatQty(food.defaultQty),
    unit: food.defaultUnitLabel,
  });
  const kcal =
    food.energyKcalPer100g === null || food.defaultGrams === null
      ? null
      : formatKcal((food.energyKcalPer100g * food.defaultGrams) / 100);
  const portion = kcal === null ? amount : t('search.resultPortion', { portion: amount, kcal });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border, paddingRight: spacing.xs }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${portion}`}
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
            numberOfLines={1}
          >
            {portion}
          </Text>
        </View>
        <View style={{ marginLeft: spacing.md }}>
          <SourceBadge source={food.source} />
        </View>
      </Pressable>
      <FavouriteButton foodSource="base" foodId={String(food.id)} name={food.name} />
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
};

/** Search foods.db as you type (SPEC §2.3). Tapping a result opens the food's details. */
export function FoodSearchScreen({ slot, header, actions, renderEmpty }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);

  let message: string | null = null;
  if (search.status === 'error') message = t('search.unavailable');
  else if (search.status === 'idle' && !renderEmpty) message = t('search.hint');
  else if (search.status === 'done' && search.results.length === 0) {
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
          data={search.results}
          keyExtractor={(food) => String(food.id)}
          renderItem={({ item }) => (
            <ResultRow
              food={item}
              onPress={() =>
                router.push({
                  pathname: '/food/[id]',
                  params: slot ? { id: String(item.id), slot } : { id: String(item.id) },
                })
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
