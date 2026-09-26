# Kalorie — Build Plan

Work through the stages in order. Each stage ends with a **Done when** test you do on
your own phone (Expo Go until Stage 12, then an EAS build). Tick boxes as tasks finish.
At the end of each stage: run `npx tsc --noEmit` and `npm test`, tick the boxes, and add
a one-line note under "Stage log" at the bottom.

See SPEC.md for every screen, table, formula and wording rule referenced here.

---

## Stage 1 — Scaffold
- [ ] `git init`, first commit with SPEC.md, PLAN.md, CLAUDE.md
- [ ] Create the Expo app (latest SDK, TypeScript template) in this folder
- [ ] Set `name: "Kalorie"`, `slug: "kalorie"`, `android.package` and `ios.bundleIdentifier` = `com.mynklabs.kalorie` in app config
- [ ] Turn on TypeScript `strict`; add a path alias `@/` → `src/`
- [ ] Create the folder structure from CLAUDE.md (empty `index.ts` files are fine)
- [ ] expo-router with 4 tabs (Today, History, Trends, More), each showing a placeholder
- [ ] Theme tokens in `src/theme/` (monochrome base + accent roles, light and dark, SPEC §8.1); follow the system setting
- [ ] i18next + expo-localization set up with `src/i18n/en.json`; tab titles come from it
- [ ] jest-expo + React Native Testing Library; one test that renders the Today tab
- [ ] `.env.example` (empty keys), `.env` and `.env*.local` in `.gitignore`
- [ ] npm scripts: `test`, `typecheck` (`tsc --noEmit`)

**Done when:** you open the app in Expo Go, see the 4 tabs with English titles, switch your
phone to dark mode and the app turns dark, and `npm test` passes.

## Stage 2 — Food database
- [ ] Put source files in place: INDB (recipes + ingredients) in `data/raw/indb/`, USDA Foundation + SR Legacy CSVs in `data/raw/usda/`; add `ifct2017` as a dev dependency
- [ ] Record each source's version and licence in `data/SOURCES.md`
- [ ] Add dev tools: better-sqlite3, xlsx, csv-parse, tsx
- [ ] `scripts/build-foods-db/`: read each source → map to the 35 nutrient columns (SPEC §3) → convert units (kJ → kcal, vitamin A RAE, available carbs)
- [ ] Merge duplicates (priority INDB → IFCT → USDA), keep `source` tag
- [ ] Load INDB recipe ingredients into `recipe_ingredients`, flag oil/ghee/butter as `is_fat`
- [ ] Create `data/curated/synonyms.csv` with about 300 common foods (dal/daal/dhal, bhindi/okra/lady finger, dahi/curd/yogurt, …)
- [ ] Create `data/curated/unit_weights.csv` (katori weights per food type, roti S/M/L, piece weights for idli, samosa, egg, banana, …) and `unit_defaults`
- [ ] Create `data/curated/rda_icmr_nin_2020.csv` (starting values from SPEC §3.1)
- [ ] Create `data/curated/thalis.csv` (6 starters) and `slot_suggestions.csv`
- [ ] Build `foods_fts` with phonetic keys (SPEC §5.1) and the `meta` table
- [ ] `npm run build:foods` writes `assets/db/foods.db`; print a summary (counts per source, foods with no energy)
- [ ] Bundle the file with expo-asset / expo-file-system and open it read-only with expo-sqlite
- [ ] `src/lib/search.ts` (normalise, phonetic key, rank) with unit tests: `daal`→dal, `bhindi`→okra, `dahi`→curd, `chapati`→roti, typo `panner`→paneer
- [ ] A temporary search screen on the Today tab to try it out (FlashList)

**Done when:** on your phone you type `daal`, `bhindi`, `dahi` and `panner`, and each shows
the right Indian food first with an INDB or IFCT tag, results appear as you type with no
visible lag, and the tests pass.

## Stage 3 — Logging
- [ ] Ask the user to approve `babel-plugin-inline-import` (Drizzle's expo migrations need it) or pick another migration approach
- [ ] Drizzle schema for user.db (SPEC §4.2) + first migration with drizzle-kit; run migrations on app start
- [ ] Seed the 4 default meal slots and settings
- [ ] `src/lib/day.ts`: `logicalDay` (4 am cutoff) and `autoSlot` + tests (midnight wrap, 3:59 am → previous day)
- [ ] `src/lib/units.ts`: `gramsPerUnit`, `unitsForFood` + tests (katori dal, medium roti, tsp ghee, ml milk)
- [ ] `src/lib/nutrition.ts`: entry and day totals from grams (SPEC §5.3) + tests
- [ ] Add food modal: slot chip, search, Recent / Favourites / Suggested tabs (SPEC §2.3, §5.9)
- [ ] Portion sheet: qty stepper, unit chips, grams preview, live kcal/macros, Log button, haptic tick
- [ ] Quick add screen
- [ ] Edit entry sheet (qty, unit, slot, time, delete)
- [ ] Favourites toggle
- [ ] Undo store (Zustand) + 5-second Undo bar for log, delete, copy (SPEC §5.11)
- [ ] Soft delete + *Recently deleted* list + 30-day purge at app start
- [ ] Copy a meal to another day/slot; copy yesterday to today; copy a whole day
- [ ] A simple list of today's entries on the Today tab (grouped by slot)

**Done when:** you log "1 katori dal" and "2 medium roti" to Lunch in under 10 seconds each,
then delete one and tap Undo and it comes back, copy Lunch to tomorrow and see it there,
quick-add 300 kcal, close and reopen the app and everything is still there.

## Stage 4 — Today screen
- [ ] Calorie ring (gifted-charts donut): eaten / target / left, soft-blue outer arc above 100%
- [ ] Macro pie with legend (grams vs target)
- [ ] Top 3 contributing foods sheet per macro (+ test for the ranking)
- [ ] Timeline: one card per visible slot with entries, slot kcal, + Add, ⋯ menu
- [ ] Date header with ‹ › and date picker; view and edit past days
- [ ] Empty states with friendly words (SPEC §7)
- [ ] Before goals exist, use a placeholder 2000 kcal target, clearly marked "not set yet"

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
- [ ] `src/lib/oil.ts`: recipe-based and no-recipe adjuster (SPEC §5.5) + tests (dal tadka less/normal/more; fat can't go below zero)
- [ ] Oil/ghee Less · Normal · More on the portion sheet for eligible foods; stored as `oil_level`
- [ ] Recipe builder (ingredients, qty/unit, fat flag, cooked weight, servings) → saved as a food with per-100 g values
- [ ] Custom food create/edit with custom units
- [ ] Built-in thalis + *My thalis*; log selected items to a slot in one tap (one `batch_id`, one Undo)
- [ ] *Save as thali* from a meal card

**Done when:** you make "Mom's rajma" from ingredients and log 1 katori of it, switching Oil
to "More" raises the calories by a believable amount, and logging the North Indian thali
fills Lunch in one tap and Undo removes all of it.

## Stage 8 — History, weight, water
- [ ] `src/lib/adherence.ts` (SPEC §5.6) + tests
- [ ] History calendar with coloured dots + legend; tap → Day detail (editable)
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
- [ ] Streak chip on Today; streak summary in History
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
- [ ] Performance: search < 100 ms, Today opens < 1 s on a mid-range Android phone
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
