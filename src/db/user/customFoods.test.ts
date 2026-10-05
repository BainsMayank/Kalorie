import { eq } from 'drizzle-orm';

import { emptyNutrients, type NutrientValues } from '@/lib/nutrients';

import { getUserDb } from './client';
import {
  deleteCustomFood,
  findProductByBarcode,
  getCustomFoodDetail,
  getLoggedCustomFoods,
  getRecipe,
  listCustomFoods,
  restoreCustomFood,
  saveProduct,
  saveRecipe,
  type ProductInput,
  type RecipeInput,
  type RecipeItemInput,
} from './customFoods';
import { customFoods } from './schema';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('./client', () => {
  const db = jest.requireActual('./testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const peanuts: ProductInput = {
  barcode: '8901234567894',
  name: 'Masala peanuts',
  brand: null,
  servingG: 30,
  densityGPerMl: 1,
  offStatus: 'user_added',
  offFetchedAt: null,
  labelPhotoUri: 'file:///labels/peanuts.jpg',
  nutrients: { ...emptyNutrients(), energy_kcal: 560, protein_g: 22, fat_g: 44 },
  units: [
    { unit: 'serving', label: 'serving', grams: 30, isDefault: true },
    { unit: 'pack', label: 'pack', grams: 150, isDefault: false },
  ],
};

describe('custom foods (barcode products)', () => {
  it('saves a product and finds it by barcode', async () => {
    const id = await saveProduct(peanuts, 1000);
    expect((await findProductByBarcode(peanuts.barcode))?.id).toBe(id);
    expect(await findProductByBarcode('8901234567000')).toBeNull();

    const food = (await getCustomFoodDetail(id))!;
    expect(food.labelPhotoUri).toBe('file:///labels/peanuts.jpg');
    expect(food.units.map((u) => u.unit)).toEqual(['serving', 'pack', 'g']);
    expect(food.nutrients.energy_kcal).toBe(560);
    expect(food.nutrients.iron_mg).toBeNull(); // unknown, not zero
  });

  it('saving the same barcode again keeps the id and replaces the details and units', async () => {
    const id = (await findProductByBarcode(peanuts.barcode))!.id;
    const again = await saveProduct(
      {
        ...peanuts,
        name: 'Masala peanuts (new pack)',
        units: [{ unit: 'pack', label: 'pack', grams: 200, isDefault: true }],
      },
      2000,
    );
    expect(again).toBe(id);
    const food = (await getCustomFoodDetail(id))!;
    expect(food.name).toBe('Masala peanuts (new pack)');
    expect(food.units.map((u) => [u.unit, u.grams])).toEqual([
      ['pack', 200],
      ['g', 1],
    ]);
  });

  it('lists foods for the log with their default portion', async () => {
    const id = (await findProductByBarcode(peanuts.barcode))!.id;
    const foods = await getLoggedCustomFoods([id, 'missing']);
    expect(foods.size).toBe(1);
    expect(foods.get(id)).toMatchObject({
      source: 'product',
      defaultPortion: { qty: 1, unit: 'pack', grams: 200 },
    });
  });

  it('a deleted product isn’t found by scanning, but old entries still read it', async () => {
    const id = (await findProductByBarcode(peanuts.barcode))!.id;
    await getUserDb().update(customFoods).set({ deletedAt: 3000 }).where(eq(customFoods.id, id));
    expect(await findProductByBarcode(peanuts.barcode)).toBeNull();
    expect((await getLoggedCustomFoods([id])).size).toBe(1);

    // Scanning it again brings it back with the same id.
    expect(await saveProduct(peanuts, 4000)).toBe(id);
    expect((await findProductByBarcode(peanuts.barcode))?.id).toBe(id);
  });

  it('offers only grams when no size is known', async () => {
    const id = await saveProduct({ ...peanuts, barcode: '96385074', units: [] });
    const food = (await getCustomFoodDetail(id))!;
    expect(food.units.map((u) => u.unit)).toEqual(['g']);
    expect(food).toMatchObject({ defaultUnit: 'g', defaultQty: 100 });
  });
});

describe('recipes', () => {
  const nutrients = (values: Partial<NutrientValues>): NutrientValues => ({
    ...emptyNutrients(),
    ...values,
  });
  const rajma: RecipeItemInput = {
    foodSource: 'base',
    foodId: '101',
    name: 'Rajma',
    qty: 1,
    unit: 'cup',
    grams: 200,
    isFat: false,
    nutrients: nutrients({ energy_kcal: 346, protein_g: 22.9, fat_g: 1.3 }),
  };
  const oil: RecipeItemInput = {
    foodSource: 'base',
    foodId: '102',
    name: 'Oil, sunflower',
    qty: 1,
    unit: 'tbsp',
    grams: 15,
    isFat: true,
    nutrients: nutrients({ energy_kcal: 900, fat_g: 100 }),
  };
  const input: RecipeInput = {
    name: "Mom's rajma",
    servings: 4,
    cookedWeightG: 600,
    items: [rajma, oil],
    servingLabel: 'serving',
  };

  it('saves a recipe as a food: per 100 g cooked, serving + katori units, oil control', async () => {
    const id = await saveRecipe(input, undefined, 1000);
    const food = (await getCustomFoodDetail(id))!;
    expect(food.source).toBe('recipe');
    // 692 + 135 = 827 kcal in 600 g
    expect(food.nutrients.energy_kcal).toBeCloseTo(137.83, 2);
    expect(food.units.map((u) => [u.unit, u.grams])).toEqual([
      ['serving', 150],
      ['katori', 150],
      ['g', 1],
    ]);
    expect(food).toMatchObject({ defaultUnit: 'serving', defaultQty: 1 });
    expect(food.oilStep?.energy_kcal).toBeCloseTo(11.25); // half of 135 kcal over 600 g
  });

  it('reads it back for editing, in order', async () => {
    const [saved] = await listCustomFoods('recipe');
    const recipe = (await getRecipe(saved.id))!;
    expect(recipe).toMatchObject({ name: "Mom's rajma", servings: 4, cookedWeightG: 600 });
    expect(recipe.items.map((i) => [i.name, i.grams, i.isFat])).toEqual([
      ['Rajma', 200, false],
      ['Oil, sunflower', 15, true],
    ]);
    expect(recipe.items[0].nutrients?.protein_g).toBe(22.9);
  });

  it('saving again keeps the id and replaces the ingredients and units', async () => {
    const [saved] = await listCustomFoods('recipe');
    await saveRecipe(
      { ...input, cookedWeightG: null, items: [rajma], servings: 2 },
      saved.id,
      2000,
    );
    const recipe = (await getRecipe(saved.id))!;
    expect(recipe.items.map((i) => i.name)).toEqual(['Rajma']);
    const food = (await getCustomFoodDetail(saved.id))!;
    expect(food.units.map((u) => [u.unit, u.grams])).toEqual([
      ['serving', 100],
      ['g', 1],
    ]); // not weighed: no katori
    expect(food.oilStep).toBeNull();
    expect(await listCustomFoods('recipe')).toHaveLength(1);
  });

  it('a deleted recipe leaves the list but old entries still read it; Undo restores it', async () => {
    const [saved] = await listCustomFoods('recipe');
    await deleteCustomFood(saved.id);
    expect(await listCustomFoods('recipe')).toHaveLength(0);
    expect(await getRecipe(saved.id)).toBeNull();
    expect((await getLoggedCustomFoods([saved.id])).size).toBe(1);
    await restoreCustomFood(saved.id);
    expect(await listCustomFoods('recipe')).toHaveLength(1);
  });
});
