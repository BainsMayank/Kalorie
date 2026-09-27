// Starred foods (SPEC §4.2).

import { and, desc, eq } from 'drizzle-orm';

import { getUserDb } from './client';
import { favourites, type Favourite } from './schema';

type FoodRef = Pick<Favourite, 'foodSource' | 'foodId'>;

/** All favourites, newest first. */
export async function listFavourites(): Promise<Favourite[]> {
  return getUserDb().select().from(favourites).orderBy(desc(favourites.createdAt));
}

/** Stars a food (starring it again changes nothing). */
export async function addFavourite(food: FoodRef, now = Date.now()): Promise<void> {
  await getUserDb()
    .insert(favourites)
    .values({ ...food, createdAt: now })
    .onConflictDoNothing();
}

/** Un-stars a food. */
export async function removeFavourite(food: FoodRef): Promise<void> {
  await getUserDb()
    .delete(favourites)
    .where(and(eq(favourites.foodSource, food.foodSource), eq(favourites.foodId, food.foodId)));
}
