import {
  barcodeFromScan,
  checkDigit,
  expandUpcE,
  hasValidCheckDigit,
  readTypedBarcode,
} from './barcode';

// Real codes: Maggi 2-minute noodles 70 g, Parle-G, and the examples in the GS1 spec.
const MAGGI = '8901058851298';
const PARLE_G = '8901719101038';

describe('checkDigit', () => {
  it('works out the last digit of real EAN-13 codes', () => {
    expect(checkDigit(MAGGI.slice(0, 12))).toBe(8);
    expect(checkDigit(PARLE_G.slice(0, 12))).toBe(8);
    expect(checkDigit('400638133393')).toBe(1); // GS1 example 4006381333931
  });

  it('works for EAN-8 and UPC-A', () => {
    expect(checkDigit('9638507')).toBe(4); // EAN-8 96385074
    expect(checkDigit('03600029145')).toBe(2); // UPC-A 036000291452
  });

  it('gives 0 when the sum is already a multiple of 10', () => {
    expect(checkDigit('0000000')).toBe(0);
  });
});

describe('hasValidCheckDigit', () => {
  it('accepts correct codes', () => {
    expect(hasValidCheckDigit(MAGGI)).toBe(true);
    expect(hasValidCheckDigit('96385074')).toBe(true);
    expect(hasValidCheckDigit('036000291452')).toBe(true);
  });

  it('catches one wrong digit and two swapped digits', () => {
    expect(hasValidCheckDigit('8901058851297')).toBe(false); // last digit wrong
    expect(hasValidCheckDigit('8901058581298')).toBe(false); // 8 and 5 swapped
    expect(hasValidCheckDigit('8901058851398')).toBe(false); // one digit mistyped
  });

  it('refuses anything that is not digits', () => {
    expect(hasValidCheckDigit('')).toBe(false);
    expect(hasValidCheckDigit('89010588512a8')).toBe(false);
  });
});

describe('expandUpcE', () => {
  it('puts the zeros back for each kind of UPC-E', () => {
    expect(expandUpcE('01234505')).toBe('012000003455'); // last middle digit 0–2
    expect(expandUpcE('01234531')).toBe('012300000451'); // 3
    expect(expandUpcE('01234543')).toBe('012340000053'); // 4
    expect(expandUpcE('04252614')).toBe('042100005264'); // 5–9 (a real soda can)
  });

  it('returns null for codes that are not UPC-E', () => {
    expect(expandUpcE('21234505')).toBeNull(); // number system must be 0 or 1
    expect(expandUpcE('0123450')).toBeNull();
  });
});

describe('barcodeFromScan', () => {
  it('keeps EAN-13 and EAN-8 as they are', () => {
    expect(barcodeFromScan('ean13', MAGGI)).toBe(MAGGI);
    expect(barcodeFromScan('ean8', '96385074')).toBe('96385074');
  });

  it('turns UPC-A into the matching EAN-13 (leading 0)', () => {
    expect(barcodeFromScan('upc_a', '036000291452')).toBe('0036000291452');
    // Some phones report the same packet as an EAN-13: both give one code.
    expect(barcodeFromScan('ean13', '0036000291452')).toBe('0036000291452');
  });

  it('writes UPC-E out in full', () => {
    expect(barcodeFromScan('upc_e', '04252614')).toBe('0042100005264');
  });

  it('refuses a bad check digit, the wrong length, and other barcode types', () => {
    expect(barcodeFromScan('ean13', '8901058851297')).toBeNull();
    expect(barcodeFromScan('ean13', '96385074')).toBeNull();
    expect(barcodeFromScan('upc_e', '04252615')).toBeNull();
    expect(barcodeFromScan('qr', 'https://example.com')).toBeNull();
  });
});

describe('readTypedBarcode', () => {
  it('accepts the number printed under the bars, with or without spaces', () => {
    expect(readTypedBarcode(MAGGI)).toEqual({ ok: true, code: MAGGI });
    expect(readTypedBarcode(' 8 901058 851298 ')).toEqual({ ok: true, code: MAGGI });
    expect(readTypedBarcode('8901-0588-51298')).toEqual({ ok: true, code: MAGGI });
  });

  it('accepts EAN-8, UPC-A and UPC-E', () => {
    expect(readTypedBarcode('96385074')).toEqual({ ok: true, code: '96385074' });
    expect(readTypedBarcode('036000291452')).toEqual({ ok: true, code: '0036000291452' });
    expect(readTypedBarcode('04252614')).toEqual({ ok: true, code: '0042100005264' });
  });

  it('says what is wrong', () => {
    expect(readTypedBarcode('')).toEqual({ ok: false, problem: 'empty' });
    expect(readTypedBarcode('   ')).toEqual({ ok: false, problem: 'empty' });
    expect(readTypedBarcode('89010588512O8')).toEqual({ ok: false, problem: 'notDigits' });
    expect(readTypedBarcode('890105885129')).toEqual({ ok: false, problem: 'checkDigit' }); // 12 digits, not UPC-A
    expect(readTypedBarcode('89010588')).toEqual({ ok: false, problem: 'checkDigit' });
    expect(readTypedBarcode('8901058851')).toEqual({ ok: false, problem: 'length' });
    expect(readTypedBarcode('89010588512980')).toEqual({ ok: false, problem: 'length' });
    expect(readTypedBarcode('8901058851297')).toEqual({ ok: false, problem: 'checkDigit' });
  });
});
