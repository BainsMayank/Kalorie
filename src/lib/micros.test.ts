import {
  coverage,
  hasRichFoods,
  isIncomplete,
  microGoals,
  microRows,
  rankRichFoods,
  shareOf,
  type MicroEntry,
  type RichFoodCandidate,
} from './micros';
import { emptyNutrients, type NutrientValues } from './nutrients';
import { microRequirements } from './targets/icmr';

function values(partial: Partial<NutrientValues>): NutrientValues {
  return { ...emptyNutrients(), ...partial };
}

let nextId = 0;
function food(
  foodKey: string,
  grams: number,
  nutrients: Partial<NutrientValues>,
  name = foodKey,
): MicroEntry {
  nextId += 1;
  return { entryId: `e${nextId}`, foodKey, name, grams, nutrients: values(nutrients) };
}
function quickAdd(name = 'Quick add'): MicroEntry {
  nextId += 1;
  return {
    entryId: `e${nextId}`,
    foodKey: 'quick',
    name,
    grams: null,
    nutrients: values({ energy_kcal: 500 }),
  };
}

const TARGETS = { fibre_g: 25, sodium_mg_limit: 2000, sugar_g_limit: 50, sat_fat_g_limit: 22 };
/** A 30-year-old sedentary woman: iron 29 mg, calcium 1000 mg, vitamin C 65 mg (ICMR-NIN p. 13). */
const WOMAN = microGoals(microRequirements('f', 30, 'sedentary'), TARGETS);

describe('shareOf (% of daily need)', () => {
  it('divides what was eaten by the need', () => {
    expect(shareOf(14.5, 29)).toBeCloseTo(0.5);
    expect(shareOf(1300, 1000)).toBeCloseTo(1.3); // not capped: 130%
    expect(shareOf(0, 65)).toBe(0);
  });

  it('has no share without a need or without a total', () => {
    expect(shareOf(12, null)).toBeNull();
    expect(shareOf(null, 29)).toBeNull();
    expect(shareOf(12, 0)).toBeNull();
  });
});

describe('microGoals', () => {
  it('uses ICMR-NIN needs for vitamins and minerals, by sex', () => {
    expect(WOMAN.iron_mg).toEqual({ goal: { kind: 'need', amount: 29 }, tul: 45 });
    const man = microGoals(microRequirements('m', 30, 'sedentary'), TARGETS);
    expect(man.iron_mg?.goal?.amount).toBe(19);
  });

  it('uses the person’s own fibre target and limits', () => {
    expect(WOMAN.fibre_g?.goal).toEqual({ kind: 'need', amount: 25 });
    expect(WOMAN.sodium_mg?.goal).toEqual({ kind: 'limit', amount: 2000 });
    expect(WOMAN.sugar_g?.goal).toEqual({ kind: 'limit', amount: 50 });
    expect(WOMAN.sat_fat_g?.goal).toEqual({ kind: 'limit', amount: 22 });
    expect(WOMAN.cholesterol_mg?.goal).toBeNull();
  });

  it('never holds food against magnesium’s supplements-only upper level', () => {
    expect(WOMAN.magnesium_mg?.tul).toBeNull();
  });

  it('has no needs under 18, only the limits', () => {
    const teen = microGoals(microRequirements('f', 16, 'sedentary'), TARGETS);
    expect(teen.iron_mg?.goal).toBeNull();
    expect(teen.sodium_mg?.goal?.kind).toBe('limit');
  });
});

describe('coverage (completeness counting)', () => {
  it('weighs by grams and counts foods', () => {
    const entries = [
      food('base:dal', 150, { iron_mg: 2 }, 'Mixed dal'),
      food('base:roti', 70, { iron_mg: 1.5 }, 'Roti'),
      food('custom:maggi', 80, { iron_mg: null }, 'Maggi'),
    ];
    const c = coverage(entries, 'iron_mg');
    expect(c.share).toBeCloseTo(220 / 300);
    expect(c).toMatchObject({ foods: 3, knownFoods: 2, quickAdds: 0, missing: ['Maggi'] });
    expect(isIncomplete(c)).toBe(true); // 73% of the grams < 80%
  });

  it('is complete at 80% of the grams or more', () => {
    const entries = [food('a', 400, { iron_mg: 2 }), food('b', 100, { iron_mg: null })];
    expect(coverage(entries, 'iron_mg').share).toBeCloseTo(0.8);
    expect(isIncomplete(coverage(entries, 'iron_mg'))).toBe(false);
  });

  it('counts the same food logged twice as one food', () => {
    const entries = [
      food('base:roti', 35, { iron_mg: 1 }, 'Roti'),
      food('base:roti', 70, { iron_mg: 2 }, 'Roti'),
      food('base:dal', 150, { iron_mg: null }, 'Mixed dal'),
    ];
    expect(coverage(entries, 'iron_mg')).toMatchObject({
      foods: 2,
      knownFoods: 1,
      missing: ['Mixed dal'],
    });
  });

  it('counts each quick add as a food with no data, and marks the day incomplete', () => {
    const entries = [food('base:dal', 150, { iron_mg: 2 }), quickAdd('Wedding buffet'), quickAdd()];
    const c = coverage(entries, 'iron_mg');
    expect(c.share).toBe(1); // every weighed gram has data…
    expect(c).toMatchObject({ foods: 3, knownFoods: 1, quickAdds: 2 });
    expect(c.missing).toEqual(['Wedding buffet', 'Quick add']);
    expect(isIncomplete(c)).toBe(true); // …but the quick adds' vitamins are unknown
  });

  it('is complete for an empty day', () => {
    expect(coverage([], 'iron_mg')).toMatchObject({ share: 1, foods: 0, knownFoods: 0 });
  });
});

describe('microRows', () => {
  const day = [
    food('base:dal', 150, { iron_mg: 3, vit_c_mg: 6, vit_b12_ug: null, fibre_g: 6 }),
    food('base:guava', 100, { iron_mg: 0.3, vit_c_mg: 214, vit_b12_ug: null, fibre_g: 8.6 }),
    food('usda:milk', 258, { iron_mg: 0.1, vit_c_mg: 0, vit_b12_ug: 1.2, fibre_g: 0 }),
  ];
  const find = (rows: ReturnType<typeof microRows>, key: string) =>
    [...rows.vitamin, ...rows.mineral, ...rows.other].find((r) => r.nutrient === key)!;

  it('groups vitamins, minerals and other, in SPEC order', () => {
    const rows = microRows(day, WOMAN);
    expect(rows.vitamin.map((r) => r.nutrient)).toHaveLength(13);
    expect(rows.vitamin[0].nutrient).toBe('vit_a_ug');
    expect(rows.mineral.map((r) => r.nutrient)).toContain('iron_mg');
    expect(rows.other.map((r) => r.nutrient)).toEqual([
      'fibre_g',
      'sugar_g',
      'sat_fat_g',
      'mufa_g',
      'pufa_g',
      'trans_fat_g',
      'cholesterol_mg',
    ]);
  });

  it('adds up a day and compares it to the need', () => {
    const iron = find(microRows(day, WOMAN), 'iron_mg');
    expect(iron.total).toBeCloseTo(3.4);
    expect(iron.share).toBeCloseTo(3.4 / 29);
    expect(iron.incomplete).toBe(false);
    const vitC = find(microRows(day, WOMAN), 'vit_c_mg');
    expect(vitC.share).toBeCloseTo(220 / 65); // 338%, more than the need is fine
    expect(vitC.aboveTul).toBe(false); // the upper level is 2000 mg
  });

  it('keeps a nutrient only some foods have as incomplete, never as a plain low number', () => {
    const b12 = find(microRows(day, WOMAN), 'vit_b12_ug');
    expect(b12.total).toBeCloseTo(1.2);
    expect(b12.incomplete).toBe(true); // milk is 258 of 508 g
    expect(b12.coverage).toMatchObject({ foods: 3, knownFoods: 1 });
  });

  it('has no total or share when no food eaten has the value', () => {
    const iodine = find(microRows(day, WOMAN), 'iodine_ug');
    expect(iodine.total).toBeNull();
    expect(iodine.share).toBeNull();
    expect(iodine.incomplete).toBe(true);
  });

  it('notes a total above the safe upper level', () => {
    const rows = microRows([food('supplement', 10, { iron_mg: 60 })], WOMAN);
    expect(find(rows, 'iron_mg')).toMatchObject({ aboveTul: true, tul: 45 });
  });

  it('averages a week over the logged days only', () => {
    // Three logged days in a week (the other four missed): 3 + 9 + 6 mg of iron.
    const week = [
      food('a', 100, { iron_mg: 3 }),
      food('b', 100, { iron_mg: 9 }),
      food('c', 100, { iron_mg: 6 }),
    ];
    const iron = find(microRows(week, WOMAN, 3), 'iron_mg');
    expect(iron.total).toBeCloseTo(6); // not 18 / 7
    expect(iron.share).toBeCloseTo(6 / 29);
  });

  it('shows nothing as incomplete on an empty day', () => {
    const iron = find(microRows([], WOMAN), 'iron_mg');
    expect(iron).toMatchObject({ total: null, share: null, incomplete: false });
  });
});

describe('rankRichFoods', () => {
  const candidate = (
    foodId: number,
    name: string,
    diet: RichFoodCandidate['diet'],
    grams: number,
    nutrients: Partial<NutrientValues>,
  ): RichFoodCandidate => ({
    foodId,
    name,
    diet,
    qty: 1,
    unit: 'katori',
    grams,
    nutrients: values(nutrients),
  });
  const pool = [
    candidate(1, 'Mixed dal', 'veg', 150, { iron_mg: 1.6 }), // 2.4 mg a katori
    candidate(2, 'Sarson ka saag', 'veg', 150, { iron_mg: 2.4 }), // 3.6
    candidate(3, 'Chicken liver', 'nonveg', 50, { iron_mg: 11.6 }), // 5.8
    candidate(4, 'Egg curry', 'egg', 150, { iron_mg: 2 }), // 3
    candidate(5, 'Poha', 'veg', 120, { iron_mg: 3 }), // 3.6 — ties with saag
    candidate(6, 'Maggi', 'veg', 70, { iron_mg: null }),
    candidate(7, 'Rice', 'veg', 98, { iron_mg: 0 }),
    candidate(8, 'Rohu', 'nonveg', 100, { iron_mg: 1 }),
  ];
  const names = (list: ReturnType<typeof rankRichFoods>) => list.map((r) => r.food.name);

  it('ranks by the amount in one everyday portion, not per 100 g', () => {
    const ranked = rankRichFoods(pool, 'iron_mg');
    expect(names(ranked)).toEqual([
      'Chicken liver',
      'Poha',
      'Sarson ka saag',
      'Egg curry',
      'Mixed dal',
    ]);
    expect(ranked[0].amount).toBeCloseTo(5.8);
  });

  it('breaks ties by name and leaves out unknown and zero values', () => {
    const ranked = names(rankRichFoods(pool, 'iron_mg', 'any', 10));
    expect(ranked.indexOf('Poha')).toBeLessThan(ranked.indexOf('Sarson ka saag'));
    expect(ranked).not.toContain('Maggi');
    expect(ranked).not.toContain('Rice');
  });

  it('puts vegetarian foods first for a vegetarian, then fills with the rest', () => {
    expect(names(rankRichFoods(pool, 'iron_mg', 'veg'))).toEqual([
      'Poha',
      'Sarson ka saag',
      'Mixed dal',
      'Chicken liver',
      'Egg curry',
    ]);
  });

  it('counts eggs as fine for vegetarian + eggs', () => {
    expect(names(rankRichFoods(pool, 'iron_mg', 'egg')).slice(0, 4)).toEqual([
      'Poha',
      'Sarson ka saag',
      'Egg curry',
      'Mixed dal',
    ]);
  });

  it('returns fewer when fewer foods have the nutrient', () => {
    expect(names(rankRichFoods(pool, 'vit_b12_ug'))).toEqual([]);
  });

  it('offers rich foods only for needs, not limits', () => {
    expect(hasRichFoods({ goal: { kind: 'need', amount: 29 } })).toBe(true);
    expect(hasRichFoods({ goal: { kind: 'limit', amount: 2000 } })).toBe(false);
    expect(hasRichFoods({ goal: null })).toBe(false);
  });
});
