// Foods kept in user.db (SPEC §4.2 `custom_foods`): barcode products — found on Open Food Facts
// or typed in from a label — and the person's own recipes. Nutrients are per 100 g, like foods.db.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import type { FoodDetail, FoodUnitOption, LoggedFood } from '@/db/foods';
import { emptyNutrients, pickNutrients, type NutrientValues } from '@/lib/nutrients';
import { genericOilStep, type OilStep } from '@/lib/oil';
import { recipeOilStepFor, recipePer100g, recipeUnits, type RecipeAmounts } from '@/lib/recipe';
import { UNIT_DEFAULTS } from '@/lib/units';
import { uuid } from '@/lib/uuid';

import { getUserDb } from './client';
import {
  customFoodUnits,
  customFoods,
  recipeItems,
  type CustomFood,
  type CustomFoodUnit,
  type RecipeItemRow,
} from './schema';

/** A unit of a custom food: "1 serving = 30 g". */
export interface CustomUnitInput {
  unit: string;
  label: string;
  grams: number;
  isDefault: boolean;
}

/** Everything saved for a barcode product. */
export interface ProductInput {
  barcode: string;
  name: string;
  brand: string | null;
  servingG: number | null;
  densityGPerMl: number;
  offStatus: 'found' | 'user_added';
  offFetchedAt: number | null;
  labelPhotoUri: string | null;
  nutrients: NutrientValues;
  units: readonly CustomUnitInput[];
}

/** The product saved for a barcode, or `null` (deleted products don't count). */
export async function findProductByBarcode(barcode: string): Promise<CustomFood | null> {
  const [row] = await getUserDb()
    .select()
    .from(customFoods)
    .where(and(eq(customFoods.barcode, barcode), isNull(customFoods.deletedAt)));
  return row ?? null;
}

/**
 * Saves a barcode product and its units, and returns its id. A barcode is saved once: saving the
 * same barcode again (a fresh lookup, or the label typed in after all) replaces that product's
 * details and units but keeps its id, so entries already logged still find it.
 */
export async function saveProduct(input: ProductInput, now = Date.now()): Promise<string> {
  const db = getUserDb();
  const [found] = await db
    .select({ id: customFoods.id, sharedFoodId: customFoods.sharedFoodId })
    .from(customFoods)
    .where(eq(customFoods.barcode, input.barcode));
  // Someone in the group shared this packet: the person's own product takes the barcode over,
  // and the group food stays, without it.
  if (found?.sharedFoodId) {
    await db.update(customFoods).set({ barcode: null }).where(eq(customFoods.id, found.id));
  }
  const existing = found?.sharedFoodId ? undefined : found;
  const id = existing?.id ?? uuid();

  const values = {
    kind: 'product' as const,
    name: input.name,
    brand: input.brand,
    barcode: input.barcode,
    servingG: input.servingG,
    densityGPerMl: input.densityGPerMl,
    offStatus: input.offStatus,
    offFetchedAt: input.offFetchedAt,
    labelPhotoUri: input.labelPhotoUri,
    ...input.nutrients,
    updatedAt: now,
    deletedAt: null,
  };
  if (existing) {
    await db.update(customFoods).set(values).where(eq(customFoods.id, id));
    await db
      .update(customFoodUnits)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(customFoodUnits.customFoodId, id), isNull(customFoodUnits.deletedAt)));
  } else {
    await db.insert(customFoods).values({ ...values, id, createdAt: now });
  }
  if (input.units.length > 0) {
    await db.insert(customFoodUnits).values(
      input.units.map((u) => ({
        ...u,
        id: uuid(),
        customFoodId: id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })),
    );
  }
  return id;
}

/**
 * Custom foods with their units and oil step, by id. Deleted foods are included: entries logged
 * before the delete still need their nutrients.
 */
async function readCustomFoods(
  ids: readonly string[],
): Promise<{ food: CustomFood; units: CustomFoodUnit[]; oilStep: OilStep | null }[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const db = getUserDb();
  const foods = await db.select().from(customFoods).where(inArray(customFoods.id, unique));
  const units = await db
    .select()
    .from(customFoodUnits)
    .where(and(inArray(customFoodUnits.customFoodId, unique), isNull(customFoodUnits.deletedAt)));
  const recipeIds = foods.filter((f) => f.kind === 'recipe').map((f) => f.id);
  const items =
    recipeIds.length === 0
      ? []
      : await db
          .select()
          .from(recipeItems)
          .where(and(inArray(recipeItems.recipeId, recipeIds), isNull(recipeItems.deletedAt)));
  return foods.map((food) => ({
    food,
    units: units.filter((u) => u.customFoodId === food.id),
    oilStep: oilStepOf(
      food,
      items.filter((i) => i.recipeId === food.id),
    ),
  }));
}

/**
 * The oil control's step (SPEC §5.5): a recipe's own oil and ghee, else 5 g of oil per 150 g for a
 * food cooked with fat, else none.
 */
function oilStepOf(food: CustomFood, items: readonly RecipeItemRow[]): OilStep | null {
  if (food.kind === 'recipe') {
    const step = recipeOilStepFor({
      servings: food.servings ?? 1,
      cookedWeightG: food.yieldG,
      ingredients: items.map((i) => ({
        grams: i.grams,
        nutrients: pickNutrients(i),
        isFat: i.isFat,
      })),
    });
    if (step) return step;
  }
  return food.cookedWithFat ? genericOilStep() : null;
}

const GRAM_LABEL = UNIT_DEFAULTS.find((u) => u.unit === 'g')!.label;

/** Its units, default first, then by size, and `g` always last (like foods.db, SPEC §4.1). */
function unitOptions(units: readonly CustomFoodUnit[]): FoodUnitOption[] {
  const options: FoodUnitOption[] = [...units]
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.grams - b.grams)
    .map((u) => ({ unit: u.unit, label: u.label, grams: u.grams, isDefault: u.isDefault }));
  options.push({ unit: 'g', label: GRAM_LABEL, grams: 1, isDefault: options.length === 0 });
  return options;
}

/** The usual portion: 1 of the default unit, else 100 g. */
function defaultPortion(options: readonly FoodUnitOption[]): { unit: string; qty: number } {
  const unit = options.find((u) => u.isDefault) ?? options[0];
  return { unit: unit.unit, qty: unit.unit === 'g' || unit.unit === 'ml' ? 100 : 1 };
}

/** A custom food for the food screen and the Add sheet, or `null` if there is none. */
export async function getCustomFoodDetail(id: string): Promise<FoodDetail | null> {
  const [found] = await readCustomFoods([id]);
  if (!found) return null;
  const { food, units, oilStep } = found;
  const options = unitOptions(units);
  const portion = defaultPortion(options);
  return {
    foodSource: 'custom',
    foodId: food.id,
    name: food.name,
    nameHi: null,
    brand: food.brand,
    barcode: food.barcode,
    labelPhotoUri: food.labelPhotoUri,
    offStatus: food.offStatus,
    source: food.kind,
    densityGPerMl: food.densityGPerMl,
    defaultUnit: portion.unit,
    defaultQty: portion.qty,
    energyEstimated: false,
    nutrients: pickNutrients(food),
    oilStep,
    units: options,
    sharing:
      food.sharedFoodId !== null
        ? { kind: 'group', addedBy: food.addedBy ?? '' }
        : { kind: 'own', shareWithGroup: food.shareWithGroup, sharedAt: food.sharedAt },
  };
}

/** Several custom foods at once, for lists of logged, suggested or starred foods. */
export async function getLoggedCustomFoods(
  ids: readonly string[],
): Promise<Map<string, LoggedFood>> {
  const result = new Map<string, LoggedFood>();
  for (const { food, units, oilStep } of await readCustomFoods(ids)) {
    const options = unitOptions(units);
    const portion = defaultPortion(options);
    const unit = options.find((u) => u.unit === portion.unit)!;
    result.set(food.id, {
      name: food.name,
      source: food.kind,
      nutrients: pickNutrients(food),
      oilStep,
      units: Object.fromEntries(options.map((u) => [u.unit, { label: u.label, grams: u.grams }])),
      defaultPortion: { ...portion, grams: portion.qty * unit.grams },
    });
  }
  return result;
}

// --- The list of the person's own foods ------------------------------------------------------

/**
 * Custom foods that aren't deleted (recipes, products…), by name: the person's own, and with
 * `withGroupFoods` also the group's (search finds both; My foods and Recipes list only their own).
 */
export async function listCustomFoods(
  kind?: CustomFood['kind'],
  { withGroupFoods = false }: { withGroupFoods?: boolean } = {},
): Promise<CustomFood[]> {
  return getUserDb()
    .select()
    .from(customFoods)
    .where(
      and(
        isNull(customFoods.deletedAt),
        kind ? eq(customFoods.kind, kind) : undefined,
        withGroupFoods ? undefined : isNull(customFoods.sharedFoodId),
      ),
    )
    .orderBy(asc(customFoods.name));
}

/**
 * Soft-deletes a custom food: it leaves search and the lists, but entries logged before keep
 * their numbers, and Undo can bring it back.
 */
export async function deleteCustomFood(id: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(customFoods)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(customFoods.id, id));
}

/** Brings a deleted custom food back (Undo). */
export async function restoreCustomFood(id: string, now = Date.now()): Promise<void> {
  await getUserDb()
    .update(customFoods)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(customFoods.id, id));
}

// --- Recipes ---------------------------------------------------------------------------------

/** One ingredient of a recipe being saved. */
export interface RecipeItemInput {
  foodSource: 'base' | 'custom';
  foodId: string;
  name: string;
  qty: number;
  unit: string;
  grams: number;
  isFat: boolean;
  /** The ingredient's per-100 g values; `null` if its food can't be found any more. */
  nutrients: NutrientValues | null;
}

/** Everything saved for a recipe. */
export interface RecipeInput {
  name: string;
  servings: number;
  /** The whole pot after cooking; `null` = not weighed (the raw weight is used). */
  cookedWeightG: number | null;
  items: readonly RecipeItemInput[];
  /** The *serving* unit in words, from en.json. */
  servingLabel: string;
}

/** A saved recipe, as the builder edits it. */
export interface SavedRecipe {
  id: string;
  name: string;
  servings: number;
  cookedWeightG: number | null;
  items: (RecipeItemInput & { id: string })[];
}

function amountsOf(
  input: Pick<RecipeInput, 'servings' | 'cookedWeightG' | 'items'>,
): RecipeAmounts {
  return {
    servings: input.servings,
    cookedWeightG: input.cookedWeightG,
    ingredients: input.items.map((i) => ({
      grams: i.grams,
      nutrients: i.nutrients,
      isFat: i.isFat,
    })),
  };
}

/**
 * Saves a recipe as a food (kind `recipe`) with its per-100 g values worked out from the
 * ingredients (SPEC §2.9), its units (serving, and katori once it was weighed cooked) and its
 * ingredients. Saving an existing recipe (`id`) replaces its details, units and ingredients but
 * keeps its id, so days it was logged on use the new numbers. Returns the recipe's id.
 */
export async function saveRecipe(
  input: RecipeInput,
  id?: string,
  now = Date.now(),
): Promise<string> {
  const db = getUserDb();
  const recipeId = id ?? uuid();
  const amounts = amountsOf(input);
  const values = {
    kind: 'recipe' as const,
    name: input.name,
    servings: input.servings,
    yieldG: input.cookedWeightG,
    cookedWithFat: input.items.some((i) => i.isFat),
    ...recipePer100g(amounts),
    updatedAt: now,
    deletedAt: null,
  };

  if (id) {
    await db.update(customFoods).set(values).where(eq(customFoods.id, id));
    await db
      .update(customFoodUnits)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(customFoodUnits.customFoodId, id), isNull(customFoodUnits.deletedAt)));
    await db
      .update(recipeItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(recipeItems.recipeId, id), isNull(recipeItems.deletedAt)));
  } else {
    await db.insert(customFoods).values({ ...values, id: recipeId, createdAt: now });
  }

  const units = recipeUnits(amounts, input.servingLabel);
  if (units.length > 0) {
    await db.insert(customFoodUnits).values(
      units.map((u) => ({
        ...u,
        id: uuid(),
        customFoodId: recipeId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })),
    );
  }
  if (input.items.length > 0) {
    await db.insert(recipeItems).values(
      input.items.map(({ nutrients, ...item }, position) => ({
        ...item,
        ...(nutrients ?? emptyNutrients()),
        id: uuid(),
        recipeId,
        position,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })),
    );
  }
  return recipeId;
}

/** A recipe with its ingredients in order, or `null` if there is none (or it was deleted). */
export async function getRecipe(id: string): Promise<SavedRecipe | null> {
  const db = getUserDb();
  const [food] = await db
    .select()
    .from(customFoods)
    .where(
      and(eq(customFoods.id, id), eq(customFoods.kind, 'recipe'), isNull(customFoods.deletedAt)),
    );
  if (!food) return null;
  const items = await db
    .select()
    .from(recipeItems)
    .where(and(eq(recipeItems.recipeId, id), isNull(recipeItems.deletedAt)))
    .orderBy(asc(recipeItems.position));
  return {
    id: food.id,
    name: food.name,
    servings: food.servings ?? 1,
    cookedWeightG: food.yieldG,
    items: items.map((row) => ({
      id: row.id,
      foodSource: row.foodSource,
      foodId: row.foodId,
      name: row.name,
      qty: row.qty,
      unit: row.unit,
      grams: row.grams,
      isFat: row.isFat,
      nutrients: pickNutrients(row),
    })),
  };
}
