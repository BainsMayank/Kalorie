// Meal slots (SPEC §4.2).

import { asc, isNull } from 'drizzle-orm';

import { getUserDb } from './client';
import { mealSlots, type MealSlot } from './schema';

const hm = (h: number) => h * 60;

/** The 4 built-in slots and their time windows. Their names come from en.json. */
export const DEFAULT_SLOTS = [
  { id: 'breakfast', position: 0, startMin: hm(4), endMin: hm(11) },
  { id: 'lunch', position: 1, startMin: hm(11), endMin: hm(16) },
  { id: 'snacks', position: 2, startMin: hm(16), endMin: hm(19) },
  { id: 'dinner', position: 3, startMin: hm(19), endMin: hm(4) },
] as const;

export type BuiltinSlotId = (typeof DEFAULT_SLOTS)[number]['id'];

/**
 * Adds the built-in slots if they are missing. Slots that already exist are left alone, so a
 * renamed, moved or hidden slot keeps its changes. Safe to run on every app start.
 */
export async function seedMealSlots(now = Date.now()): Promise<void> {
  await getUserDb()
    .insert(mealSlots)
    .values(
      DEFAULT_SLOTS.map((slot) => ({
        ...slot,
        name: null,
        isHidden: false,
        isBuiltin: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
}

/** Every slot that isn't deleted, in order (hidden ones included). */
export async function listMealSlots(): Promise<MealSlot[]> {
  return getUserDb()
    .select()
    .from(mealSlots)
    .where(isNull(mealSlots.deletedAt))
    .orderBy(asc(mealSlots.position));
}
