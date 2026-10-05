// Shared foods on the phone (Stage 11c, SPEC §4.2 `custom_foods`).
//
// Two kinds of rows take part:
//   · the person's own foods (recipes, products) with *Share with my group* on — the group gets a
//     copy online, sent by src/stores/group.ts whenever the phone is online;
//   · group foods: copies of what others in the group shared, kept in custom_foods with
//     `shared_food_id` and `added_by` set, so they can be searched and logged offline and count
//     in the day's totals like any other food. They are replaced by each download, and removed
//     (soft-deleted, so days they were logged on keep their numbers) when the sharer takes them
//     out, or when the person leaves the group or signs out.

import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';

import type { GroupFood, OwnFood, ShareState } from '@/lib/group';
import { pickNutrients } from '@/lib/nutrients';
import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import { customFoodUnits, customFoods, type CustomFood } from './schema';

// --- The person's own foods --------------------------------------------------------------------

/** Turns *Share with my group* on or off for one of the person's own foods. */
export async function setShareWithGroup(id: string, on: boolean, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(customFoods)
    .set({ shareWithGroup: on, updatedAt: now })
    .where(and(eq(customFoods.id, id), isNull(customFoods.sharedFoodId)));
}

/** Own foods that are shared, or that the group still has: what `planShareUploads` looks at. */
export async function listShareStates(): Promise<ShareState[]> {
  return getUserDb()
    .select({
      id: customFoods.id,
      shareWithGroup: customFoods.shareWithGroup,
      sharedAt: customFoods.sharedAt,
      updatedAt: customFoods.updatedAt,
      deletedAt: customFoods.deletedAt,
    })
    .from(customFoods)
    .where(
      and(
        isNull(customFoods.sharedFoodId),
        or(eq(customFoods.shareWithGroup, true), isNotNull(customFoods.sharedAt)),
      ),
    );
}

/** Own foods with their units, as the group will see them. */
export async function getOwnFoodsForSharing(ids: readonly string[]): Promise<OwnFood[]> {
  if (ids.length === 0) return [];
  const db = getUserDb();
  const foods = await db
    .select()
    .from(customFoods)
    .where(and(inArray(customFoods.id, [...ids]), isNull(customFoods.sharedFoodId)));
  const units = await db
    .select()
    .from(customFoodUnits)
    .where(and(inArray(customFoodUnits.customFoodId, [...ids]), isNull(customFoodUnits.deletedAt)));
  return foods.map((food) => ({
    id: food.id,
    kind: food.kind,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    servingG: food.servingG,
    densityGPerMl: food.densityGPerMl,
    cookedWithFat: food.cookedWithFat,
    nutrients: pickNutrients(food),
    units: units
      .filter((u) => u.customFoodId === food.id)
      .map((u) => ({ unit: u.unit, label: u.label, grams: u.grams, isDefault: u.isDefault })),
  }));
}

/**
 * Remembers which version the group has (`version` = the food's updated_at when it was sent, or
 * null once it was taken out). Doesn't change updated_at itself: nothing about the food changed.
 */
export async function markShared(id: string, version: number | null): Promise<void> {
  await getUserDb().update(customFoods).set({ sharedAt: version }).where(eq(customFoods.id, id));
}

/**
 * After leaving the group or deleting the account: the group no longer has any of the person's
 * foods, and nothing is shared any more.
 */
export async function resetOwnSharing(now = Date.now()): Promise<void> {
  await getUserDb()
    .update(customFoods)
    .set({ shareWithGroup: false, sharedAt: null, updatedAt: now })
    .where(
      and(
        isNull(customFoods.sharedFoodId),
        or(eq(customFoods.shareWithGroup, true), isNotNull(customFoods.sharedAt)),
      ),
    );
}

// --- Group foods (other people's) --------------------------------------------------------------

/** Group foods on this phone that aren't deleted, by name. */
export async function listGroupFoods(): Promise<CustomFood[]> {
  return getUserDb()
    .select()
    .from(customFoods)
    .where(and(isNotNull(customFoods.sharedFoodId), isNull(customFoods.deletedAt)))
    .orderBy(asc(customFoods.name));
}

/**
 * Makes the phone's group foods match what the group has now: adds new ones, updates changed ones
 * (so days they were logged on use the corrected numbers, like an edited recipe), and removes the
 * ones no longer shared. `names` gives each sharer's name in the group. Returns whether anything
 * changed, so lists only reload when needed.
 */
export async function saveGroupFoods(
  foods: readonly GroupFood[],
  names: ReadonlyMap<string, string>,
  now = Date.now(),
): Promise<boolean> {
  const db = getUserDb();
  const ids = foods.map((f) => f.id);
  const existing = new Map(
    (ids.length === 0
      ? []
      : await db.select().from(customFoods).where(inArray(customFoods.id, ids))
    ).map((row) => [row.id, row]),
  );
  let changed = false;

  for (const food of foods) {
    const row = existing.get(food.id);
    // The same id as one of the person's own foods: never overwrite their food.
    if (row && row.sharedFoodId === null) continue;
    const addedBy = names.get(food.createdBy) ?? '';

    if (row && row.updatedAt === food.updatedAt) {
      // Same version: at most the sharer's name changed, or it came back.
      if (row.addedBy !== addedBy || row.deletedAt !== null) {
        await db
          .update(customFoods)
          .set({ addedBy, deletedAt: null })
          .where(eq(customFoods.id, food.id));
        changed = true;
      }
      continue;
    }

    // A barcode is kept only if no other food on the phone has it (one row per barcode); the
    // person's own product for the same packet wins.
    const [taken] = food.barcode
      ? await db
          .select({ id: customFoods.id })
          .from(customFoods)
          .where(and(eq(customFoods.barcode, food.barcode), ne(customFoods.id, food.id)))
      : [];
    const values = {
      kind: food.kind,
      name: food.name,
      brand: food.brand,
      barcode: taken ? null : food.barcode,
      servingG: food.servingG,
      densityGPerMl: food.densityGPerMl,
      cookedWithFat: food.cookedWithFat,
      yieldG: null,
      servings: null,
      offStatus: null,
      offFetchedAt: null,
      labelPhotoUri: null,
      sharedFoodId: food.id,
      addedBy,
      shareWithGroup: false,
      sharedAt: null,
      ...food.nutrients,
      updatedAt: food.updatedAt,
      deletedAt: null,
    };
    if (row) {
      await db.update(customFoods).set(values).where(eq(customFoods.id, food.id));
      await db
        .update(customFoodUnits)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(customFoodUnits.customFoodId, food.id), isNull(customFoodUnits.deletedAt)));
    } else {
      await db.insert(customFoods).values({ ...values, id: food.id, createdAt: now });
    }
    if (food.units.length > 0) {
      await db.insert(customFoodUnits).values(
        food.units.map((u) => ({
          ...u,
          id: uuid(),
          customFoodId: food.id,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      );
    }
    changed = true;
  }

  // Group foods the group no longer has.
  const gone = (await listGroupFoods()).filter((row) => !ids.includes(row.id));
  if (gone.length > 0) {
    await db
      .update(customFoods)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        inArray(
          customFoods.id,
          gone.map((row) => row.id),
        ),
      );
    changed = true;
  }
  return changed;
}

/** Removes every group food (leaving the group, signing out). Returns whether there were any. */
export async function removeGroupFoods(now = Date.now()): Promise<boolean> {
  return saveGroupFoods([], new Map(), now);
}
