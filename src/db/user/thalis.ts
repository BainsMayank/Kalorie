// Thalis the person saved from a meal (SPEC §4.2 `my_thalis`, `my_thali_items`).

import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { ThaliItem } from '@/lib/thali';
import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import { myThaliItems, myThalis } from './schema';

/** A thali with its foods in order: one the person saved, or a built-in starter. */
export interface SavedThali {
  id: string;
  name: string;
  items: ThaliItem[];
  /** A starter from foods.db (SPEC §4.1 `thali_templates`): it can't be deleted. */
  builtin: boolean;
}

/** Saves a thali and returns its id. */
export async function saveThali(
  name: string,
  items: readonly ThaliItem[],
  now = Date.now(),
): Promise<string> {
  const db = getUserDb();
  const id = uuid();
  await db.insert(myThalis).values({ id, name, createdAt: now, updatedAt: now, deletedAt: null });
  if (items.length > 0) {
    await db.insert(myThaliItems).values(
      items.map((item, position) => ({
        ...item,
        id: uuid(),
        thaliId: id,
        position,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })),
    );
  }
  return id;
}

/** The saved thalis, newest first. */
export async function listThalis(): Promise<SavedThali[]> {
  const db = getUserDb();
  const thalis = await db
    .select()
    .from(myThalis)
    .where(isNull(myThalis.deletedAt))
    .orderBy(desc(myThalis.createdAt));
  if (thalis.length === 0) return [];
  const items = await db
    .select()
    .from(myThaliItems)
    .where(
      and(
        inArray(
          myThaliItems.thaliId,
          thalis.map((t) => t.id),
        ),
        isNull(myThaliItems.deletedAt),
      ),
    )
    .orderBy(asc(myThaliItems.position));
  return thalis.map((thali) => ({
    id: thali.id,
    name: thali.name,
    builtin: false,
    items: items
      .filter((i) => i.thaliId === thali.id)
      .map(({ foodSource, foodId, name, qty, unit, grams, oilLevel }) => ({
        foodSource,
        foodId,
        name,
        qty,
        unit,
        grams,
        oilLevel,
      })),
  }));
}

/** Soft-deletes a thali; Undo brings it back with `restoreThali`. */
export async function deleteThali(id: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(myThalis)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(myThalis.id, id));
}

export async function restoreThali(id: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(myThalis)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(myThalis.id, id));
}
