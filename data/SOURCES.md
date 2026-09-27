# Food data sources

Where every number in `assets/db/foods.db` comes from. Rebuild with `npm run build:foods`
(needs Node 22.13 or newer, for the built-in `node:sqlite`).

**Before a public Play Store release (Stage 12):** re-read each licence below and confirm the
credits on the About screen.

| Source | Version | Where | Licence | Foods used |
|---|---|---|---|---|
| INDB — Indian Nutrient Databank (Anuvaad) | 2024.11 | `data/raw/Anuvaad_INDB_2024.11.xlsx` | Published openly by Anuvaad Solutions; licence terms to be confirmed before release | 1,014 dishes |
| INDB recipes (Anuvaad) | 2024.11 | `data/raw/recipes.xlsx` | as above | 10,271 ingredient rows for all 1,014 dishes |
| IFCT 2017 — Indian Food Composition Tables (ICMR-NIN, Hyderabad) | 2017, via npm `@ifct2017/compositions` **2.0.9** | `node_modules/@ifct2017/compositions/index.csv` | Package: MIT. Data: © ICMR-National Institute of Nutrition — credit NIN | 514 raw foods |
| USDA FoodData Central — Foundation Foods | 2026-04-30 | `data/raw/FoodData_Central_foundation_food_csv_2026-04-30/` | Public domain (CC0) | 312 |
| USDA FoodData Central — SR Legacy | 2018-04 | `data/raw/FoodData_Central_sr_legacy_food_csv_2018-04/` | Public domain (CC0) | 7,067 |
| Open Food Facts (Stage 6, live lookups) | — | API | ODbL — attribution required | — |

`data/raw/` is not committed to git (it's large). To rebuild on another computer, download the
files above into `data/raw/` with the same folder names.

## Notes on each source

**INDB.** One sheet, 82 columns: nutrients per 100 g plus the same nutrients per serving.
INDB has no
serving weight column, so the build works it out as serving kcal ÷ kcal per 100 g × 100.
It has no trans fat, iodine or vitamin B12 (stored as unknown). Its `vita_ug` is retinol only,
so carotenoids ÷ 12 are added to get vitamin A RAE — to be checked against the ICMR-NIN
conversion before Stage 9.

**INDB recipes.** One row per ingredient: dish code, ingredient code and name, amount and a
normalised unit (g, tsp, tbsp, ml, C = cup, sprig…). Amounts become grams with tsp 5 ml,
tbsp 15 ml, cup 240 ml and the ingredient's density. About half the ingredients use IFCT codes;
the rest use Anuvaad's own codes (T508 sunflower oil, G528 salt…, copied from the UK CoFID and
USDA tables), whose nutrients we don't have — `data/curated/indb_ingredients.csv` links them to
foods in foods.db (98% of rows are linked; every fat must be). A check in the build shows INDB's
per-100 g values are recipe totals ÷ **raw** ingredient weight (for 82% of dishes the ingredient
kcal match within ±5%), which also confirms the unit conversions. So `foods.yield_g` is the raw
recipe weight, and INDB values assume no water is lost in cooking — a boiled-down dish may be a
little denser in real life than its per-100 g figure.

**IFCT 2017.** The npm package `ifct2017` changed from MIT to **AGPL-3.0** in version 2.1.0
(September 2026). We use `@ifct2017/compositions@2.0.9` instead: MIT-licensed, and the numbers
are identical (all 542 foods × 20 key nutrients compared, 0 differences). It is pinned to the
exact version in `package.json` so an update can't bring in AGPL code by accident.
Every value in that package is in grams per 100 g (energy in kJ), and a missing value is written
as 0, so a nutrient group that is entirely 0 for a food is stored as unknown. The 14 oils and
fats have no energy value; it is estimated from fat (9 kcal/g). 28 numbered varieties
("Brinjal-1" … "Brinjal-21", "Chillies, green-1" …) are skipped because IFCT also gives an
"all varieties" average. No iodine or vitamin B12.

**USDA.** Only the foods in `foundation_food.csv` / `sr_legacy_food.csv` are used (Foundation's
`food.csv` also holds lab samples and older versions). Left out: Baby Foods, American
Indian/Alaska Native Foods, Quality Control Materials, Branded Food Products and Restaurant
Foods, and 72 Foundation foods that have no energy value and too few macros to estimate one.

## Hand-kept files (`data/curated/`)

| File | What it holds |
|---|---|
| `synonyms.csv` | Search synonyms: Hindi, spelling variants, regional and English names (≈590 terms) |
| `category_units.csv` | Units offered, default unit and density for each food category |
| `unit_weights.csv` | Per-food units: roti S/M/L, piece weights (egg, banana…), default-unit fixes |
| `densities.csv` | Density fixes for foods unlike their category (flour, ghee, honey…) |
| `duplicates.csv` | Duplicate decisions the automatic name matching can't make |
| `indb_ingredients.csv` | Links Anuvaad's own recipe-ingredient codes (oils, salt, sugar…) to foods |
| `category_overrides.csv` | Fixes for foods the category rules get wrong |
| `rda_icmr_nin_2020.csv` | ICMR-NIN 2020 RDA / TUL starting values — check before Stage 9 |
