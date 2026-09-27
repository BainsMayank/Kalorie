// Matching for the hand-kept rules in data/curated/ (unit_weights.csv, densities.csv,
// synonyms.csv). A rule matches whole words in a food's name, so "tea" matches "Iced tea" but not
// "Steamed".

import { normalizeText } from '../../src/lib/search';

/** Splits a "a|b|c" cell into trimmed values. Empty cell → empty list. */
export function splitList(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Like `splitList`, but also normalises each phrase so it can be matched against food names. */
export function splitPhrases(cell: string | undefined): string[] {
  return splitList(cell)
    .map((p) => normalizeText(p))
    .filter(Boolean);
}

/**
 * True if `phrase` appears in `normalizedName` as whole words. The last word may carry a
 * plural ending, so "banana" matches "bananas raw" and "tomato" matches "tomatoes".
 */
export function containsPhrase(normalizedName: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escaped}(s|es)?( |$)`).test(normalizedName);
}

export interface Rule {
  match: string[];
  categories: string[];
  exclude: string[];
}

/** Does a rule apply to a food with this (normalised) name and category? */
export function ruleMatches(rule: Rule, normalizedName: string, category: string): boolean {
  if (rule.categories.length > 0 && !rule.categories.includes(category)) return false;
  if (!rule.match.some((p) => containsPhrase(normalizedName, p))) return false;
  return !rule.exclude.some((p) => containsPhrase(normalizedName, p));
}
