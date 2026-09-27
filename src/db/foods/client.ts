import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { readSetting, writeSetting } from '@/db/user/settings';

// foods.db ships inside the app (assets/db/foods.db). SQLite can't open a file inside the app
// package, so on first launch it is copied into the phone's database folder. When an app update
// brings a new foods.db, the copy is replaced: the setting `foods_db_version` remembers the
// fingerprint (hash) of the file that was copied.

export const FOODS_DB_NAME = 'foods.db';
const VERSION_SETTING = 'foods_db_version';

const FOODS_DB_ASSET: number = require('../../../assets/db/foods.db');

async function copyFromAppIfNeeded(): Promise<void> {
  const asset = Asset.fromModule(FOODS_DB_ASSET);
  const folder = new Directory(`file://${defaultDatabaseDirectory}`);
  const target = new File(folder, FOODS_DB_NAME);
  const copiedVersion = await readSetting(VERSION_SETTING);
  // No hash means we can't tell versions apart, so copy every time to be safe.
  if (target.exists && asset.hash !== null && copiedVersion === asset.hash) return;

  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('foods.db: the bundled file could not be found');
  folder.create({ idempotent: true, intermediates: true });
  await new File(asset.localUri).copy(target, { overwrite: true });
  await writeSetting(VERSION_SETTING, asset.hash);
}

async function openFoodsDb(): Promise<SQLiteDatabase> {
  await copyFromAppIfNeeded();
  const db = await openDatabaseAsync(FOODS_DB_NAME, {
    // expo-sqlite normally finalizes every statement before closing, including the ones FTS5
    // owns inside the search index; SQLite then finalizes those again and the app crashes
    // (seen on every reload in Expo Go). getAllAsync/getFirstAsync always finalize their own
    // statements, so leaving this to SQLite is safe.
    finalizeUnusedStatementsBeforeClosing: false,
  });
  // The app never writes to foods.db (SPEC §4.1). expo-sqlite has no read-only open option,
  // so this makes SQLite refuse any change on this connection.
  await db.execAsync('PRAGMA query_only = ON');
  // Search needs FTS5. expo-sqlite includes it; this fails early and clearly if it ever doesn't.
  await db.getFirstAsync(`SELECT rowid FROM foods_fts WHERE foods_fts MATCH 'dal*' LIMIT 1`);
  return db;
}

let opening: Promise<SQLiteDatabase> | null = null;

/**
 * The foods.db connection. The first call copies the file if needed and opens it; later calls
 * get the same connection. If opening fails, the next call tries again.
 * Call only after user.db is ready (it stores the copied version).
 */
export function getFoodsDb(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = openFoodsDb();
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}
