// Nutrients of a portion (SPEC §5.3). Foods store nutrients per 100 g; a portion's values are
// always worked out from its grams, never stored — and so are the totals of a meal or a day.

import { NUTRIENT_KEYS, emptyNutrients, type NutrientKey, type NutrientValues } from './nutrients';

/** Nutrients in `grams` of a food: grams / 100 × the per-100 g value. Unknown stays unknown. */
export function nutrientsForGrams(per100g: NutrientValues, grams: number): NutrientValues {
  const result = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key];
    result[key] = value === null ? null : (value * grams) / 100;
  }
  return result;
}

/** The parts of a log entry its nutrients are worked out from. */
export interface EntryAmount {
  /** Grams eaten; `null` for a quick add. */
  grams: number | null;
  quickKcal: number | null;
  quickProteinG: number | null;
  quickCarbG: number | null;
  quickFatG: number | null;
}

/**
 * Nutrients of one log entry (SPEC §5.3): grams / 100 × the food's per-100 g values.
 * A quick add has only the kcal / protein / carbs / fat that were typed in; everything else is
 * unknown. So is every nutrient when the food can't be found (`per100g` = null).
 */
export function entryNutrients(entry: EntryAmount, per100g: NutrientValues | null): NutrientValues {
  if (entry.grams !== null) {
    return per100g ? nutrientsForGrams(per100g, entry.grams) : emptyNutrients();
  }
  return {
    ...emptyNutrients(),
    energy_kcal: entry.quickKcal,
    protein_g: entry.quickProteinG,
    carb_g: entry.quickCarbG,
    fat_g: entry.quickFatG,
  };
}

/**
 * Adds up nutrients (a meal's or a day's total). Unknown values are left out of the sum; a
 * nutrient is unknown in the total only if it is unknown in every entry (or there are none).
 */
export function sumNutrients(list: readonly NutrientValues[]): NutrientValues {
  const total = emptyNutrients();
  for (const values of list) {
    for (const key of NUTRIENT_KEYS) {
      const value = values[key];
      if (value !== null) total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

// --- The day at a glance (Today screen, SPEC §2.2) ------------------------------------------

/** A day's targets. Until goals exist (Stage 5) they come from `placeholderTargets.ts`. */
export interface DayTargets {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

export type MacroKey = 'protein' | 'carbs' | 'fat';

/** The three macros, with the energy in one gram of each (4 / 4 / 9 kcal). */
export const MACROS = [
  { key: 'protein', nutrient: 'protein_g', kcalPerGram: 4 },
  { key: 'carbs', nutrient: 'carb_g', kcalPerGram: 4 },
  { key: 'fat', nutrient: 'fat_g', kcalPerGram: 9 },
] as const satisfies readonly { key: MacroKey; nutrient: NutrientKey; kcalPerGram: number }[];

/** How far along a target is. Nothing is ever negative. */
export interface Progress {
  eaten: number;
  target: number;
  /** What is still left of the target; 0 once it is reached. */
  left: number;
  /** How much more than planned; 0 until the target is passed. */
  over: number;
  /** Share of the target eaten, 0–1 (stops at 1: the ring or bar is full). */
  fraction: number;
  /** The part beyond the target as a share of it, 0–1 (the ring's thin outer arc). */
  overFraction: number;
}

/** Eaten vs target. A target of 0 or less counts as reached as soon as anything is eaten. */
export function progress(eaten: number, target: number): Progress {
  const e = Math.max(0, eaten);
  const t = Math.max(0, target);
  const over = Math.max(0, e - t);
  if (t === 0) {
    return { eaten: e, target: t, left: 0, over, fraction: e > 0 ? 1 : 0, overFraction: 0 };
  }
  return {
    eaten: e,
    target: t,
    left: Math.max(0, t - e),
    over,
    fraction: Math.min(1, e / t),
    overFraction: Math.min(1, over / t),
  };
}

/**
 * Each macro's share (0–1) of the energy from macros: protein and carbs 4 kcal per gram, fat 9.
 * Unknown grams count as none. `null` when there is nothing to share out (an empty day).
 */
export function macroKcalShares(totals: NutrientValues): Record<MacroKey, number> | null {
  const kcal = MACROS.map((m) => (totals[m.nutrient] ?? 0) * m.kcalPerGram);
  const sum = kcal.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  return { protein: kcal[0] / sum, carbs: kcal[1] / sum, fat: kcal[2] / sum };
}

/** One log entry, as the Today screen's sums need it. */
export interface DayEntry {
  entryId: string;
  /** `base`, `custom` or `quick`. */
  foodSource: string;
  /** NULL for a quick add. */
  foodId: string | null;
  name: string;
  nutrients: NutrientValues;
}

/** A food's part of the day's total for one nutrient. */
export interface Contributor {
  /** The same food logged more than once counts as one: `base:123`. Each quick add is its own. */
  foodKey: string;
  name: string;
  /** How much of the nutrient this food gave (grams for macros). */
  amount: number;
  /** Its share (0–1) of the day's total. */
  share: number;
  /** The entry that gave the most, opened when the food is tapped. */
  entryId: string;
}

function foodKeyOf(entry: DayEntry): string {
  return entry.foodSource === 'quick' || entry.foodId === null
    ? `quick:${entry.entryId}`
    : `${entry.foodSource}:${entry.foodId}`;
}

/**
 * The foods that gave the most of a nutrient (SPEC §2.2 "Top 3 foods"), biggest first.
 * Entries of the same food are added together. Foods that gave none, or whose value is
 * unknown, are left out. Ties go in name order so the list doesn't jump around.
 */
export function topContributors(
  entries: readonly DayEntry[],
  nutrient: NutrientKey,
  limit = 3,
): Contributor[] {
  const byFood = new Map<string, Contributor & { biggest: number }>();
  let total = 0;
  for (const entry of entries) {
    const amount = entry.nutrients[nutrient];
    if (amount === null || amount <= 0) continue;
    total += amount;
    const key = foodKeyOf(entry);
    const found = byFood.get(key);
    if (!found) {
      byFood.set(key, {
        foodKey: key,
        name: entry.name,
        amount,
        share: 0,
        entryId: entry.entryId,
        biggest: amount,
      });
    } else {
      found.amount += amount;
      if (amount > found.biggest) {
        found.biggest = amount;
        found.entryId = entry.entryId;
      }
    }
  }
  return [...byFood.values()]
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ foodKey, name, amount, entryId }) => ({
      foodKey,
      name,
      amount,
      share: amount / total,
      entryId,
    }));
}

/** One macro on the Today screen: grams vs target, share of the pie, top foods. */
export interface MacroSummary {
  key: MacroKey;
  nutrient: NutrientKey;
  grams: Progress;
  /** Share (0–1) of the energy from macros; `null` on an empty day. */
  kcalShare: number | null;
  top: Contributor[];
}

export interface DaySummary {
  /** True when the day has no entries. */
  isEmpty: boolean;
  totals: NutrientValues;
  kcal: Progress;
  macros: MacroSummary[];
}

/** Everything the Today screen shows about a day, worked out from its entries and targets. */
export function daySummary(entries: readonly DayEntry[], targets: DayTargets): DaySummary {
  const totals = sumNutrients(entries.map((e) => e.nutrients));
  const shares = macroKcalShares(totals);
  return {
    isEmpty: entries.length === 0,
    totals,
    kcal: progress(totals.energy_kcal ?? 0, targets.kcal),
    macros: MACROS.map((m) => ({
      key: m.key,
      nutrient: m.nutrient,
      grams: progress(totals[m.nutrient] ?? 0, targets[m.nutrient]),
      kcalShare: shares?.[m.key] ?? null,
      top: topContributors(entries, m.nutrient),
    })),
  };
}
