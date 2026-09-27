// Reading numbers typed by the user.

/**
 * A typed amount: "250", "12.5" or "12,5" → the number; empty or not a number → `null`.
 * Negative numbers are not accepted.
 */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
