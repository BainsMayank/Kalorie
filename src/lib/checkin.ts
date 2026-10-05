// The weekly check-in on Today (SPEC §8.4): a look back at last week (Monday–Sunday) with days
// logged, the average against the target, the best day, and ONE simple suggestion drawn from what
// was eaten — the nutrient furthest below its need, with two everyday foods rich in it.
//
// Suggestions are only made from data that can be trusted: a nutrient most foods had no value
// for, or a week carried mostly by quick adds, could look low when it wasn't.

import { addDays } from './day';
import type { DayTotals, DayTrendTargets } from './history';
import {
  COVERAGE_THRESHOLD,
  fitsDiet,
  rankRichFoods,
  type Coverage,
  type DietPreference,
  type RichFood,
  type RichFoodCandidate,
} from './micros';
import { weekStart } from './streak';

/** The week a check-in looks back on: the Monday–Sunday before `today`'s week. */
export function reviewedWeek(today: string): { start: string; days: string[] } {
  const start = addDays(weekStart(today), -7);
  return { start, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}

/** A day with at least this many entries counts as a full day for "best day". */
export const FULL_DAY_ENTRIES = 3;

/**
 * The best day of a week. With a calorie target: the day closest to it. In Just-track mode: the
 * day with the most logged. Fuller days (3+ entries) are preferred, so a single snack can't be
 * "closest to target". Ties go to the later day. `null` when nothing was logged.
 */
export function bestDay(
  days: readonly string[],
  totals: ReadonlyMap<string, DayTotals>,
  targetsFor: (day: string) => Pick<DayTrendTargets, 'kcal'> | null,
): string | null {
  const logged = days.filter((d) => (totals.get(d)?.entryCount ?? 0) > 0);
  const full = logged.filter((d) => totals.get(d)!.entryCount >= FULL_DAY_ENTRIES);
  const pool = full.length > 0 ? full : logged;
  let best: { day: string; score: number } | null = null;
  for (const day of pool) {
    const { kcal, entryCount } = totals.get(day)!;
    const target = targetsFor(day)?.kcal ?? null;
    // Lower is better: distance from the target, or fewer entries without one.
    const score = target ? Math.abs(kcal - target) / target : -entryCount;
    if (best === null || score <= best.score) best = { day, score };
  }
  return best?.day ?? null;
}

/** The nutrients a suggestion can be about, in order of preference when two are equally low. */
export const SUGGESTION_NUTRIENTS = [
  'protein_g',
  'iron_mg',
  'calcium_mg',
  'fibre_g',
  'vit_b12_ug',
  'folate_ug',
  'vit_c_mg',
] as const;
export type SuggestionNutrient = (typeof SUGGESTION_NUTRIENTS)[number];

/** Below this share of the need (on average) a nutrient is worth a suggestion. */
export const LOW_SHARE = 0.75;
/** Fewer logged days than this and the week says too little for advice. */
export const MIN_ADVICE_DAYS = 3;
/** Quick adds carrying more than this share of the week's kcal hide what was really eaten. */
export const MAX_QUICK_KCAL_SHARE = 0.2;

/**
 * Whether a nutrient's weekly average can be trusted: at least 80% of the grams eaten have a
 * value for it (SPEC §5.10), and quick adds (no nutrient data) carry little of the week.
 */
export function isReliable(c: Pick<Coverage, 'share'>, quickKcalShare: number): boolean {
  return c.share >= COVERAGE_THRESHOLD && quickKcalShare <= MAX_QUICK_KCAL_SHARE;
}

/** A nutrient's average over the logged days, as a share of the need (0.5 = half). */
export interface NutrientAverage {
  nutrient: SuggestionNutrient;
  /** `null` = no need to compare to, or no data. */
  share: number | null;
  reliable: boolean;
}

export type CheckinSuggestion =
  /** "Iron averaged 48% of your need. Two easy adds: …" */
  | { kind: 'nutrient'; nutrient: SuggestionNutrient; share: number }
  /** "Water averaged 5 of 8 glasses a day." */
  | { kind: 'water'; averageMl: number; goalMl: number }
  /** Too few days logged to say more: "Logging a few more days shows the pattern." */
  | { kind: 'logMore' }
  /** Nothing stands out. */
  | { kind: 'keepGoing' };

/**
 * The ONE suggestion for the week: the trusted nutrient furthest below its need (under 75%),
 * else water if it averaged under 75% of the goal on the days it was logged, else a plain
 * "keep going". Fewer than 3 logged days → a gentle nudge to log a few more days instead.
 */
export function pickSuggestion(input: {
  loggedDays: number;
  nutrients: readonly NutrientAverage[];
  /** `averageMl` is `null` when no water was logged all week (maybe not tracked at all). */
  water: { averageMl: number | null; goalMl: number };
}): CheckinSuggestion {
  if (input.loggedDays < MIN_ADVICE_DAYS) return { kind: 'logMore' };

  let lowest: { nutrient: SuggestionNutrient; share: number } | null = null;
  for (const nutrient of SUGGESTION_NUTRIENTS) {
    const found = input.nutrients.find((n) => n.nutrient === nutrient);
    if (!found || !found.reliable || found.share === null || found.share >= LOW_SHARE) continue;
    if (lowest === null || found.share < lowest.share) lowest = { nutrient, share: found.share };
  }
  if (lowest) return { kind: 'nutrient', ...lowest };

  const { averageMl, goalMl } = input.water;
  if (averageMl !== null && goalMl > 0 && averageMl < LOW_SHARE * goalMl) {
    return { kind: 'water', averageMl, goalMl };
  }
  return { kind: 'keepGoing' };
}

/**
 * Two everyday foods rich in a nutrient to try, matching what the person eats. Foods already
 * eaten that week come last, so the ideas are new ones when possible.
 */
export function foodIdeas<T extends RichFoodCandidate>(
  candidates: readonly T[],
  nutrient: SuggestionNutrient,
  diet: DietPreference,
  eatenFoodIds: ReadonlySet<number>,
  count = 2,
): RichFood<T>[] {
  // Ranked by amount, foods that fit the diet first; within each, foods not eaten yet first.
  const ranked = rankRichFoods(candidates, nutrient, diet, candidates.length);
  const order = (r: RichFood<T>) =>
    (fitsDiet(r.food.diet, diet) ? 0 : 2) + (eatenFoodIds.has(r.food.foodId) ? 1 : 0);
  return ranked
    .map((r, i) => ({ r, i }))
    .sort((a, b) => order(a.r) - order(b.r) || a.i - b.i)
    .slice(0, count)
    .map(({ r }) => r);
}

/** Which encouraging line fits the week: every day, most days, or a few. */
export function encouragement(loggedDays: number): 'every' | 'most' | 'some' {
  if (loggedDays >= 7) return 'every';
  if (loggedDays >= 4) return 'most';
  return 'some';
}
