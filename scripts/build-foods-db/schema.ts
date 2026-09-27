// foods.db tables (SPEC §4.1). The app opens this file read-only.

import { NUTRIENT_KEYS } from '../../src/lib/nutrients';

/** Bump when the tables or the data change in a way the app must notice (SPEC §4.1 meta). */
export const DB_VERSION = 2;

const nutrientColumns = NUTRIENT_KEYS.map((k) => `  ${k} REAL`).join(',\n');

export const SCHEMA_SQL = `
CREATE TABLE foods (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,            -- indb | ifct | usda_fnd | usda_sr
  source_code TEXT NOT NULL,
  name TEXT NOT NULL,              -- English display name
  name_hi TEXT,                    -- Roman-letter Hindi name, if known
  category TEXT NOT NULL,
  kind TEXT NOT NULL,              -- ingredient | dish
  diet TEXT,                       -- veg | egg | nonveg | NULL (unknown)
  cooked_with_fat INTEGER NOT NULL,
  density_g_per_ml REAL NOT NULL,
  default_unit TEXT NOT NULL,
  default_qty REAL NOT NULL,
  yield_g REAL,
  energy_estimated INTEGER NOT NULL,
  search_rank INTEGER NOT NULL,    -- indb 1, ifct 2, usda 3
  complete_macro INTEGER NOT NULL, -- 1 = energy, protein, carbs and fat all known
  complete_other INTEGER NOT NULL, -- 1 = at least 80% of fibre/sugar/fats/cholesterol known
  complete_mineral INTEGER NOT NULL,
  complete_vitamin INTEGER NOT NULL,
${nutrientColumns},
  UNIQUE (source, source_code)
);

CREATE TABLE food_units (
  food_id INTEGER NOT NULL REFERENCES foods(id),
  unit TEXT NOT NULL,
  label TEXT NOT NULL,             -- without the number: "medium roti", "bowl"
  grams REAL NOT NULL,             -- grams in 1 unit
  is_default INTEGER NOT NULL,
  PRIMARY KEY (food_id, unit)
) WITHOUT ROWID;

CREATE TABLE unit_defaults (
  unit TEXT PRIMARY KEY,
  ml REAL,
  grams REAL,
  label TEXT NOT NULL
);

CREATE TABLE food_synonyms (
  food_id INTEGER NOT NULL REFERENCES foods(id),
  term TEXT NOT NULL,              -- lowercase Roman letters
  kind TEXT NOT NULL               -- hindi | spelling | regional | english
);
CREATE INDEX food_synonyms_term ON food_synonyms(term);

CREATE VIRTUAL TABLE foods_fts USING fts5(
  food_id UNINDEXED,
  text,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

-- The food shown first for an exact search term (data/curated/search_pins.csv).
-- term is phonetic text (SPEC §5.1), e.g. "dal" for "daal".
CREATE TABLE search_pins (
  term TEXT PRIMARY KEY,
  food_id INTEGER NOT NULL REFERENCES foods(id)
) WITHOUT ROWID;

CREATE TABLE recipe_ingredients (
  recipe_food_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  ingredient_food_id INTEGER,
  ingredient_name TEXT NOT NULL,
  grams REAL NOT NULL,
  is_fat INTEGER NOT NULL,
${nutrientColumns},
  PRIMARY KEY (recipe_food_id, position)
) WITHOUT ROWID;

CREATE TABLE thali_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT
);

CREATE TABLE thali_template_items (
  template_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  food_id INTEGER NOT NULL,
  qty REAL NOT NULL,
  unit TEXT NOT NULL,
  PRIMARY KEY (template_id, position)
) WITHOUT ROWID;

CREATE TABLE slot_suggestions (
  slot TEXT NOT NULL,
  food_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (slot, position)
) WITHOUT ROWID;

CREATE TABLE rda_reference (
  nutrient TEXT NOT NULL,
  sex TEXT NOT NULL,
  rda REAL,
  tul REAL,
  per_1000_kcal REAL,
  unit TEXT NOT NULL,
  PRIMARY KEY (nutrient, sex)
) WITHOUT ROWID;

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
