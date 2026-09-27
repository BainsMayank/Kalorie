import { create } from 'zustand';

import {
  deleteEntry,
  insertEntries,
  insertEntry,
  purgeEntries,
  restoreEntries,
  updateEntry,
  type EntryChanges,
  type NewEntry,
} from '@/db/user/entries';
import type { LogEntry, MealSlot } from '@/db/user/schema';
import { listMealSlots, seedMealSlots } from '@/db/user/slots';
import { copyEntries, type CopyTarget } from '@/lib/copy';
import { logicalDay } from '@/lib/day';

import { useUndoStore } from './undo';

// The database is the source of truth for entries. This store holds what screens share:
// the day being looked at, the meal slots, and a counter that goes up after every change so
// screens showing entries know to read them again. Logging, deleting and copying each offer
// Undo for 5 seconds (SPEC §5.11); the caller passes the words for the Undo bar.

type LogState = {
  /** The day the Log tab shows; new entries go to this day. */
  day: string;
  /** All meal slots (hidden ones too), in order. */
  slots: MealSlot[];
  /** True once the slots have been read from user.db. */
  loaded: boolean;
  /** Goes up by one after every change to entries. */
  revision: number;
  load: () => Promise<void>;
  setDay: (day: string) => void;
  /** Saves an entry. Undo removes it. */
  addEntry: (entry: NewEntry, undoMessage: string) => Promise<LogEntry>;
  editEntry: (id: string, changes: EntryChanges) => Promise<void>;
  /** Soft-deletes an entry. Undo brings it back. */
  removeEntry: (id: string, undoMessage: string) => Promise<void>;
  /** Copies entries to another day (and slot). Undo removes the copies. */
  copy: (
    entries: readonly LogEntry[],
    target: CopyTarget,
    undoMessage: string,
  ) => Promise<LogEntry[]>;
};

export const useLogStore = create<LogState>()((set, get) => {
  const changed = () => set((state) => ({ revision: state.revision + 1 }));
  const offerUndo = (message: string, revert: () => Promise<void>) =>
    useUndoStore.getState().show(message, async () => {
      await revert();
      changed();
    });

  return {
    day: logicalDay(Date.now()),
    slots: [],
    loaded: false,
    revision: 0,

    load: async () => {
      await seedMealSlots();
      set({ slots: await listMealSlots(), loaded: true });
    },

    setDay: (day) => set({ day }),

    addEntry: async (entry, undoMessage) => {
      const saved = await insertEntry(entry);
      changed();
      offerUndo(undoMessage, () => purgeEntries([saved.id]));
      return saved;
    },

    editEntry: async (id, changes) => {
      await updateEntry(id, changes);
      changed();
    },

    removeEntry: async (id, undoMessage) => {
      await deleteEntry(id);
      changed();
      offerUndo(undoMessage, () => restoreEntries([id]));
    },

    copy: async (entries, target, undoMessage) => {
      const saved = await insertEntries(copyEntries(entries, target, get().slots));
      changed();
      offerUndo(undoMessage, () => purgeEntries(saved.map((e) => e.id)));
      return saved;
    },
  };
});
