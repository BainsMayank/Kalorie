// Which targets apply on a day (SPEC §4.2): a new `targets` row starts whenever targets change,
// so past days keep the targets they had.

/** The part of a `targets` row this needs. */
export interface DatedRow {
  effectiveFrom: string;
}

/**
 * The row with the latest `effectiveFrom` on or before `day`. Days from before the first row
 * (logged before goals were set) use the first row. `null` when there are no rows.
 */
export function rowForDay<T extends DatedRow>(rows: readonly T[], day: string): T | null {
  let best: T | null = null;
  let first: T | null = null;
  for (const row of rows) {
    if (first === null || row.effectiveFrom < first.effectiveFrom) first = row;
    if (row.effectiveFrom <= day && (best === null || row.effectiveFrom > best.effectiveFrom)) {
      best = row;
    }
  }
  return best ?? first;
}
