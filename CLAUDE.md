# Kalorie — guide for Claude

Free, ad-free calorie and nutrition tracker (Android + iOS) for the user, their family and friends in India.
App ID `com.mynklabs.kalorie`. The user is learning to code, so keep things simple and explain choices.
Full details: **SPEC.md** (what to build) and **PLAN.md** (stages and progress).

## Stack (locked — do not change)
Expo latest SDK + TypeScript (strict) · expo-router · expo-sqlite + Drizzle ORM · Zustand ·
react-native-gifted-charts · react-native-calendars · @shopify/flash-list · expo-camera ·
expo-image-picker · expo-notifications (local only) · i18next + expo-localization (English only) ·
jest-expo + React Native Testing Library. Supabase (Stage 11) and EAS Build come later.
Also approved: expo-file-system, expo-sharing, expo-asset, expo-haptics, expo-secure-store (Stage 12);
dev-only: better-sqlite3, xlsx, csv-parse, tsx, drizzle-kit.

## Folder structure
```
app/                  expo-router screens: (onboarding)/, (tabs)/, add/, modals
src/components/       reusable UI pieces
src/features/<name>/  screen logic per feature (logging, search, goals, history, ...)
src/lib/              pure functions: formulas, units, search, streaks (all unit-tested)
src/db/foods/         read-only access to foods.db
src/db/user/          Drizzle schema + queries for user.db
src/stores/           Zustand stores (UI state, undo) — the database is the source of truth
src/i18n/en.json      every user-facing string
src/theme/            colour tokens (light + dark), spacing, type
scripts/build-foods-db/  builds assets/db/foods.db from data/
data/raw/             source datasets (INDB, USDA) — not edited by hand
data/curated/         synonyms, unit weights, RDA, thalis (hand-maintained CSVs)
assets/db/foods.db    generated, bundled, read-only
drizzle/              user.db migrations
```
Tests sit next to the code as `*.test.ts(x)`.

## Data rules
- **Nutrients are stored per 100 g.** Log entries store grams (qty × unit grams). Totals are
  always computed, never stored. Only quick-add entries have no grams.
- foods.db is read-only; everything the user creates goes in user.db.
- `NULL` nutrient = unknown, not zero. A "day" starts at 4 am.
- Soft delete (`deleted_at`) for user rows; UUID `id`s for anything that will sync.

## Design and wording rules
- Monochrome base; accent colours only where they mean something; **never red for "over"**.
- No guilt words (see SPEC §7). All text goes through i18next, never written in components.

## Working rules
- Run `npx tsc --noEmit` and `npm test` before saying a task is done. Report failures honestly.
- Update PLAN.md at the end of each stage (tick boxes, add a Stage log line).
- Never hard-code keys or secrets; use `.env` and keep it in `.gitignore`. Commit `.env.example` only.
- Ask before adding any library not in the stack.
- Put formulas in `src/lib/` as pure functions with tests before using them in screens.
- Follow SPEC.md; if something in it seems wrong or unclear, ask instead of guessing.
- Explain what you did in plain words at the end: what changed, why, and how to try it on the phone.
