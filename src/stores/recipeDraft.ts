import { create } from 'zustand';

import { EMPTY_DRAFT, type DraftItem, type RecipeDraft } from '@/features/recipes/draft';

// The recipe being built (SPEC §2.9). The builder and the ingredient picker are separate screens,
// so the draft lives here until it is saved. Nothing is written to user.db before *Save*.

type RecipeDraftState = {
  draft: RecipeDraft;
  start: (draft: RecipeDraft) => void;
  change: (changes: Partial<Omit<RecipeDraft, 'items' | 'id'>>) => void;
  addItem: (item: DraftItem) => void;
  replaceItem: (item: DraftItem) => void;
  removeItem: (key: string) => void;
};

export const useRecipeDraftStore = create<RecipeDraftState>()((set) => ({
  draft: EMPTY_DRAFT,
  start: (draft) => set({ draft }),
  change: (changes) => set((state) => ({ draft: { ...state.draft, ...changes } })),
  addItem: (item) =>
    set((state) => ({ draft: { ...state.draft, items: [...state.draft.items, item] } })),
  replaceItem: (item) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.map((i) => (i.key === item.key ? item : i)),
      },
    })),
  removeItem: (key) =>
    set((state) => ({
      draft: { ...state.draft, items: state.draft.items.filter((i) => i.key !== key) },
    })),
}));
