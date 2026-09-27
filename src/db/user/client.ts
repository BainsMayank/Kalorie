import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const USER_DB_NAME = 'user.db';

export type UserDb = ExpoSQLiteDatabase<typeof schema>;

let db: UserDb | null = null;

/** Opens user.db the first time it is needed, then reuses the same connection. */
export function getUserDb(): UserDb {
  if (!db) {
    db = drizzle(openDatabaseSync(USER_DB_NAME), { schema });
  }
  return db;
}
