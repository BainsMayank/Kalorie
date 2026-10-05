// CSV export (SPEC §5.14): four files for a range of days — every entry, each day's totals,
// weigh-ins and water. Numbers are plain (no thousands separators) so spreadsheets read them as
// numbers; unknown values are empty cells, never 0.

import { toCsv } from './csv';
import { addDays, clockMinute } from './day';
import { roundTo, type NutrientValues } from './nutrients';
import { sumNutrients } from './nutrition';
import { weightTrend, type WeighIn } from './trend';

export const EXPORT_FILES = ['entries', 'daily', 'weight', 'water'] as const;
export type ExportFile = (typeof EXPORT_FILES)[number];

/** The ranges offered on the Export screen; `custom` = two picked dates. */
export const EXPORT_RANGES = ['week', 'month', 'quarter', 'all', 'custom'] as const;
export type ExportRange = (typeof EXPORT_RANGES)[number];

const RANGE_DAYS = { week: 7, month: 30, quarter: 90 } as const;

/**
 * The first and last day of a range, today included. *Everything* starts on the first day
 * anything was recorded (today when nothing was). A custom range is put in order and stops at
 * today.
 */
export function exportRange(
  range: ExportRange,
  today: string,
  firstDay: string | null,
  custom: { from: string; to: string },
): { from: string; to: string } {
  if (range === 'all') return { from: firstDay && firstDay < today ? firstDay : today, to: today };
  if (range === 'custom') {
    const [a, b] = [custom.from, custom.to].map((d) => (d > today ? today : d));
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  return { from: addDays(today, 1 - RANGE_DAYS[range]), to: today };
}

/** One logged entry, with its nutrients worked out (SPEC §5.3). */
export interface ExportEntry {
  day: string;
  loggedAt: number;
  /** The meal slot's name as the person sees it ("Lunch"). */
  meal: string;
  name: string;
  qty: number | null;
  /** The unit as words ("medium roti"); `null` for a quick add. */
  unit: string | null;
  grams: number | null;
  nutrients: NutrientValues;
}

export interface ExportData {
  entries: readonly ExportEntry[];
  water: readonly { day: string; loggedAt: number; ml: number }[];
  /** Every weigh-in, not just those in the range: the trend needs the ones before it. */
  weighIns: readonly WeighIn[];
  /** The calorie target in effect on a day (`null` = none, Just track). */
  targetKcal: (day: string) => number | null;
}

/** "13:05" — a 24-hour clock reads the same in every spreadsheet and language. */
export function clockText(timeMs: number): string {
  const minute = clockMinute(timeMs);
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** `kalorie_entries_2026-09-01_to_2026-09-28.csv` — the range in the name, so exports don't mix. */
export function exportFileName(file: ExportFile, from: string, to: string): string {
  return `kalorie_${file}_${from}_to_${to}.csv`;
}

/** kalorie_entries: one row per entry, earliest first. */
export function entriesCsv(entries: readonly ExportEntry[]): string {
  const sorted = [...entries].sort((a, b) =>
    a.day === b.day ? a.loggedAt - b.loggedAt : a.day < b.day ? -1 : 1,
  );
  return toCsv(
    ['day', 'time', 'meal', 'food', 'qty', 'unit', 'grams', 'kcal', 'protein_g', 'carb_g', 'fat_g'],
    sorted.map((e) => [
      e.day,
      clockText(e.loggedAt),
      e.meal,
      e.name,
      roundTo(e.qty, 2),
      e.unit,
      roundTo(e.grams, 0),
      roundTo(e.nutrients.energy_kcal, 0),
      roundTo(e.nutrients.protein_g, 1),
      roundTo(e.nutrients.carb_g, 1),
      roundTo(e.nutrients.fat_g, 1),
    ]),
  );
}

/**
 * kalorie_daily: one row per day that has entries, water or a weigh-in. Food totals are empty on
 * a day with only water or weight (nothing logged isn't the same as 0 kcal eaten).
 */
export function dailyCsv(data: ExportData, from: string, to: string): string {
  const inRange = (day: string) => day >= from && day <= to;
  const byDay = new Map<string, NutrientValues[]>();
  for (const e of data.entries) {
    if (!inRange(e.day)) continue;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), e.nutrients]);
  }
  const water = new Map<string, number>();
  for (const w of data.water) {
    if (inRange(w.day)) water.set(w.day, (water.get(w.day) ?? 0) + w.ml);
  }
  const weight = new Map(data.weighIns.filter((w) => inRange(w.day)).map((w) => [w.day, w.kg]));
  const days = [...new Set([...byDay.keys(), ...water.keys(), ...weight.keys()])].sort();

  return toCsv(
    [
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
    ],
    days.map((day) => {
      const list = byDay.get(day);
      const totals = list ? sumNutrients(list) : null;
      return [
        day,
        roundTo(totals?.energy_kcal ?? null, 0),
        roundTo(totals?.protein_g ?? null, 1),
        roundTo(totals?.carb_g ?? null, 1),
        roundTo(totals?.fat_g ?? null, 1),
        roundTo(totals?.fibre_g ?? null, 1),
        roundTo(totals?.sugar_g ?? null, 1),
        roundTo(totals?.sat_fat_g ?? null, 1),
        roundTo(totals?.sodium_mg ?? null, 0),
        water.has(day) ? water.get(day)! : null,
        roundTo(weight.get(day) ?? null, 1),
        roundTo(data.targetKcal(day), 0),
      ];
    }),
  );
}

/** kalorie_weight: each weigh-in in the range with its trend (SPEC §5.7, over all weigh-ins). */
export function weightCsv(weighIns: readonly WeighIn[], from: string, to: string): string {
  return toCsv(
    ['day', 'weight_kg', 'trend_kg'],
    weightTrend(weighIns)
      .filter((p) => p.day >= from && p.day <= to)
      .map((p) => [p.day, roundTo(p.kg, 1), roundTo(p.trendKg, 1)]),
  );
}

/** kalorie_water: one row per glass (or other amount), earliest first. */
export function waterCsv(water: ExportData['water']): string {
  const sorted = [...water].sort((a, b) =>
    a.day === b.day ? a.loggedAt - b.loggedAt : a.day < b.day ? -1 : 1,
  );
  return toCsv(
    ['day', 'time', 'ml'],
    sorted.map((w) => [w.day, clockText(w.loggedAt), w.ml]),
  );
}

/** All four files' text for the days `from`–`to` (both included). */
export function buildExport(
  data: ExportData,
  from: string,
  to: string,
): Record<ExportFile, string> {
  const inRange = (day: string) => day >= from && day <= to;
  return {
    entries: entriesCsv(data.entries.filter((e) => inRange(e.day))),
    daily: dailyCsv(data, from, to),
    weight: weightCsv(data.weighIns, from, to),
    water: waterCsv(data.water.filter((w) => inRange(w.day))),
  };
}
