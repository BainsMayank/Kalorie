// Reads the real foods.db.

import { getFoodDetail, getLoggedFoods, getSlotStarters } from './food';
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
  it('reads starter foods for a slot (none yet: slot_suggestions.csv is still to come)', async () => {
    expect(await getSlotStarters(db, 'breakfast')).toEqual([]);
  });
});
