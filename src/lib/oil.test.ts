import { oilAdjustedPer100, oilFactor } from './oil';

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
