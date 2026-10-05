import { create } from 'zustand';

import { addWater, removeLastWater } from '@/db/user/water';

// The database is the source of truth for water. This store only makes the changes and counts
// them, so every screen showing water (Today's row, Trends) knows to read it again.

type WaterState = {
  /** Goes up by one after every change to water logs. */
  revision: number;
  /** Adds `ml` to a day (one glass, or a custom amount). */
  add: (day: string, ml: number) => Promise<void>;
  /** Takes the day's last water log off (the − button). */
  removeLast: (day: string) => Promise<void>;
};

export const useWaterStore = create<WaterState>()((set) => {
  const changed = () => set((state) => ({ revision: state.revision + 1 }));
  return {
    revision: 0,
    add: async (day, ml) => {
      await addWater(day, ml);
      changed();
    },
    removeLast: async (day) => {
      if (await removeLastWater(day)) changed();
    },
  };
});
