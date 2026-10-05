// Soft-deleted rows are kept 30 days so they can be brought back, then removed for good at app
// start (SPEC §4.2). A deleted recipe or product that an entry, a thali or a recipe still uses
// stays: those need its numbers.

import { and, eq, inArray, isNotNull, isNull, lt, notInArray, or } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import { getUserDb } from './client';
import { KEEP_DELETED_MS } from './entries';
import {
  customFoodUnits,
  customFoods,
  favourites,
  logEntries,
  myThaliItems,
  myThalis,
  recipeItems,
  targets,
  waterLogs,
  weights,
} from './schema';

/** Removes rows deleted more than 30 days before `now`. */
export async function purgeDeletedRows(now = Date.now()): Promise<void> {
  const db = getUserDb();
  const cutoff = now - KEEP_DELETED_MS;
  const old = (column: AnySQLiteColumn) => and(isNotNull(column), lt(column, cutoff));

  await db.delete(logEntries).where(old(logEntries.deletedAt));
  await db.delete(targets).where(old(targets.deletedAt));
  await db.delete(weights).where(old(weights.deletedAt));
  await db.delete(waterLogs).where(old(waterLogs.deletedAt));

  // Thalis, with their items.
  const oldThalis = db.select({ id: myThalis.id }).from(myThalis).where(old(myThalis.deletedAt));
  await db
    .delete(myThaliItems)
    .where(or(old(myThaliItems.deletedAt), inArray(myThaliItems.thaliId, oldThalis)));
  await db.delete(myThalis).where(old(myThalis.deletedAt));

  // Old versions of a recipe's ingredients and a food's units (replaced when it was saved again).
  await db.delete(recipeItems).where(old(recipeItems.deletedAt));
  await db.delete(customFoodUnits).where(old(customFoodUnits.deletedAt));

  // Recipes and products nothing uses any more.
  const loggedCustom = db
    .select({ id: logEntries.foodId })
    .from(logEntries)
    .where(and(eq(logEntries.foodSource, 'custom'), isNotNull(logEntries.foodId)));
  const inThalis = db
    .select({ id: myThaliItems.foodId })
    .from(myThaliItems)
    .where(eq(myThaliItems.foodSource, 'custom'));
  const inRecipes = db
    .select({ id: recipeItems.foodId })
    .from(recipeItems)
    .where(and(eq(recipeItems.foodSource, 'custom'), isNull(recipeItems.deletedAt)));
  await db
    .delete(customFoods)
    .where(
      and(
        old(customFoods.deletedAt),
        notInArray(customFoods.id, loggedCustom),
        notInArray(customFoods.id, inThalis),
        notInArray(customFoods.id, inRecipes),
      ),
    );

  // What belonged to a food that is now gone.
  const kept = db.select({ id: customFoods.id }).from(customFoods);
  await db.delete(recipeItems).where(notInArray(recipeItems.recipeId, kept));
  await db.delete(customFoodUnits).where(notInArray(customFoodUnits.customFoodId, kept));
  await db
    .delete(favourites)
    .where(and(eq(favourites.foodSource, 'custom'), notInArray(favourites.foodId, kept)));
}
