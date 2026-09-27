import { ifctFood, isNumberedVariety, unanalysedColumns } from './ifct';
import {
  believableServing,
  fixedIndbServing,
  indbFood,
  indbServing,
  indbServingUnit,
} from './indb';
import {
  categoryFromCode,
  energyCheckRatio,
  ingredientUse,
  isFatIngredient,
  recipeGrams,
} from './indb-recipes';
import { usdaNutrients, usdaPortionUnit } from './usda';

describe('INDB conversion', () => {
  // Hot tea (Garam Chai), values rounded from the real row ASC001.
  const tea = {
    food_code: 'ASC001',
    food_name: 'Hot tea (Garam Chai)',
    energy_kcal: 16.14,
    protein_g: 0.39,
    carb_g: 2.58,
    fat_g: 0.53,
    freesugar_g: 2.58,
    fibre_g: 0,
    sfa_mg: 321.5,
    mufa_mg: 144.2,
    pufa_mg: 20,
    sodium_mg: 3.12,
    vita_ug: 10,
    carotenoids_ug: 24,
    vitd2_ug: 0.1,
    vitd3_ug: 0.05,
    vitk1_ug: 0.2,
    vitk2_ug: null,
    servings_unit: 'tea cup',
    unit_serving_energy_kcal: 33.98,
  };

  it('keeps per-100 g values and converts fatty acids from mg to g', () => {
    const food = indbFood(tea);
    expect(food.nutrients.energy_kcal).toBe(16.14);
    expect(food.nutrients.sugar_g).toBe(2.58);
    expect(food.nutrients.sat_fat_g).toBeCloseTo(0.3215);
    expect(food.nutrients.mufa_g).toBeCloseTo(0.1442);
  });

  it('builds vitamin A RAE from retinol + carotenoids / 12, and adds D2+D3 and K1+K2', () => {
    const food = indbFood(tea);
    expect(food.nutrients.vit_a_ug).toBeCloseTo(12);
    expect(food.nutrients.vit_d_ug).toBeCloseTo(0.15);
    expect(food.nutrients.vit_k_ug).toBeCloseTo(0.2);
  });

  it('leaves nutrients INDB never has as unknown', () => {
    const food = indbFood(tea);
    expect(food.nutrients.trans_fat_g).toBeNull();
    expect(food.nutrients.iodine_ug).toBeNull();
    expect(food.nutrients.vit_b12_ug).toBeNull();
  });

  it('splits the Hindi name out of the display name', () => {
    const food = indbFood(tea);
    expect(food.name).toBe('Hot tea');
    expect(food.nameHi).toBe('Garam Chai');
    expect(food.category).toBe('beverage');
  });

  it('works out serving grams from kcal (33.98 / 16.14 × 100 ≈ 210.5 g)', () => {
    expect(indbServing(tea)).toEqual({ unit: 'serving', label: 'tea cup', grams: 210.5 });
  });

  it('drops servings that are not a real portion', () => {
    expect(indbServing({ ...tea, servings_unit: 'ml' })).toBeNull();
    expect(indbServing({ ...tea, servings_unit: '' })).toBeNull();
  });

  it('believes a normal serving, but not a whole recipe, a huge piece or a jug-sized cup', () => {
    const vada = { unit: 'piece', label: 'vada', grams: 64 };
    expect(believableServing(vada, 275)).toBe(true); // 176 kcal
    expect(believableServing({ ...vada, grams: 172 }, 668)).toBe(false); // 1,150 kcal
    expect(believableServing({ unit: 'bowl', label: 'bowl', grams: 366 }, 251)).toBe(false); // 919 kcal
    expect(believableServing({ unit: 'serving', label: 'tea cup', grams: 210.5 }, 16)).toBe(true);
    expect(believableServing({ unit: 'serving', label: 'tea cup', grams: 450 }, 23)).toBe(false);
    expect(believableServing({ unit: 'serving', label: 'tea cup', grams: 1400 }, null)).toBe(false);
    expect(believableServing({ unit: 'tsp', label: 'tsp', grams: 3 }, 100)).toBe(false); // < 5 g
  });

  it('shrinks the serving with its recipe, or uses a piece count from indb_servings.csv', () => {
    const vada = { unit: 'piece', label: 'vada', grams: 172 };
    // The recipe lost 62% of its weight (frying oil): 172 g → 65.4 g
    expect(fixedIndbServing(vada, 275, 0.38)).toEqual({ ...vada, grams: 65.4 });
    // Still 1,150 kcal if nothing changed → dropped
    expect(fixedIndbServing(vada, 668, 1)).toBeNull();
    // Nothing to change → the same serving back
    const tea = { unit: 'serving', label: 'tea cup', grams: 210.5 };
    expect(fixedIndbServing(tea, 16, 1)).toBe(tea);
    // 529 g of gulab jamun (syrup included) in 12 pieces
    const pieces = { pieces: 12, label: 'gulab jamun', yieldG: 529 };
    expect(fixedIndbServing(null, 365, 1, pieces)).toEqual({
      unit: 'piece',
      label: 'gulab jamun',
      grams: 44.1,
    });
  });

  it('maps serving names to unit keys', () => {
    expect(indbServingUnit('parantha')).toEqual({ unit: 'piece', label: 'parantha' });
    expect(indbServingUnit('Soup Bowl')).toEqual({ unit: 'bowl', label: 'soup bowl' });
    expect(indbServingUnit('tablespoon')).toEqual({ unit: 'tbsp', label: 'tbsp' });
    expect(indbServingUnit('large slice')).toEqual({ unit: 'slice', label: 'large slice' });
    expect(indbServingUnit('jar')).toBeNull();
  });
});

describe('IFCT conversion', () => {
  // Rice, raw, milled (A015) — every IFCT value is in grams per 100 g; energy in kJ.
  const rice: Record<string, string> = {
    code: 'A015',
    name: 'Rice, raw, milled',
    lang: 'B. Chowl; H. Chawal; Tam. Arisi.',
    grup: 'Cereals and Millets',
    tags: 'vegetarian eggetarian fishetarian veg',
    enerc: '1491',
    protcnt: '7.94',
    choavldf: '78.24',
    fatce: '0.52',
    fibtg: '2.81',
    na: '0.00234',
    fe: '0.00065',
    se: '0.000001',
    retol: '0',
    cartbeq: '0.000012',
    thia: '0.00005',
  };

  it('converts kJ to kcal and grams to mg / µg', () => {
    const food = ifctFood(rice);
    expect(food.nutrients.energy_kcal).toBeCloseTo(356.36, 2);
    expect(food.nutrients.sodium_mg).toBeCloseTo(2.34);
    expect(food.nutrients.iron_mg).toBeCloseTo(0.65);
    expect(food.nutrients.selenium_ug).toBeCloseTo(1);
    expect(food.nutrients.thiamine_mg).toBeCloseTo(0.05);
    expect(food.nutrients.vit_a_ug).toBeCloseTo(1); // 12 µg β-carotene / 12
  });

  it('reads Hindi and regional names', () => {
    const food = ifctFood(rice);
    expect(food.nameHi).toBe('Chawal');
    expect(food.sourceTerms).toEqual(
      expect.arrayContaining([
        { term: 'Chawal', kind: 'hindi' },
        { term: 'Arisi', kind: 'regional' },
      ]),
    );
    expect(food.diet).toBe('veg');
  });

  it('estimates energy for oils (IFCT gives 0) and marks vitamins and minerals unknown', () => {
    const oil = {
      code: 'T005',
      name: 'Groundnut oil',
      grup: 'Edible Oils and Fats',
      tags: 'veg',
      enerc: '0',
      protcnt: '0',
      choavldf: '0',
      fatce: '100',
      fasat: '18.94',
      cholc: '0',
    };
    const food = ifctFood(oil);
    expect(food.nutrients.energy_kcal).toBe(900);
    expect(food.energyEstimated).toBe(true);
    expect(food.nutrients.sat_fat_g).toBe(18.94);
    expect(food.nutrients.sodium_mg).toBeNull();
    expect(food.nutrients.vit_e_mg).toBeNull();
    expect(food.nutrients.cholesterol_mg).toBeNull();
  });

  it('keeps a single zero inside an analysed group as a real zero', () => {
    const cols = unanalysedColumns({ ...rice, vitc: '0' });
    expect(cols.has('vitc')).toBe(false);
    expect(ifctFood({ ...rice, vitc: '0' }).nutrients.vit_c_mg).toBe(0);
  });

  it('spots numbered varieties', () => {
    expect(isNumberedVariety('Brinjal-12')).toBe(true);
    expect(isNumberedVariety('Chillies, green-3')).toBe(true);
    expect(isNumberedVariety('Brinjal - all varieties')).toBe(false);
  });
});

describe('USDA conversion', () => {
  // Bananas, raw (SR 173944)
  const banana = new Map<number, number>([
    [1008, 89],
    [1003, 1.09],
    [1004, 0.33],
    [1005, 22.84],
    [1079, 2.6],
    [2000, 12.23],
    [1106, 3],
    [1162, 8.7],
    [1185, 0.5],
  ]);

  it('takes values straight across and subtracts fibre from carbs', () => {
    const { nutrients, energyEstimated } = usdaNutrients(banana);
    expect(nutrients.energy_kcal).toBe(89);
    expect(energyEstimated).toBe(false);
    expect(nutrients.carb_g).toBeCloseTo(20.24);
    expect(nutrients.sugar_g).toBe(12.23);
    expect(nutrients.vit_a_ug).toBe(3);
    expect(nutrients.vit_k_ug).toBe(0.5);
    expect(nutrients.biotin_ug).toBeNull();
  });

  it('falls back to Atwater energy, then to an estimate', () => {
    const atwater = new Map([
      [2047, 120],
      [1003, 1],
      [1004, 1],
      [1005, 1],
    ]);
    expect(usdaNutrients(atwater).nutrients.energy_kcal).toBe(120);
    const none = new Map([
      [1003, 10],
      [1004, 5],
      [1050, 20],
    ]);
    const result = usdaNutrients(none);
    expect(result.nutrients.energy_kcal).toBe(165);
    expect(result.energyEstimated).toBe(true);
  });

  it('computes vitamin A RAE from carotenoids when RAE is missing', () => {
    const m = new Map([
      [1105, 10],
      [1107, 120],
      [1108, 24],
      [1120, 24],
    ]);
    expect(usdaNutrients(m).nutrients.vit_a_ug).toBeCloseTo(10 + 10 + 2);
  });

  it('maps household measures to unit keys', () => {
    expect(usdaPortionUnit('undetermined', 'cup, chopped')).toEqual({
      unit: 'cup',
      label: 'cup, chopped',
    });
    expect(usdaPortionUnit('tablespoon', '')).toEqual({ unit: 'tbsp', label: 'tablespoon' });
    expect(usdaPortionUnit('', 'large')).toEqual({ unit: 'piece_l', label: 'large' });
    expect(usdaPortionUnit('', 'medium (7" to 7-7/8" long)')?.unit).toBe('piece');
    expect(usdaPortionUnit('', 'oz')).toBeNull();
    expect(usdaPortionUnit('fl oz', '')).toBeNull();
  });
});

describe('INDB recipes', () => {
  it('turns kitchen measures into grams (cup = 240 ml, like the app)', () => {
    expect(recipeGrams(1, 'tsp', 0.92)).toBeCloseTo(4.6); // 1 tsp oil
    expect(recipeGrams(1, 'tbsp', 1)).toBe(15);
    expect(recipeGrams(1.5, 'C', 1)).toBe(360); // 1.5 cups water
    expect(recipeGrams(50, 'ml', 1.03)).toBeCloseTo(51.5); // 50 ml milk
    expect(recipeGrams(20, 'g', 0.5)).toBe(20); // grams ignore density
    expect(recipeGrams(2, 'sprig', 1)).toBe(3);
  });

  it('gives no grams for a missing amount or an unknown unit', () => {
    expect(recipeGrams(null, 'g', 1)).toBeNull();
    expect(recipeGrams(1, 'handful', 1)).toBeNull();
  });

  it('reads the food group from the code letter', () => {
    expect(categoryFromCode('T508')).toBe('oil_fat');
    expect(categoryFromCode('A015')).toBe('cereal');
    expect(categoryFromCode('')).toBe('misc');
  });

  it('reads frying oil and discarded water from INDB’s own wording', () => {
    expect(ingredientUse('for deep frying', 'Oil')).toBe('frying');
    expect(ingredientUse('', 'Oil (for frying)')).toBe('frying');
    expect(ingredientUse('for fryng', 'Oil')).toBe('frying'); // INDB's typo
    expect(ingredientUse('enough to immerse egg', 'Water')).toBe('discarded');
    expect(ingredientUse('2 to 3', 'Water for steaming')).toBe('discarded');
    expect(ingredientUse('For soaking', 'Water')).toBe('eaten'); // sago soaks it up
    expect(ingredientUse('1', 'Oil')).toBe('eaten');
    expect(ingredientUse('2', 'Fryums')).toBe('eaten');
  });

  it('flags cooking fats but not peanut butter or buttermilk', () => {
    expect(isFatIngredient('Oil, sunflower', 'oil_fat')).toBe(true);
    expect(isFatIngredient('Ghee, butter', 'oil_fat')).toBe(true);
    expect(isFatIngredient('Butter, unsalted', 'dairy')).toBe(true);
    expect(isFatIngredient('Peanut butter, smooth', 'pulse')).toBe(false);
    expect(isFatIngredient('Milk, buttermilk, fluid, whole', 'dairy')).toBe(false);
  });

  it('checks ingredient energy against INDB’s own kcal on the raw recipe weight', () => {
    // 300 g recipe, 50 kcal per 100 g → 150 kcal expected
    const base = { knownGrams: 100, solidGrams: 100, rawGrams: 300, dishKcalPer100: 50 };
    expect(energyCheckRatio({ ...base, knownKcal: 150 })).toBeCloseTo(1);
    expect(energyCheckRatio({ ...base, knownKcal: 165 })).toBeCloseTo(1.1);
  });

  it('skips the energy check when too little of the recipe has known energy', () => {
    const r = {
      knownKcal: 150,
      knownGrams: 90,
      solidGrams: 100,
      rawGrams: 300,
      dishKcalPer100: 50,
    };
    expect(energyCheckRatio(r)).toBeNull();
  });
});
