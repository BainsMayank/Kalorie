// Test helper: a fresh, empty user.db in memory, built with the real migrations in drizzle/.
// It uses Node's built-in SQLite behind Drizzle's "proxy" driver, so the app's queries run
// unchanged. Only imported by tests (Node, not the phone).

import { readFileSync } from 'fs';
import { join } from 'path';

import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { UserDb } from './client';
import * as schema from './schema';

const DRIZZLE_DIR = join(__dirname, '../../../drizzle');

export function openUserDbForTests(): UserDb {
  // process.getBuiltinModule avoids Jest's module loader, which doesn't know node:sqlite.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');

  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }

  const db = drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      if (method === 'get') return { rows: (statement.get(...params) ?? undefined) as never };
      return { rows: statement.all(...params) };
    },
    { schema },
  );
  // The app's queries only use what both drivers share (select / insert / update with await).
  return db as unknown as UserDb;
}
