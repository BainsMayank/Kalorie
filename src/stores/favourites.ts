import { create } from 'zustand';

import { addFavourite, listFavourites, removeFavourite } from '@/db/user/favourites';
import { foodKey, type FoodSourceKind } from '@/lib/suggestions';

// Starred foods. user.db is the source of truth; this store keeps the set of keys in memory so
// every ☆ on screen can show its state instantly.

type FavouritesState = {
  /** Food keys ("base:123"), newest first. */
  keys: string[];
  loaded: boolean;
  load: () => Promise<void>;
  isFavourite: (foodSource: FoodSourceKind, foodId: string) => boolean;
  toggle: (foodSource: FoodSourceKind, foodId: string) => Promise<void>;
};

export const useFavouritesStore = create<FavouritesState>()((set, get) => ({
  keys: [],
  loaded: false,

  load: async () => {
    const rows = await listFavourites();
    set({ keys: rows.map((f) => foodKey(f.foodSource, f.foodId)), loaded: true });
  },

  isFavourite: (foodSource, foodId) => get().keys.includes(foodKey(foodSource, foodId)),

  toggle: async (foodSource, foodId) => {
    const key = foodKey(foodSource, foodId);
    if (get().keys.includes(key)) {
      await removeFavourite({ foodSource, foodId });
      set((state) => ({ keys: state.keys.filter((k) => k !== key) }));
    } else {
      await addFavourite({ foodSource, foodId });
      set((state) => ({ keys: [key, ...state.keys] }));
    }
  },
}));
