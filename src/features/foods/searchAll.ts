// Search across every food: foods.db (SPEC §5.1) and the foods in user.db — the person's own
// recipes and scanned products, and their group's shared foods — which rank first on the same
// match tier.

import {
  MIN_QUERY_LENGTH,
  SEARCH_LIMIT,
  getFoodsDb,
  searchFoods,
  type FoodSearchResult,
  type FoodTag,
} from '@/db/foods';
import { getLoggedCustomFoods, listCustomFoods } from '@/db/user/customFoods';
import { countFoodUsesSince } from '@/db/user/entries';
import { addDays, logicalDay } from '@/lib/day';
import { customFoodMatch, mergeByTier, normalizeText, queryWords } from '@/lib/search';
import { SUGGESTION_DAYS, foodKey, type FoodSourceKind } from '@/lib/suggestions';

/** One row in the search results, wherever the food lives. */
export interface SearchHit {
  /** "base:123" or "custom:<uuid>". */
  key: string;
  foodSource: FoodSourceKind;
  foodId: string;
  name: string;
  source: FoodTag;
  /** The usual portion, e.g. 1 katori. */
  defaultQty: number;
  /** Its unit without a number: "katori", "serving". */
  defaultUnitLabel: string;
  /** Grams in the usual portion, or null if unknown. */
  defaultGrams: number | null;
  energyKcalPer100g: number | null;
  tier: number;
  /** Times logged in the last 30 days: ranks it higher on the same match (SPEC §5.1). */
  uses: number;
  /** A group food: who in the group shared it (Stage 11c). */
  addedBy?: string;
}

function baseHit(food: FoodSearchResult): SearchHit {
  return {
    key: foodKey('base', String(food.id)),
    foodSource: 'base',
    foodId: String(food.id),
    name: food.name,
    source: food.source,
    defaultQty: food.defaultQty,
    defaultUnitLabel: food.defaultUnitLabel,
    defaultGrams: food.defaultGrams,
    energyKcalPer100g: food.energyKcalPer100g,
    tier: food.tier,
    uses: food.uses,
  };
}

/** The person's own foods whose name or brand matches, best first. */
async function searchCustomFoods(
  words: readonly string[],
  uses: ReadonlyMap<string, number>,
): Promise<SearchHit[]> {
  const matched = (await listCustomFoods(undefined, { withGroupFoods: true }))
    .flatMap((row) => {
      const match = customFoodMatch(words, row.name, row.brand);
      return match ? [{ row, ...match, uses: uses.get(foodKey('custom', row.id)) ?? 0 }] : [];
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.uses - a.uses ||
        a.extraWords - b.extraWords ||
        a.row.name.length - b.row.name.length ||
        a.row.name.localeCompare(b.row.name),
    );
  const foods = await getLoggedCustomFoods(matched.map((m) => m.row.id));
  return matched.flatMap(({ row, tier, uses: timesLogged }) => {
    const food = foods.get(row.id);
    if (!food) return [];
    const { qty, unit, grams } = food.defaultPortion;
    return [
      {
        key: foodKey('custom', row.id),
        foodSource: 'custom' as const,
        foodId: row.id,
        name: row.name,
        source: row.kind,
        defaultQty: qty,
        defaultUnitLabel: food.units[unit]?.label ?? unit,
        defaultGrams: grams,
        energyKcalPer100g: food.nutrients.energy_kcal,
        tier,
        uses: timesLogged,
        ...(row.sharedFoodId !== null && { addedBy: row.addedBy ?? '' }),
      },
    ];
  });
}

/**
 * Searches every food (SPEC §5.1 step 2), at most `SEARCH_LIMIT` results, best first. Foods the
 * person logged in the last 30 days come first on the same match.
 */
export async function searchAllFoods(query: string, now = Date.now()): Promise<SearchHit[]> {
  if (normalizeText(query).length < MIN_QUERY_LENGTH) return [];
  const uses = await countFoodUsesSince(addDays(logicalDay(now), -(SUGGESTION_DAYS - 1)));
  const baseUses = new Map<number, number>();
  for (const [key, n] of uses) {
    if (key.startsWith('base:')) baseUses.set(Number(key.slice('base:'.length)), n);
  }
  const [base, custom] = await Promise.all([
    getFoodsDb().then((db) => searchFoods(db, query, baseUses)),
    searchCustomFoods(queryWords(query), uses),
  ]);
  return mergeByTier(custom, base.map(baseHit)).slice(0, SEARCH_LIMIT);
}
