// Barcodes on food packets (SPEC §2.7): EAN-13, EAN-8, UPC-A and UPC-E. Every one ends in a check
// digit worked out from the others, so a mistyped or misread number can be caught before it is
// looked up.

/** The kinds of barcode Kalorie reads (the names expo-camera uses). */
export const PACKET_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * The check digit for the digits before it (GS1 rule, the same for EAN and UPC): from the
 * right, digits are weighted 3, 1, 3, 1…; the check digit tops the sum up to a multiple of 10.
 */
export function checkDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** True if the last digit is the right check digit for the rest. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{2,}$/.test(code)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * A UPC-E code (8 digits: number system 0 or 1, six digits, check digit) written out in full as
 * the 12-digit UPC-A it stands for. UPC-E is a short form that drops zeros; its last middle
 * digit says where they went. Returns `null` if it isn't a UPC-E code.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const system = code[0];
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  let body: string;
  if (d6 === '0' || d6 === '1' || d6 === '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${system}${body}${code[7]}`;
}

/** True if an 8-digit code is a UPC-E code with the right check digit. */
function isValidUpcE(code: string): boolean {
  const full = expandUpcE(code);
  return full !== null && hasValidCheckDigit(full);
}

/**
 * One spelling per product, used to store and look up barcodes: a UPC-A code gets a leading 0
 * (it is then the same number as the product's EAN-13, which is how Open Food Facts stores it),
 * and a UPC-E code is first written out in full. EAN-13 and EAN-8 stay as they are.
 */
function canonical(code: string, upcE: boolean): string {
  if (upcE) return `0${expandUpcE(code)}`;
  return code.length === 12 ? `0${code}` : code;
}

/**
 * The code read by the camera, ready to look up — or `null` if it isn't a packet barcode or its
 * check digit is wrong. Some phones report a UPC-A code as an EAN-13 starting with 0; both end up
 * the same here.
 */
export function barcodeFromScan(type: string, data: string): string | null {
  const code = data.trim();
  switch (type) {
    case 'ean13':
      return /^\d{13}$/.test(code) && hasValidCheckDigit(code) ? code : null;
    case 'upc_a':
      return /^\d{12}$/.test(code) && hasValidCheckDigit(code) ? canonical(code, false) : null;
    case 'ean8':
      return /^\d{8}$/.test(code) && hasValidCheckDigit(code) ? code : null;
    case 'upc_e':
      return isValidUpcE(code) ? canonical(code, true) : null;
    default:
      return null;
  }
}

/** Why a typed barcode can't be used. */
export type TypedBarcodeProblem = 'empty' | 'notDigits' | 'length' | 'checkDigit';

export type TypedBarcode = { ok: true; code: string } | { ok: false; problem: TypedBarcodeProblem };

/**
 * A barcode typed by hand (the number printed under the bars). Spaces and dashes are ignored.
 * 13 digits = EAN-13, 12 = UPC-A, 8 = EAN-8 or UPC-E (EAN-8 is tried first: it is what Indian
 * packets use).
 */
export function readTypedBarcode(text: string): TypedBarcode {
  const code = text.replace(/[\s-]/g, '');
  if (code === '') return { ok: false, problem: 'empty' };
  if (!/^\d+$/.test(code)) return { ok: false, problem: 'notDigits' };
  if (code.length !== 8 && code.length !== 12 && code.length !== 13) {
    return { ok: false, problem: 'length' };
  }
  if (hasValidCheckDigit(code)) return { ok: true, code: canonical(code, false) };
  if (code.length === 8 && isValidUpcE(code)) return { ok: true, code: canonical(code, true) };
  return { ok: false, problem: 'checkDigit' };
}
