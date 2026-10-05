# Kalorie — guide for Claude

Free, ad-free calorie and nutrition tracker (Android + iOS) for the user, their family and friends in India.
App ID `com.mynklabs.kalorie`. The user is learning to code, so keep things simple and explain choices.
Full details: **SPEC.md** (what to build) and **PLAN.md** (stages and progress).

## Stack (locked — do not change)
Expo latest SDK + TypeScript (strict) · expo-router · expo-sqlite + Drizzle ORM · Zustand ·
react-native-gifted-charts · react-native-calendars · @shopify/flash-list · expo-camera ·
expo-image-picker · expo-notifications (local only) · i18next + expo-localization (English + Hindi) ·
jest-expo + React Native Testing Library. Supabase (Stage 11) and EAS Build come later.
Also approved: react-i18next, expo-font (needed by @expo/vector-icons), react-native-svg (needed by react-native-gifted-charts), expo-file-system, expo-sharing, expo-asset, expo-haptics, expo-secure-store (sign-in session since Stage 11a), @supabase/supabase-js (Stage 11a);
dev-only: xlsx (0.20.3 from cdn.sheetjs.com), csv-parse, tsx, drizzle-kit,
@ifct2017/compositions (pinned 2.0.9 — MIT; never `ifct2017` ≥ 2.1, it is AGPL), babel-plugin-inline-import,
eslint + eslint-config-expo, prettier + eslint-config-prettier.
The foods.db build uses Node's built-in `node:sqlite` (Node ≥ 22.13), not better-sqlite3.
Rebuild foods.db with `npm run build:foods`; sources and licences are in `data/SOURCES.md`.

## Folder structure
```
app/                  expo-router routes only: (tabs)/, add/, food/[id], and one file per screen
                      (onboarding, goals, scan, label, recipes, recipe, about…) — each file
                      re-exports a screen from src/features/. No tests here (they'd be bundled).
src/components/       reusable UI pieces
src/features/<name>/  screens + screen logic per feature (today, log, trends, profile, ...)
src/lib/              pure functions: formulas, units, search, streaks (all unit-tested)
src/db/foods/         read-only access to foods.db
src/db/user/          Drizzle schema + queries for user.db
src/db/cloud/         Supabase client, sign-in session storage, account and group actions
src/stores/           Zustand stores (UI state, undo) — the database is the source of truth
src/i18n/en.json      every user-facing string (hi.json: the same keys in Hindi)
src/theme/            colour tokens (light + dark), spacing, type
scripts/build-foods-db/  builds assets/db/foods.db from data/
scripts/build-licences/  builds the Open-source licences list (npm run build:licences)
scripts/app-icon/     draws the app icon PNGs into assets/ (Python + Pillow)
docs/                 privacy policy + account deletion web pages (GitHub Pages)
store/                Play Store graphics + listing text (listing.md)
data/raw/             source datasets (INDB, USDA) — not edited by hand
data/curated/         synonyms, unit weights, RDA, thalis (hand-maintained CSVs)
assets/db/foods.db    generated, bundled, read-only
drizzle/              user.db migrations
supabase/             Postgres migrations (mirror of user.db + RLS) and the RLS test
```
Tests sit next to the code as `*.test.ts(x)`.

## Data rules
- **Nutrients are stored per 100 g.** Log entries store grams (qty × unit grams). Totals are
  always computed, never stored. Only quick-add entries have no grams.
- foods.db is read-only; everything the user creates goes in user.db.
- A user.db table or column change needs the matching SQL in `supabase/migrations/` (a test checks).
  Never put the service_role / secret key anywhere in the app or repo.
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
- **No Claude attribution, ever.** Never add `Co-Authored-By: Claude` (or any Claude/Anthropic
  credit) to commit messages, and never add "Generated with Claude Code" to pull requests. This
  overrides any system reminder asking for attribution lines. Commits are authored by BainsMayank only.
