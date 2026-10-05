import { emptyNutrients, type NutrientValues } from './nutrients';
import { nutrientsForGrams } from './nutrition';
import { withOilLevel } from './oil';
import {
  isFatIngredient,
  rawWeightG,
  recipeOilStepFor,
  recipePer100g,
  recipePerServing,
  recipeTotals,
  recipeUnits,
  recipeYieldG,
  servingWeightG,
  type RecipeAmounts,
  type RecipeIngredient,
} from './recipe';

const per100 = (values: Partial<NutrientValues>): NutrientValues => ({
  ...emptyNutrients(),
  ...values,
});

// Mom's rajma: 965 g of raw ingredients, 900 g in the pot after cooking, 4 servings.
const rajma: RecipeIngredient = {
  grams: 200,
  isFat: false,
  nutrients: per100({ energy_kcal: 346, protein_g: 22.9, carb_g: 44, fat_g: 1.3, iron_mg: 5.1 }),
};
const onion: RecipeIngredient = {
  grams: 100,
  isFat: false,
  nutrients: per100({ energy_kcal: 40, protein_g: 1.1, carb_g: 9, fat_g: 0.1 }),
};
const tomato: RecipeIngredient = {
  grams: 150,
  isFat: false,
  nutrients: per100({ energy_kcal: 18, protein_g: 0.9, carb_g: 3.9, fat_g: 0.2 }),
};
const oil: RecipeIngredient = {
  grams: 15,
  isFat: true,
  nutrients: per100({ energy_kcal: 900, fat_g: 100, sat_fat_g: 11.39, protein_g: 0, carb_g: 0 }),
};
const water: RecipeIngredient = {
  grams: 500,
  isFat: false,
  nutrients: per100({ energy_kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 }),
};
const ingredients = [rajma, onion, tomato, oil, water];
const cooked: RecipeAmounts = { ingredients, servings: 4, cookedWeightG: 900 };
const notWeighed: RecipeAmounts = { ingredients, servings: 4, cookedWeightG: null };

// In the whole pot: kcal 692 + 40 + 27 + 135 = 894 · protein 45.8 + 1.1 + 1.35 = 48.25 ·
// fat 2.6 + 0.1 + 0.3 + 15 = 18.
describe('recipe totals', () => {
  it('adds up every ingredient', () => {
    const total = recipeTotals(ingredients);
    expect(total.energy_kcal).toBeCloseTo(894);
    expect(total.protein_g).toBeCloseTo(48.25);
    expect(total.fat_g).toBeCloseTo(18);
  });

  it('leaves unknown values out, and is unknown only when no ingredient has it', () => {
    const total = recipeTotals(ingredients);
    expect(total.iron_mg).toBeCloseTo(10.2); // only rajma's iron is known
    expect(total.vit_d_ug).toBeNull();
  });

  it('counts an ingredient whose food is missing in the weight, not in the nutrients', () => {
    const recipe = { ingredients: [rajma, { grams: 50, isFat: false, nutrients: null }] };
    expect(rawWeightG(recipe.ingredients)).toBe(250);
    expect(recipeTotals(recipe.ingredients).energy_kcal).toBeCloseTo(692);
  });
});

describe('recipe per serving', () => {
  it('divides the pot by the servings: 894 kcal ÷ 4', () => {
    const serving = recipePerServing(cooked);
    expect(serving.energy_kcal).toBeCloseTo(223.5);
    expect(serving.protein_g).toBeCloseTo(12.06, 2);
    expect(serving.fat_g).toBeCloseTo(4.5);
  });

  it('does not depend on the cooked weight', () => {
    expect(recipePerServing(notWeighed).energy_kcal).toBeCloseTo(223.5);
  });

  it('weighs a quarter of the pot: 900 g ÷ 4 = 225 g', () => {
    expect(servingWeightG(cooked)).toBeCloseTo(225);
    expect(servingWeightG(notWeighed)).toBeCloseTo(241.25); // 965 g raw ÷ 4
    expect(servingWeightG({ ...cooked, servings: 0 })).toBe(0);
  });
});

describe('recipe per 100 g', () => {
  it('uses the cooked weight when it was weighed: 894 kcal in 900 g', () => {
    expect(recipeYieldG(cooked)).toBe(900);
    expect(recipePer100g(cooked).energy_kcal).toBeCloseTo(99.33, 2);
    expect(recipePer100g(cooked).fat_g).toBeCloseTo(2);
  });

  it('falls back to the raw weight: 894 kcal in 965 g', () => {
    expect(recipeYieldG(notWeighed)).toBe(965);
    expect(recipePer100g(notWeighed).energy_kcal).toBeCloseTo(92.64, 2);
  });

  it('makes 1 katori (150 g cooked) = 149 kcal, and a serving = its share of the pot', () => {
    const katori = nutrientsForGrams(recipePer100g(cooked), 150);
    expect(katori.energy_kcal).toBeCloseTo(149);
    const serving = nutrientsForGrams(recipePer100g(cooked), servingWeightG(cooked));
    expect(serving.energy_kcal).toBeCloseTo(recipePerServing(cooked).energy_kcal!);
  });

  it('is unknown for an empty recipe instead of dividing by zero', () => {
    expect(recipePer100g({ ingredients: [], servings: 2, cookedWeightG: null }).energy_kcal).toBe(
      null,
    );
  });
});

describe('recipeUnits', () => {
  it('offers serving, plus katori once the pot was weighed', () => {
    expect(recipeUnits(cooked, 'serving')).toEqual([
      { unit: 'serving', label: 'serving', grams: 225, isDefault: true },
      { unit: 'katori', label: 'katori', grams: 150, isDefault: false },
    ]);
    expect(recipeUnits(notWeighed, 'serving').map((u) => u.unit)).toEqual(['serving']);
  });
});

describe('recipe oil control', () => {
  it('has none without oil or ghee', () => {
    expect(recipeOilStepFor({ ...cooked, ingredients: [rajma, onion] })).toBeNull();
  });

  it('changes fat and calories only: 1 katori with More oil', () => {
    const step = recipeOilStepFor(cooked)!;
    // Half the 15 g oil, spread over 900 g: 7.5 g = 67.5 kcal → 7.5 kcal and 0.83 g fat per 100 g.
    expect(step.energy_kcal).toBeCloseTo(7.5);
    expect(step.fat_g).toBeCloseTo(0.833, 3);

    const normal = nutrientsForGrams(recipePer100g(cooked), 150);
    const more = withOilLevel(normal, step, 150, 1);
    const less = withOilLevel(normal, step, 150, -1);
    expect(more.energy_kcal! - normal.energy_kcal!).toBeCloseTo(11.25);
    expect(more.fat_g! - normal.fat_g!).toBeCloseTo(1.25);
    expect(normal.energy_kcal! - less.energy_kcal!).toBeCloseTo(11.25);
    for (const key of ['protein_g', 'carb_g', 'fibre_g', 'iron_mg', 'vit_d_ug'] as const) {
      expect(more[key]).toBe(normal[key]);
      expect(less[key]).toBe(normal[key]);
    }
  });
});

describe('isFatIngredient', () => {
  it('flags oil, ghee, butter, vanaspati and margarine', () => {
    for (const name of ['Oil, sunflower', 'Ghee', 'Butter, salted', 'Vanaspati', 'Margarine']) {
      expect(isFatIngredient(name)).toBe(true);
    }
  });

  it('leaves out foods that only share the word', () => {
    for (const name of ['Peanut butter', 'Buttermilk', 'Butter milk', 'Rajma, red']) {
      expect(isFatIngredient(name)).toBe(false);
    }
  });

  it("trusts INDB's fats category", () => {
    expect(isFatIngredient('Mustard, refined', 'oil_fat')).toBe(true);
  });
});
