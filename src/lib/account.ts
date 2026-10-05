// Accounts (Stage 11a): checking what is typed on the Account screen, sorting sign-in errors into
// a few kinds with a friendly line each, and refusing a secret key in the app.

export type EmailProblem = 'empty' | 'invalid';

/**
 * The email typed on the Account screen, trimmed and in small letters (Supabase treats
 * "Asha@Mail.com" and "asha@mail.com" as one account). A light check only: something@something.xx
 * — the code arriving is the real check.
 */
export function readEmail(
  text: string,
): { ok: true; email: string } | { ok: false; problem: EmailProblem } {
  const email = text.trim().toLowerCase();
  if (email === '') return { ok: false, problem: 'empty' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, problem: 'invalid' };
  return { ok: true, email };
}

/** Digits in a sign-in code. Supabase's setting allows 6 to 10; 6 is the default. */
export const CODE_MIN_DIGITS = 6;
export const CODE_MAX_DIGITS = 10;

/**
 * The sign-in code from the email, digits only — so "123 456" or a pasted "Code: 123456" still
 * works. `null` until there are enough digits.
 */
export function readSignInCode(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= CODE_MIN_DIGITS && digits.length <= CODE_MAX_DIGITS ? digits : null;
}

/** What went wrong while signing in, out or deleting — each kind has its own line in en.json. */
export type AccountProblem = 'offline' | 'tooMany' | 'wrongCode' | 'badEmail' | 'other';

/**
 * Sorts an error from supabase-js into an {@link AccountProblem}. Reads only plain fields
 * (`name`, `code`, `status`), so it works on any error shape and is easy to test.
 */
export function accountProblem(error: unknown): AccountProblem {
  const { name, code, status } = (error ?? {}) as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
  };
  // No answer from the server: no internet, or it timed out.
  if (name === 'AuthRetryableFetchError' || name === 'TypeError' || status === 0) return 'offline';
  if (status === 429 || (typeof code === 'string' && code.startsWith('over_'))) return 'tooMany';
  // Supabase answers a wrong code and an old code the same way.
  if (code === 'otp_expired' || code === 'invalid_credentials') return 'wrongCode';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'badEmail';
  return 'other';
}

/**
 * Whether a key is safe to ship inside the app. The publishable (anon) key is: Row Level
 * Security decides what it can do. A secret or service_role key is not — it skips Row Level
 * Security and could read everyone's data — so the app refuses to start its connection with one.
 */
export function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return true;
  // A legacy key is a JWT: header.payload.signature, and the payload names its role.
  const payload = key.split('.')[1];
  if (payload === undefined) return false;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { role } = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      role?: unknown;
    };
    return role === 'anon';
  } catch {
    return false;
  }
}
