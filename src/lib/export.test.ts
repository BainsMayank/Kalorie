import { timeOnDay } from './day';
import {
  buildExport,
  clockText,
  dailyCsv,
  entriesCsv,
  exportFileName,
  exportRange,
  waterCsv,
  weightCsv,
  type ExportData,
  type ExportEntry,
} from './export';
import { emptyNutrients, type NutrientValues } from './nutrients';

const BOM = '﻿';

function nutrients(values: Partial<NutrientValues>): NutrientValues {
  return { ...emptyNutrients(), ...values };
}

/** Splits a file into rows of cells (no quoted commas in these tests). */
function rows(csv: string): string[][] {
  expect(csv.startsWith(BOM)).toBe(true);
  return csv
    .slice(BOM.length)
    .trimEnd()
    .split('\r\n')
    .map((line) => line.split(','));
}

const dal: ExportEntry = {
  day: '2026-09-27',
  loggedAt: timeOnDay('2026-09-27', 13 * 60 + 5),
  meal: 'Lunch',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
  nutrients: nutrients({
    energy_kcal: 139.4,
    protein_g: 7.26,
    carb_g: 18.04,
    fat_g: 4.55,
    fibre_g: 3.1,
    sodium_mg: 312.6,
  }),
};
const roti: ExportEntry = {
  ...dal,
  loggedAt: timeOnDay('2026-09-27', 13 * 60),
  name: 'Roti',
  qty: 2,
  unit: 'medium roti',
  grams: 70,
  nutrients: nutrients({ energy_kcal: 200, protein_g: 6, carb_g: 40, fat_g: 1 }),
};
const quick: ExportEntry = {
  day: '2026-09-28',
  loggedAt: timeOnDay('2026-09-28', 1 * 60 + 30), // 1:30 am, still the 28th's logical day
  meal: 'Dinner',
  name: 'Wedding buffet',
  qty: null,
  unit: null,
  grams: null,
  nutrients: nutrients({ energy_kcal: 900 }),
};

const data: ExportData = {
  entries: [dal, roti, quick],
  water: [
    { day: '2026-09-27', loggedAt: timeOnDay('2026-09-27', 9 * 60), ml: 250 },
    { day: '2026-09-27', loggedAt: timeOnDay('2026-09-27', 8 * 60), ml: 250 },
    { day: '2026-09-26', loggedAt: timeOnDay('2026-09-26', 8 * 60), ml: 500 },
  ],
  weighIns: [
    { day: '2026-09-20', kg: 72 },
    { day: '2026-09-26', kg: 71 },
  ],
  targetKcal: (day) => (day >= '2026-09-27' ? 1800 : null),
};

describe('clockText', () => {
  it('writes a 24-hour clock', () => {
    expect(clockText(timeOnDay('2026-09-27', 13 * 60 + 5))).toBe('13:05');
    expect(clockText(timeOnDay('2026-09-27', 1 * 60 + 30))).toBe('01:30');
  });
});

describe('exportRange', () => {
  const none = { from: '2026-09-01', to: '2026-09-02' };

  it('counts back from today, today included', () => {
    expect(exportRange('week', '2026-09-28', null, none)).toEqual({
      from: '2026-09-22',
      to: '2026-09-28',
    });
    expect(exportRange('month', '2026-09-28', null, none).from).toBe('2026-08-30');
    expect(exportRange('quarter', '2026-09-28', null, none).from).toBe('2026-07-01');
  });

  it('starts Everything on the first recorded day', () => {
    expect(exportRange('all', '2026-09-28', '2026-03-15', none)).toEqual({
      from: '2026-03-15',
      to: '2026-09-28',
    });
    expect(exportRange('all', '2026-09-28', null, none)).toEqual({
      from: '2026-09-28',
      to: '2026-09-28',
    });
  });

  it('puts picked dates in order and stops at today', () => {
    expect(
      exportRange('custom', '2026-09-28', null, { from: '2026-10-05', to: '2026-09-10' }),
    ).toEqual({ from: '2026-09-10', to: '2026-09-28' });
  });
});

describe('exportFileName', () => {
  it('puts the range in the name', () => {
    expect(exportFileName('daily', '2026-09-01', '2026-09-28')).toBe(
      'kalorie_daily_2026-09-01_to_2026-09-28.csv',
    );
  });
});

describe('entriesCsv', () => {
  it('lists entries in time order with rounded numbers', () => {
    expect(rows(entriesCsv([quick, dal, roti]))).toEqual([
      [
        'day',
        'time',
        'meal',
        'food',
        'qty',
        'unit',
        'grams',
        'kcal',
        'protein_g',
        'carb_g',
        'fat_g',
      ],
      ['2026-09-27', '13:00', 'Lunch', 'Roti', '2', 'medium roti', '70', '200', '6', '40', '1'],
      [
        '2026-09-27',
        '13:05',
        'Lunch',
        'Mixed dal',
        '1',
        'katori',
        '150',
        '139',
        '7.3',
        '18',
        '4.6',
      ],
      ['2026-09-28', '01:30', 'Dinner', 'Wedding buffet', '', '', '', '900', '', '', ''],
    ]);
  });
});

describe('dailyCsv', () => {
  it('adds up each day with water, weight and the target', () => {
    const [header, ...days] = rows(dailyCsv(data, '2026-09-20', '2026-09-28'));
    expect(header).toEqual([
      'day',
      'kcal',
      'protein_g',
      'carb_g',
      'fat_g',
      'fibre_g',
      'sugar_g',
      'sat_fat_g',
      'sodium_mg',
      'water_ml',
      'weight_kg',
      'target_kcal',
    ]);
    expect(days).toEqual([
      // Only a weigh-in: no food totals (not zero), no target that day.
      ['2026-09-20', '', '', '', '', '', '', '', '', '', '72', ''],
      ['2026-09-26', '', '', '', '', '', '', '', '', '500', '71', ''],
      // Roti's fibre is unknown, so fibre is dal's alone; sugar unknown for both → empty.
      ['2026-09-27', '339', '13.3', '58', '5.6', '3.1', '', '', '313', '500', '', '1800'],
      ['2026-09-28', '900', '', '', '', '', '', '', '', '', '', '1800'],
    ]);
  });

  it('leaves out days outside the range', () => {
    const [, ...days] = rows(dailyCsv(data, '2026-09-27', '2026-09-27'));
    expect(days.map((d) => d[0])).toEqual(['2026-09-27']);
  });
});

describe('weightCsv', () => {
  it('keeps the trend from weigh-ins before the range', () => {
    // Trend: 72 → 72 + 0.1 × (71 − 72) = 71.9
    expect(rows(weightCsv(data.weighIns, '2026-09-25', '2026-09-28'))).toEqual([
      ['day', 'weight_kg', 'trend_kg'],
      ['2026-09-26', '71', '71.9'],
    ]);
  });
});

describe('waterCsv', () => {
  it('lists each glass in time order', () => {
    expect(rows(waterCsv(data.water))).toEqual([
      ['day', 'time', 'ml'],
      ['2026-09-26', '08:00', '500'],
      ['2026-09-27', '08:00', '250'],
      ['2026-09-27', '09:00', '250'],
    ]);
  });
});

describe('buildExport', () => {
  it('makes all four files for the range', () => {
    const files = buildExport(data, '2026-09-27', '2026-09-27');
    expect(Object.keys(files)).toEqual(['entries', 'daily', 'weight', 'water']);
    expect(rows(files.entries)).toHaveLength(1 + 2);
    expect(rows(files.water)).toHaveLength(1 + 2);
    // No weigh-in that day: just the header.
    expect(rows(files.weight)).toEqual([['day', 'weight_kg', 'trend_kg']]);
  });
});
