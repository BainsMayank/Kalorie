// Number formatting for the screen (SPEC §7 rule 7). Returns text without units; the screen adds
// "kcal", "g" and so on through i18n.

/** Adds thousands separators to a whole number: 1840 → "1,840". */
function withSeparators(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Energy: whole kcal with thousands separators (1,840). `null` (unknown) → null. */
export function formatKcal(value: number | null): string | null {
  if (value === null) return null;
  return withSeparators(Math.round(value));
}

/**
 * Grams, milligrams and micrograms: whole numbers from 10 up, one decimal below 10
 * ("4.5"), a trailing ".0" dropped ("2"), and "<0.1" for tiny amounts that aren't zero.
 * `null` (unknown) → null.
 */
export function formatAmount(value: number | null): string | null {
  if (value === null) return null;
  if (value === 0) return '0';
  if (value > 0 && value < 0.05) return '<0.1';
  if (value >= 9.95) return withSeparators(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

/** A portion quantity: up to two decimals, no trailing zeros (1, 1.5, 0.25). */
export function formatQty(qty: number): string {
  return String(Math.round(qty * 100) / 100);
}

/** A share (0–1) as a whole percent: 0.384 → "38". Tiny shares that aren't zero → "<1". */
export function formatPercent(share: number): string {
  if (share > 0 && share < 0.005) return '<1';
  return String(Math.round(share * 100));
}
