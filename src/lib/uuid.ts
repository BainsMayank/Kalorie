// Random IDs for rows that will sync later (SPEC §4.2 — UUID v4).

type CryptoLike = { randomUUID?: () => string; getRandomValues?: (bytes: Uint8Array) => void };

/** 16 random bytes: from the phone's secure random source when there is one. */
function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const crypto = (globalThis as { crypto?: CryptoLike }).crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** A new UUID v4, e.g. "3b241101-e2bb-4255-8caf-4136c566a962". */
export function uuid(): string {
  const crypto = (globalThis as { crypto?: CryptoLike }).crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();

  const bytes = randomBytes();
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
