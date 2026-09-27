import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SourceBadge } from '@/components';
import type { FoodSearchResult } from '@/db/foods';
import { formatKcal, formatQty } from '@/lib/format';
import { useTheme } from '@/theme';

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${portion}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.background,
          borderBottomColor: colors.border,
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
  );
}

/** Search foods.db as you type (SPEC §2.3). Tapping a result opens the food's details. */
export function FoodSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);

  let message: string | null = null;
  if (search.status === 'error') message = t('search.unavailable');
  else if (search.status === 'idle') message = t('search.hint');
  else if (search.status === 'done' && search.results.length === 0) {
    message = t('search.noResults', { query: query.trim() });
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
        >
          {t('search.title')}
        </Text>
        <View
          style={[
            styles.searchBar,
            {
              marginTop: spacing.md,
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
      </View>

      {message !== null ? (
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
                router.push({ pathname: '/food/[id]', params: { id: String(item.id) } })
              }
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
