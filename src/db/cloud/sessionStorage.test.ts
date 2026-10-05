import * as SecureStore from 'expo-secure-store';

import { CHUNK_SIZE, secureSessionStorage, splitIntoChunks } from './sessionStorage';

// A pretend secure storage: a Map that also refuses anything over 2048 bytes, like Android warns.
const mockSaved = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSaved.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (new TextEncoder().encode(value).length > 2048) throw new Error('too big');
    mockSaved.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => void mockSaved.delete(key)),
}));

const KEY = 'sb-abcd-auth-token';

beforeEach(() => mockSaved.clear());

describe('splitIntoChunks', () => {
  it('cuts a long value into pieces that join back', () => {
    const value = 'x'.repeat(CHUNK_SIZE * 2 + 5);
    const chunks = splitIntoChunks(value);
    expect(chunks.map((chunk) => chunk.length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 5]);
    expect(chunks.join('')).toBe(value);
  });

  it('keeps one piece for a short or empty value', () => {
    expect(splitIntoChunks('abc')).toEqual(['abc']);
    expect(splitIntoChunks('')).toEqual(['']);
  });
});

describe('secureSessionStorage', () => {
  // About the size of a real Supabase session, with some Hindi so characters take 3 bytes.
  const session = JSON.stringify({ access_token: 'a'.repeat(3000), user: { name: 'आशा' } });

  it('saves a session bigger than secure storage allows and reads it back', async () => {
    await secureSessionStorage.setItem(KEY, session);
    expect(mockSaved.get(`${KEY}.n`)).toBe('4');
    expect(await secureSessionStorage.getItem(KEY)).toBe(session);
  });

  it('removes leftover pieces when a shorter session replaces a longer one', async () => {
    await secureSessionStorage.setItem(KEY, session);
    await secureSessionStorage.setItem(KEY, 'short');
    expect(await secureSessionStorage.getItem(KEY)).toBe('short');
    expect([...mockSaved.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
  });

  it('removes every piece on sign-out', async () => {
    await secureSessionStorage.setItem(KEY, session);
    await secureSessionStorage.removeItem(KEY);
    expect(mockSaved.size).toBe(0);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('reads nothing when a piece is missing', async () => {
    await secureSessionStorage.setItem(KEY, session);
    mockSaved.delete(`${KEY}.1`);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('reads nothing before anything is saved', async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(`${KEY}.n`);
  });
});
