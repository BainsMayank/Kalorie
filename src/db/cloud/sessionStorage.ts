import * as SecureStore from 'expo-secure-store';

/**
 * Where supabase-js keeps the sign-in session: the phone's secure storage (iOS Keychain,
 * Android Keystore), not plain files, because the session holds the tokens that act as you.
 *
 * Secure storage is meant for small values (Android warns above 2048 bytes) and a session is a
 * few kB, so each value is saved in pieces: `<key>.0`, `<key>.1`, … plus `<key>.n` = how many.
 * Kept apart from user.db on purpose, so a future export or backup of user.db never holds it.
 */

/** Characters per piece — well under 2048 bytes even if every character took 2 bytes. */
export const CHUNK_SIZE = 1000;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

/** Cuts a value into pieces of at most `size` characters (at least one piece, even for ""). */
export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += size)
    chunks.push(value.slice(start, start + size));
  return chunks.length > 0 ? chunks : [''];
}

async function storedCount(key: string): Promise<number> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function removeChunks(key: string, from: number, to: number): Promise<void> {
  for (let index = from; index < to; index++)
    await SecureStore.deleteItemAsync(chunkKey(key, index));
}

/** The storage supabase-js is given (it needs getItem, setItem and removeItem). */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await storedCount(key);
    if (count === 0) return null;
    const chunks: string[] = [];
    for (let index = 0; index < count; index++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, index));
      // A missing piece (the app was closed halfway through saving): no session, sign in again.
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const before = await storedCount(key);
    const chunks = splitIntoChunks(value);
    for (const [index, chunk] of chunks.entries())
      await SecureStore.setItemAsync(chunkKey(key, index), chunk);
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    // A shorter value than before leaves old pieces behind: remove them.
    await removeChunks(key, chunks.length, before);
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(key, 0, await storedCount(key));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
