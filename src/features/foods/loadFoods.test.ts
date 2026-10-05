import { searchFoods } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { saveProduct } from '@/db/user/customFoods';
import { emptyNutrients } from '@/lib/nutrients';

import { loadFoodDetail, loadLoggedFoods } from './loadFoods';

jest.mock('@/db/foods/client', () => {
  const db = jest.requireActual('@/db/foods/testing').openFoodsDbForTests();
  return { getFoodsDb: async () => db };
});
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const db = openFoodsDbForTests();
afterAll(() => db.close());

describe('loading foods from foods.db and user.db', () => {
  it('reads a foods.db food and a barcode product in one go, by food key', async () => {
    const [dal] = await searchFoods(db, 'daal');
    const maggi = await saveProduct({
      barcode: '8901058851298',
      name: 'Maggi 2-minutes Noodles',
      brand: 'Maggi',
      servingG: 70,
      densityGPerMl: 1,
      offStatus: 'found',
      offFetchedAt: 1,
      labelPhotoUri: null,
      nutrients: { ...emptyNutrients(), energy_kcal: 437 },
      units: [{ unit: 'serving', label: 'serving', grams: 70, isDefault: true }],
    });

    const foods = await loadLoggedFoods([
      { foodSource: 'base', foodId: String(dal.id) },
      { foodSource: 'custom', foodId: maggi },
      { foodSource: 'quick', foodId: null },
      { foodSource: 'custom', foodId: 'gone' },
    ]);
    expect([...foods.keys()].sort()).toEqual([`base:${dal.id}`, `custom:${maggi}`].sort());
    expect(foods.get(`custom:${maggi}`)).toMatchObject({
      name: 'Maggi 2-minutes Noodles',
      source: 'product',
      units: { serving: { label: 'serving', grams: 70 }, g: { grams: 1 } },
      defaultPortion: { qty: 1, unit: 'serving', grams: 70 },
    });
    expect(foods.get(`base:${dal.id}`)?.name).toBe('Mixed dal');
  });

  it('opens either kind of food for the food screen', async () => {
    const [dal] = await searchFoods(db, 'daal');
    expect(await loadFoodDetail('base', String(dal.id))).toMatchObject({
      foodSource: 'base',
      foodId: String(dal.id),
      source: 'indb',
    });
    expect(await loadFoodDetail('base', 'not-a-number')).toBeNull();
    expect(await loadFoodDetail('custom', 'missing')).toBeNull();
  });
});
