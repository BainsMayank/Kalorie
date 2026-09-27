import { copyEntries, type CopyableEntry } from './copy';
import { logicalDay } from './day';

const at = (date: number, h: number, min = 0) => new Date(2026, 8, date, h, min).getTime();
const SLOTS = [
  { id: 'breakfast', startMin: 4 * 60 },
  { id: 'lunch', startMin: 11 * 60 },
  { id: 'snacks', startMin: 16 * 60 },
  { id: 'dinner', startMin: 19 * 60 },
];

function entry(
  name: string,
  slotId: string,
  loggedAt: number,
  extra: Partial<CopyableEntry> = {},
): CopyableEntry {
  return {
    slotId,
    loggedAt,
    foodSource: 'base',
    foodId: '1',
    name,
    qty: 1,
    unit: 'katori',
    grams: 150,
    oilLevel: 0,
    quickKcal: null,
    quickProteinG: null,
    quickCarbG: null,
    quickFatG: null,
    note: null,
    ...extra,
  };
}

describe('copyEntries', () => {
  const dal = entry('Mixed dal', 'lunch', at(27, 13, 15), { oilLevel: 1, note: 'extra tadka' });
  const roti = entry('Chapati/Roti', 'lunch', at(27, 13, 20), {
    qty: 2,
    unit: 'roti_m',
    grams: 70,
  });

  it('copies a meal to another day at the same time, keeping food and amount', () => {
    const [copy] = copyEntries([dal], { day: '2026-09-28', slotId: 'lunch' }, SLOTS);
    expect(copy).toEqual({ ...dal, day: '2026-09-28', loggedAt: at(28, 13, 15) });
  });

  it('keeps the order of the entries', () => {
    const copies = copyEntries([dal, roti], { day: '2026-09-30' }, SLOTS);
    expect(copies.map((c) => c.name)).toEqual(['Mixed dal', 'Chapati/Roti']);
    expect(copies[1]).toMatchObject({ qty: 2, unit: 'roti_m', grams: 70 });
  });

  it('moves a meal to another slot at that slot’s start time', () => {
    const copies = copyEntries([dal, roti], { day: '2026-09-27', slotId: 'dinner' }, SLOTS);
    expect(copies.map((c) => [c.slotId, c.loggedAt])).toEqual([
      ['dinner', at(27, 19)],
      ['dinner', at(27, 19)],
    ]);
  });

  it('copies a whole day with every entry in its own slot', () => {
    const tea = entry('Tea', 'breakfast', at(26, 8));
    const copies = copyEntries([tea, dal], { day: '2026-09-29' }, SLOTS);
    expect(copies.map((c) => [c.slotId, c.loggedAt])).toEqual([
      ['breakfast', at(29, 8)],
      ['lunch', at(29, 13, 15)],
    ]);
  });

  it('keeps a late-night snack on the evening before (4 am day start)', () => {
    // 1:30 am on 28 Sep belongs to logical day 27 Sep.
    const late = entry('Milk', 'dinner', at(28, 1, 30));
    const [copy] = copyEntries([late], { day: '2026-09-30' }, SLOTS);
    expect(copy.loggedAt).toBe(new Date(2026, 9, 1, 1, 30).getTime());
    expect(logicalDay(copy.loggedAt)).toBe('2026-09-30');
  });

  it('copies quick adds with their numbers', () => {
    const quick = entry('Wedding buffet', 'dinner', at(27, 21), {
      foodSource: 'quick',
      foodId: null,
      qty: null,
      unit: null,
      grams: null,
      quickKcal: 900,
      quickProteinG: 30,
    });
    const [copy] = copyEntries([quick], { day: '2026-09-28' }, SLOTS);
    expect(copy).toMatchObject({
      foodSource: 'quick',
      grams: null,
      quickKcal: 900,
      quickProteinG: 30,
    });
  });

  it('copies nothing from an empty meal', () => {
    expect(copyEntries([], { day: '2026-09-28' }, SLOTS)).toEqual([]);
  });
});
