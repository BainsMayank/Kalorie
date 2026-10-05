import { create } from 'zustand';

import { listBarcodeQueue, queueBarcode, removeQueuedBarcode } from '@/db/user/barcodeQueue';
import { getLoggedCustomFoods } from '@/db/user/customFoods';
import type { BarcodeQueueRow } from '@/db/user/schema';
import { retryBarcodeQueue } from '@/features/barcode/lookup';

// Barcodes scanned while offline (SPEC §2.7, §2.8). user.db is the source of truth; this store
// keeps the list in memory for the Pending lookups card on Today, and makes sure only one retry
// runs at a time.

export interface QueuedBarcode {
  row: BarcodeQueueRow;
  /** The product's name once it was found. */
  name: string | null;
}

type BarcodeQueueState = {
  items: QueuedBarcode[];
  /** True while a retry is running. */
  retrying: boolean;
  load: () => Promise<void>;
  /** Adds a barcode that couldn't be looked up. */
  enqueue: (scan: { barcode: string; day: string; slotId: string | null }) => Promise<void>;
  /** Looks up the pending barcodes again (does nothing if there are none). */
  retry: () => Promise<void>;
  remove: (barcode: string) => Promise<void>;
};

async function readQueue(): Promise<QueuedBarcode[]> {
  const rows = await listBarcodeQueue();
  const ids = rows.flatMap((r) => (r.customFoodId ? [r.customFoodId] : []));
  const foods = await getLoggedCustomFoods(ids);
  return rows.map((row) => ({
    row,
    name: row.customFoodId ? (foods.get(row.customFoodId)?.name ?? null) : null,
  }));
}

export const useBarcodeQueueStore = create<BarcodeQueueState>()((set, get) => ({
  items: [],
  retrying: false,

  load: async () => set({ items: await readQueue() }),

  enqueue: async (scan) => {
    await queueBarcode(scan);
    await get().load();
  },

  retry: async () => {
    if (get().retrying) return;
    if (!get().items.some((item) => item.row.status === 'pending')) return;
    set({ retrying: true });
    try {
      await retryBarcodeQueue();
      await get().load();
    } finally {
      set({ retrying: false });
    }
  },

  remove: async (barcode) => {
    await removeQueuedBarcode(barcode);
    set((state) => ({ items: state.items.filter((item) => item.row.barcode !== barcode) }));
  },
}));
