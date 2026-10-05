// Plain CSV text (RFC 4180) that Google Sheets, Excel and Numbers all open the same way.

/** One cell: text, a number, or `null` for an empty cell (unknown, not zero). */
export type CsvCell = string | number | null;

/** A byte-order mark: tells Excel the file is UTF-8, so Hindi and "µg" show properly. */
const BOM = '\uFEFF';

/**
 * A cell as CSV text. Text that holds a comma, a quote or a line break is wrapped in quotes.
 * Text that starts like a formula (= + - @) gets a leading apostrophe, so a food named "=1+1"
 * shows as written instead of being worked out by the spreadsheet.
 */
export function csvCell(cell: CsvCell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
  const text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: a header row, then the rows, with Windows line endings (what RFC 4180 asks). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return BOM + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
