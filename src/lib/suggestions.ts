// Time-of-day suggestions and "usual amounts" (SPEC §5.9).
//
// For the meal slot being logged, each food eaten there in the last 30 days scores
// 0.9 ^ (days ago) per entry: often and recently beats once, long ago. The top 8 are shown,
// each with its usual amount so it can be logged in one tap.

import { parseDay } from './day';

export const SUGGESTION_DAYS = 30;
export const SUGGESTION_LIMIT = 8;
/** With fewer suggestions than this, starter foods fill the list. */
export const SUGGESTION_MINIMUM = 3;
const DECAY = 0.9;

export type FoodSourceKind = 'base' | 'custom';

/** An amount of a food: 1.5 katori = 225 g. */
export interface Portion {
  qty: number;
  unit: string;
  grams: number;
}

/** The parts of a log entry the suggestions look at. */
export interface HistoryEntry {
  foodSource: 'base' | 'custom' | 'quick';
  foodId: string | null;
  slotId: string;
  day: string;
  qty: number | null;
  unit: string | null;
  grams: number | null;
  createdAt: number;
}

export interface Suggestion {
  foodSource: FoodSourceKind;
  foodId: string;
  score: number;
  portion: Portion;
}

/** One key per food across both databases: "base:123", "custom:<uuid>". */
export function foodKey(foodSource: string, foodId: string): string {
  return `${foodSource}:${foodId}`;
}

/** Whole days from `from` to `to` ('YYYY-MM-DD'); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const { year, month, date } = parseDay(day);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

type FoodEntry = HistoryEntry & {
  foodSource: FoodSourceKind;
  foodId: string;
  qty: number;
  unit: string;
  grams: number;
};

/** Food entries with a full amount (not quick adds). */
function isFoodEntry(entry: HistoryEntry): entry is FoodEntry {
  return (
    entry.foodSource !== 'quick' &&
    entry.foodId !== null &&
    entry.qty !== null &&
    entry.unit !== null &&
    entry.grams !== null
  );
}

/**
 * The amount usually logged: the most common quantity + unit among the entries; on a tie,
 * the one used most recently. `null` if no entry has an amount.
 */
export function usualPortion(entries: readonly HistoryEntry[]): Portion | null {
  const groups = new Map<string, { count: number; latest: FoodEntry }>();
  for (const entry of entries) {
    if (!isFoodEntry(entry)) continue;
    const key = `${entry.unit}|${entry.qty}`;
    const group = groups.get(key);
    if (!group) groups.set(key, { count: 1, latest: entry });
    else {
      group.count += 1;
      if (entry.createdAt > group.latest.createdAt) group.latest = entry;
    }
  }
  let best: { count: number; latest: FoodEntry } | undefined;
  for (const group of groups.values()) {
    if (
      !best ||
      group.count > best.count ||
      (group.count === best.count && group.latest.createdAt > best.latest.createdAt)
    ) {
      best = group;
    }
  }
  return best ? { qty: best.latest.qty, unit: best.latest.unit, grams: best.latest.grams } : null;
}

/**
 * Foods most often logged in a slot lately (SPEC §5.9): score = Σ 0.9 ^ (days ago) over the
 * food's entries in that slot in the last 30 days. Highest score first; on a tie, the food
 * logged most recently. Each comes with its usual amount in that slot.
 */
export function rankSuggestions(
  entries: readonly HistoryEntry[],
  slotId: string,
  today: string,
  limit = SUGGESTION_LIMIT,
): Suggestion[] {
  const foods = new Map<string, { score: number; latest: number; entries: FoodEntry[] }>();
  for (const entry of entries) {
    if (!isFoodEntry(entry) || entry.slotId !== slotId) continue;
    const daysAgo = daysBetween(entry.day, today);
    if (daysAgo < 0 || daysAgo >= SUGGESTION_DAYS) continue;

    const key = foodKey(entry.foodSource, entry.foodId);
    const food = foods.get(key) ?? { score: 0, latest: 0, entries: [] };
    food.score += DECAY ** daysAgo;
    food.latest = Math.max(food.latest, entry.createdAt);
    food.entries.push(entry);
    foods.set(key, food);
  }

  return [...foods.values()]
    .sort((a, b) => b.score - a.score || b.latest - a.latest)
    .slice(0, limit)
    .map(({ score, entries: list }) => ({
      foodSource: list[0].foodSource,
      foodId: list[0].foodId,
      score,
      portion: usualPortion(list)!,
    }));
}

/**
 * Tops up a short list of suggestions with starter foods (SPEC §5.9: fewer than 3 → fill
 * from `slot_suggestions`), skipping foods already in the list, up to the limit.
 */
export function fillSuggestions<T extends { foodSource: string; foodId: string }>(
  ranked: readonly T[],
  starters: readonly T[],
  limit = SUGGESTION_LIMIT,
): T[] {
  if (ranked.length >= SUGGESTION_MINIMUM) return [...ranked];
  const seen = new Set(ranked.map((s) => foodKey(s.foodSource, s.foodId)));
  const result = [...ranked];
  for (const starter of starters) {
    if (result.length >= limit) break;
    const key = foodKey(starter.foodSource, starter.foodId);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(starter);
    }
  }
  return result;
}
