import type { GroupFood } from '@/lib/group';
import { emptyNutrients } from '@/lib/nutrients';
import { planShareUploads } from '@/lib/group';

import {
  findProductByBarcode,
  getCustomFoodDetail,
  getLoggedCustomFoods,
  listCustomFoods,
  saveProduct,
  type ProductInput,
} from './customFoods';
import {
  getOwnFoodsForSharing,
  listGroupFoods,
  listShareStates,
  markShared,
  removeGroupFoods,
  resetOwnSharing,
  saveGroupFoods,
  setShareWithGroup,
} from './groupFoods';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const biscuits: ProductInput = {
  barcode: '8901234567894',
  name: 'Marie biscuits',
  brand: 'Brand',
  servingG: 20,
  densityGPerMl: 1,
  offStatus: 'found',
  offFetchedAt: 1,
  labelPhotoUri: 'file:///labels/marie.jpg',
  nutrients: { ...emptyNutrients(), energy_kcal: 440 },
  units: [{ unit: 'serving', label: 'serving', grams: 20, isDefault: true }],
};

const rajma: GroupFood = {
  id: '11111111-1111-4111-8111-111111111111',
  createdBy: 'person-a',
  kind: 'recipe',
  name: "Mom's rajma",
  brand: null,
  barcode: null,
  servingG: null,
  densityGPerMl: 1,
  cookedWithFat: true,
  nutrients: { ...emptyNutrients(), energy_kcal: 140 },
  units: [{ unit: 'serving', label: 'serving', grams: 250, isDefault: true }],
  updatedAt: 5000,
};
const names = new Map([['person-a', 'Asha']]);

describe('sharing my own foods', () => {
  it('plans a newly shared food, and nothing once the group has that version', async () => {
    const id = await saveProduct(biscuits, 1000);
    expect(await listShareStates()).toEqual([]);

    await setShareWithGroup(id, true, 2000);
    const states = await listShareStates();
    expect(planShareUploads(states)).toEqual({ send: [id], remove: [] });

    const [own] = await getOwnFoodsForSharing([id]);
    expect(own).toMatchObject({
      id,
      kind: 'product',
      name: 'Marie biscuits',
      barcode: biscuits.barcode,
    });
    expect(own.units).toEqual([{ unit: 'serving', label: 'serving', grams: 20, isDefault: true }]);

    await markShared(id, 2000);
    expect(planShareUploads(await listShareStates())).toEqual({ send: [], remove: [] });
    expect((await getCustomFoodDetail(id))!.sharing).toEqual({
      kind: 'own',
      shareWithGroup: true,
      sharedAt: 2000,
    });

    // Turned off: the group's copy must go.
    await setShareWithGroup(id, false, 3000);
    expect(planShareUploads(await listShareStates())).toEqual({ send: [], remove: [id] });
    await markShared(id, null);
    expect(await listShareStates()).toEqual([]);
  });

  it('forgets all sharing after leaving the group', async () => {
    const id = (await findProductByBarcode(biscuits.barcode))!.id;
    await setShareWithGroup(id, true, 4000);
    await markShared(id, 4000);
    await resetOwnSharing(5000);
    expect(await listShareStates()).toEqual([]);
  });
});

describe('group foods', () => {
  it('keeps them for search and logging, but out of My foods', async () => {
    expect(await saveGroupFoods([rajma], names, 6000)).toBe(true);

    expect((await listGroupFoods()).map((f) => f.name)).toEqual(["Mom's rajma"]);
    expect((await listCustomFoods()).map((f) => f.name)).toEqual(['Marie biscuits']);
    expect((await listCustomFoods(undefined, { withGroupFoods: true })).map((f) => f.name)).toEqual(
      ['Marie biscuits', "Mom's rajma"],
    );
    expect(await listCustomFoods('recipe')).toEqual([]);

    const food = (await getCustomFoodDetail(rajma.id))!;
    expect(food.sharing).toEqual({ kind: 'group', addedBy: 'Asha' });
    expect(food.nutrients.energy_kcal).toBe(140);
    expect(food.units.map((u) => u.unit)).toEqual(['serving', 'g']);
    // Someone else's food is never sent back up.
    expect(await listShareStates()).toEqual([]);
  });

  it('changes nothing when the same version comes again', async () => {
    expect(await saveGroupFoods([rajma], names, 7000)).toBe(false);
  });

  it('takes a corrected version, so logged days use the new numbers', async () => {
    const fixed = {
      ...rajma,
      nutrients: { ...rajma.nutrients, energy_kcal: 120 },
      units: [{ unit: 'katori', label: 'katori', grams: 150, isDefault: true }],
      updatedAt: 8000,
    };
    expect(await saveGroupFoods([fixed], new Map([['person-a', 'Asha R']]), 8000)).toBe(true);
    const food = (await getLoggedCustomFoods([rajma.id])).get(rajma.id)!;
    expect(food.nutrients.energy_kcal).toBe(120);
    expect(Object.keys(food.units)).toEqual(['katori', 'g']);
    expect((await getCustomFoodDetail(rajma.id))!.sharing).toEqual({
      kind: 'group',
      addedBy: 'Asha R',
    });
  });

  it('removes one the group no longer has, but keeps its numbers for logged days', async () => {
    expect(await saveGroupFoods([], names, 9000)).toBe(true);
    expect(await listGroupFoods()).toEqual([]);
    expect((await getLoggedCustomFoods([rajma.id])).get(rajma.id)?.nutrients.energy_kcal).toBe(120);
    // It comes back if it is shared again.
    await saveGroupFoods([{ ...rajma, updatedAt: 8000 }], names, 9500);
    expect(await listGroupFoods()).toHaveLength(1);
    expect(await removeGroupFoods(9600)).toBe(true);
    expect(await listGroupFoods()).toEqual([]);
  });

  it('never overwrites one of my own foods that has the same id', async () => {
    const mine = (await findProductByBarcode(biscuits.barcode))!.id;
    await saveGroupFoods([{ ...rajma, id: mine, name: 'Not mine' }], names, 10_000);
    expect((await getCustomFoodDetail(mine))!.name).toBe('Marie biscuits');
  });

  it('shares a barcode only when no food on the phone has it; my own product wins', async () => {
    const packet = {
      ...rajma,
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'product' as const,
    };
    // Someone shared the same packet I have: theirs comes without the barcode.
    await saveGroupFoods([{ ...packet, barcode: biscuits.barcode }], names, 11_000);
    expect((await findProductByBarcode(biscuits.barcode))!.name).toBe('Marie biscuits');

    // A packet only the group has: scanning it finds the group's food.
    // (The sharer changed the barcode: a newer version.)
    await saveGroupFoods([{ ...packet, barcode: '8900000000017', updatedAt: 9999 }], names, 12_000);
    expect((await findProductByBarcode('8900000000017'))!.id).toBe(packet.id);

    // Then I save that packet myself: mine takes the barcode, theirs stays in the group.
    const mine = await saveProduct({ ...biscuits, barcode: '8900000000017', name: 'My packet' });
    expect(mine).not.toBe(packet.id);
    expect((await findProductByBarcode('8900000000017'))!.id).toBe(mine);
    expect((await listGroupFoods()).map((f) => f.id)).toContain(packet.id);
  });
});
