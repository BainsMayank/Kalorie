import { absorbedFryingOilGrams, oilAdjustedPer100, oilFactor, per100WithoutPart } from './oil';

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
