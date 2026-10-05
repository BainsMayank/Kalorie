// Scales for the Trends charts: which numbers the top and bottom of a chart stand for.

/** The next "round" number at or above `value`: 1, 2, 2.5, 5 or 10 × a power of ten. */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value * (1 - 1e-9)) ?? 10;
  return step * power;
}

/** A bar chart's top: a round number a little above the tallest bar or target line. */
export function barChartMax(values: readonly (number | null)[]): number {
  const highest = Math.max(0, ...values.filter((v): v is number => v !== null));
  return niceCeil(highest * 1.1);
}

/**
 * A line chart's range (weight): the values with some room above and below, at least `minSpan`
 * tall so a steady weight doesn't look like a roller coaster. Rounded out to whole numbers.
 */
export function lineChartRange(
  values: readonly number[],
  minSpan = 2,
): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: minSpan };
  let low = Math.min(...values);
  let high = Math.max(...values);
  const missing = Math.max(0, minSpan - (high - low));
  low -= missing / 2;
  high += missing / 2;
  const pad = (high - low) * 0.1;
  return { min: Math.floor(low - pad), max: Math.ceil(high + pad) };
}

/** Where `value` sits between `min` (0) and `max` (1). */
export function fraction(value: number, min: number, max: number): number {
  return max === min ? 0.5 : (value - min) / (max - min);
}
