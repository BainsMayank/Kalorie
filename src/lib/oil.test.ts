import { NUTRIENT_KEYS, emptyNutrients } from './nutrients';
import {
  OIL_NUTRIENTS,
  absorbedFryingOilGrams,
  genericOilStep,
  oilAdjustedPer100,
  oilFactor,
  per100WithoutPart,
  recipeOilStep,
  withOilLevel,
} from './oil';

describe('oilFactor', () => {
  it('maps Less / Normal / More to 0.5 / 1 / 1.5', () => {
    expect(oilFactor(-1)).toBe(0.5);
    expect(oilFactor(0)).toBe(1);
    expect(oilFactor(1)).toBe(1.5);
  });
});

describe('oilAdjustedPer100', () => {
  // Dal tadka: 600 g cooked, 100 kcal per 100 g (600 kcal in the pot),
  // of which 15 g ghee = 135 kcal.
  const dal = { per100: 100, fatTotal: 135, fatGrams: 15, yieldG: 600 };
  const kcal = (factor: number) =>
    oilAdjustedPer100(dal.per100, dal.fatTotal, dal.fatGrams, dal.yieldG, factor);

  it('changes nothing at Normal', () => {
    expect(kcal(1)).toBeCloseTo(100);
  });

  it('adds half the ghee for More: (600 + 67.5) / (600 + 7.5) × 100', () => {
    expect(kcal(1.5)).toBeCloseTo(109.88, 2);
  });

  it('removes half the ghee for Less: (600 − 67.5) / (600 − 7.5) × 100', () => {
    expect(kcal(0.5)).toBeCloseTo(89.87, 2);
  });

  it('never goes below zero, even if the recipe fat is larger than the dish total', () => {
    expect(oilAdjustedPer100(1, 500, 60, 600, 0)).toBe(0);
  });

  it('keeps unknown values unknown', () => {
    expect(oilAdjustedPer100(null, 10, 15, 600, 1.5)).toBeNull();
  });
});

describe('per100WithoutPart', () => {
  it('drains water: a 50 g egg boiled in 100 g water is back to egg values', () => {
    // 150 g recipe at 50 kcal per 100 g = 75 kcal, all from the egg
    expect(per100WithoutPart(50, 150, 100, 0)).toBeCloseTo(150);
  });

  it('removes oil and its nutrients: 300 g at 400 kcal/100 g minus 100 g oil (900 kcal)', () => {
    // (1200 − 900) / (300 − 100) × 100
    expect(per100WithoutPart(400, 300, 100, 900)).toBeCloseTo(150);
  });

  it('never goes below zero and keeps unknown values unknown', () => {
    expect(per100WithoutPart(10, 300, 100, 900)).toBe(0);
    expect(per100WithoutPart(null, 300, 100, 900)).toBeNull();
  });
});

describe('absorbedFryingOilGrams', () => {
  it('keeps 15% of the other ingredients: a 200 g vada batter soaks up 30 g', () => {
    expect(absorbedFryingOilGrams(442, 200)).toBeCloseTo(30);
  });

  it('never keeps more oil than the recipe lists', () => {
    expect(absorbedFryingOilGrams(9, 300)).toBe(9);
  });
});

describe('withOilLevel', () => {
  // 1 katori (150 g) of a dish with 3 g fat and 4 g protein, cooked with oil but without a recipe.
  const portion = { ...emptyNutrients(), energy_kcal: 120, protein_g: 4, carb_g: 15, fat_g: 3 };
  const step = genericOilStep();

  it('adds or takes away 5 g of oil per 150 g (45 kcal)', () => {
    expect(withOilLevel(portion, step, 150, 1).energy_kcal).toBeCloseTo(165);
    expect(withOilLevel(portion, step, 150, 1).fat_g).toBeCloseTo(8);
    expect(withOilLevel(portion, step, 300, 1).fat_g).toBeCloseTo(13); // 2 katori: 10 g
  });

  it('changes fat and calories only', () => {
    const more = withOilLevel(portion, step, 150, 1);
    for (const key of NUTRIENT_KEYS) {
      if ((OIL_NUTRIENTS as readonly string[]).includes(key)) continue;
      expect(more[key]).toBe(portion[key]);
    }
  });

  it('never takes out more fat than the portion has, and keeps unknown values unknown', () => {
    const less = withOilLevel(portion, step, 150, -1);
    expect(less.fat_g).toBe(0);
    expect(less.energy_kcal).toBeCloseTo(75);
    expect(less.sat_fat_g).toBeNull();
  });

  it('changes nothing at Normal or without a step', () => {
    expect(withOilLevel(portion, step, 150, 0)).toBe(portion);
    expect(withOilLevel(portion, null, 150, 1)).toBe(portion);
  });
});

describe('recipeOilStep', () => {
  it('is half the fat ingredients per 100 g of the dish (dal: 10 g ghee in 600 g)', () => {
    const ghee = { grams: 10, nutrients: { energy_kcal: 900, fat_g: 99.5, protein_g: 0.3 } };
    const step = recipeOilStep([ghee], 600)!;
    expect(step.energy_kcal).toBeCloseTo(7.5); // 45 kcal ÷ 6
    expect(step.fat_g).toBeCloseTo(0.829, 3);
    expect(step.sat_fat_g).toBe(0); // unknown in the ghee: moves nothing
  });

  it('has no step without fat, or without a weight', () => {
    expect(recipeOilStep([], 600)).toBeNull();
    expect(recipeOilStep([{ grams: 10, nutrients: { fat_g: 100 } }], 0)).toBeNull();
  });
});
