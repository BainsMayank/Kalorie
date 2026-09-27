import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

// The Undo bar (SPEC §5.11). An action that creates or deletes rows offers one Undo for
// 5 seconds. The action says how to reverse itself (`revert`), so this store works for any
// kind of row — entries now, water and weights later. A new action replaces the old one.

export const UNDO_MS = 5000;

export interface UndoAction {
  /** Goes up with every action, so the bar can tell one from the next. */
  id: number;
  /** What happened, ready to show: "Deleted Mixed dal". */
  message: string;
  revert: () => Promise<void>;
}

type UndoState = {
  current: UndoAction | null;
  show: (message: string, revert: () => Promise<void>) => void;
  /** Reverses the current action and hides the bar. */
  undo: () => Promise<void>;
  dismiss: () => void;
};

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useUndoStore = create<UndoState>()((set, get) => ({
  current: null,

  show: (message, revert) => {
    clearTimeout(timer);
    const action = { id: nextId++, message, revert };
    set({ current: action });
    // Screen readers hear what happened, since the bar appears without taking focus.
    AccessibilityInfo.announceForAccessibility(message);
    timer = setTimeout(() => {
      if (get().current?.id === action.id) set({ current: null });
    }, UNDO_MS);
  },

  undo: async () => {
    const action = get().current;
    if (!action) return;
    clearTimeout(timer);
    set({ current: null });
    await action.revert();
  },

  dismiss: () => {
    clearTimeout(timer);
    set({ current: null });
  },
}));
