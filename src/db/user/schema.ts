import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type SQLiteRealBuilderInitial,
} from 'drizzle-orm/sqlite-core';

import { NUTRIENT_KEYS, type NutrientKey } from '@/lib/nutrients';

/**
 * App settings as key/value pairs (SPEC §4.2). `value` holds JSON text,
 * e.g. key "theme", value "\"dark\"".
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * Meal slots (SPEC §4.2): Breakfast, Lunch, Snacks, Dinner, plus custom ones (Stage 10).
 * Times are minutes after midnight; a window may wrap past midnight (Dinner 19:00–04:00).
 */
export const mealSlots = sqliteTable('meal_slots', {
  /** `breakfast`, `lunch`, `snacks`, `dinner`, or a UUID for a custom slot. */
  id: text('id').primaryKey(),
  /** NULL for a built-in slot that hasn't been renamed: its name then comes from en.json. */
  name: text('name'),
  position: integer('position').notNull(),
  startMin: integer('start_min').notNull(),
  endMin: integer('end_min').notNull(),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/**
 * One thing eaten (SPEC §4.2). Stores the amount in grams; nutrient totals are never stored,
 * they are worked out from grams × the food's per-100 g values (SPEC §5.3).
 */
export const logEntries = sqliteTable(
  'log_entries',
  {
    id: text('id').primaryKey(),
    /** The logical day, 'YYYY-MM-DD' (a day starts at 4 am, SPEC §5.8). */
    day: text('day').notNull(),
    /** When it was eaten, epoch milliseconds (editable). */
    loggedAt: integer('logged_at').notNull(),
    slotId: text('slot_id').notNull(),
    /** `base` = foods.db, `custom` = custom_foods, `quick` = quick add (no food, no grams). */
    foodSource: text('food_source', { enum: ['base', 'custom', 'quick'] }).notNull(),
    /** foods.id as text, or custom_foods.id; NULL for quick add. */
    foodId: text('food_id'),
    /** The food's name when it was logged. */
    name: text('name').notNull(),
    qty: real('qty'),
    unit: text('unit'),
    /** qty × grams in one unit, worked out when logging; NULL for quick add. */
    grams: real('grams'),
    /** Oil/ghee: −1 less, 0 normal, +1 more (SPEC §5.5). */
    oilLevel: integer('oil_level').notNull().default(0),
    quickKcal: real('quick_kcal'),
    quickProteinG: real('quick_protein_g'),
    quickCarbG: real('quick_carb_g'),
    quickFatG: real('quick_fat_g'),
    /** An optional note from the user. */
    note: text('note'),
    /** Shared by entries made in one action (copy, thali), so Undo can reverse them together. */
    batchId: text('batch_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    index('log_entries_day_idx').on(table.day, table.deletedAt),
    index('log_entries_food_idx').on(table.foodSource, table.foodId),
    index('log_entries_slot_idx').on(table.slotId, table.loggedAt),
  ],
);

/** Foods the user starred (SPEC §4.2), shown in the Favourites tab of Add food. */
export const favourites = sqliteTable(
  'favourites',
  {
    /** `base` (foods.db) or `custom` (custom_foods). */
    foodSource: text('food_source', { enum: ['base', 'custom'] }).notNull(),
    foodId: text('food_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.foodSource, table.foodId] })],
);

export type MealSlot = typeof mealSlots.$inferSelect;
export type Favourite = typeof favourites.$inferSelect;
export type LogEntry = typeof logEntries.$inferSelect;

/**
 * The person (SPEC §4.2): a single row, `id = 1`. Every answer can be skipped in onboarding, so
 * every field may be NULL. Weight lives in `weights`.
 */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  /** `m`, `f`, or `x` = prefer not to say. */
  sex: text('sex', { enum: ['m', 'f', 'x'] }),
  birthYear: integer('birth_year'),
  heightCm: real('height_cm'),
  activity: text('activity', {
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  }),
  goal: text('goal', { enum: ['lose', 'maintain', 'gain', 'track'] }),
  /** 0, 0.25 or 0.5 kg a week. */
  paceKgWeek: real('pace_kg_week'),
  /** When onboarding was finished or skipped; NULL shows onboarding. */
  onboardedAt: integer('onboarded_at'),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Daily targets (SPEC §4.2). A new row starts every time targets change, so past days keep the
 * targets they had: the targets for a day are the row with the latest `effective_from <= day`.
 */
export const targets = sqliteTable('targets', {
  id: text('id').primaryKey(),
  /** The first day these targets apply to. One row per day at most. */
  effectiveFrom: text('effective_from').notNull().unique(),
  /** NULL = no calorie target (Just track, under 18, or body numbers skipped). */
  kcal: real('kcal'),
  proteinG: real('protein_g'),
  carbG: real('carb_g'),
  fatG: real('fat_g'),
  fibreG: real('fibre_g'),
  sodiumMgLimit: real('sodium_mg_limit').notNull(),
  sugarGLimit: real('sugar_g_limit').notNull(),
  satFatGLimit: real('sat_fat_g_limit').notNull(),
  fatGLimit: real('fat_g_limit').notNull(),
  /** false = the suggested numbers, true = edited by the person. */
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/** Weigh-ins (SPEC §4.2): one per day; a new one the same day replaces it. */
export const weights = sqliteTable(
  'weights',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    weightKg: real('weight_kg').notNull(),
    loggedAt: integer('logged_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('weights_day_idx').on(table.day, table.deletedAt)],
);

/** Water drunk (SPEC §4.2): one row per tap on + (a glass) or per custom amount. */
export const waterLogs = sqliteTable(
  'water_logs',
  {
    id: text('id').primaryKey(),
    /** The logical day, 'YYYY-MM-DD'. */
    day: text('day').notNull(),
    loggedAt: integer('logged_at').notNull(),
    ml: integer('ml').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('water_logs_day_idx').on(table.day, table.deletedAt)],
);

/**
 * Limit alerts (SPEC §6), one row per nutrient per day at most: when it first fired (so it never
 * fires twice in a day) and when its line on the Today card was closed.
 */
export const limitAlerts = sqliteTable(
  'limit_alerts',
  {
    day: text('day').notNull(),
    /** `fat`, `sat_fat`, `sugar` or `sodium`. */
    alert: text('alert', { enum: ['fat', 'sat_fat', 'sugar', 'sodium'] }).notNull(),
    firedAt: integer('fired_at').notNull(),
    dismissedAt: integer('dismissed_at'),
  },
  (table) => [primaryKey({ columns: [table.day, table.alert] })],
);

/**
 * The weekly check-in on Today (SPEC §8.4): one row per week looked back on, once the person
 * answers "How did last week feel?" or closes the card.
 */
export const weeklyCheckins = sqliteTable('weekly_checkins', {
  /** The Monday of the week the check-in is about (last week, seen from this week's Today). */
  weekStart: text('week_start').primaryKey(),
  feeling: text('feeling', { enum: ['easy', 'okay', 'hard'] }),
  dismissedAt: integer('dismissed_at'),
  createdAt: integer('created_at').notNull(),
});

export type Profile = typeof profile.$inferSelect;
export type TargetsRow = typeof targets.$inferSelect;
export type WeightRow = typeof weights.$inferSelect;
export type WaterLogRow = typeof waterLogs.$inferSelect;
export type LimitAlertRow = typeof limitAlerts.$inferSelect;
export type WeeklyCheckinRow = typeof weeklyCheckins.$inferSelect;

/**
 * The 35 nutrient columns (SPEC §3), per 100 g, NULL = unknown. The property names are the column
 * names (`energy_kcal`…), so a row's nutrients read straight into `NutrientValues`.
 */
function nutrientColumns(): { [K in NutrientKey]: SQLiteRealBuilderInitial<K> } {
  const columns: Record<string, unknown> = {};
  for (const key of NUTRIENT_KEYS) columns[key] = real(key);
  return columns as { [K in NutrientKey]: SQLiteRealBuilderInitial<K> };
}

/**
 * Foods that live in user.db (SPEC §4.2): barcode products cached from Open Food Facts or typed in
 * from a label, the person's own recipes, and (still to come) foods made by hand.
 */
export const customFoods = sqliteTable(
  'custom_foods',
  {
    id: text('id').primaryKey(),
    /** `product` (barcode), `custom` (made by hand), `recipe`. */
    kind: text('kind', { enum: ['custom', 'product', 'recipe'] }).notNull(),
    name: text('name').notNull(),
    brand: text('brand'),
    /** One spelling per packet (src/lib/barcode.ts); a deleted product keeps its barcode. */
    barcode: text('barcode').unique(),
    /** Grams in one serving, from the label. */
    servingG: real('serving_g'),
    densityGPerMl: real('density_g_per_ml').notNull().default(1),
    cookedWithFat: integer('cooked_with_fat', { mode: 'boolean' }).notNull().default(false),
    /** Recipes: total cooked weight. */
    yieldG: real('yield_g'),
    /** Recipes: number of servings. */
    servings: real('servings'),
    /** `found` (from Open Food Facts), `user_added` (from a label), `contributed` (Stage 12). */
    offStatus: text('off_status', { enum: ['found', 'user_added', 'contributed'] }),
    offFetchedAt: integer('off_fetched_at'),
    /** A photo of the label, kept in the app's own files (optional). */
    labelPhotoUri: text('label_photo_uri'),
    /**
     * Stage 11c: set only on a **group food** — a copy of a food someone else in the person's
     * group shared (`shared_foods.id` on the server, which is also this row's id). Group foods
     * can be logged like any other, but only the person who shared them can change them.
     */
    sharedFoodId: text('shared_food_id'),
    ...nutrientColumns(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    /** The person's own food: *Share with my group* is on (Stage 11c). */
    shareWithGroup: integer('share_with_group', { mode: 'boolean' }).notNull().default(false),
    /**
     * The person's own food: the `updated_at` of the version the group has, or null when the
     * group doesn't have it. Newer changes are sent when the phone is next online.
     */
    sharedAt: integer('shared_at'),
    /** A group food: the name of the person who shared it ("Asha"). */
    addedBy: text('added_by'),
  },
  (table) => [index('custom_foods_kind_idx').on(table.kind, table.deletedAt)],
);

/** Units of a custom food (SPEC §4.2): "1 serving = 30 g", "1 pack = 70 g". */
export const customFoodUnits = sqliteTable(
  'custom_food_units',
  {
    id: text('id').primaryKey(),
    customFoodId: text('custom_food_id').notNull(),
    unit: text('unit').notNull(),
    /** The unit in words, without a number ("serving"). */
    label: text('label').notNull(),
    grams: real('grams').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('custom_food_units_food_idx').on(table.customFoodId, table.deletedAt)],
);

/**
 * Barcodes waiting for a lookup (SPEC §2.7, §2.8): scanned while offline, looked up when the app
 * opens or comes back to the front. The Pending lookups card on Today lists them.
 */
export const barcodeQueue = sqliteTable('barcode_queue', {
  barcode: text('barcode').primaryKey(),
  scannedAt: integer('scanned_at').notNull(),
  /** The day and meal it was scanned for, so logging it later goes to the same place. */
  day: text('day').notNull(),
  slotId: text('slot_id'),
  /** `pending` (not looked up yet), `found` (saved as a product), `not_found`. */
  status: text('status', { enum: ['pending', 'found', 'not_found'] }).notNull(),
  /** The product once it was found. */
  customFoodId: text('custom_food_id'),
  lastTryAt: integer('last_try_at'),
});

export type CustomFood = typeof customFoods.$inferSelect;
export type CustomFoodUnit = typeof customFoodUnits.$inferSelect;
export type BarcodeQueueRow = typeof barcodeQueue.$inferSelect;

/**
 * A recipe's ingredients (SPEC §4.2 `recipe_items`). Each row keeps the ingredient's per-100 g
 * values from when the recipe was saved, so the recipe still adds up — and its oil control still
 * knows its oil — if a food is later changed or deleted.
 */
export const recipeItems = sqliteTable(
  'recipe_items',
  {
    id: text('id').primaryKey(),
    /** The recipe (a `custom_foods` row of kind `recipe`). */
    recipeId: text('recipe_id').notNull(),
    position: integer('position').notNull(),
    /** `base` (foods.db) or `custom` (custom_foods). */
    foodSource: text('food_source', { enum: ['base', 'custom'] }).notNull(),
    foodId: text('food_id').notNull(),
    name: text('name').notNull(),
    qty: real('qty').notNull(),
    unit: text('unit').notNull(),
    grams: real('grams').notNull(),
    /** Oil, ghee, butter…: scaled by the oil control (SPEC §5.5). */
    isFat: integer('is_fat', { mode: 'boolean' }).notNull().default(false),
    ...nutrientColumns(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('recipe_items_recipe_idx').on(table.recipeId, table.deletedAt)],
);

/** Meals saved as a named template (SPEC §4.2 `my_thalis`), logged again in one go. */
export const myThalis = sqliteTable('my_thalis', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/** The foods in a saved thali, with the amounts they were saved with. */
export const myThaliItems = sqliteTable(
  'my_thali_items',
  {
    id: text('id').primaryKey(),
    thaliId: text('thali_id').notNull(),
    position: integer('position').notNull(),
    foodSource: text('food_source', { enum: ['base', 'custom'] }).notNull(),
    foodId: text('food_id').notNull(),
    name: text('name').notNull(),
    qty: real('qty').notNull(),
    unit: text('unit').notNull(),
    /** Grams for `qty`, kept in case the food loses this unit later. */
    grams: real('grams').notNull(),
    oilLevel: integer('oil_level').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('my_thali_items_thali_idx').on(table.thaliId, table.deletedAt)],
);

export type RecipeItemRow = typeof recipeItems.$inferSelect;
export type MyThali = typeof myThalis.$inferSelect;
export type MyThaliItem = typeof myThaliItems.$inferSelect;
