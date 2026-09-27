# Kalorie — Product & Technical Spec

Kalorie is a free, ad-free calorie and nutrition tracker for Android and iOS, built for
one person, their family and friends in India. It must be **simple, fast to log, and
never feel like a chore**.

- App name: **Kalorie** (same everywhere, Latin script)
- App ID (Android package + iOS bundle ID): **`com.mynklabs.kalorie`** — permanent
- Users: **one adult (18+) per phone**. No profile switcher.
- Language: **English UI only**, but every string goes through i18next (`en.json`) so a
  language can be added later. Search understands **Hindi food names typed in Roman
  letters** (daal, bhindi, dahi).
- Platforms: Expo SDK default minimums (about Android 7+, iOS 15.1+).
- Theme: follows the phone's light/dark setting, with a manual override.

---

## 1. Decisions log (from the interview, 2026-09-26)

| Topic | Decision |
|---|---|
| Profiles | One person per phone |
| Age | 18+ gets targets. Under 18: logging only, friendly note, no calorie target |
| Units | Per-food gram weights, fallback to default unit volumes × density |
| Katori | Fixed 150 ml |
| Roti | Small / medium / large = 25 / 35 / 50 g |
| Duplicates across sources | Merge; priority INDB → IFCT 2017 → USDA; show source tag |
| USDA in search | Yes, ranked below Indian foods |
| Synonyms | Hand-curated `data/curated/synonyms.csv` + typo-tolerant matching |
| Hindi | Roman-letter Hindi names in search only; no Hindi UI; i18next kept |
| Default slots | Breakfast, Lunch, Snacks, Dinner (+ custom) |
| Day boundary | 4:00 am — earlier entries belong to the previous day |
| Auto slot | By editable time window |
| Goals | Lose / Maintain / Gain with pace, or Just track |
| Safe floor | 1200 kcal (female / not stated), 1500 kcal (male), and never below BMR — warn, never block |
| Macro split | 55% carb / 15% protein / 30% fat; protein ≥ 0.83 g/kg |
| Measurements | kg + cm; height can be entered in ft/in (stored as cm) |
| Sex input | Male / Female / Prefer not to say |
| Limits | ICMR-NIN / WHO defaults (see §6) |
| Alerts | Soft note at 100%, on Today only |
| Sugar | Total sugar ≤ 10% of kcal |
| Calendar | On track = within ±10% of calorie target |
| Streak | ≥ 1 entry keeps the day; 2 free days per Mon–Sun week |
| Photo-now-log-later | **Dropped** |
| Water | 250 ml glass, 2000 ml goal (both editable) |
| Weight trend | Exponential moving average, 10% |
| Reminders | All off; offered once after day 3 |
| Image picker | Used to scan a barcode from a gallery photo |
| Offline barcode | Queue and look up when online |
| OFF contribute | Optional button, Stage 12, login kept in expo-secure-store |
| Oil adjuster | Scale the recipe's oil/ghee grams (0.5× / 1× / 1.5×) |
| Thalis | ~6 built-in starters + user-saved |
| Micros reference | ICMR-NIN 2020 RDA, with TUL note |
| Incomplete marker | > 20% of the day's grams lack a value |
| Hide numbers | Hides kcal, grams, %, weight; keeps shapes and words |
| CSV export | Entries, daily totals, weight, water (4 files) |
| Extra libraries approved | expo-file-system, expo-sharing, expo-asset, expo-haptics, expo-secure-store (Stage 12); dev-only: xlsx, csv-parse, tsx, drizzle-kit (better-sqlite3 not needed — see Stage 2 row) |
| Colours | Monochrome base; accent colours only where they carry meaning; no red for "over" |
| Undo | 5-second Undo bar + soft delete kept 30 days |
| Sync (Stage 11) | Email one-time code; backup + restore + shared foods pool via invite code |
| Food data build (Stage 2) | Node's built-in `node:sqlite` (has FTS5) instead of better-sqlite3 · IFCT from `@ifct2017/compositions` **2.0.9** (MIT, pinned) because `ifct2017` ≥ 2.1 is AGPL-3.0 · `xlsx` 0.20.3 from the SheetJS CDN (the npm copy is outdated) · foods get a Roman Hindi `name_hi` and 4 completeness flags |
| Tabs (changed in Stage 1) | Today · Log · Trends · Profile. Log = timeline + calendar (was History); Profile = settings and account (was More) |
| Search ranking (Stage 2b, 2026-09-27) | Match tiers refined (§5.1 step 4) and hand-picked **search pins** added for staples the data can't rank on its own (plain curd exists only in USDA). Until Stage 8, the Log tab shows food search + a food detail screen (`app/food/[id].tsx`) so search can be tried on the phone |

---

## 2. Screens

Navigation uses expo-router. There are four bottom tabs: **Today · Log · Trends · Profile**.
- **Today** — the main overview of the day.
- **Log** — the meal timeline for today, and past days picked from a calendar.
- **Trends** — stats over days and weeks, and insights.
- **Profile** — settings, your profile and account, and other options.

Route files in `app/` only re-export a screen from `src/features/<name>/`.
"Add food" is a full-screen modal opened from Today.

### 2.1 Onboarding (`app/(onboarding)/`) — target under 60 seconds
One question per screen, big tap targets, a progress bar, and a "Back" button. No typing
except numbers.

1. **Welcome** — "Kalorie helps you notice what you eat. Setup takes under a minute."
   Buttons: *Get started*, *Skip — just let me log* (sets goal = track, no targets).
2. **Goal** — Lose weight · Maintain · Gain weight · Just track.
   If Lose: pace chips *Gentle (0.25 kg/week)* · *Steady (0.5 kg/week)*.
   If Gain: *0.25 kg/week* only.
3. **About you** — Sex (Male · Female · Prefer not to say), Age (number), Height
   (cm, or ft + in toggle), Weight (kg). Under 18 → friendly note, goal forced to Just track.
4. **Activity** — 5 cards with plain examples:
   Mostly sitting · Light (walks, housework) · Moderate (exercise 3–5 days) ·
   Active (exercise 6–7 days) · Very active (physical job + exercise).
5. **Your starting targets** — calorie number, macro grams, a line that says "These are a
   starting point. You can change them any time." Shows the floor warning (§5.4) if it
   applies. Button: *Start logging* → Today.

### 2.2 Today (`app/(tabs)/index.tsx`)
Top to bottom:
- **Date header** — "Today" / date, ‹ › arrows, tap for a date picker. Streak chip
  ("🔥 12 days · 2 free days left").
- **Calorie ring** — eaten, target, "left" or "more than planned". The ring fills to 100%;
  anything beyond shows as a thin soft-blue outer arc. In hide-numbers mode: shape + words
  only (§8.3). In Just-track mode: shows eaten only, no ring target.
- **Macro pie** — protein / carbs / fat by kcal share, legend with grams eaten vs target.
  Tap a macro → **Top 3 foods** sheet (food, grams of that macro, % of the day's total).
- **Water row** — glasses as small icons, *+1 glass* button, long-press for custom ml.
- **Notice cards** (only if relevant, in this order, max 3 visible):
  alert card (§6), weekly check-in (Mondays, §8.4), pending barcode lookups (§2.8),
  reminders offer (once, after day 3).
- **Timeline by meal slot** — one card per visible slot in order. Each card: slot name,
  slot kcal, entry rows (name, amount like "1 katori", kcal), *+ Add* button, a ⋯ menu:
  *Copy this meal to…*, *Save as thali*, *Clear meal*.
  Tapping an entry opens **Edit entry**. Swipe left → delete (with Undo).
- **Day menu (⋯ in header)** — *Copy yesterday to today*, *Copy this day to…*,
  *Recently deleted*.
- **Undo bar** — after log, delete, copy or clear; 5 seconds; one tap reverses the whole action.

### 2.3 Add food (modal, `app/add/index.tsx`)
- **Slot chip** at top, pre-selected by time window (§5.8); tap to change.
- **Search bar** (autofocus). Results in a FlashList: name, source tag
  (INDB / IFCT / USDA / My food / Product), a typical portion + its kcal, ☆ favourite.
- When the search box is empty, show tabs: **Suggested** (time-of-day, §5.9) ·
  **Recent** · **Favourites** · **My foods** · **Thalis**.
- Buttons row: **Scan barcode** · **Quick add** · **Create food**.
- Tap a result → **Portion sheet**.

### 2.4 Portion sheet (bottom sheet)
- Food name, source tag, ☆ favourite toggle.
- Quantity stepper (0.25 steps for katori/cup/glass, 0.5 for roti/piece, free number for g/ml).
- Unit chips: only the units valid for this food (§5.2), default unit pre-selected.
- Grams preview ("≈ 150 g").
- **Oil/ghee**: Less · Normal · More (only if the food has fat ingredients or `cooked_with_fat = 1`).
- Live numbers for this portion: kcal, P / C / F.
- *Log to Lunch* button (slot name shown). After logging: haptic tick + Undo bar, sheet
  closes, the search stays open for the next item ("Add more" flow).

### 2.5 Quick add
kcal (required), optional protein / carbs / fat grams, optional name ("Wedding buffet"),
slot. Stored without grams (§4.2 `log_entries`).

### 2.6 Edit entry
Same as the portion sheet plus: slot picker, time picker, *Delete*. Changes save on *Done*.

### 2.7 Barcode scanner (`app/scan.tsx`)
- Live camera (expo-camera) with a frame, torch toggle.
- *Pick from gallery* (expo-image-picker → expo-camera `scanFromURLAsync`).
  ⚠ Check iOS support for EAN/UPC from images in Stage 6; if iOS only reads QR from images,
  hide this button on iOS.
- *Type the code* → numeric field.
- Flow: check local cache (`custom_foods` where `barcode = code`) → if found, portion sheet.
  Else if online → Open Food Facts lookup → if found, save as product → portion sheet.
  Else if offline → add to `barcode_queue`, offer Quick add now.
  Else (not found) → **Add from label** form.

### 2.8 Add from label
Name, brand, barcode (pre-filled), "Values are per: 100 g · 100 ml · one serving of ___ g".
Fields: energy kcal, protein, carbs, of which sugar, fat, of which saturated fat, trans
fat, fibre, sodium (mg), cholesterol (mg). Optional: serving size in g, pack size.
Saved as per-100 g (§5.3). Stage 12 adds a toggle: *Also share with Open Food Facts*.
The **Pending lookups** card on Today lists queued barcodes; tapping retries.

### 2.9 My foods, recipes, thalis (`Profile` tab → Foods)
- **My foods list** — custom foods + cached products, search, edit, delete.
- **Create / edit food** — same fields as §2.8, plus custom units ("1 bowl = 180 g").
- **Recipe list / builder** — name, servings, ingredients (search to add; qty + unit each;
  auto-flag oil/ghee/butter as fat), optional *total cooked weight* (default = sum of raw
  ingredient grams). Shows per serving and per 100 g. Saved as a food (kind = recipe).
- **Thalis** — built-in starters and *My thalis*. Tap → preview the list with checkboxes
  → *Log selected* to the chosen slot. *Save as thali* from any meal card.

### 2.10 Log tab (`app/(tabs)/log.tsx`)
- Opens on **today's timeline** (meal-slot cards as in §2.2), editable.
- **Calendar** (react-native-calendars) with day dots coloured by adherence (§5.6),
  plus a legend. Month swipe.
- Streak summary ("Longest: 34 days · This week: 5 of 7 logged").
- Tap a day → that day's timeline (editable), day totals, *Recently deleted* for that
  day (restore within 30 days).

### 2.11 Trends tab (`app/(tabs)/trends.tsx`)
Segment: **Week · Month**. Sections:
- **Calories** — bar per day, dashed target line, "average 1,840 kcal · 5 days on track".
- **Macros** — average grams vs targets, stacked bar per day.
- **Weight** — dots for weigh-ins, smooth trend line (§5.7), *+ Add weight*, change over
  period ("trend −0.6 kg"). Hidden in hide-numbers mode (shows direction words only).
- **Water** — bar per day vs goal.
- **Nutrients** — link to Micronutrients for the selected period (averaged per logged day).

### 2.12 Micronutrients (`app/nutrients.tsx`)
Period picker (Day · Week avg). Two groups: **Vitamins**, **Minerals**, plus **Other**
(fibre, cholesterol, sat/mono/poly/trans fat). Each row: name, bar, "% of daily need",
amount + unit, `≈` and "some foods missing data" marker when incomplete (§5.10),
a neutral "above safe upper level" note when above TUL. Tap → top 3 foods for that nutrient.

### 2.13 Goals (`Profile` → Goals)
- Profile (sex, age, height, weight, activity, goal, pace) → *Recalculate targets*.
- Targets: kcal, protein, carbs, fat, fibre — each editable (new values start a new
  `targets` row from today, so past days keep their old targets).
- Limits: sodium, sugar, saturated fat, fat — each editable and each with an on/off alert toggle.
- Floor warning shown inline when kcal is below the floor.

### 2.14 Profile tab / Settings (`app/(tabs)/profile.tsx`)
Goals · My foods · Recipes · Thalis · Meal slots (rename, reorder, hide, add custom, edit
time windows) · Water (glass ml, goal ml) · Hide numbers · Theme (System / Light / Dark) ·
Reminders (per slot, time) · Alerts · Export CSV · About & data sources (licences and
credits: INDB, IFCT 2017/NIN, USDA FoodData Central, Open Food Facts ODbL) ·
*Stage 11:* Account, Backup & restore, My group · *Stage 12:* Open Food Facts account.

---

## 3. Nutrients tracked (exact list)

All values are **per 100 g of edible portion**. `NULL` = unknown (not zero).
The same column names are used in `foods` (foods.db) and `custom_foods` (user.db).

| # | Column | Label | Unit | Group |
|---|---|---|---|---|
| 1 | `energy_kcal` | Energy | kcal | Energy |
| 2 | `protein_g` | Protein | g | Macro |
| 3 | `carb_g` | Carbohydrate (available) | g | Macro |
| 4 | `fat_g` | Total fat | g | Macro |
| 5 | `fibre_g` | Dietary fibre | g | Other |
| 6 | `sugar_g` | Total sugars | g | Other |
| 7 | `sat_fat_g` | Saturated fat | g | Other |
| 8 | `mufa_g` | Monounsaturated fat | g | Other |
| 9 | `pufa_g` | Polyunsaturated fat | g | Other |
| 10 | `trans_fat_g` | Trans fat | g | Other |
| 11 | `cholesterol_mg` | Cholesterol | mg | Other |
| 12 | `sodium_mg` | Sodium | mg | Mineral |
| 13 | `potassium_mg` | Potassium | mg | Mineral |
| 14 | `calcium_mg` | Calcium | mg | Mineral |
| 15 | `iron_mg` | Iron | mg | Mineral |
| 16 | `magnesium_mg` | Magnesium | mg | Mineral |
| 17 | `phosphorus_mg` | Phosphorus | mg | Mineral |
| 18 | `zinc_mg` | Zinc | mg | Mineral |
| 19 | `copper_mg` | Copper | mg | Mineral |
| 20 | `manganese_mg` | Manganese | mg | Mineral |
| 21 | `selenium_ug` | Selenium | µg | Mineral |
| 22 | `iodine_ug` | Iodine | µg | Mineral |
| 23 | `vit_a_ug` | Vitamin A (RAE) | µg | Vitamin |
| 24 | `thiamine_mg` | Vitamin B1 (thiamine) | mg | Vitamin |
| 25 | `riboflavin_mg` | Vitamin B2 (riboflavin) | mg | Vitamin |
| 26 | `niacin_mg` | Vitamin B3 (niacin) | mg | Vitamin |
| 27 | `pantothenic_mg` | Vitamin B5 (pantothenic acid) | mg | Vitamin |
| 28 | `vit_b6_mg` | Vitamin B6 | mg | Vitamin |
| 29 | `biotin_ug` | Vitamin B7 (biotin) | µg | Vitamin |
| 30 | `folate_ug` | Vitamin B9 (folate) | µg | Vitamin |
| 31 | `vit_b12_ug` | Vitamin B12 | µg | Vitamin |
| 32 | `vit_c_mg` | Vitamin C | mg | Vitamin |
| 33 | `vit_d_ug` | Vitamin D | µg | Vitamin |
| 34 | `vit_e_mg` | Vitamin E (α-tocopherol) | mg | Vitamin |
| 35 | `vit_k_ug` | Vitamin K | µg | Vitamin |

Build-time conversions:
- IFCT energy is in kJ → `kcal = kJ / 4.184`. Every other IFCT value (from
  `@ifct2017/compositions`) is in **grams** per 100 g → × 1000 for mg, × 10⁶ for µg. IFCT writes
  a missing value as 0: when a whole group (minerals, vitamins, fatty acids) is 0 for a food it
  is stored as `NULL`.
- INDB fatty acids are in mg → ÷ 1000. INDB's `vita_ug` is retinol only, so
  `vit_a_ug = vita + carotenoids / 12`. INDB serving grams = serving kcal ÷ kcal per 100 g × 100.
- If a source has no energy value: `kcal = 4·protein + 4·carb + 9·fat` (+ `energy_estimated = 1`).
- Vitamin A RAE = retinol + β-carotene / 12 + other provitamin-A carotenoids / 24 (µg)
  — confirm the conversion factor ICMR-NIN 2020 uses before Stage 9.
- Sodium from Open Food Facts is in g/100 g → × 1000.
- `carb_g` = available carbohydrate (IFCT "by difference minus fibre"; USDA
  "carbohydrate by difference" minus fibre).

### 3.1 ICMR-NIN 2020 reference values (adult, sedentary)

These are **starting values** and must be checked against the official ICMR-NIN 2020
tables before Stage 9 (see PLAN.md). They are stored in
`data/curated/rda_icmr_nin_2020.csv` → `rda_reference` in foods.db.

| Nutrient | RDA man | RDA woman | TUL |
|---|---|---|---|
| Fibre | 20 g per 1000 kcal of target | same | — |
| Calcium | 1000 mg | 1000 mg | 2500 mg |
| Iron | 19 mg | 29 mg | 45 mg |
| Magnesium | 440 mg | 370 mg | 350 mg (from supplements only) |
| Phosphorus | 1000 mg | 1000 mg | 4000 mg |
| Zinc | 17 mg | 13.2 mg | 40 mg |
| Potassium | 3500 mg | 3500 mg | — |
| Copper | 2 mg | 2 mg | 10 mg |
| Manganese | 4 mg | 4 mg | 11 mg |
| Selenium | 40 µg | 40 µg | 400 µg |
| Iodine | 140 µg | 140 µg | 1100 µg |
| Vitamin A | 1000 µg | 840 µg | 3000 µg |
| Thiamine | 1.4 mg | 1.4 mg | — |
| Riboflavin | 2.0 mg | 1.9 mg | — |
| Niacin | 14 mg | 11 mg | 35 mg |
| Pantothenic acid | 5 mg | 5 mg | — |
| Vitamin B6 | 1.9 mg | 1.9 mg | 100 mg |
| Biotin | 40 µg | 40 µg | — |
| Folate | 300 µg | 220 µg | 1000 µg |
| Vitamin B12 | 2.5 µg | 2.5 µg | — |
| Vitamin C | 80 mg | 65 mg | 2000 mg |
| Vitamin D | 15 µg | 15 µg | 100 µg |
| Vitamin E | 10 mg | 10 mg | 300 mg |
| Vitamin K | 55 µg | 55 µg | — |

"Prefer not to say" uses the **higher** RDA of the two and the **lower** TUL.

---

## 4. Data model

SQLite types: `INTEGER`, `REAL`, `TEXT`. Booleans are `INTEGER` 0/1.
Dates are `TEXT 'YYYY-MM-DD'` (the **logical day**, §5.8). Timestamps are
`INTEGER` epoch milliseconds. `NUTRIENTS` means all 35 columns from §3, all `REAL NULL`.

### 4.1 foods.db — read-only, bundled at `assets/db/foods.db`

Built by `scripts/build-foods-db/` from `data/raw/` + `data/curated/`. The app never
writes to it (the connection runs with `PRAGMA query_only = ON`). On first launch the bundled
file is copied into the phone's SQLite folder; when an app update brings a different file the
copy is replaced — the setting `foods_db_version` stores the bundled asset's hash, and
`meta.db_version` is bumped whenever tables change. Opened with expo-sqlite's
`finalizeUnusedStatementsBeforeClosing: false`: the default finalizes FTS5's own statements
before closing and crashes the app on reload.

**`foods`**
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | stable across builds (hash of source + source_code) |
| source | TEXT | `indb`, `ifct`, `usda_fnd`, `usda_sr` |
| source_code | TEXT | ID in the original dataset |
| name | TEXT | display name, English |
| category | TEXT | e.g. `cereal`, `pulse`, `vegetable`, `dish`, `beverage`, `sweet` |
| kind | TEXT | `ingredient` or `dish` |
| diet | TEXT NULL | `veg`, `egg`, `nonveg` |
| cooked_with_fat | INTEGER | 1 if the oil adjuster applies without a recipe (0 for all foods.db rows: every INDB dish has a recipe) |
| density_g_per_ml | REAL | default 1.0 |
| default_unit | TEXT | e.g. `katori`, `roti_m`, `piece`, `g` |
| default_qty | REAL | e.g. 1 |
| yield_g | REAL NULL | weight of the whole recipe that the per-100 g values refer to (INDB dishes: the **raw** ingredient weight — INDB divides recipe totals by it, checked in the build) |
| energy_estimated | INTEGER | 1 if energy was calculated from macros |
| search_rank | INTEGER | source priority: indb 1, ifct 2, usda 3 |
| name_hi | TEXT NULL | Roman-letter Hindi name ("Garam Chai", "Bhindi"), from INDB brackets / IFCT |
| complete_macro | INTEGER | 1 if energy, protein, carbs and fat are all known |
| complete_other, complete_mineral, complete_vitamin | INTEGER | 1 if ≥ 80% of that §3 group is known |
| NUTRIENTS | REAL NULL | per 100 g |

**`food_synonyms`** — `food_id INTEGER`, `term TEXT` (lowercase, Roman letters),
`kind TEXT` (`hindi`, `spelling`, `regional`, `english`). Index on `term`.

**`foods_fts`** — FTS5 virtual table: `food_id UNINDEXED`, `text` (name + synonyms +
their phonetic keys, §5.1). Tokenizer `unicode61 remove_diacritics 2`, prefix index `2 3`.

**`food_units`** — `food_id INTEGER`, `unit TEXT` (`katori`, `roti_s`, `roti_m`,
`roti_l`, `piece`, `glass`, `cup`, `tsp`, `tbsp`, `slice`, `bowl`…), `label TEXT`
("medium roti" — no number, so the app can show "2 medium roti"), `grams REAL` (for 1 unit),
`is_default INTEGER`. PK (`food_id`, `unit`). Every unit a food offers has a row, including
standard measures (katori = 150 ml × density), so the portion sheet reads its chips from here;
`g` is always offered and has no row. INDB servings become `piece`, `slice`, `bowl`, `plate`,
`serving`, `tbsp` or `tsp` (label = INDB's word, e.g. "parantha", "tall glass"); USDA portions
become `cup`, `tbsp`, `tsp`, `slice`, `piece`, `piece_s`, `piece_l` or `serving`.

**`unit_defaults`** — `unit TEXT PK`, `ml REAL NULL`, `grams REAL NULL`, `label TEXT`.
Rows: katori 150 ml · glass 250 ml · cup 240 ml · tbsp 15 ml · tsp 5 ml · ml 1 ml ·
g 1 g. (Roti, piece, slice have no default: they exist only per food.)

**`recipe_ingredients`** — `recipe_food_id INTEGER`, `position INTEGER`,
`ingredient_food_id INTEGER NULL`, `ingredient_name TEXT`, `grams REAL`,
`is_fat INTEGER` (oil, ghee, butter, vanaspati, margarine), NUTRIENTS (per 100 g of the
ingredient — filled **only for fat rows**, which is all the adjuster needs; other ingredients
are looked up by `ingredient_food_id`, or are unknown if it is NULL).
PK (`recipe_food_id`, `position`). Built from `data/raw/recipes.xlsx`: kitchen measures become
grams with tsp 5 ml · tbsp 15 ml · cup 240 ml · ml × density; Anuvaad's own ingredient codes
are linked to foods through `data/curated/indb_ingredients.csv`.

**`search_pins`** — `term TEXT PK` (phonetic key text, §5.1), `food_id INTEGER`. The food shown
first for that exact search term. Built from `data/curated/search_pins.csv`.

**`thali_templates`** — `id INTEGER PK`, `name TEXT`, `region TEXT`.
**`thali_template_items`** — `template_id INTEGER`, `position INTEGER`, `food_id INTEGER`,
`qty REAL`, `unit TEXT`. Starters: North Indian veg · South Indian meals · Gujarati ·
Punjabi non-veg · Bengali fish · Simple dal-chawal.

**`slot_suggestions`** — `slot TEXT` (`breakfast`, `lunch`, `snacks`, `dinner`),
`food_id INTEGER`, `position INTEGER`. Starter suggestions for new users.

**`rda_reference`** — `nutrient TEXT` (column name from §3), `sex TEXT` (`m`, `f`),
`rda REAL NULL`, `tul REAL NULL`, `per_1000_kcal REAL NULL` (for fibre), `unit TEXT`.

**`meta`** — `key TEXT PK`, `value TEXT`: `db_version`, `built_at`, `indb_version`,
`ifct_version`, `usda_fnd_version`, `usda_sr_version`, `food_count`.

### 4.2 user.db — read-write, Drizzle ORM, migrations in `drizzle/`

Every table that will sync later has `id TEXT` (UUID v4), `created_at`, `updated_at`,
and `deleted_at INTEGER NULL` (soft delete). Rows with `deleted_at` older than 30 days
are hard-deleted at app start.

**`profile`** (single row, `id = 1`)
| Column | Type |
|---|---|
| id | INTEGER PK (always 1) |
| sex | TEXT (`m`, `f`, `x` = prefer not to say) |
| birth_year | INTEGER |
| height_cm | REAL |
| activity | TEXT (`sedentary`, `light`, `moderate`, `active`, `very_active`) |
| goal | TEXT (`lose`, `maintain`, `gain`, `track`) |
| pace_kg_week | REAL (0, 0.25, 0.5) |
| onboarded_at | INTEGER NULL |
| updated_at | INTEGER |

**`targets`** — a new row every time targets change, so old days keep old targets.
| Column | Type |
|---|---|
| id | TEXT PK |
| effective_from | TEXT (day) — unique |
| kcal | REAL NULL (NULL in Just-track mode) |
| protein_g, carb_g, fat_g, fibre_g | REAL NULL |
| sodium_mg_limit, sugar_g_limit, sat_fat_g_limit, fat_g_limit | REAL |
| is_custom | INTEGER (0 = calculated, 1 = user edited) |
| created_at, updated_at, deleted_at | INTEGER |

Targets for a day = the row with the latest `effective_from <= day`.

**`settings`** — `key TEXT PK`, `value TEXT` (JSON). Keys: `theme`, `hide_numbers`,
`water_glass_ml` (250), `water_goal_ml` (2000), `alerts_enabled`
(`{"sodium":true,"sugar":true,"sat_fat":true,"fat":true}`), `reminders`
(`{"enabled":false,"slots":{"<slot_id>":"09:00"}}`), `reminder_offer_shown`,
`first_open_day`, `foods_db_version`.

**`meal_slots`**
| Column | Type |
|---|---|
| id | TEXT PK (`breakfast`, `lunch`, `snacks`, `dinner`, or UUID for custom) |
| name | TEXT |
| position | INTEGER |
| start_min | INTEGER (minutes after midnight, e.g. 240 = 4:00) |
| end_min | INTEGER |
| is_hidden | INTEGER |
| is_builtin | INTEGER |
| created_at, updated_at, deleted_at | INTEGER |

Defaults: Breakfast 04:00–11:00 · Lunch 11:00–16:00 · Snacks 16:00–19:00 · Dinner 19:00–04:00.

**`log_entries`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| day | TEXT | logical day (§5.8) |
| logged_at | INTEGER | when it was eaten (editable) |
| slot_id | TEXT | → meal_slots.id |
| food_source | TEXT | `base` (foods.db), `custom` (custom_foods), `quick` |
| food_id | TEXT NULL | foods.id as text, or custom_foods.id; NULL for quick |
| name | TEXT | snapshot of the name at log time |
| qty | REAL NULL | e.g. 1.5 |
| unit | TEXT NULL | e.g. `katori` |
| grams | REAL NULL | qty × unit grams, computed at log time; NULL for quick |
| oil_level | INTEGER | −1 less, 0 normal, +1 more |
| quick_kcal, quick_protein_g, quick_carb_g, quick_fat_g | REAL NULL | quick add only |
| batch_id | TEXT NULL | shared by entries created in one action (copy/thali) — used by Undo |
| created_at, updated_at, deleted_at | INTEGER | |

Indexes: (`day`, `deleted_at`), (`food_source`, `food_id`), (`slot_id`, `logged_at`).
**No nutrient totals are stored.** Totals are computed from `grams` × the food's per-100 g
values (§5.3).

**`custom_foods`** — foods the user creates, cached barcode products, and recipes.
| Column | Type |
|---|---|
| id | TEXT PK |
| kind | TEXT (`custom`, `product`, `recipe`) |
| name | TEXT |
| brand | TEXT NULL |
| barcode | TEXT NULL UNIQUE |
| serving_g | REAL NULL |
| density_g_per_ml | REAL (default 1.0) |
| cooked_with_fat | INTEGER |
| yield_g | REAL NULL (recipes: total cooked weight) |
| servings | REAL NULL (recipes) |
| off_status | TEXT NULL (`found`, `user_added`, `contributed`) |
| off_fetched_at | INTEGER NULL |
| shared_food_id | TEXT NULL (Stage 11) |
| NUTRIENTS | REAL NULL, per 100 g (for recipes: recomputed and saved whenever the recipe is saved) |
| created_at, updated_at, deleted_at | INTEGER |

**`custom_food_units`** — `id TEXT PK`, `custom_food_id TEXT`, `unit TEXT`,
`label TEXT`, `grams REAL`, `is_default INTEGER`, timestamps.

**`recipe_items`** — `id TEXT PK`, `recipe_id TEXT` (→ custom_foods), `position INTEGER`,
`food_source TEXT` (`base`/`custom`), `food_id TEXT`, `name TEXT`, `qty REAL`,
`unit TEXT`, `grams REAL`, `is_fat INTEGER`, timestamps.

**`favourites`** — `food_source TEXT`, `food_id TEXT`, `created_at INTEGER`.
PK (`food_source`, `food_id`).

**`my_thalis`** — `id TEXT PK`, `name TEXT`, timestamps.
**`my_thali_items`** — `id TEXT PK`, `thali_id TEXT`, `position INTEGER`,
`food_source TEXT`, `food_id TEXT`, `name TEXT`, `qty REAL`, `unit TEXT`,
`oil_level INTEGER`, timestamps.

**`barcode_queue`** — `barcode TEXT PK`, `scanned_at INTEGER`, `day TEXT`,
`slot_id TEXT`, `status TEXT` (`pending`, `not_found`), `last_try_at INTEGER NULL`.

**`weights`** — `id TEXT PK`, `day TEXT` (unique while not deleted; a new weigh-in the
same day replaces it), `weight_kg REAL`, `logged_at INTEGER`, timestamps.

**`water_logs`** — `id TEXT PK`, `day TEXT`, `logged_at INTEGER`, `ml INTEGER`, timestamps.

**`weekly_checkins`** — `week_start TEXT PK` (Monday), `feeling TEXT NULL`
(`easy`, `okay`, `hard`), `dismissed_at INTEGER NULL`, `created_at INTEGER`.

**`alert_dismissals`** — `day TEXT`, `alert TEXT` (`sodium`, `sugar`, `sat_fat`, `fat`,
`floor`), `created_at INTEGER`. PK (`day`, `alert`).

Recents are not a table: they are the 30 most recent distinct (`food_source`, `food_id`)
in `log_entries` that are not deleted.

### 4.3 Supabase (Stage 11)
`profiles` (user_id, display_name) · `backups` (id, user_id, created_at, app_version,
storage_path — a JSON export of user.db in Supabase Storage) · `groups` (id, name,
invite_code 6 chars, owner_id) · `group_members` (group_id, user_id, joined_at) ·
`shared_foods` (id, group_id, created_by, name, brand, barcode, nutrients JSONB per 100 g,
units JSONB, created_at, updated_at, deleted_at). Row Level Security on all tables: users
see only their own backups, and shared foods only for groups they belong to.

---

## 5. Formulas and rules

All formulas live as **pure functions** in `src/lib/` with unit tests.

### 5.1 Search
1. **Normalise** query and indexed terms: lowercase → trim → remove punctuation →
   `ee`→`i`, `oo`→`u` → collapse repeated letters (`daal`→`dal`, `pappad`→`papad`) →
   `w`→`v`, `ph`→`f` → this is the **phonetic key**.
2. Query `foods_fts` with each token as a prefix, as typed and as its phonetic key
   (`("daal"* OR "dal"*) AND "tadka"*`) against name, synonyms and phonetic keys (up to 500
   candidates, shortest names first). Also look up `search_pins` for the whole query. Queries
   shorter than 2 letters are not searched. *(Stage 3+: also query `custom_foods` by name/brand.)*
3. If fewer than 5 results: typo pass — also accept index words within Levenshtein distance ≤ 1
   (tokens ≤ 5 letters) or ≤ 2 (longer) of each token or its phonetic key (up to 3 per token,
   closest then most common first); tokens under 3 letters are not corrected.
4. **Rank** (lower is better):
   - **match type**, checked against the food's own names — the name, its "a/b" alternatives
     ("Dal parantha/paratha" → *dal parantha*, *dal paratha*), the Roman Hindi name, and for
     IFCT/USDA the part before the first comma or bracket ("Okra, raw" → *okra*). Words match
     as typed, by phonetic key, or as a plural. The last word may be unfinished.
     pinned 0 · exact 1 · name starts with the query 2 · name has all query words 3 ·
     all words found only among synonyms 4 · starts with, last word unfinished 5 · has all
     words, last unfinished 6 · anything else the index found 7 · found only by the typo pass
     +10 (then matched against the corrected words)
   - personal use (logged in last 30 days first, most often first) — *from Stage 3*
   - source (custom/product 0 · INDB 1 · IFCT 2 · USDA 3)
   - fewer extra words in the best-matching name → shorter name.
5. Limit 50 results. Target: results in under 100 ms on a mid-range Android phone.
6. **Pins** (`data/curated/search_pins.csv`): for common words whose everyday meaning the rules
   can't know, a hand-picked food comes first — e.g. INDB/IFCT have no plain curd, so *dahi*,
   *curd*, *yogurt* → "Yogurt, plain, whole milk"; *dal*, *daal*, *dhal* → "Mixed dal". A pin
   applies only when the whole query is that term (compared by phonetic key).
7. The search box waits 150 ms after the last key press before searching (debounce).

### 5.2 Unit → grams
```
grams = qty × gramsPerUnit(food, unit)

gramsPerUnit(food, unit):
  1. food_units / custom_food_units row for (food, unit)  → its grams
  2. unit_defaults.grams                                   → that value (g = 1)
  3. unit_defaults.ml × food.density_g_per_ml              → e.g. katori 150 × 1.0 = 150 g
  4. otherwise the unit is not offered for this food
```
Roti sizes: `roti_s` 25 g · `roti_m` 35 g · `roti_l` 50 g (as `food_units` rows on
roti/chapati/phulka/paratha-type foods; parathas get their own larger weights).
`piece` and `slice` are offered only when a food has them.

### 5.3 Nutrients of an entry and of a day
```
entryNutrient(n) = grams / 100 × food[n]  (+ oil delta, §5.5)
quick entries    : kcal / P / C / F from the quick_* columns, other nutrients = none
dayTotal(n)      = Σ entryNutrient(n) over the day's non-deleted entries
```
Label per serving → per 100 g: `per100 = value × 100 / serving_g`.
Per 100 ml (liquids): `per100g = per100ml / density_g_per_ml`.

### 5.4 Targets (Mifflin-St Jeor)
```
age      = currentYear − birth_year
BMR      = 10·weight_kg + 6.25·height_cm − 5·age + s
           s = +5 (male), −161 (female), −78 (prefer not to say)
TDEE     = BMR × activity factor
           sedentary 1.2 · light 1.375 · moderate 1.55 · active 1.725 · very_active 1.9
delta    = pace_kg_week × 7700 / 7          (0.25 → 275 kcal, 0.5 → 550 kcal)
kcal     = TDEE − delta (lose) · TDEE (maintain) · TDEE + delta (gain) · NULL (track)
kcal     rounded to the nearest 50
floor    = max(sexFloor, BMR)   sexFloor: male 1500, female 1200, not stated 1200
```
- If `kcal < floor` → show the **floor warning**, suggest `floor`, never block.
- `protein_g = max(kcal × 0.15 / 4, 0.83 × weight_kg)`
- `fat_g = kcal × 0.30 / 9`
- `carb_g = (kcal − 4·protein_g − 9·fat_g) / 4` (carbs absorb any protein increase)
- `fibre_g = 20 × kcal / 1000`
- Round grams to whole numbers. The weight used is the latest from `weights`
  (or the onboarding weight).

### 5.5 Oil / ghee adjuster
Levels: Less `L = 0.5` · Normal `L = 1.0` · More `L = 1.5` (stored as −1 / 0 / +1).

**Foods with a recipe** (INDB dishes with `recipe_ingredients`, and user recipes):
```
F      = Σ grams of fat ingredients
N_fat  = Σ nutrients of fat ingredients (grams/100 × per100)
Y      = yield_g (or Σ ingredient grams if unknown)
N_rest = per100(n) × Y / 100 − N_fat      (the dish total minus its fats, so ingredients
                                          without nutrient data don't matter)
adjustedPer100(n) = (N_rest(n) + L × N_fat(n)) / (Y + (L − 1) × F) × 100
                  = (per100 × Y/100 + (L − 1) × N_fat) / (Y + (L − 1) × F) × 100
```
Implemented as `oilAdjustedPer100` in `src/lib/oil.ts` (never below zero). For user recipes,
`per100` is the recipe's own computed value, so both forms agree.
**Foods without a recipe** but `cooked_with_fat = 1`:
```
oilDelta_g = level × 5 × grams / 150          (±5 g oil per katori-sized 150 g)
entry nutrients += oilDelta_g / 100 × OIL[n]  (OIL = generic vegetable-oil row)
clamp: for Less, never remove more fat than the entry contains
```

### 5.6 Adherence colour (calendar)
```
entries = non-deleted entries that day
if entries = 0                               → empty (no dot)
else if entries < 3                          → partial   (light grey)
else if goal = track                         → logged    (soft green)
else if |kcal − target| ≤ 10% of target      → on track  (soft green)
else                                         → off target (soft blue)
```

### 5.7 Streaks and weight trend
Streak (forgiving):
```
A day is "logged" if it has ≥ 1 non-deleted entry (quick add counts).
Walk backwards from yesterday (today counts if already logged; if not, it never breaks the streak).
Week = Monday–Sunday. Each week allows 2 missed days ("free days").
The 3rd missed day in one week ends the streak.
streak = number of logged days in the unbroken run.
freeDaysLeft = 2 − misses so far this week.
```
Weight trend (exponential moving average):
```
trend_1 = w_1
trend_i = trend_(i−1) + 0.1 × (w_i − trend_(i−1))   (one step per weigh-in, in date order)
```

### 5.8 Logical day and auto slot
```
logicalDay(time) = calendar date of (time − 4 hours)
autoSlot(time)   = first visible slot whose window [start_min, end_min) contains the
                   local minute-of-day (windows may wrap past midnight, e.g. 19:00–04:00);
                   if none matches → the last visible slot
```

### 5.9 Time-of-day suggestions
```
For the current slot, over the last 30 days:
  score(food) = Σ over its entries in that slot of 0.9 ^ (days ago)
Show the top 8. If the user has fewer than 3, fill from slot_suggestions.
```

### 5.10 Micronutrient % and "incomplete data"
```
pct(n)       = dayTotal(n) / rda(n, sex) × 100      (fibre: rda = 20 × kcal target / 1000)
coverage(n)  = Σ grams of entries whose food has n ≠ NULL / Σ grams of all gram entries
incomplete   = coverage(n) < 0.8   → show "≈" and "some foods missing data"
               any quick-add entry that day → also note "quick adds have no vitamin data"
aboveTUL     = tul(n) exists AND dayTotal(n) > tul(n)
Week view    = average over logged days only.
```

### 5.11 Undo, copy and soft delete
- Every user action that creates or deletes rows records an **undo action** in a Zustand
  store: `{ kind, ids, batch_id, expiresAt: now + 5 s }`. Undo reverses it (delete the
  created rows, or clear `deleted_at` on the deleted ones).
- Copy meal/day: new rows with new IDs, same qty/unit/grams/oil_level, the target
  day/slot, `logged_at` = target day at the slot's start time, one shared `batch_id`.
- Deleted entries stay restorable from *Recently deleted* for 30 days.

### 5.12 Reminders
Offered once, as a card on Today, on the 3rd day with entries. If accepted: ask for
notification permission, then schedule local notifications for the next 7 days at each
chosen slot time (defaults Breakfast 09:00, Lunch 13:30, Dinner 20:30). When a slot gets
its first entry of the day, cancel that day's reminder for it. Reschedule on every app open.
Text: "Had lunch? Tap to add it — takes 10 seconds." Never more than 3 a day.

### 5.13 Barcode (Open Food Facts)
`GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=code,product_name,brands,nutriments,serving_size`
with header `User-Agent: Kalorie/<version> (<contact email from app config>)`.
Map `nutriments.<name>_100g` to §3 columns (energy-kcal, proteins, carbohydrates,
sugars, fat, saturated-fat, trans-fat, fiber, sodium (g → mg), cholesterol, and any
vitamins/minerals present). Cache as `custom_foods` kind `product`. Queue retries run on
app open and when connectivity returns. Show the OFF attribution (ODbL) in About.

### 5.14 CSV export
Four files, shared through the phone's share sheet (expo-sharing):
`kalorie_entries.csv` (day, time, slot, name, qty, unit, grams, kcal, protein, carbs,
fat), `kalorie_daily.csv` (day, kcal, protein, carbs, fat, fibre, sugar, sat_fat,
sodium, water_ml, weight_kg, target_kcal), `kalorie_weight.csv`, `kalorie_water.csv`.

---

## 6. Alert rules

Limits (defaults, all editable in Goals):
| Alert | Default limit | Basis |
|---|---|---|
| Sodium | 2000 mg / day (≈ 5 g salt) | WHO / ICMR-NIN |
| Sugar (total sugars) | 10% of kcal target ÷ 4 (50 g at 2000 kcal) | WHO upper limit; our data has total, not added sugar |
| Saturated fat | 10% of kcal target ÷ 9 (22 g at 2000 kcal) | WHO / ICMR-NIN |
| Total fat | 30% of kcal target ÷ 9 (67 g at 2000 kcal) | ICMR-NIN |

In Just-track mode, percentage limits use 2000 kcal as the base.

Rules:
1. An alert shows when `dayTotal ≥ 100%` of its limit, for **today only**, **on the Today
   screen only**. No push notifications, no pop-ups, no sounds.
2. All alerts that fire are combined into **one card**, soft amber accent, with a ✕ to
   dismiss for the day (`alert_dismissals`).
3. Each alert can be switched off in Goals → Limits.
4. Wording names a gentle next step, never blame: *"Salt is past today's guide — a
   lighter, less salty dinner balances it out."*
5. Micronutrient **TUL**: a neutral note on the Micronutrients screen only:
   *"Above the safe upper level. This usually comes from supplements or fortified
   foods — worth a look at the label."*
6. **Floor warning** (target below safe floor): shown on onboarding step 5 and Goals:
   *"This is lower than we'd suggest ({floor} kcal). Eating this little for long can be
   hard on your body — please check with a doctor. You can still keep it."*
7. Under 18: *"Kalorie's targets are made for adults, so we'll skip them. You can still
   log what you eat."*

---

## 7. Wording rules

1. **No guilt, no judgement.** Never use: *bad, cheat, junk, guilty, failed, over budget,
   exceeded, warning, blew it, sin, naughty, damage*.
2. Say **"more than planned"** / **"above your target"** instead of "over".
3. Partial days are fine: *"Partly logged — that still counts."* Missed days get **no
   message at all**.
4. Streak breaks are soft: *"Fresh start today."* — never "You lost your streak".
5. Talk about **patterns over the week**, not single meals.
6. Short sentences, everyday words, second person ("you"). No exclamation marks in
   anything about body weight or limits.
7. Numbers: kcal as whole numbers with thousands separators (1,840); grams whole
   (under 10 g: one decimal); weight one decimal.
8. Food names are never labelled good or bad. No food gets a colour grade.
9. Every string lives in `src/i18n/en.json` — none written directly in components.

## 8. Visual rules

### 8.1 Colour
- **Base is monochrome**: near-white / near-black backgrounds, neutral greys for
  surfaces, borders and secondary text. Most of the screen is black, white and grey.
- **Accent colours only where they carry meaning**, muted, each with light and dark variants:
  protein = indigo · carbs = wheat/ochre · fat = teal · fibre = olive ·
  water = sky blue · weight = violet · on track = soft green · off target = soft blue ·
  notice = soft amber · partial = light grey.
- **No red anywhere** for being above a target or limit. Delete confirmations use neutral
  text, not red.
- All colours come from theme tokens in `src/theme/`; both themes pass WCAG AA contrast
  for text.

### 8.2 Layout
Minimum tap target 48 dp. Logging a known food takes ≤ 3 taps from Today
(+ Add → tap food → Log). Everything should be reachable with one thumb.

### 8.3 Hide-numbers mode
Hides kcal, grams, percentages and weight values everywhere (Today, Log, Trends,
Micros, portion sheet). Keeps ring/pie shapes, bars and the calendar colours.
The ring shows words instead:
| Share of target | Words |
|---|---|
| < 25% | Just getting started |
| 25–60% | About halfway |
| 60–90% | Nearly there |
| 90–110% | Around your target |
| > 110% | A bit more than planned |
Portions still show units ("1 katori"). Weight shows direction only ("trending down").

### 8.4 Weekly check-in card
Shown on Today from Monday 4 am until dismissed. Contents: days logged last week
("5 of 7 days"), average kcal vs target (hidden in hide-numbers mode), weight trend
direction, one encouraging line, optional *"How did last week feel?"* → Easy · Okay · Hard
(saved to `weekly_checkins`). If "Hard": *"Want gentler targets? You can change them in
Goals."*

---

## 9. Data sources and licences
- **INDB** (Indian Nutrient Databank, Anuvaad) — recipes + ingredients → `data/raw/indb/`.
- **IFCT 2017** (NIN, Hyderabad) — via the `@ifct2017/compositions` npm package, pinned to
  2.0.9 (MIT; the `ifct2017` package became AGPL-3.0 in 2.1.0). Details in `data/SOURCES.md`.
- **USDA FoodData Central** — Foundation Foods + SR Legacy CSV → `data/raw/usda/`.
  Public domain.
- **Open Food Facts** — live lookups; ODbL — attribution required.
- Check and record each source's licence terms in `data/SOURCES.md` before public
  Play Store release (Stage 12).
