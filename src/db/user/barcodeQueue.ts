// Barcodes scanned while offline (SPEC §4.2 `barcode_queue`), looked up when the app is back
// online. Rows are removed once the person has dealt with them (logged, typed in, or closed).

import { desc, eq } from 'drizzle-orm';

import { getUserDb } from './client';
import { barcodeQueue, type BarcodeQueueRow } from './schema';

/**
 * Puts a barcode in the queue for later. Scanning the same barcode again moves it to the new day
 * and meal and makes it pending again.
 */
export async function queueBarcode(
  scan: { barcode: string; day: string; slotId: string | null },
  now = Date.now(),
): Promise<void> {
  const row = { ...scan, scannedAt: now, status: 'pending' as const, customFoodId: null };
  await getUserDb()
    .insert(barcodeQueue)
    .values({ ...row, lastTryAt: null })
    .onConflictDoUpdate({ target: barcodeQueue.barcode, set: row });
}

/** Every queued barcode, newest scan first. */
export async function listBarcodeQueue(): Promise<BarcodeQueueRow[]> {
  return getUserDb().select().from(barcodeQueue).orderBy(desc(barcodeQueue.scannedAt));
}

/** Records the result of a lookup. */
export async function updateQueuedBarcode(
  barcode: string,
  changes: Partial<Pick<BarcodeQueueRow, 'status' | 'customFoodId' | 'lastTryAt'>>,
): Promise<void> {
  await getUserDb().update(barcodeQueue).set(changes).where(eq(barcodeQueue.barcode, barcode));
}

/** Takes a barcode out of the queue. */
export async function removeQueuedBarcode(barcode: string): Promise<void> {
  await getUserDb().delete(barcodeQueue).where(eq(barcodeQueue.barcode, barcode));
}
