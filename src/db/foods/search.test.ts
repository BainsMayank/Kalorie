// Searches the real foods.db, so these tests check the data (synonyms, pins) and the ranking
// together — the same results you see on the phone.

import { getFoodDetail } from './food';
import { MIN_QUERY_LENGTH, SEARCH_LIMIT, searchFoods } from './search';
import { openFoodsDbForTests } from './testing';

const db = openFoodsDbForTests();
afterAll(() => db.close());

async function topNames(query: string, count = 1): Promise<string[]> {
  const results = await searchFoods(db, query);
  return results.slice(0, count).map((r) => r.name);
}

describe('searchFoods — Hindi words and spellings', () => {
  it.each(['daal', 'dhal', 'dal'])('"%s" finds dal first', async (query) => {
    const [first] = await searchFoods(db, query);
    expect(first.name).toMatch(/\bdal\b/i);
    expect(['indb', 'ifct']).toContain(first.source);
  });

  it('"bhindi" finds okra (ladies finger) first', async () => {
    const [first] = await searchFoods(db, 'bhindi');
    expect(first.name).toMatch(/okra|lad(y|ies)'?s? finger/i);
    expect(first.source).toBe('ifct');
  });

  it('"dahi" finds plain curd (yogurt) first', async () => {
    expect(await topNames('dahi')).toEqual(['Yogurt, plain, whole milk']);
  });

  it('"curd" and "dahi" lead to the same food', async () => {
    expect(await topNames('curd')).toEqual(await topNames('dahi'));
  });

  it('"chapati" and "roti" find Chapati/Roti first', async () => {
    expect(await topNames('chapati')).toEqual(['Chapati/Roti']);
    expect(await topNames('roti')).toEqual(['Chapati/Roti']);
  });

  it('"panner" (a common spelling) finds paneer first', async () => {
    expect(await topNames('panner')).toEqual(['Paneer']);
  });

  it.each([
    ['biryni', /biryani/i],
    ['samoza', /samosa/i],
    ['gulab jamon', /gulab jamun/i],
  ])('forgives a typo: "%s"', async (query, expected) => {
    const [first] = await searchFoods(db, query);
    expect(first.name).toMatch(expected);
  });

  it('forgives a typo the index has never seen: "paneer tika"', async () => {
    const results = await searchFoods(db, 'paneer tika');
    expect(results.map((r) => r.name)).toContain('Paneer shaslik/tikka');
  });

  it('finds a food by the word it starts with while typing ("chapa")', async () => {
    expect(await topNames('chapa')).toEqual(['Chapati/Roti']);
  });

  it('puts Indian foods before USDA for the same match', async () => {
    const results = await searchFoods(db, 'bhindi');
    const firstUsda = results.findIndex((r) => r.source.startsWith('usda'));
    const lastIndian = results.map((r) => r.source.startsWith('usda')).lastIndexOf(false);
    expect(firstUsda).toBeGreaterThan(lastIndian);
  });
});

describe('searchFoods — results', () => {
  it('gives the usual portion and its grams (1 katori dal = 150 g)', async () => {
    const [dal] = await searchFoods(db, 'daal');
    expect(dal).toMatchObject({ defaultQty: 1, defaultUnit: 'katori', defaultUnitLabel: 'katori' });
    expect(dal.defaultGrams).toBe(150);
    expect(dal.energyKcalPer100g).toBeGreaterThan(0);
  });

  it('shows at most 50 results', async () => {
    expect((await searchFoods(db, 'rice')).length).toBeLessThanOrEqual(SEARCH_LIMIT);
  });

  it('ignores queries that are too short or only punctuation', async () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(await searchFoods(db, 'd')).toEqual([]);
    expect(await searchFoods(db, ' ,/ ')).toEqual([]);
  });

  it('returns nothing for words that match no food', async () => {
    expect(await searchFoods(db, 'xqzvw')).toEqual([]);
  });
});

describe('getFoodDetail', () => {
  it('reads nutrients per 100 g and the food’s units, grams last', async () => {
    const [roti] = await searchFoods(db, 'roti');
    const food = await getFoodDetail(db, roti.id);
    expect(food).not.toBeNull();
    expect(food!.nutrients.energy_kcal).toBeGreaterThan(200);
    expect(food!.defaultUnit).toBe('roti_m');
    expect(food!.units.map((u) => u.unit)).toEqual(['roti_m', 'roti_s', 'roti_l', 'g']);
    expect(food!.units.find((u) => u.unit === 'roti_m')).toMatchObject({
      label: 'medium roti',
      grams: 35,
    });
  });

  it('returns null for an unknown id', async () => {
    expect(await getFoodDetail(db, 1)).toBeNull();
  });
});
