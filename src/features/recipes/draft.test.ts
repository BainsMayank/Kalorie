import type { FoodDetail } from '@/db/foods';
import { emptyNutrients } from '@/lib/nutrients';

import { EMPTY_DRAFT, draftNumbers, draftToInput, newDraftItem, type RecipeDraft } from './draft';

const rajma = {
  foodSource: 'base',
  foodId: '101',
  name: 'Rajma',
  nutrients: { ...emptyNutrients(), energy_kcal: 346 },
} as FoodDetail;
const draft: RecipeDraft = {
  ...EMPTY_DRAFT,
  name: "  Mom's rajma ",
  servingsText: '4',
  cookedWeightText: '',
  items: [newDraftItem({ food: rajma, qty: 1, unit: 'cup', grams: 200, isFat: false })],
};

describe('recipe draft', () => {
  it('reads servings and cooked weight as typed ("1,5" works, empty = none)', () => {
    expect(draftNumbers({ ...draft, servingsText: '1,5', cookedWeightText: '900' })).toEqual({
      servings: 1.5,
      cookedWeightG: 900,
    });
    expect(draftNumbers({ ...draft, servingsText: '0', cookedWeightText: 'abc' })).toEqual({
      servings: null,
      cookedWeightG: null,
    });
  });

  it('is ready to save with a name, servings and an ingredient', () => {
    expect(draftToInput(draft, 'serving')).toEqual({
      name: "Mom's rajma",
      servings: 4,
      cookedWeightG: null,
      servingLabel: 'serving',
      items: [
        {
          foodSource: 'base',
          foodId: '101',
          name: 'Rajma',
          qty: 1,
          unit: 'cup',
          grams: 200,
          isFat: false,
          nutrients: rajma.nutrients,
        },
      ],
    });
  });

  it('is not ready without a name, servings or an ingredient', () => {
    expect(draftToInput({ ...draft, name: ' ' }, 'serving')).toBeNull();
    expect(draftToInput({ ...draft, servingsText: '' }, 'serving')).toBeNull();
    expect(draftToInput({ ...draft, items: [] }, 'serving')).toBeNull();
  });
});
