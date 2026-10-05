import { emptyNutrients } from '@/lib/nutrients';

import { deleteCustomFood, saveRecipe } from './customFoods';
import { deleteEntry, insertEntry, listDeletedEntries, type NewEntry } from './entries';
import { addFavourite, listFavourites } from './favourites';
import { purgeDeletedRows } from './purge';
import { customFoods, logEntries, recipeItems } from './schema';
import { deleteThali, listThalis, saveThali } from './thalis';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});
const { getUserDb } = jest.requireMock('./client') as typeof import('./client');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12);

const dal: NewEntry = {
  day: '2026-08-01',
  loggedAt: NOW - 58 * DAY_MS,
  slotId: 'lunch',
  foodSource: 'base',
  foodId: '123',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
};

const recipe = (name: string) => ({
  name,
  servings: 2,
  cookedWeightG: null,
  servingLabel: 'serving',
  items: [
    {
      foodSource: 'base' as const,
      foodId: '1',
      name: 'Rajma',
      qty: 100,
      unit: 'g',
      grams: 100,
      isFat: false,
      nutrients: { ...emptyNutrients(), energy_kcal: 333 },
    },
  ],
});

describe('purgeDeletedRows', () => {
  it('keeps what was deleted in the last 30 days and removes older rows for good', async () => {
    const old = await insertEntry(dal, NOW - 40 * DAY_MS);
    const recent = await insertEntry({ ...dal, name: 'Roti' }, NOW - 40 * DAY_MS);
    const kept = await insertEntry({ ...dal, name: 'Rice' }, NOW - 40 * DAY_MS);
    await deleteEntry(old.id, NOW - 31 * DAY_MS);
    await deleteEntry(recent.id, NOW - 29 * DAY_MS);

    await purgeDeletedRows(NOW);

    const ids = (await getUserDb().select({ id: logEntries.id }).from(logEntries)).map((r) => r.id);
    expect(ids.sort()).toEqual([recent.id, kept.id].sort());
    expect((await listDeletedEntries('2026-08-01', NOW)).map((e) => e.name)).toEqual(['Roti']);
  });

  it('removes an old deleted thali with its items', async () => {
    const item = { foodSource: 'base' as const, foodId: '123', name: 'Mixed dal', qty: 1 };
    const id = await saveThali('Old lunch', [{ ...item, unit: 'katori', grams: 150, oilLevel: 0 }]);
    await deleteThali(id, NOW - 31 * DAY_MS);
    await purgeDeletedRows(NOW);
    expect(await listThalis()).toEqual([]);
  });

  it('keeps a deleted recipe that is still logged, and removes one nothing uses', async () => {
    const logged = await saveRecipe(recipe('Logged rajma'), undefined, NOW - 40 * DAY_MS);
    const unused = await saveRecipe(recipe('Unused rajma'), undefined, NOW - 40 * DAY_MS);
    await insertEntry({ ...dal, foodSource: 'custom', foodId: logged, name: 'Logged rajma' });
    await addFavourite({ foodSource: 'custom', foodId: unused });
    await deleteCustomFood(logged, NOW - 31 * DAY_MS);
    await deleteCustomFood(unused, NOW - 31 * DAY_MS);

    await purgeDeletedRows(NOW);

    const foods = await getUserDb().select({ id: customFoods.id }).from(customFoods);
    expect(foods.map((f) => f.id)).toEqual([logged]);
    const items = await getUserDb().select({ id: recipeItems.recipeId }).from(recipeItems);
    expect(items.map((i) => i.id)).toEqual([logged]);
    expect(await listFavourites()).toEqual([]);
  });
});
