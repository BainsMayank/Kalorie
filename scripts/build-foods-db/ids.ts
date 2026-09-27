/// <reference types="node" />
import { createHash } from 'node:crypto';

/**
 * A food's id: the first 52 bits of SHA-1("<source>:<source_code>"). It stays the same in every
 * build, so entries logged in user.db keep pointing at the right food after foods.db updates.
 * 52 bits fit exactly in a JavaScript number and in SQLite's INTEGER.
 */
export function stableFoodId(ref: string): number {
  return parseInt(createHash('sha1').update(ref).digest('hex').slice(0, 13), 16);
}
