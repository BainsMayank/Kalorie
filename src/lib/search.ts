// Food search (SPEC §5.1): text normalising, the FTS query, ranking and typo correction.
// The same normalising builds the search index in foods.db and cleans what the user types, so
// both sides always match. Everything here is pure; src/db/foods/search.ts runs the queries.

/** Lowercase, drop accents and punctuation, single spaces: "Chapati/Roti (Phulka)" → "chapati roti phulka". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents: "éclair" → "eclair"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Sound-alike key for one word, so different Roman spellings of Hindi words meet:
 * "ee"→"i" and "oo"→"u" first (paneer → panir, moong → mung), then repeated letters collapse
 * (daal → dal, pappad → papad), then "w"→"v" and "ph"→"f".
 * The vowel rules run before collapsing, otherwise "ee" would already be "e" and never match.
 */
export function phoneticKey(word: string): string {
  return word
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/w/g, 'v')
    .replace(/ph/g, 'f');
}

/** Normalises text and returns the phonetic key of every word: "Daal Makhani" → "dal makhani". */
export function phoneticText(text: string): string {
  return normalizeText(text).split(' ').filter(Boolean).map(phoneticKey).join(' ');
}

// --- Query ------------------------------------------------------------------------------

/** The words of a search box text, normalised: "  Daal, Tadka " → ["daal", "tadka"]. */
export function queryWords(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean);
}

/**
 * The FTS5 MATCH text for the words (SPEC §5.1 step 2). Each word is searched as a prefix,
 * both as typed and as its phonetic key, because the index holds both:
 * ["daal", "tadka"] → `("daal"* OR "dal"*) AND "tadka"*`.
 * `corrections[i]` adds exact index words for word i (the typo pass):
 * ["panner"], [["panir"]] → `("panner"* OR "paner"* OR "panir")`.
 * Words only contain a–z and 0–9 after `normalizeText`, so quoting them is safe.
 */
export function ftsQuery(
  words: readonly string[],
  corrections: readonly (readonly string[] | undefined)[] = [],
): string {
  return words
    .map((word, i) => {
      const key = phoneticKey(word);
      const options = [`"${word}"*`];
      if (key && key !== word) options.push(`"${key}"*`);
      for (const fix of corrections[i] ?? []) options.push(`"${fix}"`);
      return options.length === 1 ? options[0] : `(${options.join(' OR ')})`;
    })
    .join(' AND ');
}

/**
 * Every query that can be made by swapping words for their corrections, without the original:
 * ["panner", "tika"], [["panir"], ["tikka", "tika"]] → [["panir","tika"], ["panir","tikka"], …].
 * At most `limit` queries, so a long query with many typos stays quick.
 */
export function correctedQueries(
  words: readonly string[],
  corrections: readonly (readonly string[] | undefined)[],
  limit = 27,
): string[][] {
  let queries: string[][] = [[]];
  words.forEach((word, i) => {
    const choices = [word, ...(corrections[i] ?? [])];
    queries = queries.flatMap((q) => choices.map((c) => [...q, c])).slice(0, limit);
  });
  return queries.filter((q) => q.some((w, i) => w !== words[i]));
}

// --- A food's own names -------------------------------------------------------------------

/**
 * Splits "a/b" name alternatives. INDB often swaps only one word ("Dal parantha/paratha"), so a
 * one-word part next to a longer part replaces that part's last (or first) word:
 * "Dal parantha/paratha" → ["dal parantha", "dal paratha"], "Chapati/Roti" → ["chapati", "roti"],
 * "Suji/Rava daliya" → ["suji daliya", "rava daliya"].
 */
export function nameAlternatives(text: string): string[] {
  const parts = text.split('/').map(normalizeText).filter(Boolean);
  return parts.map((part, i) => {
    if (part.includes(' ')) return part;
    const before = parts[i - 1];
    const after = parts[i + 1];
    if (before?.includes(' ')) return before.replace(/\S+$/, part);
    if (!before && after?.includes(' ')) return after.replace(/^\S+/, part);
    return part;
  });
}

/**
 * Every way the food's own names can be read, as normalised text: the full name and its "a/b"
 * alternatives, plus the Hindi name. When `headFirst` is true (IFCT and USDA names put the main
 * word first: "Okra, raw", "Yogurt, plain, whole milk") the part before the first comma or
 * bracket counts too ("okra", "yogurt"). INDB names don't work that way
 * ("Paneer, apple and pineapple salad"), so for them it is false.
 */
export function foodAliases(name: string, nameHi: string | null, headFirst: boolean): string[] {
  const result = new Set<string>();
  for (const text of [name, nameHi]) {
    if (!text) continue;
    const texts = headFirst ? [text, text.split(/[,(]/)[0]] : [text];
    for (const t of texts) {
      for (const alias of nameAlternatives(t)) if (alias) result.add(alias);
    }
  }
  return [...result];
}

// --- Ranking ------------------------------------------------------------------------------

/**
 * How well a food matches the query; lower is better (SPEC §5.1 step 4, "match type").
 * The last word may be unfinished while the user is typing, so "partial" tiers accept it as the
 * start of a word ("chapa" → "chapati"). A whole-word synonym ("chole" → "Chickpeas curry")
 * beats a half-typed word in the name ("chole" → "Cholesterol-free mayonnaise").
 */
export const MatchTier = {
  /** Hand-picked best food for this search (data/curated/search_pins.csv). */
  pinned: 0,
  /** One of the food's names is exactly the query ("roti" → "Chapati/Roti"). */
  exact: 1,
  /** A name starts with the query words ("dal" → "Dal makhani"). */
  startsWith: 2,
  /** A name has all the query words, in any place ("dal" → "Mixed dal"). */
  allWords: 3,
  /** All query words are whole words among the food's synonyms ("bhindi" → "Stuffed okra"). */
  synonym: 4,
  /** Like startsWith, but the last word is only begun ("dal" → "Dalma"). */
  startsWithPartial: 5,
  /** Like allWords, but the last word is only begun. */
  allWordsPartial: 6,
  /** Anything else the search index found (a synonym that only begins with the last word). */
  synonymPartial: 7,
} as const;

export type MatchTierValue = (typeof MatchTier)[keyof typeof MatchTier];

/** Added to the tier of foods found only after correcting a typo, so they come after the rest. */
export const TYPO_TIER_OFFSET = 10;

interface Word {
  text: string;
  key: string;
}

function toWords(text: string): Word[] {
  return text
    .split(' ')
    .filter(Boolean)
    .map((w) => ({ text: w, key: phoneticKey(w) }));
}

/** Same word, or the same sound, or a plural of it ("banana" = "bananas", "daal" = "dal"). */
function sameWord(query: Word, word: Word): boolean {
  for (const [q, w] of [
    [query.text, word.text],
    [query.key, word.key],
  ]) {
    if (w === q || w === `${q}s` || w === `${q}es`) return true;
  }
  return false;
}

function beginsWord(query: Word, word: Word): boolean {
  return word.text.startsWith(query.text) || word.key.startsWith(query.key);
}

/** The best tier the query words reach against one name (see `MatchTier`). */
function aliasTier(query: readonly Word[], alias: readonly Word[]): MatchTierValue | null {
  const last = query.length - 1;
  const leadingSame = query.slice(0, last).every((q, i) => alias[i] && sameWord(q, alias[i]));
  const lastAtEnd = alias[last];

  if (leadingSame && lastAtEnd && sameWord(query[last], lastAtEnd)) {
    return alias.length === query.length ? MatchTier.exact : MatchTier.startsWith;
  }
  const leadingAnywhere = query.slice(0, last).every((q) => alias.some((w) => sameWord(q, w)));
  if (leadingAnywhere && alias.some((w) => sameWord(query[last], w))) return MatchTier.allWords;
  if (leadingSame && lastAtEnd && beginsWord(query[last], lastAtEnd)) {
    return MatchTier.startsWithPartial;
  }
  if (leadingAnywhere && alias.some((w) => beginsWord(query[last], w))) {
    return MatchTier.allWordsPartial;
  }
  return null;
}

/** A search result candidate: just what ranking needs. */
export interface RankCandidate {
  id: number;
  name: string;
  nameHi: string | null;
  /** Source priority: 1 INDB, 2 IFCT, 3 USDA (0 will be the user's own foods). */
  searchRank: number;
  /** True if the name starts with its main word, then a comma (IFCT, USDA): see `foodAliases`. */
  headFirst: boolean;
  /** The food's words in the search index (name, synonyms, phonetic keys), if known. */
  searchText?: string;
}

export interface RankedFood<T extends RankCandidate> {
  food: T;
  tier: number;
  /** Words in the best-matching name that the query did not ask for. */
  extraWords: number;
}

/** The tier of one food for the query words, and how many extra words its best name has. */
export function matchFood(
  words: readonly string[],
  food: Pick<RankCandidate, 'name' | 'nameHi' | 'headFirst' | 'searchText'>,
): { tier: MatchTierValue; extraWords: number } {
  const query = words.map((w) => ({ text: w, key: phoneticKey(w) }));
  let best: { tier: MatchTierValue; extraWords: number } = {
    tier: MatchTier.synonymPartial,
    extraWords: toWords(normalizeText(food.name)).length,
  };
  if (query.length === 0) return best;
  if (food.searchText) {
    const indexWords = toWords(food.searchText);
    if (query.every((q) => indexWords.some((w) => sameWord(q, w)))) {
      best = { ...best, tier: MatchTier.synonym };
    }
  }
  for (const alias of foodAliases(food.name, food.nameHi, food.headFirst)) {
    const aliasWords = toWords(alias);
    const tier = aliasTier(query, aliasWords);
    if (tier === null) continue;
    const extraWords = Math.max(0, aliasWords.length - query.length);
    if (tier < best.tier || (tier === best.tier && extraWords < best.extraWords)) {
      best = { tier, extraWords };
    }
  }
  return best;
}

/**
 * Sorts search candidates (SPEC §5.1 step 4): match tier → source (Indian foods before USDA) →
 * fewer extra words → shorter name. `pinnedIds` go first. `typoIds` were found only after
 * correcting a typo: they are matched against each corrected query in `typoQueries` and come
 * after everything found without a correction.
 * Personal use ("logged recently first") is added in Stage 3, when there are log entries.
 */
export function rankFoods<T extends RankCandidate>(
  candidates: readonly T[],
  words: readonly string[],
  options: {
    pinnedIds?: ReadonlySet<number>;
    typoIds?: ReadonlySet<number>;
    typoQueries?: readonly (readonly string[])[];
  } = {},
): RankedFood<T>[] {
  const { pinnedIds, typoIds, typoQueries = [] } = options;
  const ranked = candidates.map((food) => {
    const isTypo = typoIds?.has(food.id) ?? false;
    let match = matchFood(words, food);
    if (isTypo) {
      for (const query of typoQueries) {
        const m = matchFood(query, food);
        if (m.tier < match.tier || (m.tier === match.tier && m.extraWords < match.extraWords)) {
          match = m;
        }
      }
    }
    let tier: number = match.tier;
    if (pinnedIds?.has(food.id)) tier = MatchTier.pinned;
    else if (isTypo) tier += TYPO_TIER_OFFSET;
    return { food, tier, extraWords: match.extraWords };
  });
  return ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.food.searchRank - b.food.searchRank ||
      a.extraWords - b.extraWords ||
      a.food.name.length - b.food.name.length ||
      a.food.name.localeCompare(b.food.name),
  );
}

// --- Typos ---------------------------------------------------------------------------------

/**
 * Edit distance (insert, delete, change one letter) between two words, stopping early once it
 * is sure to be more than `max` (then it returns `max + 1`).
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowBest = Math.min(rowBest, current[j]);
    }
    if (rowBest > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Typos allowed for a word (SPEC §5.1 step 3): 1 for words up to 5 letters, 2 for longer. */
export function allowedTypos(word: string): number {
  return word.length <= 5 ? 1 : 2;
}

/**
 * Index words that are within the allowed typos of `word` (or of its phonetic key), closest
 * first, then the most common. `vocabulary` maps each index word to how many foods use it.
 * Words the prefix search already finds (starting with the word or its key) are left out.
 * Words shorter than 3 letters are not corrected: too many short words look alike.
 */
export function typoCorrections(
  word: string,
  vocabulary: ReadonlyMap<string, number>,
  limit = 3,
): string[] {
  if (word.length < 3) return [];
  const key = phoneticKey(word);
  const max = allowedTypos(word);
  const found: { term: string; distance: number; count: number }[] = [];
  for (const [term, count] of vocabulary) {
    if (term.startsWith(word) || term.startsWith(key)) continue;
    const distance = Math.min(editDistance(word, term, max), editDistance(key, term, max));
    if (distance <= max) found.push({ term, distance, count });
  }
  return found
    .sort((a, b) => a.distance - b.distance || b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit)
    .map((f) => f.term);
}
