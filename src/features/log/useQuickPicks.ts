import { useEffect, useState } from 'react';

import { getFoodsDb, getSlotStarters, getThaliTemplates, type LoggedFood } from '@/db/foods';
import { listCustomFoods } from '@/db/user/customFoods';
import { listFoodEntriesSince, listRecentFoods } from '@/db/user/entries';
import { listThalis, type SavedThali } from '@/db/user/thalis';
import { loadLoggedFoods } from '@/features/foods/loadFoods';
import { addDays } from '@/lib/day';
import {
  SUGGESTION_DAYS,
  fillSuggestions,
  foodKey,
  rankSuggestions,
  usualPortion,
  type FoodSourceKind,
  type Portion,
} from '@/lib/suggestions';
import { useFavouritesStore } from '@/stores/favourites';
import { useLogStore } from '@/stores/log';
import { useMyFoodsStore } from '@/stores/myFoods';

/** A food ready to log in one tap, with the amount it would be logged at. */
export interface QuickPick {
  key: string;
  foodSource: FoodSourceKind;
  foodId: string;
  food: LoggedFood;
  portion: Portion;
}

/** A saved thali with its foods (a food that is gone is missing from `foods`). */
export interface ThaliPick {
  thali: SavedThali;
  /** Food key → the food, for amounts and kcal. */
  foods: Map<string, LoggedFood>;
}

type QuickPicks =
  | { status: 'loading' }
  | {
      status: 'ready';
      suggestions: QuickPick[];
      recents: QuickPick[];
      favourites: QuickPick[];
      /** The person's own foods: recipes, scanned products. */
      myFoods: QuickPick[];
      /** Thalis the person saved, newest first. */
      thalis: ThaliPick[];
      /** The built-in starter thalis. */
      starterThalis: ThaliPick[];
    }
  | { status: 'error' };

/**
 * What the Add food screen shows before anything is typed (SPEC §2.3, §5.9):
 * - Suggested: foods most often logged in this slot lately, at their usual amount there
 *   (topped up with starter foods for a new user);
 * - Recent: the 30 foods logged most recently, at the amount used last time;
 * - Favourites: starred foods, at their usual amount (or the food's own portion);
 * - My foods: the person's recipes and scanned products, at their own portion;
 * - Thalis: meals saved as a thali, then the built-in starters, logged from a checklist.
 */
export function useQuickPicks(slotId: string | undefined, today: string): QuickPicks {
  const revision = useLogStore((state) => state.revision);
  const myFoodsRevision = useMyFoodsStore((state) => state.revision);
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
        const own = await listCustomFoods();
        const thalis = await listThalis();
        const templates = await getThaliTemplates(foodsDb);

        /** "base:123" → its source and id. */
        const parse = (key: string) => {
          const [foodSource, foodId] = key.split(/:(.*)/s) as [FoodSourceKind, string];
          return { foodSource, foodId };
        };
        const favouriteRefs = favouriteKeys.map(parse);
        const starterRefs = starters.map((id) => ({
          foodSource: 'base' as const,
          foodId: String(id),
        }));
        const ownRefs = own.map((f) => ({ foodSource: 'custom' as const, foodId: f.id }));
        const foods = await loadLoggedFoods([
          ...ranked,
          ...recentRows,
          ...favouriteRefs,
          ...starterRefs,
          ...ownRefs,
          ...thalis.flatMap((t) => t.items),
          ...templates.flatMap((t) =>
            t.items.map((i) => ({ foodSource: 'base', foodId: String(i.foodId) })),
          ),
        ]);

        /** A pick for a food, or null if the food is gone. */
        const pick = (
          foodSource: FoodSourceKind,
          foodId: string,
          portion: Portion | null,
        ): QuickPick | null => {
          const key = foodKey(foodSource, foodId);
          const food = foods.get(key);
          if (!food) return null;
          return { key, foodSource, foodId, food, portion: portion ?? food.defaultPortion };
        };
        const present = (p: QuickPick | null): p is QuickPick => p !== null;

        const suggestions = fillSuggestions(
          ranked.map((s) => pick(s.foodSource, s.foodId, s.portion)).filter(present),
          starterRefs.map((s) => pick(s.foodSource, s.foodId, null)).filter(present),
        );
        const recents = recentRows
          .filter((e) => e.foodSource !== 'quick')
          .map((e) =>
            pick(
              e.foodSource as FoodSourceKind,
              e.foodId!,
              e.qty !== null && e.unit && e.grams !== null
                ? { qty: e.qty, unit: e.unit, grams: e.grams }
                : null,
            ),
          )
          .filter(present);
        const favourites = favouriteRefs
          .map(({ foodSource, foodId }) => {
            const eaten = history.filter((e) => e.foodSource === foodSource && e.foodId === foodId);
            const recent = recents.find((r) => r.key === foodKey(foodSource, foodId));
            return pick(foodSource, foodId, usualPortion(eaten) ?? recent?.portion ?? null);
          })
          .filter(present);

        const myFoods = ownRefs
          .map(({ foodSource, foodId }) => pick(foodSource, foodId, null))
          .filter(present);
        const thaliPick = (thali: SavedThali): ThaliPick => ({
          thali,
          foods: new Map(
            thali.items.flatMap((item) => {
              const key = foodKey(item.foodSource, item.foodId);
              const food = foods.get(key);
              return food ? [[key, food] as const] : [];
            }),
          ),
        });
        // A starter's foods come from foods.db: its name and grams are read from the food.
        const starterThalis = templates.map((template) =>
          thaliPick({
            id: `builtin-${template.id}`,
            name: template.name,
            builtin: true,
            items: template.items.flatMap(({ foodId, qty, unit }) => {
              const food = foods.get(foodKey('base', String(foodId)));
              const grams = food?.units[unit]?.grams;
              if (!food || grams === undefined) return [];
              return [
                {
                  foodSource: 'base' as const,
                  foodId: String(foodId),
                  name: food.name,
                  qty,
                  unit,
                  grams: qty * grams,
                  oilLevel: 0,
                },
              ];
            }),
          }),
        );

        if (current) {
          setState({
            status: 'ready',
            suggestions,
            recents,
            favourites,
            myFoods,
            thalis: thalis.map(thaliPick),
            starterThalis,
          });
        }
      } catch {
        if (current) setState({ status: 'error' });
      }
    })();
    return () => {
      current = false;
    };
  }, [slotId, today, revision, myFoodsRevision, favouriteKeys]);

  return state;
}
