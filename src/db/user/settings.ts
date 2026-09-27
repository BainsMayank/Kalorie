import { eq } from 'drizzle-orm';

import { getUserDb } from './client';
import { settings } from './schema';

/** Reads every setting. Values are parsed from JSON; unreadable values are skipped. */
export async function readAllSettings(): Promise<Record<string, unknown>> {
  const rows = await getUserDb().select().from(settings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      // A broken value is treated as "not set", so the app falls back to its default.
    }
  }
  return result;
}

/** Reads one setting, or `undefined` if it isn't set or can't be read. */
export async function readSetting(key: string): Promise<unknown> {
  const [row] = await getUserDb().select().from(settings).where(eq(settings.key, key));
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

/** Saves one setting (insert or replace). */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await getUserDb()
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } });
}
