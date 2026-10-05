import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import type { FoodDetail } from '@/db/foods';
import { FoodSearchScreen } from '@/features/foods/FoodSearchScreen';
import { loadFoodDetail } from '@/features/foods/loadFoods';
import { foodKey } from '@/lib/suggestions';
import { useRecipeDraftStore } from '@/stores/recipeDraft';
import { useTheme } from '@/theme';

import { IngredientSheet } from './IngredientSheet';

/**
 * Add ingredient (`app/recipe-ingredient.tsx`): search any food, pick its amount, and it joins
 * the recipe being built. A recipe can use the person's other recipes and products, but not
 * itself.
 */
export function IngredientPickerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize } = useTheme();
  const recipeId = useRecipeDraftStore((state) => state.draft.id);
  const addItem = useRecipeDraftStore((state) => state.addItem);
  const [picked, setPicked] = useState<FoodDetail | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <FoodSearchScreen
        excludeKey={recipeId ? foodKey('custom', recipeId) : undefined}
        onPick={(hit) => {
          setFailed(false);
          loadFoodDetail(hit.foodSource, hit.foodId)
            .then((food) => (food ? setPicked(food) : setFailed(true)))
            .catch(() => setFailed(true));
        }}
        actions={
          failed ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.caption,
                marginBottom: spacing.sm,
              }}
            >
              {t('food.notFound')}
            </Text>
          ) : null
        }
      />
      {picked && (
        <IngredientSheet
          mode="add"
          food={picked}
          onClose={() => setPicked(null)}
          onSave={(item) => {
            addItem(item);
            setPicked(null);
            router.back();
          }}
        />
      )}
    </>
  );
}
