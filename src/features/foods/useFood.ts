import { useEffect, useState } from 'react';

import type { FoodDetail } from '@/db/foods';
import type { FoodSourceKind } from '@/lib/suggestions';
import { useMyFoodsStore } from '@/stores/myFoods';

import { loadFoodDetail } from './loadFoods';

type FoodState =
  | { status: 'loading' }
  | { status: 'found'; food: FoodDetail }
  | { status: 'missing' }
  | { status: 'error' };

/**
 * Loads one food — from foods.db, or from user.db for a recipe or product (read again when a
 * recipe is saved, so an edited recipe shows its new numbers).
 */
export function useFood(foodSource: FoodSourceKind, foodId: string): FoodState {
  const key = `${foodSource}:${foodId}`;
  const revision = useMyFoodsStore((state) => (foodSource === 'custom' ? state.revision : 0));
  const [state, setState] = useState<{ key: string; value: FoodState } | null>(null);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const food = await loadFoodDetail(foodSource, foodId);
        if (current)
          setState({ key, value: food ? { status: 'found', food } : { status: 'missing' } });
      } catch {
        if (current) setState({ key, value: { status: 'error' } });
      }
    })();
    return () => {
      current = false;
    };
  }, [key, foodSource, foodId, revision]);

  return state?.key === key ? state.value : { status: 'loading' };
}
