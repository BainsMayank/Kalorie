// Food search against foods.db (SPEC §5.1). The rules (normalising, ranking, typos) are pure
// functions in src/lib/search.ts; this file only runs the SQL.

import {
  correctedQueries,
  ftsQuery,
  normalizeText,
  phoneticText,
  queryWords,
  rankFoods,
  typoCorrections,
  type RankCandidate,
} from '@/lib/search';

import type { FoodSearchResult, FoodSource, ReadDb } from './types';

/** Most results shown (SPEC §5.1 step 5). */
export const SEARCH_LIMIT = 50;
/** Candidates read from the index before ranking. Short names first, so exact names are kept. */
const CANDIDATE_LIMIT = 500;
/** Fewer results than this starts the typo pass (SPEC §5.1 step 3). */
const TYPO_PASS_BELOW = 5;
/** Shortest query that is searched (one letter matches almost everything). */
export const MIN_QUERY_LENGTH = 2;

interface CandidateRow {
  id: number;
  name: string;
  name_hi: string | null;
  source: FoodSource;
  search_rank: number;
  search_text?: string;
}

const toCandidate = (row: CandidateRow): RankCandidate => ({
  id: row.id,
  name: row.name,
  nameHi: row.name_hi,
  searchRank: row.search_rank,
  headFirst: row.source !== 'indb',
  searchText: row.search_text,
});

async function ftsCandidates(db: ReadDb, match: string): Promise<RankCandidate[]> {
  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT f.id, f.name, f.name_hi, f.source, f.search_rank, foods_fts.text AS search_text
       FROM foods_fts JOIN foods f ON f.id = foods_fts.food_id
      WHERE foods_fts MATCH ?
      ORDER BY length(f.name)
      LIMIT ${CANDIDATE_LIMIT}`,
    [match],
  );
  return rows.map(toCandidate);
}

/** The hand-picked best foods for this exact query (data/curated/search_pins.csv). */
async function pinnedCandidates(db: ReadDb, query: string): Promise<RankCandidate[]> {
  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT f.id, f.name, f.name_hi, f.source, f.search_rank
       FROM search_pins p JOIN foods f ON f.id = p.food_id
      WHERE p.term = ?`,
    [phoneticText(query)],
  );
  return rows.map(toCandidate);
}

// Every word in the search index with the number of foods that use it, for typo correction.
// Read once per database connection (about 20,000 words).
const vocabularies = new WeakMap<ReadDb, Promise<Map<string, number>>>();

function vocabulary(db: ReadDb): Promise<Map<string, number>> {
  let words = vocabularies.get(db);
  if (!words) {
    words = db.getAllAsync<{ text: string }>('SELECT text FROM foods_fts', []).then((rows) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        for (const word of new Set(row.text.split(' '))) {
          counts.set(word, (counts.get(word) ?? 0) + 1);
        }
      }
      return counts;
    });
    vocabularies.set(db, words);
  }
  return words;
}

interface DetailRow {
  id: number;
  name: string;
  name_hi: string | null;
  source: FoodSource;
  default_qty: number;
  default_unit: string;
  unit_label: string | null;
  unit_grams: number | null;
  unit_ml: number | null;
  density_g_per_ml: number;
  energy_kcal: number | null;
}

/** Name, source, usual portion and kcal for the foods to show, in the given order. */
async function resultRows(
  db: ReadDb,
  ranked: readonly { id: number; tier: number; uses: number }[],
): Promise<FoodSearchResult[]> {
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.id);
  const rows = await db.getAllAsync<DetailRow>(
    `SELECT f.id, f.name, f.name_hi, f.source, f.default_qty, f.default_unit,
            f.density_g_per_ml, f.energy_kcal,
            coalesce(u.label, d.label) AS unit_label,
            coalesce(u.grams, d.grams) AS unit_grams,
            d.ml AS unit_ml
       FROM foods f
       LEFT JOIN food_units u ON u.food_id = f.id AND u.unit = f.default_unit
       LEFT JOIN unit_defaults d ON d.unit = f.default_unit
      WHERE f.id IN (${ids.map(() => '?').join(', ')})`,
    [...ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ranked.flatMap(({ id, tier, uses }) => {
    const r = byId.get(id);
    if (!r) return [];
    const gramsPerUnit =
      r.unit_grams ?? (r.unit_ml !== null ? r.unit_ml * r.density_g_per_ml : null);
    return [
      {
        id: r.id,
        name: r.name,
        nameHi: r.name_hi,
        source: r.source,
        defaultQty: r.default_qty,
        defaultUnit: r.default_unit,
        defaultUnitLabel: r.unit_label ?? r.default_unit,
        defaultGrams: gramsPerUnit === null ? null : r.default_qty * gramsPerUnit,
        energyKcalPer100g: r.energy_kcal,
        tier,
        uses,
      },
    ];
  });
}

/**
 * Searches foods by name, Hindi name, synonyms and sound-alike spellings, forgiving small typos
 * (SPEC §5.1). Returns at most `SEARCH_LIMIT` results, best first. `uses` = food id → times the
 * person logged it in the last 30 days (those come first on the same match).
 */
export async function searchFoods(
  db: ReadDb,
  query: string,
  uses?: ReadonlyMap<number, number>,
): Promise<FoodSearchResult[]> {
  const words = queryWords(query);
  if (normalizeText(query).length < MIN_QUERY_LENGTH) return [];

  const [found, pinned] = await Promise.all([
    ftsCandidates(db, ftsQuery(words)),
    pinnedCandidates(db, query),
  ]);
  const candidates = new Map<number, RankCandidate>();
  for (const food of [...pinned, ...found]) candidates.set(food.id, food);

  // Typo pass: also accept index words a typo or two away ("panner" → "panir").
  const typoIds = new Set<number>();
  let typoQueries: string[][] = [];
  if (candidates.size < TYPO_PASS_BELOW) {
    const vocab = await vocabulary(db);
    const corrections = words.map((w) => typoCorrections(w, vocab));
    if (corrections.some((c) => c.length > 0)) {
      typoQueries = correctedQueries(words, corrections);
      for (const food of await ftsCandidates(db, ftsQuery(words, corrections))) {
        if (!candidates.has(food.id)) {
          candidates.set(food.id, food);
          typoIds.add(food.id);
        }
      }
    }
  }

  const ranked = rankFoods([...candidates.values()], words, {
    pinnedIds: new Set(pinned.map((p) => p.id)),
    typoIds,
    typoQueries,
    uses,
  });
  return resultRows(
    db,
    ranked.slice(0, SEARCH_LIMIT).map((r) => ({ id: r.food.id, tier: r.tier, uses: r.uses })),
  );
}
