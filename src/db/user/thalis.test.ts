import type { ThaliItem } from '@/lib/thali';

import { deleteThali, listThalis, restoreThali, saveThali } from './thalis';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const dal: ThaliItem = {
  foodSource: 'base',
  foodId: '11',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
  oilLevel: 1,
};
const rajma: ThaliItem = { ...dal, foodSource: 'custom', foodId: 'r-1', name: "Mom's rajma" };

describe('my thalis', () => {
  it('saves a thali and lists it with its items in order, newest first', async () => {
    await saveThali('Sunday lunch', [dal, rajma], 1000);
    await saveThali('Light dinner', [dal], 2000);
    const thalis = await listThalis();
    expect(thalis.map((t) => t.name)).toEqual(['Light dinner', 'Sunday lunch']);
    expect(thalis[1].items).toEqual([dal, rajma]);
  });

  it('deletes a thali, and Undo brings it back', async () => {
    const [light] = await listThalis();
    await deleteThali(light.id);
    expect((await listThalis()).map((t) => t.name)).toEqual(['Sunday lunch']);
    await restoreThali(light.id);
    expect(await listThalis()).toHaveLength(2);
  });
});
