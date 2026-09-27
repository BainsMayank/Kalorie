// Duplicate foods across sources (SPEC §1: merge, priority INDB → IFCT → USDA).
// Only exact matches are automatic: two foods are duplicates when they are the same kind (dish or
// ingredient) and their names contain the same words, ignoring order and filler words
// ("Spinach" = "Spinach, raw"; "Oil, coconut" = "Coconut oil"). INDB's "Rice flakes" is a
// prepared bowl, so it never swallows IFCT's raw rice flakes. Anything fuzzier is decided by hand
// in data/curated/duplicates.csv.

import { normalizeText } from '../../src/lib/search';
import type { DuplicateDecision } from './curated';
import { type FoodRecord, SOURCE_RANK, refOf } from './types';

const FILLER_WORDS = new Set(['raw', 'fresh', 'and', 'with', 'of', 'the', 'plain']);

/** The comparison key for a name: its words, minus filler words, sorted. */
export function dedupeKey(name: string): string {
  const words = normalizeText(name)
    .split(' ')
    .filter((w) => w && !FILLER_WORDS.has(w));
  return [...new Set(words)].sort().join(' ');
}

export interface DedupeResult {
  kept: FoodRecord[];
  dropped: { dropped: FoodRecord; keptRef: string; reason: 'same name' | 'duplicates.csv' }[];
}

/**
 * Removes lower-priority duplicates. Foods from the same source are never merged with each other
 * (they have different codes on purpose), and USDA Foundation beats SR Legacy.
 */
export function dedupe(foods: FoodRecord[], decisions: DuplicateDecision[]): DedupeResult {
  const pairKey = (a: string, b: string) => [a, b].sort().join(' ~ ');
  const keepBoth = new Set(
    decisions.filter((d) => d.action === 'keep_both').map((d) => pairKey(d.refA, d.refB)),
  );
  const manualDrops = new Map(
    decisions.filter((d) => d.action === 'drop').map((d) => [d.refB, d.refA]),
  );

  // Highest priority first, so the first food with a key is the one we keep.
  const order = (f: FoodRecord) => SOURCE_RANK[f.source] * 10 + (f.source === 'usda_sr' ? 1 : 0);
  const sorted = [...foods].sort((a, b) => order(a) - order(b));

  const firstByKey = new Map<string, FoodRecord>();
  const result: DedupeResult = { kept: [], dropped: [] };
  for (const food of sorted) {
    const ref = refOf(food);
    const manualKeeper = manualDrops.get(ref);
    if (manualKeeper) {
      result.dropped.push({ dropped: food, keptRef: manualKeeper, reason: 'duplicates.csv' });
      continue;
    }
    const key = `${food.kind}|${dedupeKey(food.name)}`;
    const first = firstByKey.get(key);
    if (first && first.source !== food.source && !keepBoth.has(pairKey(refOf(first), ref))) {
      result.dropped.push({ dropped: food, keptRef: refOf(first), reason: 'same name' });
      continue;
    }
    if (!first) firstByKey.set(key, food);
    result.kept.push(food);
  }
  return result;
}
