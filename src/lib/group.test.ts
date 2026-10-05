import {
  formatInviteCode,
  fromSharedFood,
  groupProblem,
  planShareUploads,
  readInviteCode,
  readName,
  toSharedFood,
  type OwnFood,
} from './group';
import { emptyNutrients } from './nutrients';

describe('readInviteCode', () => {
  it('ignores spaces, dashes and small letters', () => {
    expect(readInviteCode(' k7m q2p ')).toBe('K7MQ2P');
    expect(readInviteCode('K7M-Q2P')).toBe('K7MQ2P');
  });

  it.each(['K7MQ2', 'K7MQ2PX', '', 'K7MQ2O', 'K7MQ21', 'K7M Q2!'])('turns down "%s"', (text) => {
    expect(readInviteCode(text)).toBeNull();
  });

  it('formats a code in two halves', () => {
    expect(formatInviteCode('K7MQ2P')).toBe('K7M Q2P');
  });
});

describe('readName', () => {
  it('trims and squeezes spaces', () => {
    expect(readName('  Sharma   family ', 40)).toBe('Sharma family');
  });

  it('turns down empty and too-long names', () => {
    expect(readName('   ', 30)).toBeNull();
    expect(readName('a'.repeat(31), 30)).toBeNull();
    expect(readName('a'.repeat(30), 30)).toBe('a'.repeat(30));
  });
});

describe('groupProblem', () => {
  it.each([
    ['KG001', 'alreadyInGroup'],
    ['KG002', 'tooManyTries'],
    ['KG003', 'full'],
    ['KG004', 'notInGroup'],
  ])('reads the server code %s', (code, problem) => {
    expect(groupProblem({ code, message: 'x' })).toBe(problem);
  });

  it('knows when there was no answer', () => {
    expect(groupProblem(new TypeError('Network request failed'))).toBe('offline');
    expect(groupProblem({ code: '', status: 0 })).toBe('offline');
  });

  it('calls anything else "other"', () => {
    expect(groupProblem({ code: '42501' })).toBe('other');
    expect(groupProblem(null)).toBe('other');
  });
});

const rajma: OwnFood = {
  id: 'food-1',
  kind: 'recipe',
  name: "Mom's rajma",
  brand: null,
  barcode: null,
  servingG: null,
  densityGPerMl: 1,
  cookedWithFat: true,
  nutrients: { ...emptyNutrients(), energy_kcal: 140, protein_g: 6.2 },
  units: [{ unit: 'serving', label: 'serving', grams: 250, isDefault: true }],
};

describe('toSharedFood', () => {
  it('keeps unknown nutrients as null, never 0', () => {
    const row = toSharedFood(rajma, 'group-1');
    expect(row).toMatchObject({ id: 'food-1', group_id: 'group-1', kind: 'recipe' });
    expect(row.nutrients.energy_kcal).toBe(140);
    expect(row.nutrients.iron_mg).toBeNull();
    expect(row.units).toEqual([
      { unit: 'serving', label: 'serving', grams: 250, is_default: true },
    ]);
  });

  it('sends an empty brand as none', () => {
    expect(toSharedFood({ ...rajma, brand: '' }, 'g').brand).toBeNull();
  });
});

describe('fromSharedFood', () => {
  const server = {
    ...toSharedFood(rajma, 'group-1'),
    created_by: 'person-a',
    created_at: '2026-09-28T10:00:00+00:00',
    updated_at: '2026-09-28T11:00:00+00:00',
  };

  it('reads back what was shared', () => {
    const food = fromSharedFood(JSON.parse(JSON.stringify(server)))!;
    expect(food).toMatchObject({
      id: 'food-1',
      createdBy: 'person-a',
      kind: 'recipe',
      name: "Mom's rajma",
      cookedWithFat: true,
      units: [{ unit: 'serving', label: 'serving', grams: 250, isDefault: true }],
      updatedAt: Date.parse('2026-09-28T11:00:00Z'),
    });
    expect(food.nutrients.energy_kcal).toBe(140);
    expect(food.nutrients.iron_mg).toBeNull();
  });

  it('turns numbers that make no sense into unknown', () => {
    const food = fromSharedFood({
      ...server,
      nutrients: { energy_kcal: -5, protein_g: 'lots', fat_g: 1e9, carb_g: 20, extra: 3 },
    })!;
    expect(food.nutrients.energy_kcal).toBeNull();
    expect(food.nutrients.protein_g).toBeNull();
    expect(food.nutrients.fat_g).toBeNull();
    expect(food.nutrients.carb_g).toBe(20);
    expect(food.nutrients).not.toHaveProperty('extra');
  });

  it('drops units it cannot use and keeps one default', () => {
    const food = fromSharedFood({
      ...server,
      units: [
        { unit: 'g', label: 'g', grams: 1, is_default: true },
        { unit: 'katori', label: 'katori', grams: 150, is_default: true },
        { unit: 'katori', label: 'katori again', grams: 160, is_default: false },
        { unit: 'piece', label: 'piece', grams: 0, is_default: false },
        { unit: 'serving', label: 'serving', grams: 250, is_default: true },
        'nonsense',
      ],
    })!;
    expect(food.units).toEqual([
      { unit: 'katori', label: 'katori', grams: 150, isDefault: true },
      { unit: 'serving', label: 'serving', grams: 250, isDefault: false },
    ]);
  });

  it('turns down rows without an id, a name, a sharer or a known kind', () => {
    expect(fromSharedFood({ ...server, id: null })).toBeNull();
    expect(fromSharedFood({ ...server, name: '  ' })).toBeNull();
    expect(fromSharedFood({ ...server, created_by: undefined })).toBeNull();
    expect(fromSharedFood({ ...server, kind: 'poison' })).toBeNull();
    expect(fromSharedFood({ ...server, updated_at: 'yesterday' })).toBeNull();
    expect(fromSharedFood('row')).toBeNull();
  });

  it('keeps only real barcodes', () => {
    expect(fromSharedFood({ ...server, barcode: '8901234567890' })!.barcode).toBe('8901234567890');
    expect(fromSharedFood({ ...server, barcode: 'abc' })!.barcode).toBeNull();
  });
});

describe('planShareUploads', () => {
  const food = (over: object) => ({
    id: 'x',
    shareWithGroup: true,
    sharedAt: null,
    updatedAt: 10,
    deletedAt: null,
    ...over,
  });

  it('sends a newly shared food and one changed since', () => {
    expect(
      planShareUploads([
        food({ id: 'new' }),
        food({ id: 'changed', sharedAt: 5 }),
        food({ id: 'same', sharedAt: 10 }),
      ]),
    ).toEqual({ send: ['new', 'changed'], remove: [] });
  });

  it('takes out a food that was unshared or deleted, if the group has it', () => {
    expect(
      planShareUploads([
        food({ id: 'unshared', shareWithGroup: false, sharedAt: 5 }),
        food({ id: 'deleted', deletedAt: 12, sharedAt: 10 }),
        food({ id: 'never-sent', shareWithGroup: false }),
      ]),
    ).toEqual({ send: [], remove: ['unshared', 'deleted'] });
  });
});
