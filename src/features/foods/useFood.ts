import { useEffect, useState } from 'react';

import { getFoodDetail, getFoodsDb, type FoodDetail } from '@/db/foods';

type FoodState =
  | { status: 'loading' }
  | { status: 'found'; food: FoodDetail }
  | { status: 'missing' }
  | { status: 'error' };

/** Loads one food from foods.db for the detail screen. */
export function useFood(id: number): FoodState {
  const [state, setState] = useState<{ id: number; value: FoodState } | null>(null);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const food = Number.isSafeInteger(id) ? await getFoodDetail(await getFoodsDb(), id) : null;
        if (current)
          setState({ id, value: food ? { status: 'found', food } : { status: 'missing' } });
      } catch {
        if (current) setState({ id, value: { status: 'error' } });
      }
    })();
    return () => {
      current = false;
    };
  }, [id]);

  return state?.id === id ? state.value : { status: 'loading' };
}
