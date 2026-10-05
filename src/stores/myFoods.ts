import { create } from 'zustand';

import {
  deleteCustomFood,
  restoreCustomFood,
  saveRecipe,
  type RecipeInput,
} from '@/db/user/customFoods';
import { deleteThali, restoreThali, saveThali } from '@/db/user/thalis';
import type { ThaliItem } from '@/lib/thali';

import { useLogStore } from './log';
import { useUndoStore } from './undo';

// The person's own recipes and thalis. user.db is the source of truth; this store makes the
// changes, offers Undo for deletes and new thalis (SPEC §5.11), and counts changes so search and
// the Add food lists read them again.

type MyFoodsState = {
  /** Goes up by one after every change to recipes or thalis. */
  revision: number;
  /** Saves a new recipe, or replaces the one with `id`. Returns its id. */
  saveRecipe: (input: RecipeInput, id?: string) => Promise<string>;
  /** Deletes a recipe (entries logged before keep their numbers). Undo brings it back. */
  deleteRecipe: (id: string, undoMessage: string) => Promise<void>;
  /** Saves a meal as a thali. Undo removes it. */
  saveThali: (name: string, items: readonly ThaliItem[], undoMessage: string) => Promise<string>;
  /** Deletes a thali. Undo brings it back. */
  deleteThali: (id: string, undoMessage: string) => Promise<void>;
};

export const useMyFoodsStore = create<MyFoodsState>()((set) => {
  const changed = () => {
    set((state) => ({ revision: state.revision + 1 }));
    // Logged entries of a recipe show its new numbers.
    useLogStore.setState((state) => ({ revision: state.revision + 1 }));
  };
  const offerUndo = (message: string, revert: () => Promise<void>) =>
    useUndoStore.getState().show(message, async () => {
      await revert();
      changed();
    });

  return {
    revision: 0,

    saveRecipe: async (input, id) => {
      const saved = await saveRecipe(input, id);
      changed();
      return saved;
    },

    deleteRecipe: async (id, undoMessage) => {
      await deleteCustomFood(id);
      changed();
      offerUndo(undoMessage, () => restoreCustomFood(id));
    },

    saveThali: async (name, items, undoMessage) => {
      const id = await saveThali(name, items);
      changed();
      offerUndo(undoMessage, () => deleteThali(id));
      return id;
    },

    deleteThali: async (id, undoMessage) => {
      await deleteThali(id);
      changed();
      offerUndo(undoMessage, () => restoreThali(id));
    },
  };
});
