// Reads the real foods.db.

import { getFoodDetail, getLoggedFoods, getSlotStarters, getThaliTemplates } from './food';
import { searchFoods } from './search';
import { openFoodsDbForTests } from './testing';

const db = openFoodsDbForTests();
afterAll(() => db.close());

describe('getLoggedFoods', () => {
  it('reads nutrients and unit labels for several foods at once', async () => {
    const [roti] = await searchFoods(db, 'roti');
    const [dal] = await searchFoods(db, 'daal');
    const foods = await getLoggedFoods(db, [roti.id, dal.id, roti.id]);

    const rotiDetail = await getFoodDetail(db, roti.id);
    expect(foods.get(roti.id)?.nutrients).toEqual(rotiDetail?.nutrients);
    expect(foods.get(roti.id)?.units).toMatchObject({
      roti_m: { label: 'medium roti', grams: 35 },
      g: { label: 'g', grams: 1 },
    });
    expect(foods.get(dal.id)).toMatchObject({
      name: 'Mixed dal',
      source: 'indb',
      defaultPortion: { qty: 1, unit: 'katori', grams: 150 },
    });
  });

  it('leaves out foods that don’t exist, and handles an empty list', async () => {
    expect((await getLoggedFoods(db, [1])).size).toBe(0);
    expect((await getLoggedFoods(db, [])).size).toBe(0);
  });
});

describe('getSlotStarters', () => {
  it('reads starter foods for a slot, in order (data/curated/slot_suggestions.csv)', async () => {
    const ids = await getSlotStarters(db, 'lunch');
    const foods = await getLoggedFoods(db, ids);
    expect(ids.slice(0, 2).map((id) => foods.get(id)?.name)).toEqual(['Chapati/Roti', 'Mixed dal']);
    expect(await getSlotStarters(db, 'no-such-slot')).toEqual([]);
  });
});

describe('getThaliTemplates', () => {
  it('reads the 6 starter thalis with their foods in order (data/curated/thalis.csv)', async () => {
    const thalis = await getThaliTemplates(db);
    expect(thalis).toHaveLength(6);
    const dalChawal = thalis.find((t) => t.name === 'Simple dal-chawal')!;
    expect(dalChawal.items.map((i) => [i.qty, i.unit])).toEqual([
      [1, 'katori'],
      [1.5, 'katori'],
      [1, 'tsp'],
    ]);
    const foods = await getLoggedFoods(
      db,
      thalis.flatMap((t) => t.items.map((i) => i.foodId)),
    );
    // Every item's food exists and offers the item's unit.
    for (const item of thalis.flatMap((t) => t.items)) {
      expect(foods.get(item.foodId)?.units[item.unit]).toBeDefined();
    }
  });
});
