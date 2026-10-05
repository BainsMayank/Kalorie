import {
  bestDay,
  encouragement,
  foodIdeas,
  isReliable,
  pickSuggestion,
  reviewedWeek,
  type NutrientAverage,
} from './checkin';
import type { DayTotals } from './history';
import type { RichFoodCandidate } from './micros';
import { emptyNutrients, type NutrientValues } from './nutrients';

const totals = (list: Record<string, [kcal: number, entries: number]>) =>
  new Map<string, DayTotals>(
    Object.entries(list).map(([day, [kcal, entryCount]]) => [
      day,
      { kcal, entryCount, protein_g: 0, carb_g: 0, fat_g: 0 },
    ]),
  );
const target = (kcal: number | null) => () => ({ kcal });

describe('reviewedWeek', () => {
  it('is last Monday–Sunday, whichever day of this week it is', () => {
    const expected = {
      start: '2026-09-21',
      days: ['21', '22', '23', '24', '25', '26', '27'].map((d) => `2026-09-${d}`),
    };
    expect(reviewedWeek('2026-09-28')).toEqual(expected); // Monday
    expect(reviewedWeek('2026-10-04')).toEqual(expected); // Sunday
  });

  it('crosses a year boundary', () => {
    expect(reviewedWeek('2027-01-04').start).toBe('2026-12-28');
  });
});

describe('bestDay', () => {
  const week = reviewedWeek('2026-09-28').days;

  it('is the full day closest to the calorie target', () => {
    const t = totals({ '2026-09-21': [2600, 4], '2026-09-22': [1950, 5], '2026-09-23': [1700, 3] });
    expect(bestDay(week, t, target(2000))).toBe('2026-09-22');
  });

  it("doesn't pick a day with one small entry, even if it's close to the target", () => {
    const t = totals({ '2026-09-21': [2000, 1], '2026-09-22': [2400, 4] });
    expect(bestDay(week, t, target(2000))).toBe('2026-09-22');
  });

  it('falls back to partly logged days when there are no full ones', () => {
    const t = totals({ '2026-09-21': [900, 1], '2026-09-22': [1500, 2] });
    expect(bestDay(week, t, target(2000))).toBe('2026-09-22');
  });

  it('in Just-track mode is the day with the most logged; ties go to the later day', () => {
    const t = totals({ '2026-09-21': [1800, 6], '2026-09-24': [2500, 6], '2026-09-25': [900, 3] });
    expect(bestDay(week, t, target(null))).toBe('2026-09-24');
  });

  it('is null when nothing was logged', () => {
    expect(bestDay(week, new Map(), target(2000))).toBeNull();
  });
});

describe('isReliable', () => {
  it('needs 80% of the grams covered and few quick-add calories', () => {
    expect(isReliable({ share: 0.9 }, 0.1)).toBe(true);
    expect(isReliable({ share: 0.7 }, 0)).toBe(false);
    expect(isReliable({ share: 1 }, 0.3)).toBe(false);
  });
});

describe('pickSuggestion', () => {
  const avg = (nutrient: NutrientAverage['nutrient'], share: number | null, reliable = true) => ({
    nutrient,
    share,
    reliable,
  });
  const noWater = { averageMl: null, goalMl: 2000 };

  it('picks the nutrient furthest below its need', () => {
    const nutrients = [avg('protein_g', 0.7), avg('iron_mg', 0.45), avg('calcium_mg', 0.6)];
    expect(pickSuggestion({ loggedDays: 6, nutrients, water: noWater })).toEqual({
      kind: 'nutrient',
      nutrient: 'iron_mg',
      share: 0.45,
    });
  });

  it('only suggests nutrients under 75% of the need', () => {
    const nutrients = [avg('iron_mg', 0.8), avg('protein_g', 1.1)];
    expect(pickSuggestion({ loggedDays: 6, nutrients, water: noWater })).toEqual({
      kind: 'keepGoing',
    });
  });

  it('skips nutrients whose data is incomplete or unknown', () => {
    const nutrients = [avg('iron_mg', 0.2, false), avg('vit_b12_ug', null), avg('fibre_g', 0.5)];
    expect(pickSuggestion({ loggedDays: 5, nutrients, water: noWater })).toMatchObject({
      nutrient: 'fibre_g',
    });
  });

  it('breaks a tie by the order of SUGGESTION_NUTRIENTS (protein first)', () => {
    const nutrients = [avg('calcium_mg', 0.5), avg('protein_g', 0.5)];
    expect(pickSuggestion({ loggedDays: 7, nutrients, water: noWater })).toMatchObject({
      nutrient: 'protein_g',
    });
  });

  it('ignores nutrients that are not on the suggestion list', () => {
    const nutrients = [{ nutrient: 'vit_d_ug', share: 0.1, reliable: true }] as never;
    expect(pickSuggestion({ loggedDays: 7, nutrients, water: noWater }).kind).toBe('keepGoing');
  });

  it('suggests water when nothing else stands out and water was well under the goal', () => {
    const water = { averageMl: 1250, goalMl: 2000 };
    expect(pickSuggestion({ loggedDays: 5, nutrients: [], water })).toEqual({
      kind: 'water',
      averageMl: 1250,
      goalMl: 2000,
    });
    expect(
      pickSuggestion({ loggedDays: 5, nutrients: [], water: { averageMl: 1600, goalMl: 2000 } }),
    ).toEqual({ kind: 'keepGoing' });
  });

  it('prefers a nutrient over water', () => {
    const water = { averageMl: 500, goalMl: 2000 };
    expect(pickSuggestion({ loggedDays: 5, nutrients: [avg('iron_mg', 0.7)], water }).kind).toBe(
      'nutrient',
    );
  });

  it('with fewer than 3 logged days only nudges to log a few more', () => {
    const nutrients = [avg('iron_mg', 0.2)];
    expect(pickSuggestion({ loggedDays: 2, nutrients, water: noWater })).toEqual({
      kind: 'logMore',
    });
  });
});

describe('foodIdeas', () => {
  const food = (
    foodId: number,
    name: string,
    diet: RichFoodCandidate['diet'],
    iron: number,
  ): RichFoodCandidate => ({
    foodId,
    name,
    diet,
    qty: 1,
    unit: 'katori',
    grams: 100,
    nutrients: { ...emptyNutrients(), iron_mg: iron } as NutrientValues,
  });
  const foods = [
    food(1, 'Chicken liver', 'nonveg', 9),
    food(2, 'Rajma', 'veg', 4),
    food(3, 'Spinach', 'veg', 3),
    food(4, 'Egg bhurji', 'egg', 2),
    food(5, 'Poha', 'veg', 1.5),
  ];
  const names = (list: ReturnType<typeof foodIdeas>) => list.map((r) => r.food.name);

  it('gives the two richest foods', () => {
    expect(names(foodIdeas(foods, 'iron_mg', 'any', new Set()))).toEqual([
      'Chicken liver',
      'Rajma',
    ]);
  });

  it('matches a vegetarian diet', () => {
    expect(names(foodIdeas(foods, 'iron_mg', 'veg', new Set()))).toEqual(['Rajma', 'Spinach']);
  });

  it('prefers foods not eaten that week', () => {
    expect(names(foodIdeas(foods, 'iron_mg', 'veg', new Set([2])))).toEqual(['Spinach', 'Poha']);
  });

  it('still suggests eaten foods when there are no others', () => {
    expect(names(foodIdeas(foods, 'iron_mg', 'veg', new Set([2, 3, 5])))).toEqual([
      'Rajma',
      'Spinach',
    ]);
  });
});

describe('encouragement', () => {
  it('fits the number of days logged', () => {
    expect(encouragement(7)).toBe('every');
    expect(encouragement(5)).toBe('most');
    expect(encouragement(2)).toBe('some');
  });
});
