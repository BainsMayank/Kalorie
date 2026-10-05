// Vitamins, minerals and the "other" nutrients for a day or an average over days (SPEC §2.12,
// §5.10): each one's total, its share of the day's need or limit, how much of what was eaten has
// data for it, and the everyday foods richest in it.
//
// Unknown is never zero. When foods eaten have no value for a nutrient, the total is only what
// the other foods gave, so it's marked as incomplete ("≈") instead of looking like too little.

import type { Requirement } from './targets/icmr';
import { NUTRIENTS, type NutrientKey, type NutrientValues } from './nutrients';

export type MicroGroup = 'vitamin' | 'mineral' | 'other';

/** The nutrients on the Nutrients screen, by group, in SPEC §3 order. */
export const MICRO_GROUPS: readonly { group: MicroGroup; nutrients: readonly NutrientKey[] }[] = (
  ['vitamin', 'mineral', 'other'] as const
).map((group) => ({
  group,
  nutrients: NUTRIENTS.filter((n) => n.group === group).map((n) => n.key),
}));

/** A nutrient's coverage below this share of the grams eaten counts as incomplete (SPEC §5.10). */
export const COVERAGE_THRESHOLD = 0.8;

/** One log entry, as the sums need it. */
export interface MicroEntry {
  entryId: string;
  /** The same food logged more than once counts as one food: "base:123". */
  foodKey: string;
  name: string;
  /** Grams eaten; `null` for a quick add (it has no vitamin or mineral data at all). */
  grams: number | null;
  nutrients: NutrientValues;
}

/** How much of what was eaten has data for one nutrient. */
export interface Coverage {
  /** Share (0–1) of the grams eaten whose food has a value; 1 when nothing with grams was eaten. */
  share: number;
  /** Foods eaten (the same food twice counts once; each quick add is its own). */
  foods: number;
  /** Those with a value for this nutrient ("based on 3 of 5 foods"). */
  knownFoods: number;
  /** Quick adds among them: they never have vitamin or mineral data. */
  quickAdds: number;
  /** Names of the foods with no value, in the order they were eaten. */
  missing: string[];
}

function foodIdOf(entry: MicroEntry): string {
  return entry.grams === null ? `quick:${entry.entryId}` : entry.foodKey;
}

/**
 * Coverage (SPEC §5.10): the grams whose food has a value ÷ all the grams eaten, and the same
 * counted in foods. A quick add has no grams, so it can't be weighed, but it counts as a food
 * with no data.
 */
export function coverage(entries: readonly MicroEntry[], nutrient: NutrientKey): Coverage {
  let knownGrams = 0;
  let totalGrams = 0;
  let quickAdds = 0;
  const foods = new Map<string, { name: string; known: boolean }>();
  for (const entry of entries) {
    const known = entry.nutrients[nutrient] !== null;
    if (entry.grams === null) quickAdds += 1;
    else {
      totalGrams += entry.grams;
      if (known) knownGrams += entry.grams;
    }
    const id = foodIdOf(entry);
    const found = foods.get(id);
    // A food counts as known if any of its entries has the value (they all should).
    if (!found) foods.set(id, { name: entry.name, known });
    else found.known ||= known;
  }
  const list = [...foods.values()];
  return {
    share: totalGrams > 0 ? knownGrams / totalGrams : 1,
    foods: list.length,
    knownFoods: list.filter((f) => f.known).length,
    quickAdds,
    missing: list.filter((f) => !f.known).map((f) => f.name),
  };
}

/**
 * Incomplete = less than 80% of the grams have data, or there are quick adds (their vitamins and
 * minerals are unknown, however many calories they hold).
 */
export function isIncomplete(c: Coverage): boolean {
  return c.share < COVERAGE_THRESHOLD || c.quickAdds > 0;
}

/** Eaten as a share of a need or a limit (0.41 = 41%); `null` when there is nothing to compare to. */
export function shareOf(total: number | null, amount: number | null): number | null {
  if (total === null || amount === null || amount <= 0) return null;
  return total / amount;
}

/**
 * What a nutrient's bar is measured against. A need (RDA or adequate intake, the fibre target) is
 * something to reach; a limit (sodium, sugar, saturated fat) is something to stay under.
 */
export type MicroGoal = { kind: 'need' | 'limit'; amount: number };

/** The day's targets that the "other" nutrients use (SPEC §4.2 `targets`). */
export interface MicroTargets {
  fibre_g: number | null;
  sodium_mg_limit: number;
  sugar_g_limit: number;
  sat_fat_g_limit: number;
}

/**
 * Each nutrient's goal and safe upper level. Vitamins and minerals use ICMR-NIN (`reqs`, `null`
 * under 18); fibre, sodium, sugar and saturated fat use the person's own targets and limits, so
 * the numbers match Goals and the limit card. Magnesium's upper level is for supplements only
 * (ICMR-NIN p. 17), so food is never held against it.
 */
export function microGoals(
  reqs: Partial<Record<NutrientKey, Requirement>> | null,
  targets: MicroTargets | null,
): Partial<Record<NutrientKey, { goal: MicroGoal | null; tul: number | null }>> {
  const result: Partial<Record<NutrientKey, { goal: MicroGoal | null; tul: number | null }>> = {};
  for (const { nutrients } of MICRO_GROUPS) {
    for (const key of nutrients) {
      const req = reqs?.[key];
      const need = req?.need ?? null;
      result[key] = {
        goal: need === null ? null : { kind: 'need', amount: need },
        tul: key === 'magnesium_mg' ? null : (req?.tul ?? null),
      };
    }
  }
  const limit = (amount: number | undefined) =>
    amount === undefined ? null : ({ kind: 'limit', amount } as const);
  result.fibre_g = {
    goal: targets?.fibre_g ? { kind: 'need', amount: targets.fibre_g } : null,
    tul: null,
  };
  // Sodium's 2000 mg is a limit (ICMR-NIN p. 6), edited in Goals, not a need.
  result.sodium_mg = { goal: limit(targets?.sodium_mg_limit), tul: null };
  result.sugar_g = { goal: limit(targets?.sugar_g_limit), tul: null };
  result.sat_fat_g = { goal: limit(targets?.sat_fat_g_limit), tul: null };
  return result;
}

/** One row on the Nutrients screen. */
export interface MicroRow {
  nutrient: NutrientKey;
  /**
   * Amount a day (the average over the counted days); `null` = nothing eaten had a value. When
   * `incomplete`, it is only what the foods with data gave: the real amount is at least this.
   */
  total: number | null;
  goal: MicroGoal | null;
  /** total ÷ goal (0.41 = 41%), not capped; `null` without a goal, or when nothing had data. */
  share: number | null;
  coverage: Coverage;
  /** Shown with "≈" and "based on X of Y foods". */
  incomplete: boolean;
  /** Above the safe upper level (a calm note, SPEC §6 rule 5). */
  aboveTul: boolean;
  tul: number | null;
}

/**
 * Every row for a day or a period. `dayCount` = the days the entries come from (logged days
 * only, SPEC §5.10), so totals are an average a day; 1 for a single day.
 */
export function microRows(
  entries: readonly MicroEntry[],
  goals: ReturnType<typeof microGoals>,
  dayCount = 1,
): Record<MicroGroup, MicroRow[]> {
  const days = Math.max(1, dayCount);
  const rowFor = (nutrient: NutrientKey): MicroRow => {
    let total: number | null = null;
    for (const entry of entries) {
      const value = entry.nutrients[nutrient];
      if (value !== null) total = (total ?? 0) + value;
    }
    if (total !== null) total /= days;
    const { goal = null, tul = null } = goals[nutrient] ?? {};
    const cov = coverage(entries, nutrient);
    return {
      nutrient,
      total,
      goal,
      share: shareOf(total, goal?.amount ?? null),
      coverage: cov,
      incomplete: entries.length > 0 && isIncomplete(cov),
      aboveTul: tul !== null && total !== null && total > tul,
      tul,
    };
  };
  const result = {} as Record<MicroGroup, MicroRow[]>;
  for (const { group, nutrients } of MICRO_GROUPS) result[group] = nutrients.map(rowFor);
  return result;
}

// --- Foods rich in a nutrient -----------------------------------------------------------------

export type Diet = 'veg' | 'egg' | 'nonveg';

/** "I eat": everything, vegetarian, or vegetarian + eggs (Profile). Changes the order only. */
export type DietPreference = 'any' | 'veg' | 'egg';

export const DIET_PREFERENCES: readonly DietPreference[] = ['any', 'veg', 'egg'];

/** An everyday food with an everyday portion (foods.db `common_foods`). */
export interface RichFoodCandidate {
  foodId: number;
  name: string;
  diet: Diet;
  qty: number;
  unit: string;
  /** Grams in the portion. */
  grams: number;
  /** Per 100 g. */
  nutrients: NutrientValues;
}

export interface RichFood<T extends RichFoodCandidate = RichFoodCandidate> {
  food: T;
  /** How much of the nutrient one portion gives. */
  amount: number;
}

/** Whether a food fits what the person eats ("I eat" in Profile). */
export function fitsDiet(diet: Diet, preference: DietPreference): boolean {
  if (preference === 'veg') return diet === 'veg';
  if (preference === 'egg') return diet !== 'nonveg';
  return true;
}

/**
 * The foods whose everyday portion gives the most of a nutrient, most first. Foods with no value
 * or none of it are left out. Vegetarian (or vegetarian + eggs) foods come first when that's what
 * the person eats; the others only fill the list if there aren't enough. Ties go by name.
 */
export function rankRichFoods<T extends RichFoodCandidate>(
  candidates: readonly T[],
  nutrient: NutrientKey,
  preference: DietPreference = 'any',
  limit = 5,
): RichFood<T>[] {
  return candidates
    .flatMap((food) => {
      const per100 = food.nutrients[nutrient];
      if (per100 === null || per100 <= 0) return [];
      return [{ food, amount: (per100 * food.grams) / 100 }];
    })
    .sort(
      (a, b) =>
        Number(fitsDiet(b.food.diet, preference)) - Number(fitsDiet(a.food.diet, preference)) ||
        b.amount - a.amount ||
        a.food.name.localeCompare(b.food.name),
    )
    .slice(0, limit);
}

/** Whether a nutrient gets a "foods rich in it" list: only needs (not limits, not amount-only). */
export function hasRichFoods(row: Pick<MicroRow, 'goal'>): boolean {
  return row.goal?.kind === 'need';
}
