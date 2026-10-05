import {
  thaliEntries,
  thaliItemGrams,
  thaliItemsFromEntries,
  type ThaliChoice,
  type ThaliItem,
} from './thali';

const dal: ThaliItem = {
  foodSource: 'base',
  foodId: '11',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
  oilLevel: 1,
};
const roti: ThaliItem = {
  foodSource: 'base',
  foodId: '22',
  name: 'Chapati/Roti',
  qty: 2,
  unit: 'roti_m',
  grams: 70,
  oilLevel: 0,
};

describe('thaliItemsFromEntries', () => {
  it('keeps the foods with their amounts and oil level, and leaves out quick adds', () => {
    const items = thaliItemsFromEntries([
      { ...dal },
      {
        foodSource: 'quick',
        foodId: null,
        name: 'Wedding buffet',
        qty: null,
        unit: null,
        grams: null,
        oilLevel: 0,
      },
      { ...roti },
    ]);
    expect(items).toEqual([dal, roti]);
  });
});

describe('thaliItemGrams', () => {
  it("uses the food's unit weight", () => {
    expect(thaliItemGrams(roti, 3, 35)).toBe(105);
  });

  it('scales the saved grams when the unit is gone', () => {
    expect(thaliItemGrams(roti, 3, null)).toBe(105); // 70 g for 2 → 35 g each
    expect(thaliItemGrams({ qty: 0, grams: 0 }, 1, null)).toBe(0);
  });
});

describe('thaliEntries', () => {
  const target = { day: '2026-09-28', slotId: 'lunch', loggedAt: 1000 };
  const choices: ThaliChoice[] = [
    { item: dal, checked: true, qty: 1.5, unitGrams: 150 },
    { item: roti, checked: false, qty: 2, unitGrams: 35 },
  ];

  it('logs only the ticked items, at the tweaked amounts, to one slot and time', () => {
    expect(thaliEntries(choices, target)).toEqual([
      {
        ...target,
        foodSource: 'base',
        foodId: '11',
        name: 'Mixed dal',
        qty: 1.5,
        unit: 'katori',
        grams: 225,
        oilLevel: 1,
      },
    ]);
  });

  it('skips items set to nothing', () => {
    expect(thaliEntries([{ ...choices[0], qty: 0 }], target)).toEqual([]);
  });
});
