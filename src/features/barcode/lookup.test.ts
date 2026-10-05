import '@/i18n';

import { listBarcodeQueue, queueBarcode } from '@/db/user/barcodeQueue';
import { findProductByBarcode, getCustomFoodDetail } from '@/db/user/customFoods';
import maggi from '@/lib/testdata/off/maggi.json';
import notFound from '@/lib/testdata/off/not-found.json';

import { lookupBarcode, retryBarcodeQueue } from './lookup';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const MAGGI = '8901058851298';
const UNKNOWN = '8901063010321';

/** A pretend Open Food Facts: answers from saved JSON, and counts the calls. */
function fakeOff(answers: Record<string, { status: number; body: unknown }>) {
  return jest.fn(async (url: string | URL | Request) => {
    const code = String(url).match(/product\/(\d+)\.json/)![1];
    const answer = answers[code] ?? { status: 404, body: notFound };
    return { status: answer.status, json: async () => answer.body } as Response;
  });
}

const offline = jest.fn(async () => {
  throw new TypeError('Network request failed');
});

describe('lookupBarcode', () => {
  it('finds Maggi on Open Food Facts, saves it, then finds it offline without asking again', async () => {
    const fetch = fakeOff({ [MAGGI]: { status: 200, body: maggi } });

    const first = await lookupBarcode(MAGGI, fetch);
    expect(first.kind).toBe('found');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Sent with a User-Agent naming the app, as Open Food Facts asks.
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/api/v2/product/${MAGGI}.json`);
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^Kalorie\/\S+ \(.+\)$/);

    const again = await lookupBarcode(MAGGI, offline);
    expect(again).toEqual(first);
    expect(offline).not.toHaveBeenCalled();
  });

  it('saves the product with grams and servings to pick from', async () => {
    const saved = (await findProductByBarcode(MAGGI))!;
    const food = (await getCustomFoodDetail(saved.id))!;
    expect(food).toMatchObject({
      foodSource: 'custom',
      name: 'Maggi 2-minutes Noodles',
      brand: 'Maggi',
      barcode: MAGGI,
      source: 'product',
      offStatus: 'found',
      defaultUnit: 'serving',
      defaultQty: 1,
    });
    expect(food.units.map((u) => [u.unit, u.label, u.grams])).toEqual([
      ['serving', 'serving', 70],
      ['g', 'g', 1],
    ]);
    expect(food.nutrients.energy_kcal).toBe(437);
    expect(food.nutrients.vit_c_mg).toBeNull();
  });

  it('says so for a barcode Open Food Facts doesn’t know', async () => {
    expect(await lookupBarcode(UNKNOWN, fakeOff({}))).toEqual({ kind: 'not_found' });
  });

  it('keeps the name of a product that has no nutrition numbers', async () => {
    const fetch = fakeOff({
      '8900000000017': {
        status: 200,
        body: { status: 1, product: { product_name: 'Masala chips', brands: 'Local' } },
      },
    });
    expect(await lookupBarcode('8900000000017', fetch)).toEqual({
      kind: 'no_nutrition',
      name: 'Masala chips',
      brand: 'Local',
    });
    expect(await findProductByBarcode('8900000000017')).toBeNull();
  });

  it('calls it offline when there is no internet or the server has a problem', async () => {
    expect(await lookupBarcode('8901719101038', offline)).toEqual({ kind: 'offline' });
    const down = fakeOff({ '8901719101038': { status: 503, body: null } });
    expect(await lookupBarcode('8901719101038', down)).toEqual({ kind: 'offline' });
  });
});

describe('retryBarcodeQueue', () => {
  const PARLE_G = '8901719101038';

  it('waits while offline, then looks everything up when back online', async () => {
    await queueBarcode({ barcode: PARLE_G, day: '2026-09-27', slotId: 'snacks' }, 1000);
    await queueBarcode({ barcode: UNKNOWN, day: '2026-09-27', slotId: null }, 2000);

    expect(await retryBarcodeQueue(offline, 3000)).toBe(false);
    expect((await listBarcodeQueue()).map((r) => [r.barcode, r.status, r.lastTryAt])).toEqual([
      [UNKNOWN, 'pending', 3000], // newest first; the first try failed, so it stopped there
      [PARLE_G, 'pending', null],
    ]);

    const parleG = jest.requireActual('@/lib/testdata/off/parle-g.json');
    const online = fakeOff({ [PARLE_G]: { status: 200, body: parleG } });
    expect(await retryBarcodeQueue(online, 4000)).toBe(true);

    const rows = await listBarcodeQueue();
    expect(rows.find((r) => r.barcode === UNKNOWN)).toMatchObject({ status: 'not_found' });
    const found = rows.find((r) => r.barcode === PARLE_G)!;
    expect(found).toMatchObject({ status: 'found', day: '2026-09-27', slotId: 'snacks' });
    expect(found.customFoodId).toBe((await findProductByBarcode(PARLE_G))!.id);
  });
});
