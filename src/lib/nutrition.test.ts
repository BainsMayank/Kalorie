import { emptyNutrients } from './nutrients';
import {
  daySummary,
  entryNutrients,
  macroKcalShares,
  nutrientsForGrams,
  progress,
  sumNutrients,
  topContributors,
  type DayEntry,
} from './nutrition';

describe('nutrientsForGrams', () => {
  const dal = { ...emptyNutrients(), energy_kcal: 62, protein_g: 3.2, iron_mg: 0.9 };

  it('scales per-100 g values to the portion (1 katori dal = 150 g)', () => {
    const katori = nutrientsForGrams(dal, 150);
    expect(katori.energy_kcal).toBeCloseTo(93);
    expect(katori.protein_g).toBeCloseTo(4.8);
    expect(katori.iron_mg).toBeCloseTo(1.35);
  });

  it('keeps unknown nutrients unknown, not zero', () => {
    expect(nutrientsForGrams(dal, 150).vit_c_mg).toBeNull();
  });

  it('gives zero for zero grams', () => {
    expect(nutrientsForGrams(dal, 0).energy_kcal).toBe(0);
  });
});

describe('entryNutrients', () => {
  const dal = { ...emptyNutrients(), energy_kcal: 62, protein_g: 3.2 };
  const noQuick = { quickKcal: null, quickProteinG: null, quickCarbG: null, quickFatG: null };

  it('works out a food entry from its grams', () => {
    const values = entryNutrients({ grams: 225, ...noQuick }, dal); // 1.5 katori
    expect(values.energy_kcal).toBeCloseTo(139.5);
    expect(values.protein_g).toBeCloseTo(7.2);
  });

  it('uses the typed-in numbers for a quick add, with nothing else known', () => {
    const values = entryNutrients(
      { grams: null, quickKcal: 300, quickProteinG: 10, quickCarbG: null, quickFatG: null },
      null,
    );
    expect(values.energy_kcal).toBe(300);
    expect(values.protein_g).toBe(10);
    expect(values.carb_g).toBeNull();
    expect(values.iron_mg).toBeNull();
  });

  it('is unknown when the food is missing', () => {
    expect(entryNutrients({ grams: 100, ...noQuick }, null).energy_kcal).toBeNull();
  });
});

describe('sumNutrients', () => {
  it('adds up entries, leaving unknown values out', () => {
    const a = { ...emptyNutrients(), energy_kcal: 93, iron_mg: 1.2 };
    const b = { ...emptyNutrients(), energy_kcal: 104, iron_mg: null };
    const total = sumNutrients([a, b]);
    expect(total.energy_kcal).toBeCloseTo(197);
    expect(total.iron_mg).toBeCloseTo(1.2);
    expect(total.vit_c_mg).toBeNull(); // unknown everywhere
  });

  it('is unknown for an empty day', () => {
    expect(sumNutrients([]).energy_kcal).toBeNull();
  });
});

describe('progress', () => {
  it('shows what is left while under the target', () => {
    expect(progress(760, 2000)).toEqual({
      eaten: 760,
      target: 2000,
      left: 1240,
      over: 0,
      fraction: 0.38,
      overFraction: 0,
    });
  });

  it('is exactly full at the target', () => {
    expect(progress(2000, 2000)).toMatchObject({ left: 0, over: 0, fraction: 1, overFraction: 0 });
  });

  it('keeps the ring full and measures the extra above the target', () => {
    expect(progress(2300, 2000)).toMatchObject({
      left: 0,
      over: 300,
      fraction: 1,
      overFraction: 0.15,
    });
  });

  it('stops the outer arc at one full circle', () => {
    expect(progress(5000, 2000).overFraction).toBe(1);
  });

  it('never goes below zero, and copes with a zero target', () => {
    expect(progress(-5, 2000)).toMatchObject({ eaten: 0, left: 2000, fraction: 0 });
    expect(progress(0, 0)).toMatchObject({ fraction: 0, overFraction: 0, left: 0 });
    expect(progress(50, 0)).toMatchObject({ fraction: 1, over: 50, overFraction: 0 });
  });
});

describe('macroKcalShares', () => {
  it('shares out energy at 4 / 4 / 9 kcal per gram', () => {
    // 50 g protein = 200 kcal, 200 g carbs = 800 kcal, 40 g fat = 360 kcal → 1,360 kcal
    const shares = macroKcalShares({
      ...emptyNutrients(),
      protein_g: 50,
      carb_g: 200,
      fat_g: 40,
    })!;
    expect(shares.protein).toBeCloseTo(200 / 1360);
    expect(shares.carbs).toBeCloseTo(800 / 1360);
    expect(shares.fat).toBeCloseTo(360 / 1360);
    expect(shares.protein + shares.carbs + shares.fat).toBeCloseTo(1);
  });

  it('counts an unknown macro as none', () => {
    const shares = macroKcalShares({ ...emptyNutrients(), protein_g: 10, carb_g: 10 })!;
    expect(shares).toEqual({ protein: 0.5, carbs: 0.5, fat: 0 });
  });

  it('is null when there is nothing to share (an empty day, or only black coffee)', () => {
    expect(macroKcalShares(emptyNutrients())).toBeNull();
    expect(macroKcalShares({ ...emptyNutrients(), protein_g: 0, carb_g: 0, fat_g: 0 })).toBeNull();
  });
});

/** A logged food with just the macros these tests need. */
function logged(
  entryId: string,
  name: string,
  macros: { protein_g?: number | null; carb_g?: number | null; fat_g?: number | null },
  food: { source?: string; id?: string | null } = {},
): DayEntry {
  const { protein_g = null, carb_g = null, fat_g = null } = macros;
  const kcal = 4 * (protein_g ?? 0) + 4 * (carb_g ?? 0) + 9 * (fat_g ?? 0);
  return {
    entryId,
    foodSource: food.source ?? 'base',
    foodId: food.id === undefined ? name : food.id,
    name,
    nutrients: { ...emptyNutrients(), energy_kcal: kcal, protein_g, carb_g, fat_g },
  };
}

describe('topContributors', () => {
  const day = [
    logged('e1', 'Mixed dal', { protein_g: 9, carb_g: 20, fat_g: 4 }),
    logged('e2', 'Roti', { protein_g: 6, carb_g: 30, fat_g: 1 }),
    logged('e3', 'Paneer', { protein_g: 18, carb_g: 3, fat_g: 20 }),
    logged('e4', 'Roti', { protein_g: 3, carb_g: 15, fat_g: 0.5 }), // roti again, at dinner
    logged('e5', 'Tea', { protein_g: 1, carb_g: 8, fat_g: 2 }),
  ];

  it('ranks foods by grams of the macro, biggest first, top 3 only', () => {
    const top = topContributors(day, 'protein_g');
    expect(top.map((c) => c.name)).toEqual(['Paneer', 'Mixed dal', 'Roti']);
    expect(top.map((c) => c.amount)).toEqual([18, 9, 9]);
  });

  it('gives each food its share of the day’s total', () => {
    const top = topContributors(day, 'protein_g'); // day total 37 g
    expect(top[0].share).toBeCloseTo(18 / 37);
    expect(top[1].share).toBeCloseTo(9 / 37);
  });

  it('adds up the same food logged twice, and opens its biggest entry', () => {
    const [roti] = topContributors(day, 'carb_g');
    expect(roti).toMatchObject({ foodKey: 'base:Roti', name: 'Roti', amount: 45, entryId: 'e2' });
  });

  it('breaks ties by name so the order stays put', () => {
    // Mixed dal and Roti both gave 9 g protein.
    expect(topContributors(day, 'protein_g', 5).map((c) => c.name)).toEqual([
      'Paneer',
      'Mixed dal',
      'Roti',
      'Tea',
    ]);
  });

  it('keeps each quick add separate, even with the same name', () => {
    const quick = { source: 'quick', id: null };
    const top = topContributors(
      [
        logged('q1', 'Quick add', { fat_g: 10 }, quick),
        logged('q2', 'Quick add', { fat_g: 5 }, quick),
      ],
      'fat_g',
    );
    expect(top.map((c) => [c.foodKey, c.amount])).toEqual([
      ['quick:q1', 10],
      ['quick:q2', 5],
    ]);
  });

  it('leaves out foods that gave none or whose value is unknown', () => {
    const top = topContributors(
      [
        logged('a', 'Black coffee', { protein_g: 0 }),
        logged('b', 'Mystery food', { protein_g: null }),
        logged('c', 'Egg', { protein_g: 6 }),
      ],
      'protein_g',
    );
    expect(top).toEqual([{ foodKey: 'base:Egg', name: 'Egg', amount: 6, share: 1, entryId: 'c' }]);
  });

  it('is empty for an empty day', () => {
    expect(topContributors([], 'protein_g')).toEqual([]);
  });
});

describe('daySummary', () => {
  const targets = { kcal: 2000, protein_g: 60, carb_g: 250, fat_g: 65 };

  it('adds up the day and compares it with the targets', () => {
    const summary = daySummary(
      [
        logged('e1', 'Mixed dal', { protein_g: 9, carb_g: 20, fat_g: 4 }), // 152 kcal
        logged('e2', 'Roti', { protein_g: 6, carb_g: 30, fat_g: 1 }), // 153 kcal
      ],
      targets,
    );
    expect(summary.isEmpty).toBe(false);
    expect(summary.totals.energy_kcal).toBeCloseTo(305);
    expect(summary.kcal).toMatchObject({ eaten: 305, target: 2000, left: 1695, over: 0 });

    const [protein, carbs, fat] = summary.macros;
    expect(protein).toMatchObject({ key: 'protein', grams: { eaten: 15, target: 60, left: 45 } });
    expect(carbs.grams).toMatchObject({ eaten: 50, target: 250, fraction: 0.2 });
    expect(fat.grams).toMatchObject({ eaten: 5, target: 65 });
    // Shares by energy: 60 + 200 + 45 = 305 kcal.
    expect(protein.kcalShare).toBeCloseTo(60 / 305);
    expect(carbs.kcalShare).toBeCloseTo(200 / 305);
    expect(fat.kcalShare).toBeCloseTo(45 / 305);
    expect(carbs.top.map((c) => c.name)).toEqual(['Roti', 'Mixed dal']);
  });

  it('shows "more than planned" amounts once past a target', () => {
    const summary = daySummary(
      [logged('e1', 'Wedding buffet', { protein_g: 70, carb_g: 300, fat_g: 90 })],
      targets,
    );
    expect(summary.kcal).toMatchObject({ eaten: 2290, left: 0, over: 290, fraction: 1 });
    expect(summary.macros[0].grams).toMatchObject({ over: 10, fraction: 1 });
  });

  it('gives zeros, no shares and no top foods for an empty day', () => {
    const summary = daySummary([], targets);
    expect(summary.isEmpty).toBe(true);
    expect(summary.kcal).toEqual({
      eaten: 0,
      target: 2000,
      left: 2000,
      over: 0,
      fraction: 0,
      overFraction: 0,
    });
    for (const macro of summary.macros) {
      expect(macro.grams).toMatchObject({ eaten: 0, fraction: 0 });
      expect(macro.kcalShare).toBeNull();
      expect(macro.top).toEqual([]);
    }
  });
});
