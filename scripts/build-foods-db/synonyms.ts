// Search synonyms per food (SPEC §4.1 food_synonyms) and the text that goes into the FTS5 index.

import { normalizeText, phoneticKey } from '../../src/lib/search';
import type { SynonymGroup } from './curated';
import { containsPhrase } from './rules';
import type { FoodRecord, SynonymKind } from './types';

export interface Synonym {
  term: string;
  kind: SynonymKind;
}

/**
 * All search terms for a food, except words already in its name:
 * - names that come with the source (IFCT Hindi/regional names, INDB's Hindi name)
 * - every term of a synonyms.csv group whose term appears in the food's English name
 */
export function synonymsFor(
  food: Pick<FoodRecord, 'nameHi' | 'sourceTerms'>,
  normalizedName: string,
  groups: readonly SynonymGroup[],
): Synonym[] {
  const result = new Map<string, Synonym>();
  const add = (raw: string, kind: SynonymKind) => {
    const term = normalizeText(raw);
    if (!term || term.length > 60 || containsPhrase(normalizedName, term)) return;
    if (!result.has(term)) result.set(term, { term, kind });
  };

  if (food.nameHi) add(food.nameHi, 'hindi');
  for (const t of food.sourceTerms) add(t.term, t.kind);
  for (const group of groups) {
    if (group.terms.some((t) => containsPhrase(normalizedName, normalizeText(t.term)))) {
      for (const t of group.terms) add(t.term, t.kind);
    }
  }
  return [...result.values()];
}

/**
 * The FTS5 `text` column: every distinct word of the name and synonyms, plus each word's
 * phonetic key (SPEC §5.1), so "daal" and "dal" find the same foods.
 */
export function searchText(normalizedName: string, synonyms: readonly Synonym[]): string {
  const words = new Set<string>();
  for (const text of [normalizedName, ...synonyms.map((s) => s.term)]) {
    for (const word of text.split(' ')) {
      if (!word) continue;
      words.add(word);
      words.add(phoneticKey(word));
    }
  }
  return [...words].join(' ');
}
