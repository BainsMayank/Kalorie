# Kalorie — Build Plan

Work through the stages in order. Each stage ends with a **Done when** test you do on
your own phone (Expo Go until Stage 12, then an EAS build). Tick boxes as tasks finish.
At the end of each stage: run `npx tsc --noEmit` and `npm test`, tick the boxes, and add
a one-line note under "Stage log" at the bottom.

See SPEC.md for every screen, table, formula and wording rule referenced here.

---

## Stage 1 — Scaffold
- [x] `git init`, first commit with SPEC.md, PLAN.md, CLAUDE.md
- [x] Create the Expo app (SDK 57 — the one Expo Go supports — TypeScript template) in this folder
- [x] Set `name: "Kalorie"`, `slug: "kalorie"`, `android.package` and `ios.bundleIdentifier` = `com.mynklabs.kalorie` in app config
- [x] Turn on TypeScript `strict`; add a path alias `@/` → `src/`
- [x] ESLint (`eslint-config-expo`) + Prettier (`eslint-config-prettier`)
- [x] Create the folder structure from CLAUDE.md (empty `index.ts` files are fine)
- [x] expo-router with 4 tabs (Today, Log, Trends, Profile), each showing a placeholder with its name and icon
- [x] Theme tokens in `src/theme/` (monochrome base + accent roles, light and dark, SPEC §8.1); follow the system setting, with a System / Light / Dark override in Profile
- [x] i18next + expo-localization set up with `src/i18n/en.json`; tab titles come from it (English only, per SPEC)
- [x] user.db with expo-sqlite + Drizzle: `babel-plugin-inline-import` approved, migrations run on app start, `settings` table *(moved up from Stage 3)*
- [x] Zustand settings store (`src/stores/settings.ts`), saved to user.db
- [x] jest-expo + React Native Testing Library; tests for the settings store, the Today tab and the Profile theme switch
- [x] `.env.example` (empty keys), `.env` and `.env*.local` in `.gitignore`; `data/raw/` ignored too
- [x] npm scripts: `test`, `typecheck` (`tsc --noEmit`), `lint`, `format`, `db:generate`

**Done when:** you open the app in Expo Go, see the 4 tabs with English titles, switch your
phone to dark mode and the app turns dark, pick Dark in Profile and it stays dark after
closing the app, and `npm test` passes.

## Stage 2 — Food database
*Stage 2a (foods.db build) done 2026-09-26; Stage 2b food search done 2026-09-27; thalis + slot suggestions done in the 2026-09-28 audit.*
- [x] Put source files in place: INDB (`data/raw/Anuvaad_INDB_2024.11.xlsx`), USDA Foundation + SR Legacy CSV folders in `data/raw/`; IFCT from `@ifct2017/compositions@2.0.9` (MIT — `ifct2017` ≥ 2.1 is AGPL)
- [x] Record each source's version and licence in `data/SOURCES.md`
- [x] Add dev tools: xlsx (0.20.3, SheetJS CDN), csv-parse, tsx — Node's built-in `node:sqlite` replaces better-sqlite3
- [x] `scripts/build-foods-db/`: read each source → map to the 35 nutrient columns (SPEC §3) → convert units (kJ → kcal, vitamin A RAE, available carbs)
- [x] Merge duplicates (priority INDB → IFCT → USDA), keep `source` tag — exact-name matching of same-kind foods + `data/curated/duplicates.csv`
- [x] Load INDB recipe ingredients into `recipe_ingredients`, flag oil/ghee/butter as `is_fat` — from `data/raw/recipes.xlsx`; Anuvaad's own ingredient codes linked via `data/curated/indb_ingredients.csv` (98% of rows)
- [x] Create `data/curated/synonyms.csv` (591 terms in 157 groups: dal/daal/dhal, bhindi/okra/lady finger, dahi/curd/yogurt, …) — plus IFCT Hindi/regional names and INDB Hindi names automatically
- [x] Create `data/curated/unit_weights.csv` (roti S/M/L, piece weights for egg, banana, …), `category_units.csv` (units + density per category), `densities.csv`, and `unit_defaults`
- [x] Create `data/curated/rda_icmr_nin_2020.csv` (starting values from SPEC §3.1) — *removed in Stage 5: replaced by `src/lib/targets/icmr.ts`, checked against the ICMR-NIN PDF*
- [x] Fix INDB outliers (2026-09-27): frying oil cut to the 15% the food soaks up (126 dishes — dahi vada 1,150 → 176 kcal per vada), egg-boiling/steaming water taken out (boiled egg 45 → 132 kcal/100 g), servings shrink with their recipe, piece counts for gulab jamun + chhena sweets in `data/curated/indb_servings.csv`, unbelievable servings dropped (105, listed in the build report)
- [x] Create `data/curated/thalis.csv` (6 starters) and `slot_suggestions.csv` — *audit 2026-09-28: 27 thali items, 8 starter foods per slot, checked by the build (ref, name, unit); db_version 4*
- [x] Build `foods_fts` with phonetic keys (SPEC §5.1) and the `meta` table
- [x] `npm run build:foods` writes `assets/db/foods.db`; print a summary (counts per source, foods with no energy, missing macros, 10 spot checks)
- [x] Bundle the file with expo-asset / expo-file-system and open it read-only with expo-sqlite (check FTS5 at startup) — copied on first launch, replaced when the bundled file's hash changes; `PRAGMA query_only`; `finalizeUnusedStatementsBeforeClosing: false` avoids an expo-sqlite crash on reload
- [x] `src/lib/search.ts` (normalise, phonetic key, rank, typo pass) + `src/db/foods/search.ts`, with tests on the real foods.db: `daal`/`dhal`→dal, `bhindi`→okra, `dahi`/`curd`→plain yogurt, `chapati`→roti, `panner`→paneer, typos `biryni`, `samoza`, `gulab jamon` — plain curd exists only in USDA, so `data/curated/search_pins.csv` (new `search_pins` table, db_version 2) puts it first
- [x] A temporary search screen to try it out (FlashList) — in the **Log** tab, as asked; debounced 150 ms; name, source tag, usual portion + kcal
- [x] Food detail screen (`app/food/[id].tsx`): nutrients per 100 g and for the chosen portion, unit chips + quantity stepper (1 katori, 2 roti, 150 g…); no logging yet

**Done when:** on your phone you type `daal`, `bhindi`, `dahi` and `panner`, and each shows
the right Indian food first with an INDB or IFCT tag, results appear as you type with no
visible lag, and the tests pass.

## Stage 3 — Logging
*Stage 3a (core logging) done 2026-09-27: add from the food screen, Log tab timeline with edit and swipe-to-delete, date switcher.*
*Stage 3b (fast logging) done 2026-09-27: suggestions, recents, favourites, one-tap add, quick add, copy meal/day, Undo bar.*
- [x] ~~Approve `babel-plugin-inline-import`~~ — done in Stage 1
- [x] Rest of the Drizzle schema for user.db (SPEC §4.2) + a new migration (`npm run db:generate`); the migration runner and `settings` table already exist from Stage 1 — *`meal_slots` + `log_entries` done in Stage 3a (migration `0001_log_entries`); `profile`, `targets`, `weights`, `limit_alerts` in Stage 5; `custom_foods`, `custom_food_units`, `barcode_queue` in Stage 6 (`0004_barcode`); `recipe_items`, `my_thalis`, `my_thali_items` in Stage 7. `water_logs` and `weekly_checkins` move to Stages 8 and 10, with their features*
- [x] Seed the 4 default meal slots (at every app start, keeping user changes) — default settings already come from the settings store
- [x] `src/lib/day.ts`: `logicalDay` (4 am cutoff) and `autoSlot` + tests (midnight wrap, 3:59 am → previous day), plus `timeOnDay`, `defaultEntryMinute`
- [x] `src/lib/units.ts`: `gramsPerUnit`, `entryGrams`, `stepQuantity` + tests for every unit type (katori, glass, cup, tsp, tbsp, ml, g, roti S/M/L, piece, slice, bowl) — units per food are read by `getFoodDetail`
- [x] `src/lib/nutrition.ts`: `entryNutrients` (food and quick add) and `sumNutrients` for meal/day totals (SPEC §5.3) + tests
- [x] Add food: slot chips, search, *Often at {slot}* suggestions + Recent / Favourites tabs with one-tap ⊕ (SPEC §2.3, §5.9) — `src/lib/suggestions.ts` + tests; still a pushed screen (modal later); My foods / Thalis tabs come with Stage 7
- [x] Portion sheet: qty stepper, unit chips, grams preview, live kcal/macros, Log button, haptic tick — *done as the "Add to log" sheet on the food screen (Stage 3a) with the haptic tick (Stage 3b, expo-haptics); opened straight from Add food since the 2026-09-28 audit (`log=1`)*
- [x] Quick add (kcal + optional protein/carbs/fat + label, meal, time); edit it from the Log tab
- [x] Edit entry sheet (qty, unit, slot, time, delete) — tap an entry in the Log tab
- [x] Favourites toggle (☆ on search results, suggestion/recent rows and the food screen; `favourites` table, migration 0002)
- [x] Undo store (Zustand) + 5-second Undo bar for log, delete, copy (SPEC §5.11)
- [x] Soft delete + *Recently deleted* list + 30-day purge at app start — *soft delete in Stage 3a; Recently deleted (Log tab, Bring back with Undo) and the purge (`src/db/user/purge.ts`, keeps recipes/products still in use) in the 2026-09-28 audit*
- [x] Copy a meal to another day/slot; copy a whole day (from yesterday it goes to today by default) — `src/lib/copy.ts` + tests
- [x] A simple list of today's entries on the Today tab (grouped by slot) — *done as the Stage 4 timeline*

**Done when:** you log "1 katori dal" and "2 medium roti" to Lunch in under 10 seconds each,
then delete one and tap Undo and it comes back, copy Lunch to tomorrow and see it there,
quick-add 300 kcal, close and reopen the app and everything is still there.

## Stage 4 — Today screen
*Done 2026-09-27: ring, macro pie + bars, top contributors, meal timeline, day header, pull to refresh, empty state.*
- [x] Calorie ring (gifted-charts donut): eaten / target / left, soft-blue outer arc above 100%
- [x] Macro pie with legend (grams vs target) — pie by share of calories, one bar per macro
- [x] Top 3 contributing foods per macro (+ test for the ranking) — shown as a *Top contributors* card on Today instead of a sheet; the same food logged twice counts once; tap → its entry
- [x] Timeline: one card per visible slot with entries, time, slot kcal, + Add, copy — *the ⋯ menu waits for Save as thali (Stage 7) and Clear meal*
- [x] Date header with ‹ › and date picker; view and edit past days (› stops at today)
- [x] Empty states with friendly words (SPEC §7)
- [x] Before goals exist, use placeholder targets (2000 kcal, 60 g protein, 250 g carbs, 65 g fat in `src/lib/placeholderTargets.ts`), clearly marked as sample targets
- [x] Pull to refresh; tapping any food (timeline or top contributors) opens its entry
- [x] `src/lib/nutrition.ts`: `progress`, `macroKcalShares`, `topContributors`, `daySummary` + tests (totals, percentages, top contributors, empty day)

**Done when:** after logging a normal day, the ring and pie match what you ate, tapping
Protein shows your top 3 protein foods, and moving to yesterday shows yesterday's meals.

## Stage 5 — Onboarding and goals
*Done 2026-09-27: ICMR-NIN tables in `icmr.ts`, 4-screen onboarding, targets, Goals screen, limit alerts.*
- [x] `src/lib/targets/icmr.ts`: the ICMR-NIN 2020 short report's EAR / RDA / AI / TUL tables (16–18 y, adults, ≥ 60 y; by sex and category of work), printed page beside every value; 10 values checked against the PDF, then every adult value cross-checked with the PDF's text layer
- [x] `src/lib/targets/formulas.ts`: BMR, TDEE, pace, rounding, floor, macros, fibre (ICMR), limits (SPEC §5.4, §6) + tests with 4 worked examples (man maintain, woman just under BMR, prefer-not-to-say gain, woman 65 far under the floor) and the no-target cases
- [x] Onboarding flow, **4 screens** (goal + welcome · about you · activity · targets), every question skippable, ft/in ↔ cm, under-18 path, *Skip — just let me log* → Just track; the app shows only onboarding until it is done (`Stack.Protected`)
- [x] Save `profile` and first `targets` row; save onboarding weight to `weights` (migration `0003_goals`)
- [x] Goals screen (Profile → Goals): answers, targets, limits with on/off switches, *Save* (new row from today) and *Reset to suggested*, ICMR vitamins and minerals (read-only)
- [x] Floor note (onboarding step 4 + Goals) with *Use {floor} kcal*, never blocking
- [x] `src/lib/alerts.ts`: fat, saturated fat, sugar, sodium at 100%, fires once per nutrient per day (+ tests: fires once, not twice)
- [x] One combined soft-amber card on Today ("Fat is 12 g above today's limit."), ✕ closes it for the day, per-alert switches; optional phone notification (expo-notifications, off by default)
- [x] Just-track mode: Today shows eaten only, no targets; Stage 4's placeholder targets removed everywhere

**Done when:** a friend installs the app and finishes onboarding in under 60 seconds with a
timer, their calorie target matches a hand calculation, setting 1000 kcal shows the gentle
floor warning, and logging 3 packets of namkeen shows the calm sodium card (no red).

## Stage 6 — Barcode
*Done 2026-09-28: scanner, type the number, gallery (Android), Open Food Facts lookup + cache, label form, offline queue, About screen.*
- [x] Barcode screen with expo-camera, torch, frame; permission prompt with a friendly reason — *Scan barcode* on the Log tab and in Add food; EAN-13 / EAN-8 / UPC-A / UPC-E
- [x] Manual code entry — *Type the number*, with check-digit validation (`src/lib/barcode.ts` + tests)
- [x] Gallery scan with expo-image-picker + `scanFromURLAsync` — **Android only**: expo-camera 57 on iOS uses Apple's QR-only detector for images
- [x] `src/lib/off.ts`: map OFF nutriments to SPEC §3 columns (+ tests with saved Maggi / Parle-G answers); the request (User-Agent, 10 s timeout) is in `src/features/barcode/lookup.ts`
- [x] Cache found products in `custom_foods` (kind `product`) + `custom_food_units` (serving / pack / ml); local cache checked first (migration `0004_barcode`)
- [x] Add-from-label form (per 100 g / 100 ml / per serving → stored per 100 g) + test for the conversion; optional photo of the label
- [x] Offline queue (`barcode_queue`), "Pending lookups" card, retry on app open, return to the app, pull to refresh and *Try again now* — *no network-state library in the stack, so no instant retry the moment Wi-Fi returns*
- [x] OFF attribution in About (Profile → About & data sources)
- [x] "Incomplete data" tag + note on the food screen when a food's vitamins or minerals are < 80% known
- [ ] Put a contact email in app.json `extra.contactEmail` (sent in the Open Food Facts User-Agent; the app ID is sent until then)

**Done when:** you scan a Parle-G or Maggi packet and it's found and logged, scan the same
packet in airplane mode and it still works (cached), scan an unknown code offline and it
waits in the Pending card and is looked up when you're back online, and typing a code by
hand works.

## Stage 7 — Recipes, oil adjuster, thalis
*Stage 7a done 2026-09-28: oil control, recipe builder (edit, duplicate), recipes in search, My thalis; built-in thalis in the audit. Still open: INDB cooked weights, custom foods by hand, product edit/delete.*
- [x] `src/lib/oil.ts`: recipe-based and no-recipe adjuster (SPEC §5.5) + tests (dal less/normal/more; fat can't go below zero; **only energy and fats change**) — a per-portion step (`recipeOilStep`, `genericOilStep`, `withOilLevel`), applied in `entryNutrients`
- [x] Oil/ghee Less · Normal · More on the portion sheet for eligible foods; stored as `oil_level` — on the Add / Edit entry sheet; INDB dishes use their own `recipe_ingredients` oil and ghee (foods.db unchanged)
- [x] Recipe builder (ingredients, qty/unit, fat flag, cooked weight, servings) → saved as a food with per-100 g values — `src/lib/recipe.ts` (+ tests), `app/recipe.tsx`, `app/recipe-ingredient.tsx`, Profile → Recipes (`app/recipes.tsx`); serving + katori (with cooked weight) units; edit, duplicate, swipe to delete; `recipe_items` (migration `0005_recipes_thalis`)
- [ ] Cooked weights for INDB dishes that lose water while cooking (INDB's per-100 g is per raw weight): dry fried snacks (sev, banana chips, murukku), chhena sweets (the milk's whey), dals; also mark the unlabelled frying oil in Fish orly and Mango malpua
- [ ] Custom food create/edit with custom units
- [ ] Search custom foods and cached barcode products by name/brand (SPEC §5.1 step 2); edit or delete a product in My foods — *search done (recipes and products, "My recipe" / "Product" tags) and a My foods tab in Add food; product edit/delete still to do*
- [x] Built-in thalis + *My thalis*; log selected items to a slot in one tap (one `batch_id`, one Undo) — *My thalis in Stage 7a (Add food → Thalis: checklist with − / + per item, one batch, one Undo; `my_thalis` + `my_thali_items`); the 6 starters (`data/curated/thalis.csv`) below them since the audit, not deletable*
- [x] *Save as thali* from a meal card — an icon next to Copy on each meal (Today and Log); quick adds are left out

**Done when:** you make "Mom's rajma" from ingredients and log 1 katori of it, switching Oil
to "More" raises the calories by a believable amount, and logging the North Indian thali
fills Lunch in one tap and Undo removes all of it.

## Stage 8 — Log calendar, weight, water
*Stage 8 done 2026-09-28. The calendar went to the Trends tab (Calendar · Week · Month) with a read-only day view and Edit → Log tab; see SPEC §1 "History, weight, water".*
- [x] `src/lib/adherence.ts` (SPEC §5.6) + tests — *five colours: on target / a bit under or over / further from target / partly logged / not logged; today judged only once it looks finished; a month with gaps*
- [x] ~~Log tab~~ Trends tab: calendar with coloured days + legend + month line; tap a day → that day read-only in the Today layout, *Edit* → Log tab on that day — *the Log tab keeps its plain Pick a date*
- [x] Trends tab: Week/Month calories bars with dashed target line, macro averages vs target + a line per macro — *charts drawn with react-native-svg (`src/components/charts/`), see SPEC §1*
- [x] Weight: add (today / yesterday), edit, delete, `src/lib/trend.ts` EMA (SPEC §5.7) + tests, line chart with dots + trend line, weekly change as a calm number
- [x] Water: − / + on Today (long-press + for custom ml), glass/goal settings in Goals, bar chart in Trends — *`water_logs` (migration 0006)*
- [x] Targets use the row in effect on each past day — *already done in Stage 5 (`rowForDay`, `useDayTargets`); Trends uses it too (`useTargetsFor`)*
- [x] Fast date queries — *`log_entries (day, deleted_at)` index already existed; the new `water_logs` gets the same; a query-plan test checks that a month is an index search*

**Done when:** after a week of use the calendar shows green/blue/grey days (never red), you
enter 5 weights that bounce up and down and the trend line stays smooth, and tapping
+1 glass 8 times fills today's water goal.

## Stage 9 — Micronutrients
*Done 2026-09-28: Vitamins & minerals screen (Day · 7-day · 30-day), ≈ for foods without data, top foods + good sources, "I eat" in Profile, vitamin A and IFCT fixes in foods.db (db_version 5).*
- [x] ~~Check every RDA/TUL in `rda_icmr_nin_2020.csv`~~ — *done in Stage 5 (`src/lib/targets/icmr.ts`)*; vitamin A in foods.db now uses ICMR-NIN's 6:1 for β-carotene and 12:1 for α-carotene / β-cryptoxanthin (p. 10, checked in the PDF) for INDB, IFCT and USDA; foods.db rebuilt
- [x] Data check while building the screen: IFCT fish vitamin B6 and biotin were 1000× too big (÷ 1000 now); IFCT's vitamin D in plant foods (curry leaves 117 µg/100 g, pomegranate 109 µg) and INDB's vitamin D built from it are unknown now (`data/SOURCES.md`)
- [x] `src/lib/micros.ts`: % of need, coverage + "based on X of Y foods", incomplete (also with any quick add), above TUL (not magnesium: supplements only), average over logged days, good-sources ranking (SPEC §5.10) + tests
- [x] Micronutrients screen (`app/nutrients.tsx`): vitamins / minerals / fibre, fats and sugar, bars towards the ICMR need or the Goals limit, ≈ + lighter bar + "At least this", "No data for the foods eaten" instead of 0%, TUL note, never red
- [x] Tap a nutrient → sheet: which foods had no data, top 3 foods it came from, 5 good sources from `data/curated/common_foods.csv` (~80 everyday foods with portions → foods.db `common_foods`), vegetarian first with Profile → Food → *I eat*
- [x] Links: a card on Today and on a past day (Day), and in Trends Week / Month (7- or 30-day average)
- [ ] INDB rows with odd vitamins, left as they are (kept out of good sources): Black forest gateau 219 mg vitamin C / 100 g, Fried fish (Indian style) 85 mg vitamin E / 100 g; IFCT liver biotin looks high — worth a look with the Stage 7 INDB cooked-weights task

**Done when:** after logging a normal day, the screen lists all vitamins and minerals, iron
shows a sensible % for your sex, a USDA-only or quick-add-heavy day shows the "some foods
missing data" marker, and nothing is coloured red.

## Stage 10 — Low-burden features
*Stage 10a (habits) done 2026-09-28: forgiving streak, weekly check-in with one suggestion, reminders. Stage 10b (comfort) done 2026-09-28: hide numbers, CSV export, Hindi, accessibility, wording. Still open: streak summary, suggestion polish, meal slot editor.*
- [x] `src/lib/streak.ts`: forgiving streak with 2 free days per Mon–Sun week (SPEC §5.7) + tests (3rd miss ends it, today not yet logged doesn't break it, week boundaries, a fresh start keeps this week's free days)
- [x] Streak line on Today (small, under the date, today only; nothing at 0; tap → how free days work) — *streak summary in Log moves to 10b*
- [ ] Streak summary in Log ("Longest: 34 days · This week: 5 of 7 logged") *(10b)*
- [x] Hide-numbers mode everywhere (SPEC §8.3), including word bands on the ring — *the check-in's average line hides too; Profile → Numbers; words on macro, Trends and vitamin bars as well*
- [x] Weekly check-in card (SPEC §8.4): days logged, average vs target, best day, weight trend, one encouraging line, ONE suggestion with 2 food ideas (`src/lib/checkin.ts` + tests), Easy · Okay · Hard, ✕; `weekly_checkins` (migration 0007)
- [ ] Time-of-day suggestions scoring polished (SPEC §5.9) *(10b)*
- [x] Reminders (SPEC §5.12): meal-time nudges skipped when that meal is logged + evening pending-scans nudge, planned 7 days ahead and re-planned on every change (`src/lib/reminders.ts` + tests, `src/features/reminders/`); off by default, switched on at onboarding's last step or Profile → Reminders — *the day-3 offer card is dropped (user's call); the "pending photos" nudge became pending scans (photo-now-log-later was dropped)*
- [x] CSV export: 4 files via expo-sharing (SPEC §5.14) — *Profile → Export CSV, a date range, one Share per file (the share sheet takes one file); expo-sharing added with your OK*
- [ ] Meal slot editor: rename, reorder, hide, add custom, time windows *(10b — reminders already follow hidden/custom slots)*
- [x] Wording pass over `en.json` against SPEC §7 (banned-word test that scans en.json) — *`src/i18n/translations.test.ts` scans en.json and hi.json; fixed "A bit under or over", "averaged over", a stale "tracking comes later" hint*
- [x] Hindi translation of every screen (`src/i18n/hi.json`, Profile → Language, Hindi calendars); a test keeps its keys and placeholders in step with en.json *(added in 10b)*
- [x] Accessibility first pass: large system text, tap targets ≥ 44 pt, screen-reader labels on charts and buttons *(pulled forward from Stage 12)*

**Done when:** turning on hide-numbers leaves no calorie or gram number anywhere, skipping
2 days in a week keeps your streak, a reminder arrives at lunch only if you haven't logged
lunch, and the CSV files open correctly in Google Sheets.

## Stage 11 — Accounts and sync
*Split on 2026-09-28: 11a accounts (done), 11b sync, 11c groups. Backup changed from a JSON file in Storage to Postgres tables that mirror user.db (the user's call).*

### Stage 11a — Accounts
*Done 2026-09-28.*
- [x] Approve `@supabase/supabase-js` — *approved with the Stage 11a request; the session is kept with expo-secure-store (already approved), so no AsyncStorage or other helper*
- [x] Create the Supabase project (region Mumbai); put URL and publishable/anon key in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), never in code — *walkthrough in the Stage 11a notes; `.env` confirmed git-ignored; the app refuses a secret/service_role key*
- [x] Postgres tables mirroring user.db + Row Level Security on every table (`supabase/migrations/`, SPEC §4.3); `src/db/cloud/migrations.test.ts` keeps them in step with user.db
- [x] RLS test: `supabase/tests/rls.test.sql` — A can't read, change, delete or write B's rows, signed-out requests are refused, deleting A removes only A's rows (checked on Postgres with a stand-in `auth` schema, and that it fails when a policy is loosened)
- [x] Email one-time-code sign in / sign out (optional; the app works fully without an account) — Profile → Account
- [x] *Delete my account and data* (both app stores require it): `delete_my_account()`, confirmation sheet, phone data stays
- [x] Privacy note, one screen (Profile → Privacy): what is stored, where, never sold or used for ads
- [ ] **You:** run both migrations and the RLS test in the SQL Editor; put `{{ .Token }}` in the *Magic Link* and *Confirm signup* email templates
- [ ] **You, before family use:** custom SMTP (Supabase's own mailer sends only to your project team's addresses, a few an hour)

**Done when:** you sign in on your phone with the code from the email, see "Signed in as …" in
Profile, sign out and everything you logged is still there, sign in again and *Delete my account
and data* removes you from Authentication → Users, and the RLS test shows PASS.

### Stage 11b — Sync
- [ ] Upload changed rows (by `updated_at`) and download on a new phone; soft deletes travel as rows
- [ ] Sync status + *Back up now* on the Account screen; restore on a new phone
- [ ] Update the Privacy screen first: a copy of the log is kept with the account

### Stage 11c — Groups
*Done 2026-09-28, before 11b (the user's call): sharing sends its own foods, it doesn't wait for sync.*
- [x] Groups: create group, 6-character invite code, join, leave — Profile → My group; one group per person, no owner, *Make a new code*, 10 wrong codes an hour at most
- [x] Shared foods: *Share with my group* on the food screen of your own recipes and products; group foods appear in search with a "Group" tag and "Shared by …"; changes made offline go next time
- [x] Only the sharer can change or remove a shared food; anyone else in the group can flag it as wrong (reason + note), the sharer sees why and has *Mark as fixed*
- [x] RLS for groups: groups, people, shared foods and flags only for members (`rls.test.sql` step 4, four people; checked on Postgres with a stand-in `auth` schema, and that it fails for each of 17 loosened rules)
- [ ] **You:** run `20260928110000_groups.sql` in the SQL Editor (after the two 11a files), then the RLS test again — it should show the new PASS line

**Done when:** you back up on your phone, sign in on a second phone and restore, and see
the same history; a family member joins with your invite code and finds the custom food
you shared.

## Stage 12 — Polish and release
- [ ] Add expo-secure-store; Open Food Facts account in Settings; *Also share with Open Food Facts* toggle on the label form
- [ ] App icon, splash screen, monochrome design pass in light and dark — *icon done 2026-10-05: katori in the calorie ring, drawn by `scripts/app-icon/make_icons.py` (replaces Expo's placeholder logo); Android 12+ shows it as the launch screen. A custom splash needs `expo-splash-screen` (not in the stack yet — ask)*
- [ ] Accessibility: screen-reader labels, font scaling, 48 dp targets, contrast check — *first pass in 10b; still to do: contrast check, a TalkBack/VoiceOver walk-through on a phone*
- [ ] Performance: search < 100 ms, Today opens < 1 s on a mid-range Android phone — *on a Mac (Node) searches take 1–25 ms; the first typo search reads the word list once*
- [ ] Error handling: no crashes offline, friendly messages
- [ ] Confirm data licences in `data/SOURCES.md` (*Open licence questions*); About screen credits — *three answers needed: INDB has no stated licence (ask Anuvaad); IFCT 2017 values and the ICMR-NIN 2020 tables are © ICMR-NIN with a "no reproduction for creating a product without written permission" line (one letter to nin@nic.in). Code libraries checked: all permissive; their notices are on About → Open-source licences (2026-10-05). Emails drafted in `data/permission-requests.md`*
- [ ] Privacy policy page (data stays on the phone unless you sign in) — *the in-app Privacy screen came with 11a; web pages written 2026-10-05 in `docs/` (privacy, delete-account — Play asks for a deletion link too); still to do: fill in the contact email (`CONTACT_EMAIL`), turn on GitHub Pages (main → /docs)*
- [ ] EAS Build set up; internal testing track on Play Console; TestFlight if doing iOS
- [ ] Final wording and hide-numbers review

**Done when:** family members install Kalorie from the Play Store internal testing link, use
it for a full week without a crash, and at least one says logging feels quick.

---

## Stage log
<!-- One line per finished stage: date — stage — note -->
2026-09-26 — Stage 1 Scaffold — Expo SDK 57; tabs changed to Today · Log · Trends · Profile (SPEC updated); user.db + Drizzle migrations and the settings store moved up from Stage 3; English only; 11 tests pass.
2026-09-26 — Stage 2a foods.db — 8,907 foods (INDB 1,014 · IFCT 514 · USDA 7,379), FTS5 search index, 591 synonym terms, units per food, recipe ingredients for all 1,014 INDB dishes (oil control on 712); built with node:sqlite; IFCT via MIT @ifct2017/compositions; 130 tests pass.
2026-09-27 — Stage 2b food search — foods.db copied on first launch and opened read-only; search by name, Hindi name, synonyms, sound and typos with match-tier ranking + 11 hand-picked pins (db_version 2); Log tab = search screen, food detail with unit picker; fixed an expo-sqlite crash on reload (FTS5 + finalize); yogurt now defaults to katori; 198 tests pass. Thalis still open.
2026-09-27 — Stage 3a Core logging — `meal_slots` + `log_entries` in user.db (migration 0001, soft delete, UUIDs); "Add to log" sheet on the food screen (qty with 0.5 steps, unit, meal by time window, time as an hour grid); Log tab = the day's entries by meal slot with kcal per entry, slot and day, tap to edit, swipe left to delete; Yesterday · Today · Pick a date; search moved to Add food; react-native-calendars added; no new libraries for swipe or time; 285 tests pass.
2026-09-27 — Stage 3b Fast logging — Add food shows *Often at {slot}* (0.9^days score, usual amount) + Recent / Favourites with ☆ and one-tap ⊕; quick add; copy a meal or a whole day (same time of day, or the new slot's start); 5-second Undo for log, delete and copy; `favourites` table (migration 0002); expo-haptics; search no longer autofocuses; Undo bar drawn per screen (iOS native screens swallow taps on a root overlay); 342 tests pass.
2026-09-27 — Stage 4 Today screen — calorie ring (outer soft-blue arc above target), macro pie + grams-vs-target bars, top 3 foods per macro, meal timeline with time (shared with the Log tab as `DayTimeline`), ‹ › + calendar, pull to refresh, empty state; placeholder targets in one file until Stage 5; react-native-gifted-charts + react-native-svg added (PieChart imported from its own file, so no gradient library); 371 tests pass.
2026-09-27 — Stage 5 Onboarding and goals — ICMR-NIN 2020 short report typed into `src/lib/targets/icmr.ts` with page numbers (B12 2.2 µg, copper 1.7 mg corrected; `rda_reference` removed, foods.db db_version 3); 4-screen skippable onboarding; Mifflin-St Jeor targets with ICMR fibre and a kind floor note; `profile`, `targets`, `weights`, `limit_alerts` (migration 0003); Goals screen with Save / Reset to suggested; calm limit card on Today, once per nutrient per day, optional phone notification (expo-notifications, off by default); Just-track Today; 439 tests pass.
2026-09-28 — Stage 6 Barcode — *Scan barcode* on the Log tab and in Add food: expo-camera (EAN-13/8, UPC-A/E, light, frame), *Type the number* with check-digit validation, gallery scan on Android only (iOS reads only QR from photos); lookup = saved products first, then Open Food Facts API v2 (User-Agent Kalorie/<version>); found products cached as `custom_foods` kind `product` with serving / pack / ml units (migration 0004), so they work offline and join Recent, Favourites and the day's totals; *Add from label* per 100 g / 100 ml / serving with an optional label photo; offline scans wait in `barcode_queue` and the Pending lookups card on Today; *Incomplete data* tag on foods missing most vitamins/minerals; About screen with data credits ("Food data from Open Food Facts (ODbL)"); expo-camera + expo-image-picker added; 504 tests pass.
2026-09-28 — Stage 7a Recipes, oil, thalis — oil control uses each INDB dish's own oil/ghee from `recipe_ingredients` (already in foods.db, no rebuild), as a per-portion step so only kcal and fats move (5 g per 150 g fallback for `cooked_with_fat` foods); Less · Normal · More on the Add / Edit sheet; recipe builder with servings, optional cooked weight (enables katori), per serving + per 100 g, oil/ghee flagged by itself, edit + duplicate + swipe to delete; recipes and products in search with a "My recipe" / "Product" tag; My foods + Thalis tabs in Add food; *Save as thali* on meal cards, checklist logging in one batch with one Undo; `recipe_items`, `my_thalis`, `my_thali_items` (migration 0005); fixed recents/favourites opening a product as a foods.db food; 559 tests pass.
2026-09-28 — Audit of Stages 1–7 — leftovers closed: starter thalis + slot starter foods in foods.db (db_version 4, existing tables unchanged), personal-use search ranking, 30-day purge, Recently deleted on the Log tab, Add to log sheet straight from Add food, a delete-only sheet for entries whose food is gone; licences: INDB (no stated licence) and IFCT (© ICMR-NIN) added to the Stage 12 permission list, About cites INDB and USDA ARS; redundancy: duplicated recipe oil step, nutrient picking, pill buttons, Profile rows and Today/Log sheets shared, unused code and strings removed; SPEC/PLAN/SOURCES brought in line with the code; 574 tests pass.
2026-09-28 — Stage 8 History, weight, water — Trends tab = Calendar · Week · Month: calendar days coloured on target / a bit under or over / further from target / partly logged (today only once it looks finished), legend and month line, tap → the day read-only in the Today layout with Edit → Log tab; Week/Month calories bars with dashed per-day target, macro averages + lines, weight dots + 10% EMA trend + weekly change (add today/yesterday, edit, delete), water bars vs goal; − / + water row on Today (long-press + for ml), goal and glass in Goals; `water_logs` (migration 0006); charts drawn with react-native-svg (gifted-charts' bar chart needs a gradient library); query-plan test for the day index; 633 tests pass.
2026-09-28 — Stage 9 Micronutrients — Vitamins & minerals screen from Today, a past day and Trends: Day · 7-day · 30-day average (logged days only, today once it looks finished), three groups with bars towards the ICMR-NIN need or the Goals limit (fibre, sodium, sugar, sat fat), "≈ · At least this · based on X of Y foods" when foods lack data or quick adds exist, "No data" instead of 0%, calm TUL note (not magnesium); tap → no-data foods, top 3 sources today, 5 good sources from a hand-picked `common_foods` list (db_version 5), vegetarian first with the new Profile → *I eat* (`diet_preference`); foods.db: vitamin A with ICMR 6:1 / 12:1, IFCT fish B6 + biotin ÷ 1000, plant (and INDB) vitamin D unknown; 668 tests pass.
2026-09-28 — Stage 10a Habits — forgiving streak (`src/lib/streak.ts`: 2 free days per Mon–Sun week, a miss counts only inside the run) as a small line on Today with an explainer sheet, nothing at 0; weekly check-in card from Monday until ✕ (days logged, average vs target, best day, weight trend, one suggestion: the trusted nutrient furthest under 75% of its need with 2 `common_foods` ideas, else water, else keep going; fewer than 3 days → log a few more), feeling saved to `weekly_checkins` (migration 0007); reminders with expo-notifications, local only, so Expo Go is enough: meal nudges skipped once that meal is logged, evening pending-scans nudge, max 3 a day, re-planned 7 days ahead on every change, tap → Add food for that meal; off by default, on at onboarding's last step or Profile → Reminders (day-3 offer card dropped); 739 tests pass.
2026-09-28 — Stage 10b Comfort — hide numbers (Profile → Numbers): ring words from SPEC §8.3, the same words on macro, Trends and vitamin bars, no kcal/grams/% on Today, Log, Add food, search, portion sheet, thalis, recipes, check-in, limits card + notification, Trends (weight as direction) or the food screen; CSV export (Profile → Export CSV): 7/30/90 days, everything or picked dates, 4 files shared one at a time (`src/lib/csv.ts`, `src/lib/export.ts`), expo-sharing added; full Hindi UI (`hi.json`, Profile → Language, Hindi calendars) with a key/placeholder test; accessibility first pass (44 pt calendar days, 48 dp text links, capped big numbers, 4-column hour grid at large text, 2-line amounts); banned-word test over both languages; 774 tests pass.
2026-09-28 — Stage 11a Accounts — optional sign-in with an emailed code (Profile → Account), sign out on this phone, *Delete my account and data* (`delete_my_account()`, cascades; phone data stays), Privacy screen; @supabase/supabase-js added, session in expo-secure-store in pieces; keys only in `.env` (secret key refused); 13 Postgres tables mirroring user.db with one *Only your own rows* RLS policy each (`supabase/migrations/`), `supabase/tests/rls.test.sql` proves A can't touch B's rows; a test keeps the SQL in step with user.db; nothing uploaded until 11b; 861 tests pass.
2026-09-28 — Stage 11c Groups — Profile → My group: start (group name + your name) or join with a 6-character code (no 0 O 1 I L; spaces and small letters fine; 10 wrong codes an hour), send the code, make a new one, people, shared foods, leave (the last one out ends the group); *Share with my group* switch on your own recipes and products, sent now or next time online (`shared_at`, `planShareUploads`); group foods kept in `custom_foods` (`shared_food_id`, `added_by`, migration 0008) so search (Group tag, "Shared by Asha"), logging and totals work offline, out of My foods/Recipes, not editable; flags (Calories · Other nutrients · Name or brand · Something else + note), *Mark as fixed* for the sharer; Supabase `groups`, `group_members`, `shared_foods`, `shared_food_flags` + 4 functions with RLS, proven by `rls.test.sql` step 4 (4 people, 17 loosened rules all caught); Privacy screen says what a group sees; `TextField` shared by Account and My group; 930 tests pass.
