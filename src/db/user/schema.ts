import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * App settings as key/value pairs (SPEC §4.2). `value` holds JSON text,
 * e.g. key "theme", value "\"dark\"".
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * Meal slots (SPEC §4.2): Breakfast, Lunch, Snacks, Dinner, plus custom ones later.
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
