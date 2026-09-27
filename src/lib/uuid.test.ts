import { uuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  const original = globalThis.crypto;
  afterEach(() =>
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true }),
  );

  it('makes version 4 UUIDs that differ each time', () => {
    const a = uuid();
    expect(a).toMatch(UUID_V4);
    expect(uuid()).not.toBe(a);
  });

  it('still makes valid UUIDs on a phone without crypto', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(uuid()).toMatch(UUID_V4);
  });

  it('builds one from random bytes when randomUUID is missing', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) },
      configurable: true,
    });
    expect(uuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});
