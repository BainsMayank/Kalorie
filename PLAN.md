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
*Stage 2a (foods.db build) done 2026-09-26; Stage 2b food search done 2026-09-27. Still open: thalis + slot suggestions.*
- [x] Put source files in place: INDB (`data/raw/Anuvaad_INDB_2024.11.xlsx`), USDA Foundation + SR Legacy CSV folders in `data/raw/`; IFCT from `@ifct2017/compositions@2.0.9` (MIT — `ifct2017` ≥ 2.1 is AGPL)
- [x] Record each source's version and licence in `data/SOURCES.md`
- [x] Add dev tools: xlsx (0.20.3, SheetJS CDN), csv-parse, tsx — Node's built-in `node:sqlite` replaces better-sqlite3
- [x] `scripts/build-foods-db/`: read each source → map to the 35 nutrient columns (SPEC §3) → convert units (kJ → kcal, vitamin A RAE, available carbs)
- [x] Merge duplicates (priority INDB → IFCT → USDA), keep `source` tag — exact-name matching of same-kind foods + `data/curated/duplicates.csv`
- [x] Load INDB recipe ingredients into `recipe_ingredients`, flag oil/ghee/butter as `is_fat` — from `data/raw/recipes.xlsx`; Anuvaad's own ingredient codes linked via `data/curated/indb_ingredients.csv` (98% of rows)
- [x] Create `data/curated/synonyms.csv` (591 terms in 157 groups: dal/daal/dhal, bhindi/okra/lady finger, dahi/curd/yogurt, …) — plus IFCT Hindi/regional names and INDB Hindi names automatically
- [x] Create `data/curated/unit_weights.csv` (roti S/M/L, piece weights for egg, banana, …), `category_units.csv` (units + density per category), `densities.csv`, and `unit_defaults`
- [x] Create `data/curated/rda_icmr_nin_2020.csv` (starting values from SPEC §3.1)
- [x] Fix INDB outliers (2026-09-27): frying oil cut to the 15% the food soaks up (126 dishes — dahi vada 1,150 → 176 kcal per vada), egg-boiling/steaming water taken out (boiled egg 45 → 132 kcal/100 g), servings shrink with their recipe, piece counts for gulab jamun + chhena sweets in `data/curated/indb_servings.csv`, unbelievable servings dropped (105, listed in the build report)
- [ ] Create `data/curated/thalis.csv` (6 starters) and `slot_suggestions.csv` (tables exist in foods.db, empty for now)
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
- [ ] Rest of the Drizzle schema for user.db (SPEC §4.2) + a new migration (`npm run db:generate`); the migration runner and `settings` table already exist from Stage 1 — *`meal_slots` + `log_entries` done in Stage 3a (migration `0001_log_entries`); the other tables come with their features*
- [x] Seed the 4 default meal slots (at every app start, keeping user changes) — default settings already come from the settings store
- [x] `src/lib/day.ts`: `logicalDay` (4 am cutoff) and `autoSlot` + tests (midnight wrap, 3:59 am → previous day), plus `timeOnDay`, `defaultEntryMinute`
- [x] `src/lib/units.ts`: `gramsPerUnit`, `entryGrams`, `stepQuantity` + tests for every unit type (katori, glass, cup, tsp, tbsp, ml, g, roti S/M/L, piece, slice, bowl) — units per food are read by `getFoodDetail`
- [x] `src/lib/nutrition.ts`: `entryNutrients` (food and quick add) and `sumNutrients` for meal/day totals (SPEC §5.3) + tests
- [x] Add food: slot chips, search, *Often at {slot}* suggestions + Recent / Favourites tabs with one-tap ⊕ (SPEC §2.3, §5.9) — `src/lib/suggestions.ts` + tests; still a pushed screen (modal later); My foods / Thalis tabs come with Stage 7
- [ ] Portion sheet: qty stepper, unit chips, grams preview, live kcal/macros, Log button, haptic tick — *done as the "Add to log" sheet on the food screen (Stage 3a) with the haptic tick (Stage 3b, expo-haptics); still to do: open it straight from search*
- [x] Quick add (kcal + optional protein/carbs/fat + label, meal, time); edit it from the Log tab
- [x] Edit entry sheet (qty, unit, slot, time, delete) — tap an entry in the Log tab
- [x] Favourites toggle (☆ on search results, suggestion/recent rows and the food screen; `favourites` table, migration 0002)
- [x] Undo store (Zustand) + 5-second Undo bar for log, delete, copy (SPEC §5.11)
- [ ] Soft delete + *Recently deleted* list + 30-day purge at app start — *soft delete done in Stage 3a (swipe left → Delete, or Delete in the Edit sheet)*
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
- [ ] `src/lib/targets.ts`: BMR, TDEE, pace, rounding, floor, macros (SPEC §5.4) + tests with worked examples (male, female, not stated, under-floor case)
- [ ] Onboarding flow, 5 screens (SPEC §2.1), ft/in ↔ cm, under-18 path, Skip → Just track
- [ ] Save `profile` and first `targets` row; save onboarding weight to `weights`
- [ ] Goals screen: recalculate, edit each target (new `targets` row from today), limits
- [ ] Floor warning (onboarding step 5 + Goals), never blocking
- [ ] `src/lib/alerts.ts`: sodium, sugar, sat fat, fat at 100% (SPEC §6) + tests
- [ ] One combined soft-amber alert card on Today, dismiss for the day, per-alert toggles
- [ ] Just-track mode: Today shows eaten only, no targets

**Done when:** a friend installs the app and finishes onboarding in under 60 seconds with a
timer, their calorie target matches a hand calculation, setting 1000 kcal shows the gentle
floor warning, and logging 3 packets of namkeen shows the calm sodium card (no red).

## Stage 6 — Barcode
- [ ] Barcode screen with expo-camera, torch, frame; permission prompt with a friendly reason
- [ ] Manual code entry
- [ ] Gallery scan with expo-image-picker + `scanFromURLAsync`; check iOS barcode support and hide on iOS if it only reads QR
- [ ] `src/lib/off.ts`: fetch + map OFF nutriments to SPEC §3 columns (+ tests with saved sample JSON)
- [ ] Cache found products in `custom_foods` (kind `product`); local cache checked first
- [ ] Add-from-label form (per 100 g / 100 ml / per serving → stored per 100 g) + test for the conversion
- [ ] Offline queue (`barcode_queue`), "Pending lookups" card, retry on open/reconnect
- [ ] OFF attribution in About

**Done when:** you scan a Parle-G or Maggi packet and it's found and logged, scan the same
packet in airplane mode and it still works (cached), scan an unknown code offline and it
waits in the Pending card and is looked up when you're back online, and typing a code by
hand works.

## Stage 7 — Recipes, oil adjuster, thalis
- [ ] `src/lib/oil.ts`: recipe-based and no-recipe adjuster (SPEC §5.5) + tests (dal tadka less/normal/more; fat can't go below zero) — *recipe-based `oilAdjustedPer100` done in Stage 2a (used by the build report); no-recipe path still to do*
- [ ] Oil/ghee Less · Normal · More on the portion sheet for eligible foods; stored as `oil_level`
- [ ] Recipe builder (ingredients, qty/unit, fat flag, cooked weight, servings) → saved as a food with per-100 g values
- [ ] Cooked weights for INDB dishes that lose water while cooking (INDB's per-100 g is per raw weight): dry fried snacks (sev, banana chips, murukku), chhena sweets (the milk's whey), dals; also mark the unlabelled frying oil in Fish orly and Mango malpua
- [ ] Custom food create/edit with custom units
- [ ] Built-in thalis + *My thalis*; log selected items to a slot in one tap (one `batch_id`, one Undo)
- [ ] *Save as thali* from a meal card

**Done when:** you make "Mom's rajma" from ingredients and log 1 katori of it, switching Oil
to "More" raises the calories by a believable amount, and logging the North Indian thali
fills Lunch in one tap and Undo removes all of it.

## Stage 8 — Log calendar, weight, water
- [ ] `src/lib/adherence.ts` (SPEC §5.6) + tests
- [ ] Log tab: calendar with coloured dots + legend; tap a day → that day's timeline (editable) — *the editable day timeline and a plain date picker (react-native-calendars) are done in Stage 3a*
- [ ] Trends tab: Week/Month calories bars with target line, macro averages
- [ ] Weight: add/edit, `src/lib/trend.ts` EMA (SPEC §5.7) + tests, line chart with dots + trend line
- [ ] Water: +1 glass on Today, custom ml, glass/goal settings, bar chart in Trends
- [ ] Targets use the row in effect on each past day

**Done when:** after a week of use the calendar shows green/blue/grey days (never red), you
enter 5 weights that bounce up and down and the trend line stays smooth, and tapping
+1 glass 8 times fills today's water goal.

## Stage 9 — Micronutrients
- [ ] Check every RDA/TUL in `rda_icmr_nin_2020.csv` against the official ICMR-NIN 2020 report (and the vitamin A conversion factor); fix values and rebuild foods.db
- [ ] `src/lib/micros.ts`: % RDA, coverage, incomplete, above TUL, week average (SPEC §5.10) + tests
- [ ] Micronutrients screen: vitamins / minerals / other, bars, ≈ marker, TUL note
- [ ] Tap a nutrient → top 3 foods
- [ ] Link from Trends (week average)

**Done when:** after logging a normal day, the screen lists all vitamins and minerals, iron
shows a sensible % for your sex, a USDA-only or quick-add-heavy day shows the "some foods
missing data" marker, and nothing is coloured red.

## Stage 10 — Low-burden features
- [ ] `src/lib/streak.ts`: forgiving streak with 2 free days per Mon–Sun week (SPEC §5.7) + tests (3rd miss ends it, today not yet logged doesn't break it)
- [ ] Streak chip on Today; streak summary in Log
- [ ] Hide-numbers mode everywhere (SPEC §8.3), including word bands on the ring
- [ ] Weekly check-in card (SPEC §8.4)
- [ ] Time-of-day suggestions scoring polished (SPEC §5.9)
- [ ] Reminders: offer card after day 3, scheduling + cancel-when-logged (SPEC §5.12)
- [ ] CSV export: 4 files via expo-sharing (SPEC §5.14)
- [ ] Meal slot editor: rename, reorder, hide, add custom, time windows
- [ ] Wording pass over `en.json` against SPEC §7 (banned-word test that scans en.json)

**Done when:** turning on hide-numbers leaves no calorie or gram number anywhere, skipping
2 days in a week keeps your streak, a reminder arrives at lunch only if you haven't logged
lunch, and the CSV files open correctly in Google Sheets.

## Stage 11 — Accounts and sync
- [ ] Ask the user to approve `@supabase/supabase-js` (and any session-storage helper it needs)
- [ ] Create the Supabase project; put URL and anon key in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), never in code
- [ ] Tables + Row Level Security from SPEC §4.3 (SQL saved in `supabase/migrations/`)
- [ ] Email one-time-code sign in / sign out (optional; the app works fully without an account)
- [ ] Backup: export user.db to JSON → Supabase Storage; list backups; restore on a new phone
- [ ] Groups: create group, 6-character invite code, join, leave
- [ ] Shared foods: share a custom food/product to the group; group foods appear in search with a "Group" tag
- [ ] Test RLS: a second account can't read your backups

**Done when:** you back up on your phone, sign in on a second phone and restore, and see
the same history; a family member joins with your invite code and finds the custom food
you shared.

## Stage 12 — Polish and release
- [ ] Add expo-secure-store; Open Food Facts account in Settings; *Also share with Open Food Facts* toggle on the label form
- [ ] App icon, splash screen, monochrome design pass in light and dark
- [ ] Accessibility: screen-reader labels, font scaling, 48 dp targets, contrast check
- [ ] Performance: search < 100 ms, Today opens < 1 s on a mid-range Android phone — *on a Mac (Node) searches take 1–25 ms; the first typo search reads the word list once*
- [ ] Error handling: no crashes offline, friendly messages
- [ ] Confirm data licences in `data/SOURCES.md`; About screen credits
- [ ] Privacy policy page (data stays on the phone unless you sign in)
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
