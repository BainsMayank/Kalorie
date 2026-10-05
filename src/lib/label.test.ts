import { labelToPer100g, per100gFactor, productUnits, toPer100g } from './label';

describe('per100gFactor', () => {
  it('is 1 for values already per 100 g', () => {
    expect(per100gFactor({ per: '100g' })).toBe(1);
  });

  it('is 100 / serving grams for values per serving', () => {
    expect(per100gFactor({ per: 'serving', servingG: 25 })).toBe(4);
    expect(per100gFactor({ per: 'serving', servingG: 200 })).toBe(0.5);
  });

  it('divides by the density for values per 100 ml', () => {
    expect(per100gFactor({ per: '100ml', densityGPerMl: 1 })).toBe(1);
    expect(per100gFactor({ per: '100ml', densityGPerMl: 1.25 })).toBe(0.8);
  });

  it('is null for a serving or density that is not a positive number', () => {
    expect(per100gFactor({ per: 'serving', servingG: 0 })).toBeNull();
    expect(per100gFactor({ per: 'serving', servingG: -5 })).toBeNull();
    expect(per100gFactor({ per: '100ml', densityGPerMl: 0 })).toBeNull();
  });
});

describe('toPer100g', () => {
  it('turns a per-serving value into per 100 g', () => {
    // A 30 g serving of biscuits with 138 kcal → 460 kcal per 100 g.
    expect(toPer100g(138, { per: 'serving', servingG: 30 })).toBeCloseTo(460);
  });

  it('keeps unknown as unknown', () => {
    expect(toPer100g(null, { per: 'serving', servingG: 30 })).toBeNull();
  });
});

describe('labelToPer100g', () => {
  it('converts a whole Indian label given per serving (Parle-G: one 56.4 g pack)', () => {
    const per100 = labelToPer100g(
      { energy_kcal: 260, protein_g: 4, carb_g: 44, fat_g: 7, sodium_mg: 170 },
      { per: 'serving', servingG: 56.4 },
    )!;
    expect(per100.energy_kcal).toBeCloseTo(461, 0);
    expect(per100.protein_g).toBeCloseTo(7.09, 2);
    expect(per100.carb_g).toBeCloseTo(78.01, 2);
    expect(per100.fat_g).toBeCloseTo(12.41, 2);
    expect(per100.sodium_mg).toBeCloseTo(301.4, 1);
  });

  it('leaves out-of-label nutrients unknown, and keeps a real 0 as 0', () => {
    const per100 = labelToPer100g({ energy_kcal: 120, trans_fat_g: 0 }, { per: '100g' })!;
    expect(per100.energy_kcal).toBe(120);
    expect(per100.trans_fat_g).toBe(0);
    expect(per100.protein_g).toBeNull();
    expect(per100.iron_mg).toBeNull();
  });

  it('turns per 100 ml into per 100 g for a drink', () => {
    const per100 = labelToPer100g({ energy_kcal: 44 }, { per: '100ml', densityGPerMl: 1.04 })!;
    expect(per100.energy_kcal).toBeCloseTo(42.3, 1);
  });

  it('gives null for a serving of 0 g', () => {
    expect(labelToPer100g({ energy_kcal: 100 }, { per: 'serving', servingG: 0 })).toBeNull();
  });
});

describe('productUnits', () => {
  it('offers a serving and the pack, serving first', () => {
    expect(productUnits({ servingG: 30, packG: 150, isLiquid: false })).toEqual([
      { unit: 'serving', grams: 30, isDefault: true },
      { unit: 'pack', grams: 150, isDefault: false },
    ]);
  });

  it('offers only one when the serving is the whole pack (Maggi 70 g)', () => {
    expect(productUnits({ servingG: 70, packG: 70, isLiquid: false })).toEqual([
      { unit: 'serving', grams: 70, isDefault: true },
    ]);
  });

  it('makes the pack the default when there is no serving size', () => {
    expect(productUnits({ servingG: null, packG: 200, isLiquid: false })).toEqual([
      { unit: 'pack', grams: 200, isDefault: true },
    ]);
  });

  it('adds ml for drinks', () => {
    expect(productUnits({ servingG: 200, packG: 1000, isLiquid: true })).toContainEqual({
      unit: 'ml',
      grams: 1,
      isDefault: false,
    });
  });

  it('offers nothing but grams when no size is known', () => {
    expect(productUnits({ servingG: null, packG: null, isLiquid: false })).toEqual([]);
    expect(productUnits({ servingG: 0, packG: null, isLiquid: false })).toEqual([]);
  });
});
