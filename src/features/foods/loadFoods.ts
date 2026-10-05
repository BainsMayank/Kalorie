// Reading a food from wherever it lives: foods.db (`base`) or user.db (`custom`: barcode
// products and the person's own recipes).

import {
  getFoodDetail,
  getFoodsDb,
  getLoggedFoods,
  type FoodDetail,
  type LoggedFood,
} from '@/db/foods';
import { getCustomFoodDetail, getLoggedCustomFoods } from '@/db/user/customFoods';
import { foodKey, type FoodSourceKind } from '@/lib/suggestions';

/** A food, or `null` if there is no such food. */
export async function loadFoodDetail(
  foodSource: FoodSourceKind,
  foodId: string,
): Promise<FoodDetail | null> {
  if (foodSource === 'custom') return getCustomFoodDetail(foodId);
  const id = Number(foodId);
  return Number.isSafeInteger(id) ? getFoodDetail(await getFoodsDb(), id) : null;
}

/**
 * Several foods at once, keyed by food key ("base:123", "custom:<uuid>"). Foods that no longer
 * exist are left out. foods.db is only opened when a foods.db food is asked for.
 */
export async function loadLoggedFoods(
  refs: readonly { foodSource: string; foodId: string | null }[],
): Promise<Map<string, LoggedFood>> {
  const baseIds: number[] = [];
  const customIds: string[] = [];
  for (const { foodSource, foodId } of refs) {
    if (foodId === null) continue;
    if (foodSource === 'base') baseIds.push(Number(foodId));
    else if (foodSource === 'custom') customIds.push(foodId);
  }

  const result = new Map<string, LoggedFood>();
  if (baseIds.length > 0) {
    for (const [id, food] of await getLoggedFoods(await getFoodsDb(), baseIds)) {
      result.set(foodKey('base', String(id)), food);
    }
  }
  for (const [id, food] of await getLoggedCustomFoods(customIds)) {
    result.set(foodKey('custom', id), food);
  }
  return result;
}
