// Tests for the parts of the build that work on all foods: rules, units, synonyms, duplicates,
// categories — plus a check that the real curated CSV files load without errors.

import { emptyNutrients } from '../../src/lib/nutrients';
import { normalizeText } from '../../src/lib/search';
import {
  dietFromName,
  indbCategory,
  parseIfctLocalNames,
  splitIndbName,
  usdaCategory,
} from './classify';
import {
  loadCategoryOverrides,
  loadCategoryUnits,
  loadDensityRules,
  loadDuplicateDecisions,
  loadIngredientMap,
  loadSearchPins,
  loadServingOverrides,
  loadSlotSuggestions,
  loadSynonymGroups,
  loadThalis,
  loadUnitRules,
} from './curated';
import { dedupe, dedupeKey } from './dedupe';
import { buildFoodUnits } from './food-units';
import { stableFoodId } from './ids';
import { attachRecipes } from './recipes';
import type { IngredientUse, RawIngredient } from './sources/indb-recipes';
import { containsPhrase, ruleMatches } from './rules';
import { searchText, synonymsFor } from './synonyms';
import type { FoodRecord } from './types';
import type { FoodRow } from './write';

function food(overrides: Partial<FoodRecord>): FoodRecord {
  return {
    source: 'ifct',
    sourceCode: 'X1',
    name: 'Test food',
    nameHi: null,
    sourceTerms: [],
    sourceCategory: '',
    kind: 'ingredient',
    category: 'misc',
    diet: 'veg',
    nutrients: emptyNutrients(),
    energyEstimated: false,
    trace: {},
    serving: null,
    portions: [],
    ...overrides,
  };
}

describe('curated files', () => {
  const categories = loadCategoryUnits();

  it('all load and pass their checks', () => {
    expect(categories.size).toBeGreaterThan(20);
    expect(loadUnitRules(categories).length).toBeGreaterThan(10);
    expect(loadDensityRules(categories).length).toBeGreaterThan(5);
    expect(loadCategoryOverrides(categories)).toBeInstanceOf(Map);
    expect(loadDuplicateDecisions()).toBeInstanceOf(Array);
    expect(loadSearchPins().length).toBeGreaterThan(5);
    expect(loadServingOverrides().size).toBeGreaterThan(5);
  });

  it('has the 6 starter thalis from the spec, each with a few foods', () => {
    const thalis = loadThalis();
    expect(thalis.map((t) => t.name)).toEqual([
      'North Indian veg thali',
      'South Indian meals',
      'Gujarati thali',
      'Punjabi non-veg thali',
      'Bengali fish thali',
      'Simple dal-chawal',
    ]);
    for (const thali of thalis) expect(thali.items.length).toBeGreaterThanOrEqual(3);
  });

  it('has starter foods for every meal slot', () => {
    const slots = new Set(loadSlotSuggestions().map((s) => s.slot));
    expect([...slots]).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
  });

  it('maps every INDB fat code (T5xx) to a food', () => {
    const map = loadIngredientMap();
    for (const code of ['T500', 'T501', 'T502', 'T504', 'T506', 'T507', 'T508', 'T509', 'T510']) {
      expect(map.get(code)).toBeTruthy();
    }
    expect(map.get('K505')).toBe('zero'); // water
  });

  it('has at least 200 synonym terms, including the ones from the plan', () => {
    const groups = loadSynonymGroups();
    const terms = groups.flatMap((g) => g.terms.map((t) => t.term));
    expect(terms.length).toBeGreaterThanOrEqual(200);
    for (const t of [
      'daal',
      'dhal',
      'bhindi',
      'lady finger',
      'dahi',
      'yogurt',
      'arhar',
      'toor',
      'chawal',
    ]) {
      expect(terms).toContain(t);
    }
  });
});

describe('rules', () => {
  it('matches whole words, with plurals', () => {
    expect(containsPhrase('bananas raw', 'banana')).toBe(true);
    expect(containsPhrase('tomatoes red ripe', 'tomato')).toBe(true);
    expect(containsPhrase('steamed rice', 'tea')).toBe(false);
    expect(containsPhrase('ladies finger', 'ladies finger')).toBe(true);
  });

  it('respects categories and excludes', () => {
    const rule = { match: ['banana'], categories: ['fruit'], exclude: ['chips'] };
    expect(ruleMatches(rule, 'bananas raw', 'fruit')).toBe(true);
    expect(ruleMatches(rule, 'banana milkshake', 'beverage')).toBe(false);
    expect(ruleMatches(rule, 'banana chips', 'fruit')).toBe(false);
  });
});

describe('food units', () => {
  const categories = loadCategoryUnits();
  const unitRules = loadUnitRules(categories);
  const densityRules = loadDensityRules(categories);
  const build = (f: FoodRecord) =>
    buildFoodUnits(f, normalizeText(f.name), categories.get(f.category), unitRules, densityRules);

  it('gives chapati the three roti sizes, medium by default, instead of the INDB serving', () => {
    const chapati = food({
      source: 'indb',
      name: 'Chapati/Roti',
      kind: 'dish',
      category: 'bread',
      serving: { unit: 'piece', label: 'chapati', grams: 36 },
    });
    const result = build(chapati);
    expect(result.units.map((u) => [u.unit, u.grams])).toEqual([
      ['roti_s', 25],
      ['roti_m', 35],
      ['roti_l', 50],
    ]);
    expect(result.defaultUnit).toBe('roti_m');
    expect(result.defaultQty).toBe(1);
  });

  it('offers katori (150 ml × density) and the INDB bowl for dal, katori by default', () => {
    const dal = food({
      source: 'indb',
      name: 'Mixed dal',
      kind: 'dish',
      category: 'dal',
      serving: { unit: 'bowl', label: 'bowl', grams: 298 },
    });
    const result = build(dal);
    expect(result.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: 'bowl', grams: 298 }),
        expect.objectContaining({ unit: 'katori', grams: 150, isDefault: true }),
      ]),
    );
  });

  it('uses tsp for oils, with oil density', () => {
    const result = build(food({ name: 'Groundnut oil', category: 'oil_fat' }));
    expect(result.defaultUnit).toBe('tsp');
    expect(result.units.find((u) => u.unit === 'tsp')?.grams).toBe(4.6);
  });

  it('prefers a hand-checked piece weight over a USDA portion, and defaults fruit to a piece', () => {
    const banana = food({
      source: 'usda_sr',
      name: 'Bananas, raw',
      category: 'fruit',
      portions: [
        { unit: 'piece', label: 'medium', grams: 118 },
        { unit: 'cup', label: 'cup, sliced', grams: 150 },
      ],
    });
    const result = build(banana);
    expect(result.units.find((u) => u.unit === 'piece')?.grams).toBe(118);
    expect(result.units.find((u) => u.unit === 'cup')?.grams).toBe(150);
    expect(result.defaultUnit).toBe('piece');
  });

  it('defaults milk to a glass and raw grains to 100 g', () => {
    expect(build(food({ name: 'Milk, whole, Cow', category: 'dairy' })).defaultUnit).toBe('glass');
    const rice = build(food({ name: 'Rice, raw, milled', category: 'cereal' }));
    expect(rice.defaultUnit).toBe('g');
    expect(rice.defaultQty).toBe(100);
    expect(rice.density).toBe(0.85);
  });
});

describe('synonyms and search text', () => {
  const groups = loadSynonymGroups();

  it('gives okra its Hindi and English names', () => {
    const terms = synonymsFor(food({ name: 'Ladies finger' }), 'ladies finger', groups).map(
      (s) => s.term,
    );
    expect(terms).toEqual(expect.arrayContaining(['bhindi', 'okra', 'lady finger']));
    expect(terms).not.toContain('ladies finger'); // already in the name
  });

  it('includes source names and phonetic keys in the search text', () => {
    const f = food({ name: 'Paneer', nameHi: 'Chhena' });
    const synonyms = synonymsFor(f, 'paneer', groups);
    const text = searchText('paneer', synonyms).split(' ');
    expect(text).toEqual(expect.arrayContaining(['paneer', 'panir', 'chhena', 'cottage']));
  });
});

describe('duplicates', () => {
  it('ignores word order and filler words', () => {
    expect(dedupeKey('Spinach, raw')).toBe(dedupeKey('Spinach'));
    expect(dedupeKey('Oil, coconut')).toBe(dedupeKey('Coconut oil'));
  });

  it('keeps the higher-priority source and never merges a dish with an ingredient', () => {
    const ifctSpinach = food({ source: 'ifct', sourceCode: 'C033', name: 'Spinach' });
    const usdaSpinach = food({ source: 'usda_sr', sourceCode: '168462', name: 'Spinach, raw' });
    const indbFlakes = food({
      source: 'indb',
      sourceCode: 'ASC052',
      name: 'Rice flakes',
      kind: 'dish',
    });
    const ifctFlakes = food({ source: 'ifct', sourceCode: 'A011', name: 'Rice flakes' });
    const result = dedupe([usdaSpinach, ifctSpinach, indbFlakes, ifctFlakes], []);
    expect(result.kept.map((f) => f.sourceCode).sort()).toEqual(['A011', 'ASC052', 'C033']);
    expect(result.dropped[0].keptRef).toBe('ifct:C033');
  });

  it('follows duplicates.csv decisions', () => {
    const a = food({ source: 'ifct', sourceCode: 'C033', name: 'Spinach' });
    const b = food({ source: 'usda_sr', sourceCode: '168462', name: 'Spinach, raw' });
    const c = food({ source: 'usda_sr', sourceCode: '999', name: 'Palak leaves' });
    const result = dedupe(
      [a, b, c],
      [
        { refA: 'ifct:C033', refB: 'usda_sr:168462', action: 'keep_both' },
        { refA: 'ifct:C033', refB: 'usda_sr:999', action: 'drop' },
      ],
    );
    expect(result.kept.map((f) => f.sourceCode).sort()).toEqual(['168462', 'C033']);
  });
});

describe('stable ids', () => {
  it('is the same every time and differs between foods', () => {
    expect(stableFoodId('ifct:A015')).toBe(stableFoodId('ifct:A015'));
    expect(stableFoodId('ifct:A015')).not.toBe(stableFoodId('ifct:A016'));
    expect(Number.isSafeInteger(stableFoodId('usda_sr:173944'))).toBe(true);
  });
});

describe('names, categories and diet', () => {
  it('splits Hindi names from English notes', () => {
    expect(splitIndbName('Hot tea (Garam Chai)')).toEqual({
      name: 'Hot tea',
      nameHi: 'Garam Chai',
    });
    expect(splitIndbName('Lassi (salted)')).toEqual({ name: 'Lassi (salted)', nameHi: null });
    expect(splitIndbName('Cold coffee (with cream)')).toEqual({
      name: 'Cold coffee (with cream)',
      nameHi: null,
    });
  });

  it('parses IFCT local names', () => {
    expect(parseIfctLocalNames('A. Chana; H. Chana, Kala chana; Tam. Kadalai.')).toEqual({
      hindi: ['Chana', 'Kala chana'],
      regional: ['Chana', 'Kadalai'],
    });
  });

  it.each([
    ['Washed moong dal', 'dal'],
    ['Dal makhani', 'dal'],
    ['Dal parantha/paratha', 'bread'],
    ['Besan kadhi with pakodies', 'curry'],
    ['Egg curry', 'curry'],
    ['Boiled egg', 'egg'],
    ['Paneer in butter sauce', 'curry'],
    ['Tomato sauce', 'condiment'],
    ['Hot chocolate souffle', 'sweet'],
    ['Hot cheese souffle', 'dish'],
    ['Cold coffee with ice cream', 'beverage'],
    ['Coffee biscuit', 'baked'],
    ['Masala dosa', 'breakfast'],
    ['Chinese fried rice', 'rice_dish'],
    ['Green gram whole with baghar', 'dal'],
    ['Cumin seeds baghar', 'condiment'],
  ])('%s → %s', (name, category) => {
    expect(indbCategory(name)).toBe(category);
  });

  it('maps USDA categories, with juices as drinks and powders weighed', () => {
    expect(usdaCategory('Fruits and Fruit Juices', 'Orange juice, raw').category).toBe('beverage');
    expect(usdaCategory('Beverages', 'Beverages, coffee, instant, powder').category).toBe('misc');
    expect(usdaCategory('Fast Foods', 'Pizza').kind).toBe('dish');
  });

  it.each([
    ['Chicken curry', 'nonveg'],
    ['Egg curry (Anda curry)', 'egg'],
    ['Vegetarian egg kofta curry', 'veg'],
    ['Vanilla ice cream without egg', 'veg'],
    ['Chocolate cake', null],
    ['Palak paneer', 'veg'],
  ])('diet of %s is %s', (name, diet) => {
    expect(dietFromName(name)).toBe(diet);
  });
});

describe('recipes', () => {
  const categories = loadCategoryUnits();
  const densityRules = loadDensityRules(categories);

  function row(overrides: Partial<FoodRow>): FoodRow {
    const nutrients = emptyNutrients();
    return {
      id: 1,
      source: 'indb',
      sourceCode: 'D1',
      name: 'Dish',
      nameHi: null,
      category: 'dal',
      kind: 'dish',
      diet: 'veg',
      cookedWithFat: false,
      density: 1,
      defaultUnit: 'katori',
      defaultQty: 1,
      energyEstimated: false,
      searchRank: 1,
      complete_macro: 1,
      complete_other: 1,
      complete_mineral: 1,
      complete_vitamin: 1,
      nutrients,
      units: [],
      synonyms: [],
      searchText: '',
      yieldG: null,
      recipe: [],
      ...overrides,
    };
  }

  const dalNutrients = emptyNutrients();
  dalNutrients.energy_kcal = 60;
  const oilNutrients = emptyNutrients();
  oilNutrients.energy_kcal = 900;
  oilNutrients.fat_g = 100;
  const lentilNutrients = emptyNutrients();
  lentilNutrients.energy_kcal = 350;

  const dish = () => row({ sourceCode: 'D1', nutrients: dalNutrients });
  const oil = row({
    id: 2,
    source: 'ifct',
    sourceCode: 'T012',
    category: 'oil_fat',
    density: 0.92,
    nutrients: oilNutrients,
  });
  const lentil = row({
    id: 3,
    source: 'ifct',
    sourceCode: 'B013',
    category: 'pulse',
    density: 0.85,
    nutrients: lentilNutrients,
  });
  const foods = new Map([
    ['ifct:T012', oil],
    ['ifct:B013', lentil],
  ]);
  const ing = (
    position: number,
    name: string,
    code: string,
    amount: number,
    unit: string,
    use: IngredientUse = 'eaten',
  ): RawIngredient => ({ recipeCode: 'D1', position, name, code, amount, unit, use });
  const recipe = new Map([
    [
      'D1',
      [
        ing(1, 'Lentil dal', 'B013', 50, 'g'),
        ing(2, 'Water', 'K505', 1, 'C'),
        ing(3, 'Oil, sunflower', 'T508', 1, 'tsp'),
      ],
    ],
  ]);
  const map = new Map([
    ['K505', 'zero'],
    ['T508', 'ifct:T012'],
  ]);

  it('links ingredients, converts to grams, flags the fat and sets the recipe weight', () => {
    const d = dish();
    const stats = attachRecipes(
      [d],
      recipe,
      map,
      (ref) => foods.get(ref),
      densityRules,
      categories,
    );
    expect(d.recipe.map((r) => [r.name, r.grams, r.ingredientFoodId, r.isFat])).toEqual([
      ['Lentil dal', 50, 3, false],
      ['Water', 240, null, false],
      ['Oil, sunflower', 4.6, 2, true],
    ]);
    expect(d.yieldG).toBe(295); // 50 + 240 + 4.6, rounded
    expect(d.recipe[2].nutrients.fat_g).toBe(100); // fat rows carry their nutrients
    expect(d.recipe[0].nutrients.energy_kcal).toBeNull(); // others are looked up by id
    expect(stats).toMatchObject({
      linkedIfct: 1,
      linkedCurated: 1,
      zero: 1,
      unlinked: 0,
      dishesWithFat: 1,
    });
  });

  it('keeps only the frying oil the food soaks up (15% of the rest) and fixes per 100 g', () => {
    // 100 g lentil batter (350 kcal) fried in 1 cup oil (220.8 g, 1987 kcal): INDB says
    // 2337 kcal in 320.8 g = 728.5 kcal/100 g
    const d = row({ sourceCode: 'D1', nutrients: { ...emptyNutrients(), energy_kcal: 728.5 } });
    const fried = new Map([
      ['D1', [ing(1, 'Lentil dal', 'B013', 100, 'g'), ing(2, 'Oil', 'T508', 1, 'C', 'frying')]],
    ]);
    const stats = attachRecipes([d], fried, map, (r) => foods.get(r), densityRules, categories);
    // 15 g of oil stays: 350 + 135 = 485 kcal in 115 g
    expect(d.recipe[1].grams).toBeCloseTo(15);
    expect(d.yieldG).toBe(115);
    expect(d.nutrients.energy_kcal).toBeCloseTo(421.7, 0);
    expect(stats.servingScale.get(d.id)).toBeCloseTo(115 / 320.8);
    expect(stats).toMatchObject({ fryingFixed: 1, drainedFixed: 0 });
  });

  it('takes out water that never reaches the plate (boiling an egg)', () => {
    const d = row({ sourceCode: 'D1', nutrients: { ...emptyNutrients(), energy_kcal: 50 } });
    const boiled = new Map([
      [
        'D1',
        [ing(1, 'Lentil dal', 'B013', 50, 'g'), ing(2, 'Water', 'K505', 100, 'ml', 'discarded')],
      ],
    ]);
    attachRecipes([d], boiled, map, (r) => foods.get(r), densityRules, categories);
    expect(d.recipe[1].grams).toBe(0);
    expect(d.yieldG).toBe(50);
    expect(d.nutrients.energy_kcal).toBeCloseTo(150); // 75 kcal in 50 g
  });

  it('refuses to build when a fat ingredient is not linked', () => {
    const noOil = new Map([['K505', 'zero']]);
    expect(() =>
      attachRecipes([dish()], recipe, noOil, (ref) => foods.get(ref), densityRules, categories),
    ).toThrow(/fat ingredient/);
  });
});
