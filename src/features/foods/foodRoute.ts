import type { FoodSourceKind } from '@/lib/suggestions';

/**
 * The food screen for a food (`app/food/[id].tsx`). `slot` = the meal it would be logged to.
 * Foods in user.db (recipes, products) carry `source: 'custom'`. `log` opens the *Add to log*
 * sheet straight away (from Add food: + Add → tap a food → Log, SPEC §2.3, §8.2).
 */
export function foodRoute(
  foodSource: FoodSourceKind,
  foodId: string,
  slot?: string,
  options: { log?: boolean } = {},
) {
  return {
    pathname: '/food/[id]' as const,
    params: {
      id: foodId,
      ...(foodSource === 'custom' ? { source: 'custom' } : {}),
      ...(slot ? { slot } : {}),
      ...(options.log ? { log: '1' } : {}),
    },
  };
}
