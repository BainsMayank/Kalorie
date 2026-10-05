// The recipe being built or edited: the builder, the ingredient picker and the ingredient sheet
// share it through `useRecipeDraftStore`.

import type { FoodDetail } from '@/db/foods';
import { getRecipe, type RecipeInput, type RecipeItemInput } from '@/db/user/customFoods';
import { loadFoodDetail } from '@/features/foods/loadFoods';
import { emptyNutrients } from '@/lib/nutrients';
import { parseAmount } from '@/lib/parse';
import type { RecipeAmounts } from '@/lib/recipe';
import { uuid } from '@/lib/uuid';

/** One ingredient in the draft, with its food so its amount can be changed. */
export interface DraftItem {
  /** Only for the list on screen. */
  key: string;
  food: FoodDetail;
  qty: number;
  unit: string;
  grams: number;
  isFat: boolean;
}

export interface RecipeDraft {
  /** The recipe being edited; `null` for a new one (or a copy). */
  id: string | null;
  name: string;
  /** As typed, so "1." can be typed on the way to "1.5". */
  servingsText: string;
  cookedWeightText: string;
  items: DraftItem[];
}

export const EMPTY_DRAFT: RecipeDraft = {
  id: null,
  name: '',
  servingsText: '',
  cookedWeightText: '',
  items: [],
};

export function newDraftItem(item: Omit<DraftItem, 'key'>): DraftItem {
  return { ...item, key: uuid() };
}

/** Servings and cooked weight as numbers; anything not a positive number is left out. */
export function draftNumbers(draft: RecipeDraft): {
  servings: number | null;
  cookedWeightG: number | null;
} {
  const servings = parseAmount(draft.servingsText);
  const cooked = parseAmount(draft.cookedWeightText);
  return {
    servings: servings !== null && servings > 0 ? servings : null,
    cookedWeightG: cooked !== null && cooked > 0 ? cooked : null,
  };
}

/** What the recipe maths needs from the draft (1 serving until servings are typed). */
export function draftAmounts(draft: RecipeDraft): RecipeAmounts {
  const { servings, cookedWeightG } = draftNumbers(draft);
  return {
    servings: servings ?? 1,
    cookedWeightG,
    ingredients: draft.items.map((i) => ({
      grams: i.grams,
      nutrients: i.food.nutrients,
      isFat: i.isFat,
    })),
  };
}

/** The draft ready to save, or `null` while it still needs a name, servings or an ingredient. */
export function draftToInput(draft: RecipeDraft, servingLabel: string): RecipeInput | null {
  const { servings, cookedWeightG } = draftNumbers(draft);
  const name = draft.name.trim();
  if (!name || servings === null || draft.items.length === 0) return null;
  return {
    name,
    servings,
    cookedWeightG,
    servingLabel,
    items: draft.items.map((i): RecipeItemInput => ({
      foodSource: i.food.foodSource,
      foodId: i.food.foodId,
      name: i.food.name,
      qty: i.qty,
      unit: i.unit,
      grams: i.grams,
      isFat: i.isFat,
      nutrients: i.food.nutrients,
    })),
  };
}

/**
 * An ingredient whose food is gone (deleted since): a stand-in food from what the recipe saved,
 * so the recipe still adds up and the amount can still be changed in grams.
 */
function savedFood(item: RecipeItemInput): FoodDetail {
  const perUnit = item.qty > 0 ? item.grams / item.qty : item.grams;
  return {
    foodSource: item.foodSource,
    foodId: item.foodId,
    name: item.name,
    nameHi: null,
    brand: null,
    barcode: null,
    labelPhotoUri: null,
    offStatus: null,
    source: item.foodSource === 'custom' ? 'custom' : 'indb',
    densityGPerMl: 1,
    defaultUnit: item.unit,
    defaultQty: item.qty,
    energyEstimated: false,
    nutrients: item.nutrients ?? emptyNutrients(),
    oilStep: null,
    units: [
      ...(item.unit === 'g'
        ? []
        : [{ unit: item.unit, label: item.unit, grams: perUnit, isDefault: true }]),
      { unit: 'g', label: 'g', grams: 1, isDefault: item.unit === 'g' },
    ],
  };
}

/**
 * A saved recipe as a draft: to edit it, or — with `copyName` — as a new recipe to save under
 * another name (Duplicate). Ingredients use their food's current numbers. `null` if the recipe
 * doesn't exist.
 */
export async function loadRecipeDraft(
  id: string,
  copyName?: (name: string) => string,
): Promise<RecipeDraft | null> {
  const recipe = await getRecipe(id);
  if (!recipe) return null;
  const items = await Promise.all(
    recipe.items.map(async (item) => {
      const food = (await loadFoodDetail(item.foodSource, item.foodId)) ?? savedFood(item);
      // A unit the food no longer has: keep the amount, in grams.
      const hasUnit = food.units.some((u) => u.unit === item.unit);
      return newDraftItem({
        food,
        qty: hasUnit ? item.qty : Math.round(item.grams),
        unit: hasUnit ? item.unit : 'g',
        grams: item.grams,
        isFat: item.isFat,
      });
    }),
  );
  return {
    id: copyName ? null : recipe.id,
    name: copyName ? copyName(recipe.name) : recipe.name,
    servingsText: String(recipe.servings),
    cookedWeightText: recipe.cookedWeightG === null ? '' : String(recipe.cookedWeightG),
    items,
  };
}
