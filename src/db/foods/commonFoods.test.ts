// Reads the real foods.db.

import { rankRichFoods } from '@/lib/micros';

import { getCommonFoods } from './commonFoods';
import { openFoodsDbForTests } from './testing';

const db = openFoodsDbForTests();
afterAll(() => db.close());

describe('getCommonFoods', () => {
  it('reads every everyday food with its portion (data/curated/common_foods.csv)', async () => {
    const foods = await getCommonFoods(db);
    expect(foods.length).toBeGreaterThan(70);
    expect(foods.find((f) => f.name === 'Mixed dal')).toMatchObject({
      qty: 1,
      unit: 'katori',
      unitLabel: 'katori',
      grams: 150,
      diet: 'veg',
    });
    expect(foods.find((f) => f.name === 'Chapati/Roti')).toMatchObject({
      qty: 2,
      unitLabel: 'medium roti',
      grams: 70,
    });
    expect(foods.find((f) => f.name === 'Paneer')).toMatchObject({ unit: 'g', unitLabel: 'g' });
    // Every food says whether it's vegetarian, so "vegetarian first" always works.
    expect(foods.every((f) => ['veg', 'egg', 'nonveg'].includes(f.diet))).toBe(true);
  });

  it('gives believable rich foods on the real data', async () => {
    const foods = await getCommonFoods(db);
    const top = (key: Parameters<typeof rankRichFoods>[1], diet?: 'veg') =>
      rankRichFoods(foods, key, diet).map((r) => r.food.name);

    expect(top('vit_c_mg')[0]).toMatch(/^Guava/);
    expect(top('calcium_mg', 'veg')).toEqual(expect.arrayContaining(['Paneer']));
    // INDB and IFCT have no B12: milk and curd come from USDA.
    expect(top('vit_b12_ug', 'veg').slice(0, 2)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Milk/)]),
    );
    expect(top('iron_mg', 'veg').length).toBe(5);
    for (const key of ['iron_mg', 'folate_ug', 'vit_a_ug'] as const) {
      expect(rankRichFoods(foods, key, 'veg').every((r) => r.food.diet === 'veg')).toBe(true);
    }
  });

  it('keeps IFCT’s slips out: no fish with 100 mg of B6, no pomegranate vitamin D', async () => {
    const foods = await getCommonFoods(db);
    for (const r of rankRichFoods(foods, 'vit_b6_mg')) expect(r.amount).toBeLessThan(5);
    expect(rankRichFoods(foods, 'vit_d_ug', 'any', 20).map((r) => r.food.name)).not.toContain(
      'Pomegranate, maroon seeds',
    );
  });
});
