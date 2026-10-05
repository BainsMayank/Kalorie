import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, NumberField, PortionSummary } from '@/components';
import { formatAmount, formatKcal, formatQty } from '@/lib/format';
import { nutrientsForGrams } from '@/lib/nutrition';
import { recipePer100g, recipePerServing, servingWeightG } from '@/lib/recipe';
import { useMyFoodsStore } from '@/stores/myFoods';
import { useRecipeDraftStore } from '@/stores/recipeDraft';
import { useTheme } from '@/theme';

import { EMPTY_DRAFT, draftAmounts, draftNumbers, draftToInput, loadRecipeDraft } from './draft';
import { IngredientSheet } from './IngredientSheet';
import type { DraftItem } from './draft';

type Loading = 'loading' | 'ready' | 'missing' | 'error';

/**
 * The recipe builder (SPEC §2.9, `app/recipe.tsx`): name, servings, optional cooked weight and
 * ingredients, with per serving and per 100 g worked out as you go. Params: `id` = edit that
 * recipe; `copy` = start from a copy of that recipe (Duplicate); neither = a new recipe.
 */
export function RecipeBuilderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, spacing, fontSize, radius } = useTheme();
  const { id, copy } = useLocalSearchParams<{ id?: string; copy?: string }>();
  const draft = useRecipeDraftStore((state) => state.draft);
  const change = useRecipeDraftStore((state) => state.change);
  const replaceItem = useRecipeDraftStore((state) => state.replaceItem);
  const removeItem = useRecipeDraftStore((state) => state.removeItem);
  const saveRecipe = useMyFoodsStore((state) => state.saveRecipe);
  const [loading, setLoading] = useState<Loading>(id || copy ? 'loading' : 'ready');
  const [editingItem, setEditingItem] = useState<DraftItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Start the draft once, when the screen opens: coming back from *Add ingredient* keeps it.
  useEffect(() => {
    const { start } = useRecipeDraftStore.getState();
    const source = id ?? copy;
    if (!source) {
      start(EMPTY_DRAFT);
      return;
    }
    let current = true;
    loadRecipeDraft(source, copy ? (name) => t('recipe.copyName', { name }) : undefined)
      .then((loaded) => {
        if (!current) return;
        if (loaded) start(loaded);
        setLoading(loaded ? 'ready' : 'missing');
      })
      .catch(() => current && setLoading('error'));
    return () => {
      current = false;
    };
  }, [id, copy, t]);

  useEffect(() => {
    navigation.setOptions({ title: id ? t('recipe.editTitle') : t('recipe.newTitle') });
  }, [navigation, id, t]);

  if (loading !== 'ready') {
    const message =
      loading === 'missing'
        ? t('recipe.notFound')
        : loading === 'error'
          ? t('search.unavailable')
          : null;
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, padding: spacing.lg }]}>
        {message && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>{message}</Text>
        )}
      </View>
    );
  }

  const input = draftToInput(draft, t('units.serving'));
  const amounts = draftAmounts(draft);
  const { cookedWeightG } = draftNumbers(draft);
  const hasItems = draft.items.length > 0;
  const perServing = recipePerServing(amounts);
  const per100 = recipePer100g(amounts);
  const katoriKcal = nutrientsForGrams(per100, 150).energy_kcal;

  const save = async () => {
    if (!input) return;
    setBusy(true);
    setFailed(false);
    try {
      await saveRecipe(input, draft.id ?? undefined);
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const label = (text: string) => (
    <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginBottom: 4 }}>
      {text}
    </Text>
  );
  const caption = (text: string) => (
    <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 4 }}>
      {text}
    </Text>
  );
  const sectionTitle = (text: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.textSecondary,
        fontSize: fontSize.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {text}
    </Text>
  );
  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {label(t('recipe.name'))}
        <TextInput
          value={draft.name}
          onChangeText={(name) => change({ name })}
          accessibilityLabel={t('recipe.name')}
          placeholder={t('recipe.namePlaceholder')}
          placeholderTextColor={colors.iconInactive}
          style={{
            minHeight: 48,
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: fontSize.body,
            paddingHorizontal: spacing.md,
          }}
        />

        <View style={[styles.row, { marginTop: spacing.lg, gap: spacing.md }]}>
          <NumberField
            label={t('recipe.servings')}
            value={draft.servingsText}
            onChangeText={(servingsText) => change({ servingsText })}
          />
          <NumberField
            label={t('recipe.cookedWeight')}
            value={draft.cookedWeightText}
            onChangeText={(cookedWeightText) => change({ cookedWeightText })}
            unit={t('nutrientUnits.g')}
          />
        </View>
        {caption(t('recipe.cookedWeightHint'))}

        {sectionTitle(t('recipe.ingredients'))}
        {hasItems ? (
          <View style={card}>
            {draft.items.map((item, index) => (
              <IngredientRow
                key={item.key}
                item={item}
                first={index === 0}
                onPress={() => setEditingItem(item)}
              />
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('recipe.noIngredients')}
          </Text>
        )}
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={t('recipe.addIngredient')}
            kind="secondary"
            onPress={() => router.push('/recipe-ingredient')}
          />
        </View>

        {hasItems && (
          <>
            {sectionTitle(t('recipe.perServing'))}
            <View style={[card, { padding: spacing.lg }]}>
              <PortionSummary nutrients={perServing} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.caption,
                  textAlign: 'center',
                  marginTop: spacing.sm,
                }}
              >
                {t('recipe.servingWeight', { grams: formatAmount(servingWeightG(amounts)) })}
              </Text>
            </View>

            {sectionTitle(
              cookedWeightG === null ? t('recipe.per100Raw') : t('recipe.per100Cooked'),
            )}
            <Text style={{ color: colors.text, fontSize: fontSize.body }}>
              {t('recipe.per100Line', {
                kcal: formatKcal(per100.energy_kcal) ?? t('food.unknown'),
                protein: formatAmount(per100.protein_g) ?? t('food.unknown'),
                carbs: formatAmount(per100.carb_g) ?? t('food.unknown'),
                fat: formatAmount(per100.fat_g) ?? t('food.unknown'),
              })}
            </Text>
            {caption(
              cookedWeightG === null
                ? t('recipe.katoriNeedsWeight')
                : t('recipe.katoriLine', { kcal: formatKcal(katoriKcal) ?? t('food.unknown') }),
            )}
          </>
        )}

        {draft.id !== null && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.xl,
            }}
          >
            {t('recipe.editNote')}
          </Text>
        )}
      </ScrollView>

      <View
        style={{
          padding: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {(failed || !input) && (
          <Text
            style={{ color: colors.textSecondary, fontSize: fontSize.caption, textAlign: 'center' }}
          >
            {failed ? t('entry.saveProblem') : t('recipe.needs')}
          </Text>
        )}
        <Button label={t('recipe.save')} onPress={save} disabled={!input || busy} />
      </View>

      {editingItem && (
        <IngredientSheet
          mode="edit"
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(item) => {
            replaceItem(item);
            setEditingItem(null);
          }}
          onRemove={() => {
            removeItem(editingItem.key);
            setEditingItem(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

/** "Rajma · 1 cup · 200 g · 692 kcal", with an Oil/ghee tag on the fats. Tap to change it. */
function IngredientRow({
  item,
  first,
  onPress,
}: {
  item: DraftItem;
  first: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const unitLabel = item.food.units.find((u) => u.unit === item.unit)?.label ?? item.unit;
  const amount = t('food.portion', { qty: formatQty(item.qty), unit: unitLabel });
  const detail =
    item.unit === 'g'
      ? amount
      : t('recipe.itemAmount', { amount, grams: formatAmount(item.grams) });
  const kcal = nutrientsForGrams(item.food.nutrients, item.grams).energy_kcal;
  const kcalText = t('food.kcal', { value: formatKcal(kcal) ?? t('food.unknown') });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.food.name, detail, kcalText].join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.md,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        },
      ]}
    >
      <View style={styles.flex}>
        <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
          {item.food.name}
        </Text>
        <View style={[styles.row, { gap: spacing.sm, marginTop: 2 }]}>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{detail}</Text>
          {item.isFat && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: '600',
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.xs,
              }}
            >
              {t('recipe.fatTag')}
            </Text>
          )}
        </View>
      </View>
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>{kcalText}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
