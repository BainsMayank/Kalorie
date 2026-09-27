// Test helper: opens the real assets/db/foods.db with Node's built-in SQLite and gives it the
// same `getAllAsync` shape as expo-sqlite, so tests run the app's queries on the real data.
// Only imported by tests (Node, not the phone).

import { join } from 'path';

import type { ReadDb } from './types';

export function openFoodsDbForTests(): ReadDb & { close: () => void } {
  // process.getBuiltinModule avoids Jest's module loader, which doesn't know node:sqlite.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(join(__dirname, '../../../assets/db/foods.db'), { readOnly: true });
  return {
    getAllAsync: async <T>(sql: string, params: (string | number | null)[]) =>
      db.prepare(sql).all(...params) as T[],
    close: () => db.close(),
  };
}
