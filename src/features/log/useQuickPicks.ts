import { useEffect, useState } from 'react';

import { getFoodsDb, getLoggedFoods, getSlotStarters, type LoggedFood } from '@/db/foods';
import { listFoodEntriesSince, listRecentFoods } from '@/db/user/entries';
import { addDays } from '@/lib/day';
import {
  SUGGESTION_DAYS,
  fillSuggestions,
  foodKey,
  rankSuggestions,
  usualPortion,
  type Portion,
} from '@/lib/suggestions';
import { useFavouritesStore } from '@/stores/favourites';
import { useLogStore } from '@/stores/log';

/** A food ready to log in one tap, with the amount it would be logged at. */
export interface QuickPick {
  key: string;
  foodSource: 'base';
  foodId: string;
  food: LoggedFood;
  portion: Portion;
}

type QuickPicks =
  | { status: 'loading' }
  | { status: 'ready'; suggestions: QuickPick[]; recents: QuickPick[]; favourites: QuickPick[] }
  | { status: 'error' };

/**
 * What the Add food screen shows before anything is typed (SPEC §2.3, §5.9):
 * - Suggested: foods most often logged in this slot lately, at their usual amount there
 *   (topped up with starter foods for a new user);
 * - Recent: the 30 foods logged most recently, at the amount used last time;
 * - Favourites: starred foods, at their usual amount (or the food's own portion).
 * Only foods.db foods for now; custom foods join in Stage 7.
 */
export function useQuickPicks(slotId: string | undefined, today: string): QuickPicks {
  const revision = useLogStore((state) => state.revision);
  const favouriteKeys = useFavouritesStore((state) => state.keys);
  // While the lists refresh (after a log, or a star), the last ones stay on screen.
  const [state, setState] = useState<QuickPicks>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const history = await listFoodEntriesSince(addDays(today, -(SUGGESTION_DAYS - 1)));
        const recentRows = await listRecentFoods();
        const ranked = slotId ? rankSuggestions(history, slotId, today) : [];
        const foodsDb = await getFoodsDb();
        const starters = slotId ? await getSlotStarters(foodsDb, slotId) : [];

        const baseIds = (keys: string[]) =>
          keys.filter((k) => k.startsWith('base:')).map((k) => k.slice('base:'.length));
        const favouriteIds = baseIds(favouriteKeys);
        const ids = [
          ...ranked.map((s) => s.foodId),
          ...recentRows.map((e) => e.foodId!),
          ...favouriteIds,
          ...starters.map(String),
        ].map(Number);
        const foods = await getLoggedFoods(foodsDb, ids);

        /** A pick for a foods.db food, or null if the food is gone. */
        const pick = (foodId: string, portion: Portion | null): QuickPick | null => {
          const food = foods.get(Number(foodId));
          if (!food) return null;
          return {
            key: foodKey('base', foodId),
            foodSource: 'base',
            foodId,
            food,
            portion: portion ?? food.defaultPortion,
          };
        };
        const present = (p: QuickPick | null): p is QuickPick => p !== null;

        const suggestions = fillSuggestions(
          ranked
            .filter((s) => s.foodSource === 'base')
            .map((s) => pick(s.foodId, s.portion))
            .filter(present),
          starters.map((id) => pick(String(id), null)).filter(present),
        );
        const recents = recentRows
          .filter((e) => e.foodSource === 'base')
          .map((e) =>
            pick(
              e.foodId!,
              e.qty !== null && e.unit && e.grams !== null
                ? { qty: e.qty, unit: e.unit, grams: e.grams }
                : null,
            ),
          )
          .filter(present);
        const favourites = favouriteIds
          .map((id) => {
            const eaten = history.filter((e) => e.foodSource === 'base' && e.foodId === id);
            const recent = recents.find((r) => r.foodId === id);
            return pick(id, usualPortion(eaten) ?? recent?.portion ?? null);
          })
          .filter(present);

        if (current) setState({ status: 'ready', suggestions, recents, favourites });
      } catch {
        if (current) setState({ status: 'error' });
      }
    })();
    return () => {
      current = false;
    };
  }, [slotId, today, revision, favouriteKeys]);

  return state;
}
