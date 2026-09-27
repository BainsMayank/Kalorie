import {
  daysBetween,
  fillSuggestions,
  foodKey,
  rankSuggestions,
  usualPortion,
  type HistoryEntry,
} from './suggestions';

const TODAY = '2026-09-27';
let clock = 0;

/** An entry of food `id` in `slot`, `daysAgo` days before today. Later calls are newer. */
function eaten(
  id: string,
  slot: string,
  daysAgo: number,
  amount: { qty: number; unit: string; grams: number } = { qty: 1, unit: 'katori', grams: 150 },
): HistoryEntry {
  const date = new Date(2026, 8, 27 - daysAgo);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { foodSource: 'base', foodId: id, slotId: slot, day, ...amount, createdAt: ++clock };
}

const ids = (list: { foodId: string }[]) => list.map((s) => s.foodId);

describe('daysBetween', () => {
  it('counts whole days, across months', () => {
    expect(daysBetween('2026-09-27', '2026-09-27')).toBe(0);
    expect(daysBetween('2026-08-28', '2026-09-27')).toBe(30);
    expect(daysBetween('2026-09-28', '2026-09-27')).toBe(-1);
  });
});

describe('rankSuggestions', () => {
  it('ranks by how often a food was eaten in the slot', () => {
    const entries = [
      eaten('poha', 'breakfast', 1),
      eaten('tea', 'breakfast', 1),
      eaten('tea', 'breakfast', 2),
      eaten('tea', 'breakfast', 3),
      eaten('poha', 'breakfast', 2),
      eaten('egg', 'breakfast', 1),
    ];
    expect(ids(rankSuggestions(entries, 'breakfast', TODAY))).toEqual(['tea', 'poha', 'egg']);
  });

  it('scores each entry 0.9 ^ days ago, so recent meals count more', () => {
    const [one] = rankSuggestions(
      [eaten('dal', 'lunch', 0), eaten('dal', 'lunch', 2)],
      'lunch',
      TODAY,
    );
    expect(one.score).toBeCloseTo(1 + 0.81);

    // Twice 20 days ago (2 × 0.12) scores below once yesterday (0.9).
    const entries = [
      eaten('rajma', 'lunch', 20),
      eaten('rajma', 'lunch', 20),
      eaten('dal', 'lunch', 1),
    ];
    expect(ids(rankSuggestions(entries, 'lunch', TODAY))).toEqual(['dal', 'rajma']);
  });

  it('only counts the slot asked for', () => {
    const entries = [eaten('tea', 'breakfast', 0), eaten('dal', 'lunch', 0)];
    expect(ids(rankSuggestions(entries, 'lunch', TODAY))).toEqual(['dal']);
  });

  it('only looks at the last 30 days, and not at future days', () => {
    const entries = [
      eaten('old', 'lunch', 30),
      eaten('recent', 'lunch', 29),
      eaten('planned', 'lunch', -1),
    ];
    expect(ids(rankSuggestions(entries, 'lunch', TODAY))).toEqual(['recent']);
  });

  it('breaks a tie with the food logged most recently', () => {
    const entries = [eaten('a', 'lunch', 1), eaten('b', 'lunch', 1)];
    expect(ids(rankSuggestions(entries, 'lunch', TODAY))).toEqual(['b', 'a']);
  });

  it('shows at most 8', () => {
    const entries = Array.from({ length: 12 }, (_, i) => eaten(`food${i}`, 'lunch', i));
    const list = rankSuggestions(entries, 'lunch', TODAY);
    expect(list).toHaveLength(8);
    expect(list[0].foodId).toBe('food0');
  });

  it('skips quick adds', () => {
    const quick: HistoryEntry = {
      foodSource: 'quick',
      foodId: null,
      slotId: 'lunch',
      day: TODAY,
      qty: null,
      unit: null,
      grams: null,
      createdAt: ++clock,
    };
    expect(rankSuggestions([quick], 'lunch', TODAY)).toEqual([]);
  });

  it('gives each food its usual amount in that slot', () => {
    const two = { qty: 2, unit: 'roti_m', grams: 70 };
    const three = { qty: 3, unit: 'roti_m', grams: 105 };
    const entries = [
      eaten('roti', 'lunch', 3, two),
      eaten('roti', 'lunch', 2, two),
      eaten('roti', 'lunch', 1, three),
      eaten('roti', 'dinner', 0, three),
      eaten('roti', 'dinner', 0, three),
    ];
    expect(rankSuggestions(entries, 'lunch', TODAY)[0].portion).toEqual(two);
  });
});

describe('usualPortion', () => {
  it('picks the most common amount', () => {
    const half = { qty: 0.5, unit: 'katori', grams: 75 };
    expect(
      usualPortion([
        eaten('x', 'lunch', 1, half),
        eaten('x', 'lunch', 2),
        eaten('x', 'lunch', 3, half),
      ]),
    ).toEqual(half);
  });

  it('breaks a tie with the amount used last', () => {
    const grams = { qty: 200, unit: 'g', grams: 200 };
    expect(usualPortion([eaten('x', 'lunch', 2), eaten('x', 'lunch', 1, grams)])).toEqual(grams);
  });

  it('is unknown without entries', () => {
    expect(usualPortion([])).toBeNull();
  });
});

describe('fillSuggestions', () => {
  const s = (id: string) => ({ foodSource: 'base', foodId: id });

  it('tops up a short list with starter foods it doesn’t already have', () => {
    expect(ids(fillSuggestions([s('tea')], [s('poha'), s('tea'), s('idli')]))).toEqual([
      'tea',
      'poha',
      'idli',
    ]);
  });

  it('leaves a list of 3 or more alone', () => {
    expect(ids(fillSuggestions([s('a'), s('b'), s('c')], [s('d')]))).toEqual(['a', 'b', 'c']);
  });

  it('stops at the limit', () => {
    const starters = Array.from({ length: 10 }, (_, i) => s(`s${i}`));
    expect(fillSuggestions([], starters)).toHaveLength(8);
  });
});

describe('foodKey', () => {
  it('joins source and id', () => {
    expect(foodKey('base', '42')).toBe('base:42');
  });
});
