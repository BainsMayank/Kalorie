import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain text and numbers as they are', () => {
    expect(csvCell('Mixed dal')).toBe('Mixed dal');
    expect(csvCell(93)).toBe('93');
    expect(csvCell(2.5)).toBe('2.5');
  });

  it('writes unknown as an empty cell, not 0', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(-0)).toBe('0');
  });

  it('quotes text with commas, quotes or line breaks', () => {
    expect(csvCell('Okra, raw')).toBe('"Okra, raw"');
    expect(csvCell('Mom\'s "special" rajma')).toBe('"Mom\'s ""special"" rajma"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded')).toBe('" padded"');
  });

  it('keeps text that looks like a formula from being worked out', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('-5 kcal')).toBe("'-5 kcal");
    expect(csvCell('@home')).toBe("'@home");
    // A negative number is still a number.
    expect(csvCell(-0.4)).toBe('-0.4');
  });

  it('keeps Hindi and other letters as they are', () => {
    expect(csvCell('दोपहर का खाना')).toBe('दोपहर का खाना');
  });
});

describe('toCsv', () => {
  it('starts with a byte-order mark and ends every row with CRLF', () => {
    const text = toCsv(
      ['day', 'kcal'],
      [
        ['2026-09-28', 1840],
        ['2026-09-29', null],
      ],
    );
    expect(text).toBe('\uFEFFday,kcal\r\n2026-09-28,1840\r\n2026-09-29,\r\n');
  });
});
