import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SwipeableRow, UndoBar } from '@/components';
import { getLoggedCustomFoods, listCustomFoods } from '@/db/user/customFoods';
import { formatKcal } from '@/lib/format';
import { useMyFoodsStore } from '@/stores/myFoods';
import { useHideNumbers } from '@/stores/settings';
import { useTheme } from '@/theme';

interface RecipeRow {
  id: string;
  name: string;
  /** kcal in one serving, or null if unknown. */
  servingKcal: number | null;
}

type Recipes = { status: 'loading' } | { status: 'ready'; rows: RecipeRow[] } | { status: 'error' };

async function readRecipes(): Promise<RecipeRow[]> {
  const recipes = await listCustomFoods('recipe');
  const foods = await getLoggedCustomFoods(recipes.map((r) => r.id));
  return recipes.map((recipe) => {
    const food = foods.get(recipe.id);
    const kcal = food?.nutrients.energy_kcal ?? null;
    const serving = food?.units.serving?.grams ?? null;
    return {
      id: recipe.id,
      name: recipe.name,
      servingKcal: kcal === null || serving === null ? null : (kcal * serving) / 100,
    };
  });
}

/**
 * Recipes (Profile → Recipes, `app/recipes.tsx`): the person's recipes with kcal per serving.
 * Tap to edit, ⧉ to duplicate, swipe left to delete (with Undo).
 */
export function RecipesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius } = useTheme();
  const revision = useMyFoodsStore((state) => state.revision);
  const deleteRecipe = useMyFoodsStore((state) => state.deleteRecipe);
  const [recipes, setRecipes] = useState<Recipes>({ status: 'loading' });
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    let current = true;
    readRecipes()
      .then((rows) => current && setRecipes({ status: 'ready', rows }))
      .catch(() => current && setRecipes({ status: 'error' }));
    return () => {
      current = false;
    };
  }, [revision]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, gap: spacing.lg }}
      >
        <Button label={t('recipe.new')} onPress={() => router.push('/recipe')} />
        {recipes.status === 'error' && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('search.unavailable')}
          </Text>
        )}
        {recipes.status === 'ready' && recipes.rows.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
            {t('recipe.listEmpty')}
          </Text>
        )}
        {recipes.status === 'ready' && recipes.rows.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              overflow: 'hidden',
            }}
          >
            {recipes.rows.map((row, index) => (
              <RecipeListRow
                key={row.id}
                row={row}
                first={index === 0}
                onDelete={() => {
                  deleteRecipe(row.id, t('undo.deletedRecipe', { name: row.name })).catch(() => {});
                }}
                onSwipeChange={(swiping) => setScrollEnabled(!swiping)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <UndoBar placement="screen" />
    </SafeAreaView>
  );
}

function RecipeListRow({
  row,
  first,
  onDelete,
  onSwipeChange,
}: {
  row: RecipeRow;
  first: boolean;
  onDelete: () => void;
  onSwipeChange: (swiping: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const hide = useHideNumbers();
  const kcal =
    row.servingKcal === null || hide
      ? null
      : t('recipe.perServingKcal', { kcal: formatKcal(row.servingKcal) });

  return (
    <SwipeableRow actionLabel={t('entry.delete')} onAction={onDelete} onSwipeChange={onSwipeChange}>
      <View
        style={[
          styles.row,
          {
            borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[row.name, kcal].filter(Boolean).join(', ')}
          accessibilityHint={t('recipe.edit')}
          accessibilityActions={[{ name: 'delete', label: t('entry.delete') }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onDelete();
          }}
          onPress={() => router.push({ pathname: '/recipe', params: { id: row.id } })}
          style={({ pressed }) => [
            styles.flex,
            {
              minHeight: minTapTarget + spacing.sm,
              justifyContent: 'center',
              paddingLeft: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
            {row.name}
          </Text>
          {kcal && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
              {kcal}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('recipe.duplicateLabel', { name: row.name })}
          onPress={() => router.push({ pathname: '/recipe', params: { copy: row.id } })}
          style={({ pressed }) => [
            styles.center,
            { width: minTapTarget, height: minTapTarget, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="copy-outline" size={20} color={colors.text} />
        </Pressable>
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
