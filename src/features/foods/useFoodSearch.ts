import { useEffect, useState } from 'react';

import { MIN_QUERY_LENGTH } from '@/db/foods';
import { normalizeText } from '@/lib/search';
import { useMyFoodsStore } from '@/stores/myFoods';

import { searchAllFoods, type SearchHit } from './searchAll';

/** Wait this long after the last key press before searching, so fast typing stays smooth. */
export const SEARCH_DEBOUNCE_MS = 150;

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

interface SearchState {
  /** The query the results belong to. */
  query: string;
  results: SearchHit[];
  status: SearchStatus;
}

/**
 * Searches foods.db and the person's own foods as the user types. Results for the previous query
 * stay on screen until the new ones arrive, so the list doesn't flicker. Answers for an older
 * query are ignored.
 */
export function useFoodSearch(query: string): SearchState {
  const tooShort = normalizeText(query).length < MIN_QUERY_LENGTH;
  // A recipe saved or deleted while the search is open shows up (or goes) straight away.
  const foodsRevision = useMyFoodsStore((state) => state.revision);
  const [state, setState] = useState<SearchState>({ query: '', results: [], status: 'idle' });

  useEffect(() => {
    if (tooShort) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchAllFoods(query);
        if (current) setState({ query, results, status: 'done' });
      } catch {
        if (current) setState({ query, results: [], status: 'error' });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, tooShort, foodsRevision]);

  if (tooShort) return { query, results: [], status: 'idle' };
  if (state.query !== query && state.status !== 'error') return { ...state, status: 'searching' };
  return state;
}
