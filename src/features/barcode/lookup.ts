// Looking up a barcode (SPEC §2.7): the products already saved in user.db first, then Open Food
// Facts. A product found there is saved, so the next scan of the same packet is instant and works
// offline.

import Constants from 'expo-constants';

import { findProductByBarcode, saveProduct, type CustomUnitInput } from '@/db/user/customFoods';
import { listBarcodeQueue, updateQueuedBarcode } from '@/db/user/barcodeQueue';
import i18n from '@/i18n';
import { productUnits } from '@/lib/label';
import { offProductUrl, offUserAgent, parseOffResponse, type OffProduct } from '@/lib/off';

export type LookupResult =
  /** Saved in user.db (it was there already, or just found on Open Food Facts). */
  | { kind: 'found'; foodId: string }
  /** Open Food Facts knows the packet, but not its nutrition: fill in the label form. */
  | { kind: 'no_nutrition'; name: string | null; brand: string | null }
  | { kind: 'not_found' }
  /** No internet, or Open Food Facts didn't answer: try again later. */
  | { kind: 'offline' };

/** Seconds to wait for Open Food Facts before calling it offline. */
const TIMEOUT_MS = 10_000;

type Fetch = typeof fetch;

/** The User-Agent for Open Food Facts: app version from app.json, contact from its `extra`. */
function userAgent(): string {
  const config = Constants.expoConfig;
  const contact = (config?.extra as { contactEmail?: string } | undefined)?.contactEmail;
  return offUserAgent(config?.version ?? '1.0.0', contact);
}

/** Asks Open Food Facts; `null` means it couldn't be reached (or answered with an error). */
async function askOff(barcode: string, fetchImpl: Fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(offProductUrl(barcode), {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    return parseOffResponse(barcode, response.status, body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The units a product is saved with, labelled in words ("serving", "pack", "ml"). */
function unitsFor(product: OffProduct): CustomUnitInput[] {
  return productUnits(product).map((u) => ({ ...u, label: i18n.t(`units.${u.unit}`) }));
}

/** Saves a product found on Open Food Facts; returns its id in user.db. */
function saveFound(product: OffProduct, now: number): Promise<string> {
  return saveProduct(
    {
      barcode: product.barcode,
      name: product.name ?? product.brand ?? i18n.t('product.unnamed', { code: product.barcode }),
      brand: product.name ? product.brand : null,
      servingG: product.servingG,
      densityGPerMl: 1,
      offStatus: 'found',
      offFetchedAt: now,
      labelPhotoUri: null,
      nutrients: product.nutrients,
      units: unitsFor(product),
    },
    now,
  );
}

/**
 * Looks up a barcode (already checked, from src/lib/barcode.ts): user.db first, then Open Food
 * Facts. What Open Food Facts finds is saved to user.db before this returns.
 */
export async function lookupBarcode(
  barcode: string,
  fetchImpl: Fetch = fetch,
  now = Date.now(),
): Promise<LookupResult> {
  const saved = await findProductByBarcode(barcode);
  if (saved) return { kind: 'found', foodId: saved.id };

  const answer = await askOff(barcode, fetchImpl);
  if (answer === null) return { kind: 'offline' };
  switch (answer.status) {
    case 'found':
      return { kind: 'found', foodId: await saveFound(answer.product, now) };
    case 'no_nutrition':
      return { kind: 'no_nutrition', name: answer.product.name, brand: answer.product.brand };
    case 'not_found':
      return { kind: 'not_found' };
  }
}

/**
 * Tries every pending barcode in the queue again (on app open, when the app comes back to the
 * front, and from the Pending lookups card). Stops at the first one that can't reach Open Food
 * Facts: still offline. Returns true if anything changed.
 */
export async function retryBarcodeQueue(
  fetchImpl: Fetch = fetch,
  now = Date.now(),
): Promise<boolean> {
  const pending = (await listBarcodeQueue()).filter((row) => row.status === 'pending');
  let changed = false;
  for (const row of pending) {
    const result = await lookupBarcode(row.barcode, fetchImpl, now);
    if (result.kind === 'offline') {
      await updateQueuedBarcode(row.barcode, { lastTryAt: now });
      break;
    }
    await updateQueuedBarcode(row.barcode, {
      status: result.kind === 'found' ? 'found' : 'not_found',
      customFoodId: result.kind === 'found' ? result.foodId : null,
      lastTryAt: now,
    });
    changed = true;
  }
  return changed;
}
