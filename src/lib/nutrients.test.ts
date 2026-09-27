import {
  NUTRIENTS,
  availableCarb,
  completenessFlags,
  emptyNutrients,
  estimateEnergyKcal,
  groupCoverage,
  kjToKcal,
  roundTo,
  scale,
  sumKnown,
  vitaminARaeUg,
} from './nutrients';

describe('nutrient list', () => {
  it('has the 35 columns from SPEC §3, each once', () => {
    expect(NUTRIENTS).toHaveLength(35);
    expect(new Set(NUTRIENTS.map((n) => n.key)).size).toBe(35);
  });

  it('starts every food with all nutrients unknown (null, not zero)', () => {
    const values = emptyNutrients();
    expect(Object.values(values).every((v) => v === null)).toBe(true);
  });
});

describe('kjToKcal', () => {
  it('divides by 4.184 (IFCT rice: 1491 kJ ≈ 356 kcal)', () => {
    expect(kjToKcal(1491)).toBeCloseTo(356.36, 2);
    expect(kjToKcal(4.184)).toBe(1);
  });

  it('keeps unknown as unknown', () => {
    expect(kjToKcal(null)).toBeNull();
  });
});

describe('scale', () => {
  it('converts IFCT grams to mg and µg', () => {
    expect(scale(0.00234, 1000)).toBeCloseTo(2.34); // sodium in rice, g → mg
    expect(scale(0.002605, 1e6)).toBeCloseTo(2605); // β-carotene in spinach, g → µg
  });

  it('converts INDB fatty acids from mg to g', () => {
    expect(scale(321.5, 1 / 1000)).toBeCloseTo(0.3215);
  });

  it('keeps unknown as unknown and zero as zero', () => {
    expect(scale(null, 1000)).toBeNull();
    expect(scale(0, 1000)).toBe(0);
  });
});

describe('sumKnown', () => {
  it('adds the parts that are known (vitamin D2 + D3)', () => {
    expect(sumKnown(1.2, 0.3)).toBeCloseTo(1.5);
    expect(sumKnown(1.2, null)).toBe(1.2);
  });

  it('is unknown only when every part is unknown', () => {
    expect(sumKnown(null, null)).toBeNull();
    expect(sumKnown(0, null)).toBe(0);
  });
});

describe('availableCarb', () => {
  it('subtracts fibre from carbohydrate by difference (USDA)', () => {
    expect(availableCarb(22.84, 2.6)).toBeCloseTo(20.24);
  });

  it('uses the value as is when fibre is unknown', () => {
    expect(availableCarb(10, null)).toBe(10);
  });

  it('never goes below zero', () => {
    expect(availableCarb(1, 3)).toBe(0);
  });

  it('is unknown when carbohydrate is unknown', () => {
    expect(availableCarb(null, 2)).toBeNull();
  });
});

describe('estimateEnergyKcal', () => {
  it('uses 4 / 4 / 9 kcal per gram', () => {
    expect(estimateEnergyKcal(10, 20, 5)).toBe(165);
  });

  it('gives 900 kcal for pure fat (IFCT oils have no energy value)', () => {
    expect(estimateEnergyKcal(0, 0, 100)).toBe(900);
  });

  it('needs all three macros', () => {
    expect(estimateEnergyKcal(10, null, 5)).toBeNull();
  });
});

describe('vitaminARaeUg', () => {
  it('adds retinol and β-carotene / 12 (IFCT egg)', () => {
    expect(vitaminARaeUg({ retinolUg: 198, betaCaroteneUg: 14.5 })).toBeCloseTo(199.21, 2);
  });

  it('divides other provitamin-A carotenoids by 24 (USDA)', () => {
    expect(
      vitaminARaeUg({ retinolUg: 0, betaCaroteneUg: 120, otherCarotenoidsUg: 48 }),
    ).toBeCloseTo(12);
  });

  it('treats a missing part as zero but all missing as unknown', () => {
    expect(vitaminARaeUg({ retinolUg: null, betaCaroteneUg: 2605 })).toBeCloseTo(217.08, 2);
    expect(vitaminARaeUg({ retinolUg: null, betaCaroteneUg: null })).toBeNull();
  });
});

describe('roundTo', () => {
  it('rounds and keeps null', () => {
    expect(roundTo(356.3576, 2)).toBe(356.36);
    expect(roundTo(null, 2)).toBeNull();
  });
});

describe('completeness', () => {
  it('measures the share of a group that is known', () => {
    const values = emptyNutrients();
    values.sodium_mg = 5;
    values.iron_mg = 1;
    expect(groupCoverage(values, 'mineral')).toBeCloseTo(2 / 11);
  });

  it('needs energy and all three macros for complete_macro', () => {
    const values = emptyNutrients();
    values.energy_kcal = 100;
    values.protein_g = 1;
    values.carb_g = 20;
    expect(completenessFlags(values).complete_macro).toBe(0);
    values.fat_g = 0;
    expect(completenessFlags(values).complete_macro).toBe(1);
  });

  it('uses the 80% rule for vitamins (12 of 13 known is complete)', () => {
    const values = emptyNutrients();
    for (const n of NUTRIENTS) if (n.group === 'vitamin') values[n.key] = 1;
    values.vit_b12_ug = null;
    expect(completenessFlags(values).complete_vitamin).toBe(1);
    values.biotin_ug = null;
    values.vit_d_ug = null;
    expect(completenessFlags(values).complete_vitamin).toBe(0);
  });
});
