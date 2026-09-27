import {
  UNIT_DEFAULTS,
  entryGrams,
  gramsPerUnit,
  isFreeNumberUnit,
  mlToGrams,
  quantityForNewUnit,
  quantityStep,
  servingGrams,
  stepQuantity,
} from './units';

describe('UNIT_DEFAULTS', () => {
  it('has the fixed sizes from SPEC §4.1', () => {
    const ml = Object.fromEntries(UNIT_DEFAULTS.map((u) => [u.unit, u.ml]));
    expect(ml).toMatchObject({ katori: 150, glass: 250, cup: 240, tbsp: 15, tsp: 5, ml: 1 });
  });
});

describe('mlToGrams', () => {
  it('multiplies by density', () => {
    expect(mlToGrams(150, 1)).toBe(150); // 1 katori dal
    expect(mlToGrams(5, 0.91)).toBeCloseTo(4.55); // 1 tsp ghee
    expect(mlToGrams(250, 1.03)).toBeCloseTo(257.5); // 1 glass milk
  });
});

describe('servingGrams', () => {
  it('works out the serving weight from kcal per serving and per 100 g (INDB chapati)', () => {
    // 36 g chapati: 100 g has 290 kcal, one chapati has 104.4 kcal
    expect(servingGrams(104.4, 290)).toBeCloseTo(36);
  });

  it('is unknown when the per-100 g value is missing or zero', () => {
    expect(servingGrams(50, 0)).toBeNull();
    expect(servingGrams(50, null)).toBeNull();
    expect(servingGrams(null, 100)).toBeNull();
  });
});

describe('gramsPerUnit', () => {
  const roti = [
    { unit: 'roti_s', grams: 25 },
    { unit: 'roti_m', grams: 35 },
    { unit: 'roti_l', grams: 50 },
  ];

  it('uses the food’s own unit first (medium roti = 35 g)', () => {
    expect(gramsPerUnit('roti_m', roti, 1)).toBe(35);
  });

  it('prefers the food’s own grams over the standard volume (INDB tbsp of chutney)', () => {
    expect(gramsPerUnit('tbsp', [{ unit: 'tbsp', grams: 19 }], 1)).toBe(19);
  });

  it('falls back to a standard volume × density (katori dal, tsp ghee)', () => {
    expect(gramsPerUnit('katori', [], 1)).toBe(150);
    expect(gramsPerUnit('tsp', [], 0.91)).toBeCloseTo(4.55);
  });

  it('treats g as 1 g whatever the density', () => {
    expect(gramsPerUnit('g', [], 0.5)).toBe(1);
  });

  it('does not offer a unit the food doesn’t have (piece of dal)', () => {
    expect(gramsPerUnit('piece', [], 1)).toBeNull();
  });
});

describe('entryGrams', () => {
  it('multiplies quantity by grams per unit', () => {
    expect(entryGrams(2, 'roti_m', [{ unit: 'roti_m', grams: 35 }], 1)).toBe(70);
    expect(entryGrams(1.5, 'katori', [], 1)).toBe(225);
    expect(entryGrams(200, 'ml', [], 1.03)).toBeCloseTo(206);
  });

  it('is unknown for a unit the food doesn’t have', () => {
    expect(entryGrams(1, 'slice', [], 1)).toBeNull();
  });
});

describe('quantityStep', () => {
  it('uses quarter steps for katori, cup and glass', () => {
    expect(quantityStep('katori')).toBe(0.25);
    expect(quantityStep('glass')).toBe(0.25);
  });

  it('uses half steps for roti, pieces and spoons', () => {
    expect(quantityStep('roti_m')).toBe(0.5);
    expect(quantityStep('piece')).toBe(0.5);
    expect(quantityStep('tsp')).toBe(0.5);
  });

  it('uses 10 for grams and ml, which can also be typed', () => {
    expect(quantityStep('g')).toBe(10);
    expect(isFreeNumberUnit('ml')).toBe(true);
    expect(isFreeNumberUnit('katori')).toBe(false);
  });
});

describe('quantityForNewUnit', () => {
  it('keeps the amount when switching to grams (1 katori → 150 g)', () => {
    expect(quantityForNewUnit('g', 1, 150)).toBe(150);
    expect(quantityForNewUnit('ml', 1.03, 257.5)).toBe(250);
  });

  it('starts at 1 for any other unit', () => {
    expect(quantityForNewUnit('roti_m', 35, 150)).toBe(1);
    expect(quantityForNewUnit('katori', 150, 70)).toBe(1);
  });

  it('never goes below 1 g', () => {
    expect(quantityForNewUnit('g', 1, 0.2)).toBe(1);
  });
});

describe('grams for each unit type', () => {
  // A food with its own units, as foods.db stores them (SPEC §4.1): roti sizes, a piece, a slice,
  // a bowl, and its own tbsp. Density 1.03 (like milk), so volume units show the density at work.
  const food = [
    { unit: 'roti_s', grams: 25 },
    { unit: 'roti_m', grams: 35 },
    { unit: 'roti_l', grams: 50 },
    { unit: 'piece', grams: 45 },
    { unit: 'slice', grams: 30 },
    { unit: 'bowl', grams: 180 },
    { unit: 'tbsp', grams: 19 },
  ];
  const grams = (qty: number, unit: string) => entryGrams(qty, unit, food, 1.03);

  it.each([
    // unit, qty, expected grams, how it's worked out
    ['g', 150, 150], // grams: 1 g each, density ignored
    ['ml', 200, 206], // 200 ml × 1.03
    ['katori', 1, 154.5], // 150 ml × 1.03
    ['katori', 0.5, 77.25],
    ['glass', 1, 257.5], // 250 ml × 1.03
    ['cup', 1.5, 370.8], // 240 ml × 1.5 × 1.03
    ['tsp', 2, 10.3], // 5 ml × 2 × 1.03
    ['tbsp', 1, 19], // the food's own tbsp wins over 15 ml
    ['roti_s', 1, 25],
    ['roti_m', 2, 70],
    ['roti_l', 0.5, 25],
    ['piece', 1.5, 67.5],
    ['slice', 2, 60],
    ['bowl', 1, 180],
  ])('%s × %s = %s g', (unit, qty, expected) => {
    expect(grams(qty, unit)).toBeCloseTo(expected);
  });

  it('does not offer a unit the food has no weight for', () => {
    expect(grams(1, 'plate')).toBeNull();
    expect(entryGrams(1, 'roti_m', [], 1)).toBeNull(); // no roti sizes on dal
  });
});

describe('stepQuantity', () => {
  it('moves by half a roti or piece, down to 0.5', () => {
    expect(stepQuantity(1, 'roti_m', 1)).toBe(1.5);
    expect(stepQuantity(1, 'roti_m', -1)).toBe(0.5);
    expect(stepQuantity(0.5, 'piece', -1)).toBe(0.5); // never 0
  });

  it('moves by a quarter katori', () => {
    expect(stepQuantity(1, 'katori', 1)).toBe(1.25);
    expect(stepQuantity(0.25, 'katori', -1)).toBe(0.25);
  });

  it('snaps a typed amount to the step', () => {
    expect(stepQuantity(1.3, 'roti_m', 1)).toBe(2); // 1.8 → 2
    expect(stepQuantity(137, 'g', 1)).toBe(150);
  });
});
