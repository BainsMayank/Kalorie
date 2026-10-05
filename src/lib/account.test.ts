import { accountProblem, isPublicKey, readEmail, readSignInCode } from './account';

/** A made-up legacy Supabase key (a JWT) with the given role. Only the payload matters here. */
function legacyKey(role: string): string {
  const payload = btoa(JSON.stringify({ iss: 'supabase', ref: 'abcd', role }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.signature`;
}

describe('readEmail', () => {
  it('trims and lowercases', () => {
    expect(readEmail('  Asha.Rao@Mail.COM ')).toEqual({ ok: true, email: 'asha.rao@mail.com' });
  });

  it('says when nothing is typed', () => {
    expect(readEmail('   ')).toEqual({ ok: false, problem: 'empty' });
  });

  it.each(['asha', 'asha@mail', 'asha@@mail.com', 'asha rao@mail.com', '@mail.com', 'a@b.c'])(
    'turns down %s',
    (text) => {
      expect(readEmail(text)).toEqual({ ok: false, problem: 'invalid' });
    },
  );

  it('accepts plus addresses and long domains', () => {
    expect(readEmail('asha+kalorie@mail.co.in')).toEqual({
      ok: true,
      email: 'asha+kalorie@mail.co.in',
    });
  });
});

describe('readSignInCode', () => {
  it('keeps only the digits', () => {
    expect(readSignInCode('123 456')).toBe('123456');
    expect(readSignInCode('Code: 12345678')).toBe('12345678');
  });

  it('waits for at least 6 digits and allows up to 10', () => {
    expect(readSignInCode('12345')).toBeNull();
    expect(readSignInCode('1234567890')).toBe('1234567890');
    expect(readSignInCode('12345678901')).toBeNull();
  });
});

describe('accountProblem', () => {
  it('spots no internet', () => {
    expect(accountProblem({ name: 'AuthRetryableFetchError', status: 0 })).toBe('offline');
    expect(accountProblem(new TypeError('Network request failed'))).toBe('offline');
  });

  it('spots too many tries', () => {
    expect(accountProblem({ name: 'AuthApiError', status: 429 })).toBe('tooMany');
    expect(accountProblem({ code: 'over_email_send_rate_limit', status: 400 })).toBe('tooMany');
  });

  it('spots a wrong or old code', () => {
    expect(accountProblem({ name: 'AuthApiError', code: 'otp_expired', status: 403 })).toBe(
      'wrongCode',
    );
  });

  it('spots an email the server turns down', () => {
    expect(accountProblem({ code: 'email_address_invalid', status: 400 })).toBe('badEmail');
  });

  it('falls back to a general line', () => {
    expect(accountProblem({ code: 'unexpected_failure', status: 500 })).toBe('other');
    expect(accountProblem(undefined)).toBe('other');
    expect(accountProblem('oops')).toBe('other');
  });
});

describe('isPublicKey', () => {
  it('accepts the publishable key and the legacy anon key', () => {
    expect(isPublicKey('sb_publishable_abc123')).toBe(true);
    expect(isPublicKey(legacyKey('anon'))).toBe(true);
  });

  it('refuses a secret key and the legacy service_role key', () => {
    expect(isPublicKey('sb_secret_abc123')).toBe(false);
    expect(isPublicKey(legacyKey('service_role'))).toBe(false);
  });

  it('refuses anything it cannot read', () => {
    expect(isPublicKey('not-a-key')).toBe(false);
    expect(isPublicKey('a.%%%.c')).toBe(false);
  });
});
